#!/usr/bin/env bash
#
# Backup de Forge OS: base de datos y archivos subidos.
#
#   ./scripts/backup.sh                    # usa los valores por defecto
#   DB=/ruta/forge.db DEST=/ruta ./scripts/backup.sh
#   BACKUP_REMOTE=forge-backup:mi-bucket ./scripts/backup.sh
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

# A dónde se copia fuera de la máquina.
#
# En Google Cloud Storage —y en S3, y en B2— **la primera parte de la ruta es el
# nombre del bucket**, no una carpeta. `forge-backup:forge-os` no significa «la
# carpeta forge-os de mi almacenamiento», significa «el bucket forge-os», y si
# no existe la copia falla en silencio para quien no lea el error.
#
# Por eso va en una variable: el nombre del bucket lo elige quien instala, y
# aquí no se puede adivinar. Se pone en /etc/forge-os.env junto al resto.
# El destino puede venir del entorno o del fichero de configuración. Lo segundo
# es lo que hace que le llegue al temporizador de systemd, que no hereda nada.
# `-r` porque /etc/forge-os.env es de root: cuando el script corre como `forge`
# —desde el despliegue— sencillamente no lo lee y se queda con el valor de por
# defecto, en vez de fallar.
if [[ -z ${BACKUP_REMOTE:-} && -r /etc/forge-os.env ]]; then
    BACKUP_REMOTE="$(grep -E '^BACKUP_REMOTE=' /etc/forge-os.env | tail -1 | cut -d= -f2- | tr -d "\"' ")"
fi
REMOTO="${BACKUP_REMOTE:-forge-backup:forge-os}"

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
#
# Un backup en el mismo disco no protege del escenario que importa: que la VM o
# su disco desaparezcan.
#
# `copy` y **no** `sync`. Es la diferencia entre una copia de seguridad y un
# espejo, y aquí importa mucho:
#
#   - `sync` deja el destino idéntico al origen, así que **borra en el bucket lo
#     que ya no está aquí**. La rotación local de 30 días se propagaría, y el
#     bucket no guardaría nada más antiguo que el disco que intenta proteger.
#   - Peor: si alguien entra en la máquina y borra `/var/backups`, el siguiente
#     `sync` vacía el bucket. El backup moriría con el servidor, que es
#     exactamente lo que no puede pasar.
#
# `copy` solo añade. La retención del bucket se decide **en el bucket**, con una
# regla de ciclo de vida (ver deploy/README.md), donde esta máquina no manda.
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q "^${REMOTO%%:*}:"; then
    # El error de rclone **se enseña**. Antes iba a /dev/null con `--quiet`, así
    # que un bucket mal escrito o sin permisos daba exactamente el mismo aspecto
    # que una copia correcta: nada. Un backup que falla en silencio es peor que
    # no tener backup, porque encima da tranquilidad.
    if rclone copy "$DEST" "$REMOTO" --quiet; then
        echo "copiado a $REMOTO"
    else
        # Código 3, y no 1, a propósito.
        #
        # La copia **local** sí se ha hecho: es la que protege del escenario que
        # motiva el backup previo a un despliegue —una migración que sale mal—,
        # y bloquear el despliegue por un fallo del bucket empujaría a
        # desactivar la comprobación entera, que es mucho peor.
        #
        # Pero tampoco puede pasar desapercibido: con un código distinto de
        # cero, systemd marca el temporizador como fallido y se ve en
        # `systemctl status forge-backup`. Un backup fuera de la máquina que
        # falla en silencio es peor que no tenerlo, porque da tranquilidad.
        echo "error: rclone no ha podido copiar a $REMOTO — la copia solo existe en esta máquina" >&2
        exit 3
    fi
else
    echo "aviso: rclone sin configurar — el backup solo existe en esta máquina" >&2
fi
