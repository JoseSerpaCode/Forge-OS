import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * El script que cierra 80/443 a todo lo que no sea Cloudflare.
 *
 * Se prueba porque falló en producción, y falló de la peor manera: **borró las
 * reglas antiguas y murió antes de poner las nuevas**. En una máquina con la
 * política por defecto en «denegar», eso es el sitio caído; con «permitir», es
 * el servidor abierto de par en par. Las dos cosas en silencio.
 *
 * La causa era tonta: el fichero de rangos IPv4 de Cloudflare **no termina en
 * salto de línea**, así que `cat v4 v6` pegaba el último rango IPv4 con el
 * primero IPv6 —`131.0.72.0/222400:cb00::/32`— y ufw respondía «Bad source
 * address». Los dos ficheros por separado pasaban la validación; lo que nadie
 * validaba era lo que de verdad se le pasaba a ufw.
 *
 * Aquí se ejecuta el script de verdad contra un `ufw` de mentira que apunta lo
 * que le piden y rechaza direcciones inválidas igual que el real.
 */

let tmp: string;
const SCRIPT = path.join(process.cwd(), 'scripts', 'cloudflare-firewall.sh');

/** Un `ufw` que registra lo que le mandan y se queja de lo que el real rechaza. */
const UFW_FALSO = `#!/usr/bin/env bash
case "$1 $2" in
  "status numbered")
    printf '%s\\n' "Status: active" \\
      "[ 1] 22/tcp                     ALLOW IN    Anywhere" \\
      "[ 2] 80/tcp                     ALLOW IN    Anywhere" \\
      "[ 3] 443/tcp                    ALLOW IN    Anywhere" \\
      "[ 4] 80                         ALLOW IN    173.245.48.0/20"
    exit 0;;
esac
[[ "$1" == "status" ]] && { echo "Status: active"; exit 0; }
if [[ "$1" == "allow" && "$2" == "from" ]]; then
  cidr="$3"
  if ! [[ $cidr =~ ^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$ || $cidr =~ ^[0-9a-fA-F:]+/[0-9]{1,3}$ ]]; then
    echo "ERROR: Bad source address" >&2; exit 1
  fi
  echo "ALLOW $cidr" >> "$FWLOG"; exit 0
fi
echo "CMD $*" >> "$FWLOG"; exit 0
`;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-fw-'));
  fs.mkdirSync(path.join(tmp, 'bin'));

  fs.writeFileSync(path.join(tmp, 'bin', 'ufw'), UFW_FALSO, { mode: 0o755 });
  fs.writeFileSync(path.join(tmp, 'bin', 'yes'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });

  // El script exige root. Para la prueba se cambia esa única línea; lo demás se
  // ejecuta tal cual, que es de lo que se trata.
  const original = fs.readFileSync(SCRIPT, 'utf8');
  fs.writeFileSync(path.join(tmp, 'script.sh'), original.replace(/^\[\[ \$EUID -eq 0.*$/m, 'true'));
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** Ejecuta el script contra unos rangos dados. */
function ejecutar(v4: string, v6: string) {
  const log = path.join(tmp, `log-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(log, '');
  fs.writeFileSync(path.join(tmp, 'v4'), v4);
  fs.writeFileSync(path.join(tmp, 'v6'), v6);

  let salida = '';
  let ok = true;
  try {
    salida = execFileSync('bash', [path.join(tmp, 'script.sh')], {
      env: {
        ...process.env,
        PATH: `${path.join(tmp, 'bin')}:${process.env.PATH}`,
        FWLOG: log,
        CF_V4_URL: `file://${path.join(tmp, 'v4')}`,
        CF_V6_URL: `file://${path.join(tmp, 'v6')}`,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: any) {
    ok = false;
    salida = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  return { ok, salida, acciones: fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) };
}

// Quince y siete, como los publica Cloudflare de verdad.
const V4 = Array.from({ length: 15 }, (_, i) => `10.${i}.0.0/16`).join('\n');
const V6 = Array.from({ length: 7 }, (_, i) => `2400:cb0${i}::/32`).join('\n');

describe('cortafuegos de Cloudflare', () => {
  it('el fichero sin salto de línea final no pega dos rangos en uno', () => {
    // Es exactamente lo que publica Cloudflare, y lo que rompió producción.
    const r = ejecutar(V4, V6); // V4 va sin '\n' al final

    expect(r.ok, r.salida).toBe(true);
    const permitidos = r.acciones.filter((a) => a.startsWith('ALLOW'));
    // 22 rangos × 2 puertos.
    expect(permitidos).toHaveLength(44);
    // Y ninguno es el engendro de dos pegados.
    expect(permitidos.some((a) => a.includes('/162400'))).toBe(false);
  });

  it('pone las reglas nuevas ANTES de quitar las viejas', () => {
    const r = ejecutar(V4, V6);
    const primerBorrado = r.acciones.findIndex((a) => a.startsWith('CMD delete'));
    const ultimoAllow = r.acciones.map((a) => a.startsWith('ALLOW')).lastIndexOf(true);

    // El orden es lo que impide quedarse sin ninguna de las dos si algo falla
    // a mitad. Al revés, un error deja el servidor abierto o inalcanzable.
    expect(primerBorrado).toBeGreaterThan(ultimoAllow);
  });

  it('solo quita las reglas que abrían a todo el mundo', () => {
    const r = ejecutar(V4, V6);
    const borrados = r.acciones.filter((a) => a.startsWith('CMD delete'));

    // De la lista falsa, la 2 (80/tcp Anywhere) y la 3 (443/tcp Anywhere).
    // **No** la 1, que es SSH, ni la 4, que es una de Cloudflare.
    expect(borrados.sort()).toEqual(['CMD delete 2', 'CMD delete 3']);
  });

  it('abre SSH antes que nada', () => {
    const r = ejecutar(V4, V6);
    expect(r.acciones[0]).toContain('22/tcp');
  });

  it('no toca nada si la lista trae algo que no es un CIDR', () => {
    const r = ejecutar(`${V4}\nesto-no-es-una-ip`, V6);

    expect(r.ok).toBe(false);
    expect(r.salida).toContain('no es un CIDR');
    // Ni una sola regla: prefiere no hacer nada a hacer algo a medias.
    expect(r.acciones.filter((a) => a.startsWith('ALLOW'))).toHaveLength(0);
    expect(r.acciones.filter((a) => a.startsWith('CMD delete'))).toHaveLength(0);
  });

  it('no toca nada si la descarga viene truncada', () => {
    // Aplicar media lista deja fuera a la mayor parte del CDN: el sitio caído
    // para casi todo el mundo.
    const r = ejecutar('10.0.0.0/16\n10.1.0.0/16', V6);

    expect(r.ok).toBe(false);
    expect(r.salida).toMatch(/rangos IPv4/);
    expect(r.acciones.filter((a) => a.startsWith('CMD delete'))).toHaveLength(0);
  });

  it('--check no cambia nada', () => {
    const log = path.join(tmp, 'log-check');
    fs.writeFileSync(log, '');
    fs.writeFileSync(path.join(tmp, 'v4'), V4);
    fs.writeFileSync(path.join(tmp, 'v6'), V6);

    const salida = execFileSync('bash', [path.join(tmp, 'script.sh'), '--check'], {
      env: {
        ...process.env,
        PATH: `${path.join(tmp, 'bin')}:${process.env.PATH}`,
        FWLOG: log,
        CF_V4_URL: `file://${path.join(tmp, 'v4')}`,
        CF_V6_URL: `file://${path.join(tmp, 'v6')}`,
      },
      encoding: 'utf8',
    });

    expect(salida).toContain('no cambia nada');
    expect(fs.readFileSync(log, 'utf8').trim()).toBe('');
  });
});
