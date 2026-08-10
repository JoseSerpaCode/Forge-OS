# Desplegar Forge OS

VM propia con disco persistente, Caddy delante y systemd manteniendo el proceso.
Forge OS usa SQLite sobre un archivo, así que necesita un disco que sobreviva a
los reinicios — eso descarta las plataformas serverless.

Probado sobre **Ubuntu 24.04 LTS** en una `e2-micro` del tier gratuito de GCP
(1 GB de RAM, 30 GB de disco). Sirve igual en cualquier VM equivalente.

## Antes de empezar: los dos límites que importan

**Egress, no RAM.** El tier gratuito de GCP incluye **1 GB de tráfico de salida
al mes**. Con ~196 KB de JS+CSS comprimidos por visita nueva, eso son del orden
de **5.000 visitas mensuales** antes de que empiece a facturar, y lo hace sin
avisar. Por eso la sección de Cloudflare no es opcional: mueve los assets
estáticos al CDN y saca la mayor parte del tráfico de la cuenta de Google.

Configura además una **alerta de presupuesto a 0 €** en la consola de GCP.

**Memoria.** Medido en este proyecto:

| Paso | Pico de RAM |
|---|---|
| `npm ci` | 744 MB |
| `npm run build` | 492 MB |

Con 1 GB y ~200 MB de sistema, `npm ci` va al límite. El swap lo resuelve.
`better-sqlite3` **no** compila: trae binarios precompilados para linux-x64 y
linux-arm64, así que ese paso no es el problema — el pico viene de npm y de los
tres `esbuild` del árbol de dependencias.

---

## 1. Preparar la VM

Región obligatoria para que la VM sea gratis: `us-west1`, `us-central1` o
`us-east1`. En cualquier otra, se factura.

```sh
# Swap: cubre el pico de npm ci y evita que un pico puntual mate el proceso
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Node 26 y sqlite3 (lo necesita el script de backup)
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3
```

## 2. Usuario y directorios

La aplicación corre sin privilegios y **los datos viven fuera del directorio de
despliegue**. Es lo que impide que un despliegue descuidado borre la base de
datos y los archivos subidos, que a diferencia del código no se reconstruyen.

```sh
sudo useradd --system --home /opt/forge-os --shell /usr/sbin/nologin forge
sudo mkdir -p /opt/forge-os /var/lib/forge-os/storage /var/backups/forge-os
sudo chown -R forge:forge /opt/forge-os /var/lib/forge-os /var/backups/forge-os
```

## 3. Código y configuración

```sh
sudo -u forge git clone https://github.com/JoseSerpaCode/Forge-OS.git /opt/forge-os
cd /opt/forge-os
sudo -u forge npm ci --omit=dev     # las dependencias de desarrollo pesan ~39 MB y no hacen falta
sudo -u forge npm run build
```

> `npm run build` necesita las dependencias de desarrollo. Si `--omit=dev` deja
> el build sin herramientas, haz `npm ci` completo, construye, y luego
> `npm prune --omit=dev` para quitarlas.

Configuración y secretos en `/etc/forge-os.env`, **fuera del repositorio**:

```sh
sudo tee /etc/forge-os.env > /dev/null <<'EOF'
NODE_ENV=production
PORT=4321
PUBLIC_SITE_URL=https://forge-os.online
DATABASE_URL=/var/lib/forge-os/forge.db
STORAGE_DIR=/var/lib/forge-os/storage
EOF
sudo chmod 600 /etc/forge-os.env
```

`PUBLIC_SITE_URL` no es cosmética: sin ella la app se anuncia como
`localhost:4321` en la URL canónica y en las etiquetas OpenGraph, aunque esté
sirviendo el dominio real.

## 4. systemd

```sh
sudo cp deploy/forge-os.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now forge-os
sudo systemctl status forge-os
```

## 5. Caddy

**Antes de arrancarlo**, el registro A de `forge-os.online` (en Porkbun) debe
apuntar a la IP pública de la VM. Si no, el reto de Let's Encrypt falla.

```sh
sudo apt-get install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

El certificado se emite y se renueva solo.

## 6. Cloudflare

Cambia los nameservers de Porkbun a los de Cloudflare y activa el proxy (nube
naranja) en el registro A.

Una regla de caché, imprescindible:

- **`forge-os.online/api/*` → Bypass de caché.**

`/api/storage/` sirve archivos **después** de comprobar permisos. La respuesta
ya viaja con `Cache-Control: private`, pero la regla es defensa en profundidad:
aunque una cabecera se rompiera, el CDN nunca guardaría un archivo privado.

Los assets de `/_astro/*` llevan hash en el nombre y se sirven con
`max-age=31536000, immutable`: Cloudflare los cachea y dejan de contar como
egress de Google.

## 7. Backups

```sh
sudo cp scripts/backup.sh /usr/local/bin/forge-backup
sudo chmod +x /usr/local/bin/forge-backup

sudo tee /etc/systemd/system/forge-backup.service > /dev/null <<'EOF'
[Unit]
Description=Backup de Forge OS
[Service]
Type=oneshot
User=forge
ExecStart=/usr/local/bin/forge-backup
EOF

sudo tee /etc/systemd/system/forge-backup.timer > /dev/null <<'EOF'
[Unit]
Description=Backup diario de Forge OS
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo systemctl enable --now forge-backup.timer
```

**Saca las copias de la máquina.** Un backup en el mismo disco no protege del
escenario que importa: que la VM desaparezca. Backblaze B2 da 10 GB gratis:

```sh
rclone config      # crea un remoto llamado exactamente "forge-backup"
```

El script lo detecta y sincroniza solo. Si no está configurado, avisa por stderr.

### Restaurar

```sh
sudo systemctl stop forge-os
gunzip -c /var/backups/forge-os/forge-AAAAMMDD-HHMMSS.db.gz > /tmp/restore.db
sqlite3 /tmp/restore.db "PRAGMA integrity_check;"   # debe decir: ok
sudo -u forge cp /tmp/restore.db /var/lib/forge-os/forge.db
sudo systemctl start forge-os
```

**Prueba esto una vez, ahora, con la instalación recién hecha.** Un backup que
nunca se ha restaurado no es un backup: es un archivo del que no sabes nada.

## Actualizar

```sh
sudo /opt/forge-os/scripts/deploy.sh
```

Eso es todo. El script hace copia de la base, aparta el `dist/` actual, trae los
cambios, instala, construye, reinicia y **comprueba que la aplicación responde**
antes de dar el despliegue por bueno. Si algo falla en cualquier punto, vuelve
solo al commit anterior y deja el servicio corriendo la versión que funcionaba.

Los datos no se tocan: viven en `/var/lib/forge-os`.

### Por qué no la cadena a mano

La secuencia `git pull && npm ci && npm run build && systemctl restart` tiene
dos agujeros que no se ven hasta que muerden:

- **`npm run build` vacía `dist/` antes de construir.** Un fallo de compilación
  deja sin ficheros a la instancia que estaba sirviendo bien. El script se lleva
  una copia de `dist/` antes de empezar y la repone si el build cae.
- **Que systemd arranque el proceso no significa que la aplicación funcione.**
  El servicio se da por bueno mientras el proceso no muera, aunque no sirva una
  sola página. El script consulta `/healthz`, que hace una lectura real contra
  SQLite, y si no contesta `ok` en 60 segundos deshace el despliegue.

Variables que acepta, por si el entorno no es el de esta guía:
`APP_DIR`, `APP_USER`, `SERVICE`, `ENV_FILE`, `BACKUP_CMD`, `HEALTH_TIMEOUT`.

### Comprobar la salud a mano

```sh
curl -s localhost:4321/healthz     # → ok
```

Devuelve `503` con el motivo si el proceso está en pie pero no puede leer la
base. Si la base **falta**, el proceso ni siquiera arranca, y eso también lo
detecta el script (la petición no llega a conectar).

## Comprobar que salió bien

```sh
# La URL canónica muestra el dominio real, no localhost
curl -s https://forge-os.online | grep -E 'canonical|og:url'

# Los assets se cachean un año; en la segunda petición, cf-cache-status: HIT
curl -sI https://forge-os.online/_astro/<algún-asset>.js | grep -iE 'cache-control|cf-cache'

# La API nunca se cachea en capas compartidas
curl -sI https://forge-os.online/api/storage/<archivo> | grep -i cache-control   # private

# Sobrevive a un reinicio
sudo reboot && sleep 45 && curl -sI https://forge-os.online | head -1
```
