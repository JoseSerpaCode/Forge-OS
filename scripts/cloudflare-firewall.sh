#!/usr/bin/env bash
#
# Deja los puertos 80 y 443 abiertos **solo a las redes de Cloudflare**.
#
# Hoy la VM acepta tráfico directo a su IP pública. Quien la conozca —y sale en
# los registros de certificados, en escaneos de rango y en cualquier DNS
# histórico— se salta el CDN entero: el WAF, la caché y, sobre todo, el límite
# por IP, que va sobre `CF-Connecting-IP`. Sin esa cabecera el limitador agrupa
# a todo el mundo bajo la misma clave.
#
# También evita que alguien sirva el sitio por HTTP plano contra la IP y se
# salte la redirección a HTTPS.
#
# Uso, en la VM y como root:
#
#   sudo /opt/forge-os/scripts/cloudflare-firewall.sh          # aplica
#   sudo /opt/forge-os/scripts/cloudflare-firewall.sh --check  # solo enseña
#
# Cloudflare cambia sus rangos de vez en cuando, así que conviene dejarlo en un
# temporizador semanal (ver deploy/README.md).
#
set -Eeuo pipefail

CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

log() { printf '\033[1;33m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() {
    printf '\033[1;31m✗\033[0m %s\n' "$*" >&2
    exit 1
}

[[ $EUID -eq 0 || $CHECK_ONLY -eq 1 ]] || die "Hay que ejecutarlo como root. Prueba: sudo $0"
command -v ufw &>/dev/null || die "Falta ufw (sudo apt-get install -y ufw)"
command -v curl &>/dev/null || die "Falta curl"

# ── Traer los rangos ─────────────────────────────────────────────────────────
#
# Se descargan a un temporal y se validan **antes** de tocar el cortafuegos. Una
# descarga a medias o una página de error de Cloudflare escrita directamente
# sobre las reglas dejaría el servidor sin nadie que pueda entrar.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log "Descargando los rangos publicados por Cloudflare…"
curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4 -o "$TMP/v4" || die "No he podido descargar los rangos IPv4"
curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6 -o "$TMP/v6" || die "No he podido descargar los rangos IPv6"

# Cada línea tiene que ser un CIDR. Si algo no lo es, la lista no sirve.
grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$' "$TMP/v4" || die "La lista IPv4 no parece una lista de CIDR"
if grep -vE '^[0-9a-fA-F:]+/[0-9]+$' "$TMP/v6" | grep -q .; then
    die "La lista IPv6 trae líneas que no son CIDR"
fi

V4_COUNT=$(grep -c . "$TMP/v4")
V6_COUNT=$(grep -c . "$TMP/v6")

# Cloudflare publica ~15 rangos v4 y ~7 v6. Un número muy bajo significa que la
# descarga vino truncada, y aplicarla dejaría fuera a la mayor parte del CDN
# —es decir, el sitio caído para casi todo el mundo.
[[ $V4_COUNT -ge 10 ]] || die "Solo $V4_COUNT rangos IPv4; esperaba al menos 10. No aplico nada."
[[ $V6_COUNT -ge 4 ]] || die "Solo $V6_COUNT rangos IPv6; esperaba al menos 4. No aplico nada."

ok "$V4_COUNT rangos IPv4 y $V6_COUNT IPv6"

if [[ $CHECK_ONLY -eq 1 ]]; then
    echo
    echo "Se permitiría 80/443 desde:"
    sed 's/^/  /' "$TMP/v4" "$TMP/v6"
    echo
    echo "(--check no cambia nada)"
    exit 0
fi

# ── Aplicar ──────────────────────────────────────────────────────────────────
#
# SSH primero y siempre. Si el script muriera a mitad, la regla que importa ya
# está puesta: quedarse fuera de la propia máquina en un proveedor sin consola
# serie significa reinstalar.
log "Asegurando el acceso por SSH…"
ufw allow 22/tcp comment 'SSH' >/dev/null
ok "SSH permitido"

log "Retirando las reglas anteriores de 80/443…"
# `ufw status numbered` y borrar por número es frágil: los números cambian con
# cada borrado. Se recorre la lista al revés para que los que quedan no se
# muevan bajo los pies.
mapfile -t RULE_NUMS < <(ufw status numbered | grep -E '\[[ 0-9]+\].*(80|443)' | grep -oE '^\[[ 0-9]+\]' | tr -d '[] ' | sort -rn)
for n in "${RULE_NUMS[@]:-}"; do
    [[ -n $n ]] && yes | ufw delete "$n" >/dev/null 2>&1 || true
done

log "Permitiendo 80 y 443 solo desde Cloudflare…"
while read -r cidr; do
    [[ -z $cidr ]] && continue
    ufw allow from "$cidr" to any port 80 proto tcp comment 'Cloudflare' >/dev/null
    ufw allow from "$cidr" to any port 443 proto tcp comment 'Cloudflare' >/dev/null
done < <(cat "$TMP/v4" "$TMP/v6")

# `default deny incoming` es lo que hace que todo lo anterior signifique algo:
# sin ello, las reglas «allow» son redundantes y cualquier otro origen entra.
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null

if ! ufw status | grep -q "Status: active"; then
    log "Activando ufw…"
    # --force evita la pregunta interactiva, que colgaría el script.
    ufw --force enable >/dev/null
fi

ufw reload >/dev/null
ok "Cortafuegos aplicado"

echo
ufw status verbose | head -20
echo
cat <<'EOF'
Comprueba desde fuera que la IP directa ya no responde y el dominio sí:

  curl -sS --max-time 5 -o /dev/null -w '%{http_code}\n' http://<IP-DE-LA-VM>/   # debe fallar o agotar el tiempo
  curl -sS --max-time 5 -o /dev/null -w '%{http_code}\n' https://forge-os.online/ # debe dar 200

Si el dominio deja de responder, el proxy de Cloudflare (la nube naranja) está
desactivado en el registro A: actívalo o vuelve a abrir 80/443 con
`sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`.
EOF
