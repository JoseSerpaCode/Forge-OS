#!/usr/bin/env bash
#
# Despliegue de Forge OS con vuelta atrás automática.
#
# Sustituye a la cadena manual `git pull && npm ci && npm run build &&
# systemctl restart`, que tiene tres problemas que este script resuelve:
#
#   1. `npm run build` **vacía dist/ antes de construir**. Si el build falla, la
#      aplicación en marcha se queda sin los trozos que Astro carga a demanda,
#      así que un fallo de compilación tumba una instancia que estaba sana.
#   2. Arrancar el proceso no es lo mismo que funcionar. systemd da el servicio
#      por bueno en cuanto el proceso no muere, aunque no sirva una sola página.
#   3. Al pegarla en una terminal la cadena se corta y deja el despliegue a
#      medias — pasó dos veces.
#
# Uso, en la VM y como root:   sudo /opt/forge-os/scripts/deploy.sh
#
# `-E` es necesario para que la trampa ERR también se dispare dentro de
# funciones; sin ella un fallo en `rollback` o en `run_as_app` pasaría de largo.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/forge-os}"
APP_USER="${APP_USER:-forge}"
SERVICE="${SERVICE:-forge-os}"
ENV_FILE="${ENV_FILE:-/etc/forge-os.env}"
BACKUP_CMD="${BACKUP_CMD:-/usr/local/bin/forge-backup}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"

log() { printf '\033[1;33m▸\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
die() {
    printf '\033[1;31m✗\033[0m %s\n' "$*" >&2
    exit 1
}

# ── Correr desde una copia, no desde el repositorio ──────────────────────────
#
# Este script vive **dentro** del repositorio que él mismo actualiza. Bash lee
# el fichero a medida que lo ejecuta, así que un `git pull` que lo reescriba a
# mitad puede dejarlo leyendo desde un desplazamiento que ya no significa lo
# mismo. Es raro, silencioso y difícil de reproducir.
#
# Hay una consecuencia menos exótica y más molesta: **un arreglo en este script
# no se aplica al despliegue que lo trae**, sino al siguiente. Pasó con el
# refresco de /usr/local/bin, que se quedó sin hacer justo el día que hacía
# falta.
#
# La solución es sacarse una copia y ejecutarla desde ahí. `FORGE_DEPLOY_COPIA`
# corta la recursión: el que ya corre desde la copia no vuelve a copiarse.
if [[ -z ${FORGE_DEPLOY_COPIA:-} ]]; then
    COPIA="$(mktemp /tmp/forge-deploy-XXXXXX.sh)"
    cat "${BASH_SOURCE[0]}" > "$COPIA"
    export FORGE_DEPLOY_COPIA="$COPIA"
    # El nombre real, para que los mensajes no digan «prueba: sudo
    # /tmp/forge-deploy-XXXX.sh», que no le sirve a nadie.
    export FORGE_DEPLOY_ORIGEN="${BASH_SOURCE[0]}"
    exec bash "$COPIA" "$@"
fi
# Ya corriendo desde la copia: se borra al salir, termine bien o mal.
trap 'rm -f "$FORGE_DEPLOY_COPIA"' EXIT

# ── Comprobaciones previas ───────────────────────────────────────────────────
# Todas antes de tocar nada: es preferible negarse a empezar que abortar con el
# despliegue a medio hacer.
[[ $EUID -eq 0 ]] || die "Hay que ejecutarlo como root (necesita systemctl). Prueba: sudo ${FORGE_DEPLOY_ORIGEN:-$0}"
[[ -d $APP_DIR/.git ]] || die "No encuentro un repositorio en $APP_DIR"
[[ -f $ENV_FILE ]] || die "Falta $ENV_FILE"
id "$APP_USER" &>/dev/null || die "No existe el usuario $APP_USER"
command -v git &>/dev/null || die "Falta git"
command -v npm &>/dev/null || die "Falta npm"
command -v curl &>/dev/null || die "Falta curl (lo necesita la comprobación de salud)"

# Un solo despliegue a la vez. Dos a la vez se pisarían el dist/ y el
# node_modules, y el segundo dejaría el primero irreconocible.
exec 9>/var/lock/forge-deploy.lock
flock -n 9 || die "Ya hay un despliegue en marcha"

# El puerto sale del fichero de entorno, que es el que manda: si el healthcheck
# apuntara a otro sitio, comprobaría un servicio que no es este.
PORT="$(grep -E '^PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"'"'"' ')"
PORT="${PORT:-4321}"
HEALTH_URL="http://127.0.0.1:${PORT}/healthz"

# PUBLIC_SITE_URL hay que pasarsela explicitamente al build (ver mas abajo).
PUBLIC_SITE_URL="$(grep -E '^PUBLIC_SITE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d "\"' ")"
[[ -n $PUBLIC_SITE_URL ]] || die "Falta PUBLIC_SITE_URL en $ENV_FILE. Sin ella la aplicacion se anuncia como localhost."

cd "$APP_DIR"

run_as_app() { sudo -u "$APP_USER" "$@"; }

# ── Punto de retorno ─────────────────────────────────────────────────────────
PREV_COMMIT="$(run_as_app git rev-parse HEAD)"
log "Versión actual: $(run_as_app git log -1 --format='%h %s' | head -c 70)"

# Copia de la base antes de nada. Un despliegue puede traer migraciones, y las
# migraciones son lo único de este proceso que no se deshace con un git reset.
if [[ -x $BACKUP_CMD ]]; then
    log "Copia de seguridad de la base…"
    run_as_app "$BACKUP_CMD" || die "El backup falló. No sigo: desplegar sin copia previa es apostar la base de datos."
    ok "Copia hecha"
else
    printf '\033[1;31m!\033[0m %s\n' "No encuentro $BACKUP_CMD — se despliega SIN copia previa." >&2
    printf '  %s\n' "Instálalo con: sudo cp scripts/backup.sh $BACKUP_CMD && sudo chmod +x $BACKUP_CMD" >&2
fi

# dist/ se aparta en lugar de dejar que el build lo borre. Es un `mv` dentro del
# mismo sistema de ficheros, así que cuesta lo mismo con 1 MB que con 100.
DIST_BACKUP=""
if [[ -d dist ]]; then
    DIST_BACKUP="$APP_DIR/.dist-prev"
    rm -rf "$DIST_BACKUP"
    run_as_app cp -a dist "$DIST_BACKUP"
fi

# `rm -rf ""` no es inocuo: devuelve error, y con `set -e` eso aborta el
# despliegue justo al terminar bien. Pasa siempre que no hubiera un dist/ previo.
# Va como función y no como `[[ -n X ]] && rm …` porque esa forma también
# devuelve 1 cuando la condición es falsa, con el mismo resultado.
drop_dist_backup() {
    if [[ -n $DIST_BACKUP ]]; then
        rm -rf "$DIST_BACKUP"
    fi
}

rollback() {
    printf '\033[1;31m✗\033[0m %s\n' "Despliegue fallido — volviendo a $PREV_COMMIT" >&2
    run_as_app git reset --hard "$PREV_COMMIT" >/dev/null 2>&1 || true
    if [[ -n $DIST_BACKUP && -d $DIST_BACKUP ]]; then
        rm -rf "$APP_DIR/dist"
        run_as_app mv "$DIST_BACKUP" "$APP_DIR/dist"
    fi
    # Las dependencias también vuelven: el package-lock del commit anterior puede
    # no coincidir con lo que dejó el npm ci que acaba de correr.
    run_as_app npm ci >/dev/null 2>&1 || true
    systemctl restart "$SERVICE" || true
    die "Vuelta atrás completada. El servicio corre la versión anterior."
}
trap 'rollback' ERR

# ── Desplegar ────────────────────────────────────────────────────────────────
#
# `npm ci` deja a veces `package-lock.json` tocado —reordena, o ajusta una
# resolución— y entonces `git pull` se niega: «Your local changes would be
# overwritten by merge». El despliegue se para en seco por un fichero que ni
# siquiera se edita a mano aquí, y que además va a quedar exactamente como diga
# el repositorio en cuanto el pull entre.
#
# Se restauran solo **los ficheros que npm toca**, y no un `reset --hard` a
# secas: eso borraría también cualquier cambio que alguien hubiera hecho a mano
# en la máquina, que es justamente lo que sí conviene que pare el despliegue.
for tocado in package-lock.json package.json; do
    if ! run_as_app git diff --quiet -- "$tocado" 2>/dev/null; then
        log "Descartando cambios locales en $tocado (los deja npm)"
        run_as_app git checkout -- "$tocado"
    fi
done

# Lo que quede sucio sí es cosa de una persona. Se dice cuál, en vez de dejar
# que git lo cuente a su manera en mitad de un pull.
sucios="$(run_as_app git status --porcelain --untracked-files=no || true)"
if [[ -n $sucios ]]; then
    printf '%s\n' "$sucios" >&2
    die "Hay cambios locales sin guardar en $APP_DIR. Revísalos antes de desplegar."
fi

log "Trayendo cambios…"
run_as_app git pull --ff-only

if [[ "$(run_as_app git rev-parse HEAD)" == "$PREV_COMMIT" ]]; then
    trap - ERR
    drop_dist_backup
    ok "No hay nada nuevo. Servicio intacto."
    exit 0
fi

log "Instalando dependencias…"
# `npm ci` completo y no `--omit=dev`: el build necesita Astro, Vite y Tailwind,
# que son dependencias de desarrollo. Podarlas después ahorra ~39 MB de un disco
# de 30 GB y arriesga dejar sin un módulo al proceso en marcha; no compensa.
run_as_app npm ci

log "Construyendo…"
# El build se hace **con el fichero de entorno cargado**, no sin el.
#
# Astro hornea `site` --de donde salen la URL canonica y las etiquetas
# OpenGraph-- en tiempo de compilacion, leyendo PUBLIC_SITE_URL. `sudo -u forge`
# arranca un entorno limpio que no incluye /etc/forge-os.env, asi que sin esto
# el build se quedaba con el valor por defecto y produccion servia
# `<link rel="canonical" href="http://localhost:4321/">`. Los buscadores
# descartan una canonica que apunta a un host que no existe, y con ella se va la
# indexacion entera del sitio.
run_as_app env "PUBLIC_SITE_URL=$PUBLIC_SITE_URL" NODE_ENV=production npm run build

# Comprobacion de que ha servido: si el bundle todavia menciona localhost como
# origen, la canonica saldra mal, y es mejor enterarse aqui que en Search
# Console tres semanas despues.
if grep -rqs 'createAstro("http://localhost' "$APP_DIR/dist/server/"; then
    # `rollback` y no `die`: `die` hace `exit`, que no dispara la trampa ERR, y
    # dejaria el dist/ nuevo en disco con el servicio corriendo el codigo viejo
    # --justo el escenario que la copia de dist/ existe para evitar.
    printf '\033[1;31m!\033[0m %s\n' "El build ha quedado con localhost como sitio publico. Revisa PUBLIC_SITE_URL en $ENV_FILE." >&2
    rollback
fi

log "Reiniciando el servicio…"
systemctl restart "$SERVICE"

# ── Comprobar que además de arrancar, sirve ──────────────────────────────────
log "Esperando a que responda (hasta ${HEALTH_TIMEOUT}s)…"
healthy=0
for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
    if curl -fsS --max-time 3 "$HEALTH_URL" | grep -qx 'ok'; then
        healthy=1
        break
    fi
    sleep 1
done

if [[ $healthy -ne 1 ]]; then
    printf '\033[1;31m!\033[0m %s\n' "$HEALTH_URL no responde 'ok'. Últimas líneas del servicio:" >&2
    journalctl -u "$SERVICE" -n 25 --no-pager >&2 || true
    rollback
fi

trap - ERR
drop_dist_backup

# ── Refrescar los scripts instalados ─────────────────────────────────────────
#
# `forge-backup` y `forge-cf-firewall` son **copias** en /usr/local/bin, no
# enlaces: los ejecutan temporizadores de systemd, que no saben nada del
# checkout. Sin esto, un arreglo en el repositorio nunca llega a lo que corre
# cada noche y cada semana — se despliega, se da por bueno, y el temporizador
# sigue ejecutando la versión rota durante meses.
#
# Solo se refresca lo que ya estaba instalado: si alguien decidió no usar el
# temporizador, este script no se lo instala por su cuenta.
for par in "backup.sh:forge-backup" "cloudflare-firewall.sh:forge-cf-firewall"; do
    origen="$APP_DIR/scripts/${par%%:*}"
    destino="/usr/local/bin/${par##*:}"
    if [[ -f $destino && -f $origen ]] && ! cmp -s "$origen" "$destino"; then
        install -m 755 "$origen" "$destino"
        log "Actualizado $destino"
    fi
done

ok "Desplegado: $(run_as_app git log -1 --format='%h %s' | head -c 70)"
ok "Servicio sano en $HEALTH_URL"
