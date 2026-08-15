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

## 7. Cerrar el paso directo a la VM

Con Cloudflare delante, la IP pública de la VM **sigue aceptando tráfico**. Y esa
IP no es un secreto: sale en los registros públicos de certificados, en el DNS
histórico del dominio y en cualquier escaneo de rangos de GCP.

Quien la conozca se salta el CDN entero: el WAF, la caché y —lo que más
importa— el límite por IP, que va sobre `CF-Connecting-IP`. Sin esa cabecera el
limitador mete a todo el mundo en la misma clave. También puede pedir el sitio
por HTTP plano contra la IP y esquivar la redirección a HTTPS.

```sh
sudo apt-get install -y ufw
sudo cp scripts/cloudflare-firewall.sh /usr/local/bin/forge-cf-firewall
sudo chmod +x /usr/local/bin/forge-cf-firewall

sudo forge-cf-firewall --check   # enseña qué haría, sin tocar nada
sudo forge-cf-firewall           # aplica
```

**Abre SSH lo primero**, antes que ninguna otra regla, y se niega a aplicar nada
si la descarga de rangos viene truncada o no parece una lista de CIDR. Quedarse
fuera de la propia máquina en un proveedor sin consola serie significa
reinstalar, así que prefiere no hacer nada a hacer algo a medias.

Cloudflare cambia sus rangos de vez en cuando. Un temporizador semanal los
mantiene al día:

```sh
sudo tee /etc/systemd/system/forge-cf-firewall.service > /dev/null <<'EOF'
[Unit]
Description=Sincronizar el cortafuegos con los rangos de Cloudflare
After=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/bin/forge-cf-firewall
EOF

sudo tee /etc/systemd/system/forge-cf-firewall.timer > /dev/null <<'EOF'
[Unit]
Description=Sincronizacion semanal de los rangos de Cloudflare
[Timer]
OnCalendar=weekly
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo systemctl enable --now forge-cf-firewall.timer
```

Comprueba desde fuera de la VM que la puerta quedó cerrada:

```sh
curl -sS --max-time 5 -o /dev/null -w '%{http_code}\n' http://<IP-DE-LA-VM>/    # debe agotar el tiempo
curl -sS --max-time 5 -o /dev/null -w '%{http_code}\n' https://forge-os.online/  # debe dar 200
```

> Si el dominio deja de responder, es que el proxy de Cloudflare (la nube
> naranja) no está activo en el registro A: el tráfico llega directo desde el
> visitante y ya no está permitido. Actívalo, o vuelve a abrir con
> `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`.

## 8. Entrar con Google y GitHub (opcional)

Los botones ya están en el formulario, pero **cada proveedor se activa solo si
tiene credenciales**. Sin ellas su ruta responde 404 y el botón sale
deshabilitado diciéndolo, así que puedes dejarlo para más adelante sin que nada
se rompa.

Registra la aplicación en cada consola y apunta el retorno **exactamente** a:

```
https://forge-os.online/api/auth/oauth/google/callback
https://forge-os.online/api/auth/oauth/github/callback
```

- Google → https://console.cloud.google.com/apis/credentials
  (Credenciales → Crear → ID de cliente de OAuth → Aplicación web)
- GitHub → https://github.com/settings/developers
  (New OAuth App → Authorization callback URL)

Los proveedores comparan esa URI carácter a carácter con la que envía la app,
que se construye sobre `PUBLIC_SITE_URL`. Si no coinciden —una barra de más, un
`www` de menos— rechazan la petición con `redirect_uri_mismatch`.

```sh
sudo tee -a /etc/forge-os.env > /dev/null <<'EOF'
SESSION_SECRET=PEGA_AQUI_EL_RESULTADO_DE_openssl_rand_hex_32
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
EOF
sudo systemctl restart forge-os
```

`SESSION_SECRET` firma el `state` de OAuth y el captcha del registro. Sin ella
se genera una clave nueva en cada arranque, y eso invalida los inicios de sesión
a medias y los formularios abiertos cada vez que reinicias el servicio.

## 9. Backups

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
escenario que importa: que la VM desaparezca.

```sh
sudo apt-get install -y rclone
sudo rclone config      # el remoto tiene que llamarse exactamente "forge-backup"
```

El script lo detecta solo. Si no está configurado, avisa por stderr en cada
copia — ese aviso sale en la salida de cada despliegue.

> **El remoto se configura como root**, porque el temporizador corre como root y
> `rclone` busca su configuración en el `HOME` de quien lo ejecuta. Un remoto
> creado con tu usuario existe para ti y no para el temporizador, y el aviso de
> «rclone sin configurar» seguiría saliendo sin que se entienda por qué.

**Y pon la retención en el bucket, no aquí.** El script usa `rclone copy`, que
solo añade: la rotación local de 30 días **no** se propaga, y si alguien entra
en la máquina y borra `/var/backups`, el bucket no se entera. Esa es la
diferencia entre una copia de seguridad y un espejo.

En Google Cloud Storage, una regla de ciclo de vida que borre lo que pase de 90
días:

```sh
cat > /tmp/ciclo.json <<'EOF'
{"lifecycle":{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}}
EOF
gcloud storage buckets update gs://TU-BUCKET --lifecycle-file=/tmp/ciclo.json
```

Si además puedes, activa el **bloqueo de objetos** o el versionado del bucket:
con eso, ni siquiera unas credenciales robadas de esta máquina podrían borrar
las copias antiguas.

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
