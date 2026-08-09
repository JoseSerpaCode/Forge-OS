#!/usr/bin/env bash
#
# Backup de Forge OS: base de datos y archivos subidos.
#
#   ./scripts/backup.sh                    # usa los valores por defecto
#   DB=/ruta/forge.db DEST=/ruta ./scripts/backup.sh
#
# Pensado para correr desde un timer de systemd (ver deploy/README.md).
#
# POR QUÉ NO `cp forge.db`
# ------------------------
# La base está en modo WAL: las escrituras recientes viven en forge.db-wal y
# aún no están en el archivo principal. Copiarlo con `cp` da, en el mejor caso,
# una copia sin los últimos cambios; en el peor, un archivo inconsistente si la
# app estaba escribiendo a mitad de la copia.
#
# `.backup` usa la API de backup en línea de SQLite: coge una instantánea
# coherente con la app funcionando, sin bloquear escrituras.

set -euo pipefail

DB="${DB:-/var/lib/forge-os/forge.db}"
STORAGE="${STORAGE:-/var/lib/forge-os/storage}"
DEST="${DEST:-/var/backups/forge-os}"
KEEP_DAYS="${KEEP_DAYS:-30}"

stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"

if [ ! -f "$DB" ]; then
    echo "error: no existe la base de datos: $DB" >&2
    exit 1
fi

# ── Base de datos ────────────────────────────────────────────────────────────
db_out="$DEST/forge-$stamp.db"
sqlite3 "$DB" ".backup '$db_out'"

# Un backup que no se verifica no es un backup. Si la copia está corrupta,
# mejor saberlo ahora que el día que haga falta restaurarla.
check=$(sqlite3 "$db_out" "PRAGMA integrity_check;")
if [ "$check" != "ok" ]; then
    echo "error: la copia no pasa integrity_check: $check" >&2
    rm -f "$db_out"
    exit 1
fi

gzip -f "$db_out"
echo "base de datos -> ${db_out}.gz ($(du -h "${db_out}.gz" | cut -f1))"

# ── Archivos subidos ─────────────────────────────────────────────────────────
# A diferencia del código, esto no se puede reconstruir: si se pierde, se perdió.
if [ -d "$STORAGE" ]; then
    storage_out="$DEST/storage-$stamp.tar.gz"
    tar -czf "$storage_out" -C "$(dirname "$STORAGE")" "$(basename "$STORAGE")"
    echo "archivos       -> $storage_out ($(du -h "$storage_out" | cut -f1))"
fi

# ── Rotación local ───────────────────────────────────────────────────────────
find "$DEST" -name 'forge-*.db.gz' -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'storage-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

# ── Copia fuera de la máquina ────────────────────────────────────────────────
# Un backup en el mismo disco no protege del escenario que importa: que la VM
# o su disco desaparezcan. Si rclone está configurado, sincroniza.
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q "^forge-backup:"; then
    rclone sync "$DEST" forge-backup:forge-os --quiet
    echo "sincronizado con forge-backup:"
else
    echo "aviso: rclone sin configurar — el backup solo existe en esta máquina" >&2
fi
