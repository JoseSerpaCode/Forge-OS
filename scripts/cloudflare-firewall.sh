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

# Las URL se pueden sustituir. Existe para poder probar el script contra
# ficheros locales sin salir a la red —incluidos los casos raros, como el
# fichero sin salto de línea final que rompió esto en producción.
V4_URL="${CF_V4_URL:-https://www.cloudflare.com/ips-v4}"
V6_URL="${CF_V6_URL:-https://www.cloudflare.com/ips-v6}"

log "Descargando los rangos publicados por Cloudflare…"
curl -fsS --max-time 20 "$V4_URL" -o "$TMP/v4" || die "No he podido descargar los rangos IPv4"
curl -fsS --max-time 20 "$V6_URL" -o "$TMP/v6" || die "No he podido descargar los rangos IPv6"

# Cada línea tiene que ser un CIDR. Si algo no lo es, la lista no sirve.
grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$' "$TMP/v4" || die "La lista IPv4 no parece una lista de CIDR"
if grep -vE '^[0-9a-fA-F:]+/[0-9]+$' "$TMP/v6" | grep -q .; then
    die "La lista IPv6 trae líneas que no son CIDR"
fi

# Una sola lista, con los saltos de línea puestos.
#
# `cat v4 v6` **no vale**: el fichero de Cloudflare termina sin salto de línea
# final, así que el último rango IPv4 sale pegado al primero IPv6
# —`131.0.72.0/222400:cb00::/32`— y ufw responde «Bad source address». Los dos
# ficheros por separado pasaban la validación; lo que fallaba era justo lo que
# se le pasaba a ufw, que es lo que hay que validar.
#
# `awk 1` imprime cada línea con su salto, venga como venga.
awk 1 "$TMP/v4" "$TMP/v6" > "$TMP/todos"

# Y ahora sí, se valida **la lista final**, línea por línea. Ninguna excusa: lo
# que no sea un CIDR no llega a ufw.
if grep -vE '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$|^[0-9a-fA-F:]+/[0-9]{1,3}$' "$TMP/todos" | grep -q .; then
    echo "Líneas que no son CIDR:" >&2
    grep -vE '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$|^[0-9a-fA-F:]+/[0-9]{1,3}$' "$TMP/todos" | sed 's/^/  /' >&2
    die "La lista combinada trae algo que no es un CIDR. No aplico nada."
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
    sed 's/^/  /' "$TMP/todos"
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

# ¿Sabe este ufw hablar IPv6?
#
# Si `IPV6=no` —o el kernel no tiene IPv6— cada `ufw allow from 2400:cb00::/32`
# responde «ERROR: Bad source address» y, con `set -e`, mata el script a mitad.
# Pasó exactamente eso: se quedó con las reglas viejas ya borradas y las nuevas
# a medio poner.
#
# Saltárselos es correcto **si la máquina no tiene IPv6 público**: no hay nada
# que filtrar por ahí. Pero si lo tiene, saltárselos deja esa puerta abierta, y
# eso hay que decirlo en voz alta, no esconderlo en un `|| true`.
IPV6_OK=1
if ! grep -qE '^IPV6=yes' /etc/default/ufw 2>/dev/null; then
    IPV6_OK=0
fi

if [[ $IPV6_OK -eq 0 ]]; then
    printf '\033[1;33m▸\033[0m %s\n' "ufw tiene IPv6 desactivado: se omiten los $V6_COUNT rangos IPv6"
    if ip -6 addr show scope global 2>/dev/null | grep -q 'inet6'; then
        printf '\033[1;31m✗\033[0m %s\n' "PERO esta máquina SÍ tiene IPv6 público: esa puerta se queda abierta." >&2
        printf '  %s\n' "Pon IPV6=yes en /etc/default/ufw y vuelve a ejecutarlo." >&2
    else
        printf '  %s\n' "Esta máquina no tiene IPv6 público, así que no hay nada que filtrar por ahí."
    fi
fi

# ── Primero poner, después quitar ────────────────────────────────────────────
#
# El orden importa más que cualquier otra cosa de este script. Antes se
# borraban las reglas viejas y luego se añadían las nuevas: si algo falla en
# medio —y falló—, el servidor se queda sin ninguna de las dos, que según la
# política por defecto significa abierto de par en par o inalcanzable.
#
# Añadir primero es seguro: durante unos segundos conviven las viejas (que
# permitían de más) con las nuevas. Permitir de más un momento es reversible;
# quedarse fuera de la máquina, no.
log "Permitiendo 80 y 443 solo desde Cloudflare…"
PUESTAS=0
# `|| [[ -n $cidr ]]` porque el último renglón de Cloudflare viene sin salto de
# línea final, y `read` a secas se lo deja fuera.
while read -r cidr || [[ -n $cidr ]]; do
    [[ -z $cidr ]] && continue
    [[ $cidr == *:* && $IPV6_OK -eq 0 ]] && continue

    if ! ufw allow from "$cidr" to any port 80 proto tcp comment 'Cloudflare' >/dev/null 2>&1 \
       || ! ufw allow from "$cidr" to any port 443 proto tcp comment 'Cloudflare' >/dev/null 2>&1; then
        die "ufw ha rechazado el rango $cidr. No se ha quitado ninguna regla anterior; el servidor sigue como estaba."
    fi
    PUESTAS=$((PUESTAS + 1))
done < "$TMP/todos"

[[ $PUESTAS -gt 0 ]] || die "No se ha añadido ningún rango. No toco nada más."
ok "$PUESTAS rangos permitidos"

log "Retirando las reglas que abrían 80/443 a todo el mundo…"
# Solo las **anchas**: las que permiten desde «Anywhere». Un patrón que mire
# únicamente el puerto borraría también las de Cloudflare que se acaban de
# poner, que llevan 80 y 443 igual.
#
# Se recorre al revés porque los números cambian con cada borrado, y borrar de
# arriba abajo desplaza a los que aún no se han tocado.
mapfile -t RULE_NUMS < <(
    ufw status numbered 2>/dev/null \
    | grep -E '^\[[ 0-9]+\].*\b(80|443)(/tcp)?\b.*ALLOW IN[[:space:]]+Anywhere' \
    | grep -oE '^\[[ 0-9]+\]' | tr -d '[] ' | sort -rn
)
for n in "${RULE_NUMS[@]:-}"; do
    [[ -n $n ]] && yes | ufw delete "$n" >/dev/null 2>&1 || true
done

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
