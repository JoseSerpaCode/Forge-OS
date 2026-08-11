// src/lib/automations.ts
import EventEmitter from 'events';
import dns from 'dns/promises';
import { Agent, fetch as undiciFetch } from 'undici';
import db from './db';
import crypto from 'crypto';

function isBlockedIP(ip: string): boolean {
  if (ip === '::1') return true;
  
  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:192.168.1.1)
  if (ip.toLowerCase().startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (ip.includes(':')) {
    const ipLower = ip.toLowerCase();
    if (ipLower.startsWith('fc') || ipLower.startsWith('fd') || ipLower.startsWith('fe80')) return true;
    return false;
  }
  
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;
  
  const [a, b] = parts;
  if (a === 127) return true; // Loopback
  if (a === 10) return true; // Private 10.x
  if (a === 172 && b >= 16 && b <= 31) return true; // Private 172.16.x - 172.31.x
  if (a === 192 && b === 168) return true; // Private 192.168.x
  if (a === 169 && b === 254) return true; // Cloud Metadata
  if (a === 0) return true; // 0.0.0.0
  
  return false;
}

export const ForgeEvents = new EventEmitter();

/**
 * Nombre canónico del único disparador que existe.
 *
 * Se exporta para que el endpoint y el formulario usen exactamente esta cadena.
 * El desacuerdo entre las tres partes es lo que hacía que ninguna regla llegara
 * nunca a ejecutarse: el formulario ofrecía `issue.moved`, el motor consultaba
 * `issue_status_changed`, y no había forma de que coincidieran.
 */
export const TRIGGER_ISSUE_STATUS_CHANGED = 'issue_status_changed';

/** Única acción implementada. `assign.user` y `add.label` nunca lo estuvieron. */
export const ACTION_WEBHOOK = 'webhook';

ForgeEvents.on('issue.status_changed', async ({ issueId, workspaceId, newStatus, userId }) => {
  // 1. Buscar reglas activas en el workspace
  const rules = db
    .prepare('SELECT * FROM automations WHERE workspace_id = ? AND trigger_type = ? AND is_active = 1')
    .all(workspaceId, TRIGGER_ISSUE_STATUS_CHANGED) as any[];

  for (const rule of rules) {
    // Una regla con la condición corrupta no puede tumbar el manejador entero:
    // se salta esa y las demás siguen.
    let condition: any;
    try {
      condition = JSON.parse(rule.trigger_condition);
    } catch {
      console.error('[SYS.AUTOMATION] Condición ilegible en la regla', rule.id);
      continue;
    }

    // 2. Evaluar Condición (ej. {"to_status": "done"})
    if (condition?.to_status === newStatus) {
      // Queda constancia de que la regla se ha disparado, **antes** de intentar
      // la acción.
      //
      // «¿Se ejecutó mi automatización?» es una pregunta que el usuario se hace
      // y que hasta ahora solo podía responder mirando los logs del servidor,
      // a los que no tiene acceso. El registro de actividad del espacio ya
      // existe y es donde lo va a buscar.
      try {
        db.prepare(
          'INSERT INTO audit_logs (id, workspace_id, user_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          workspaceId,
          // Quien movió el issue, no 'system': una automatización no ocurre
          // sola, la provoca una acción de alguien, y el registro de actividad
          // sirve para reconstruir qué pasó y por quién.
          userId,
          'AUTOMATION_FIRED',
          'automation',
          rule.id,
          JSON.stringify({ name: rule.name, issueId, newStatus })
        );
      } catch (err) {
        console.error('[SYS.AUTOMATION] No se pudo registrar el disparo', err);
      }

      // 3. Ejecutar Acción
      if (rule.action_type === ACTION_WEBHOOK) {
        let payloadConfig: any;
        try {
          payloadConfig = JSON.parse(rule.action_payload);
        } catch {
          console.error('[SYS.AUTOMATION] Carga ilegible en la regla', rule.id);
          continue;
        }
        // [M-5 FIX] Validate webhook URL to prevent SSRF attacks
        let webhookUrl: URL;
        try {
          webhookUrl = new URL(payloadConfig.url);
        } catch {
          console.error('[SYS.WEBHOOK] Invalid URL in automation config:', payloadConfig.url);
          continue;
        }
        // Only allow HTTPS and block private/loopback IPs
        if (webhookUrl.protocol !== 'https:') {
          console.error('[SYS.WEBHOOK] Webhook must use HTTPS:', payloadConfig.url);
          continue;
        }
        let resolvedIp: string;
        try {
          const lookup = await dns.lookup(webhookUrl.hostname);
          resolvedIp = lookup.address;
        } catch (err) {
          console.error('[SYS.WEBHOOK] DNS lookup failed:', webhookUrl.hostname);
          continue;
        }

        // Chequeo contra rangos privados post-resolución
        if (isBlockedIP(resolvedIp)) {
          console.error(`[SYS.WEBHOOK] Blocked SSRF attempt to private network (Resolved IP: ${resolvedIp}):`, payloadConfig.url);
          continue;
        }

        const pinnedAgent = new Agent({
          connect: {
            lookup: (lookupHostname, options, callback) => {
              // Forced pinned IP to prevent TOCTOU DNS Rebinding
              callback(null, [{ address: resolvedIp, family: resolvedIp.includes(':') ? 6 : 4 }]);
            }
          }
        });

        undiciFetch(webhookUrl.toString(), {
          method: 'POST',
          dispatcher: pinnedAgent,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'issue_completed', issueId })
        }).catch(err => console.error('[SYS.WEBHOOK] Fallo al emitir webhook', err));
      }
    }
  }
});
