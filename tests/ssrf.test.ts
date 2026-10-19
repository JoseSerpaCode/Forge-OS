import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForgeEvents } from '../src/lib/automations';
import db from '../src/lib/db';
import dns from 'dns/promises';
import { fetch as undiciFetch } from 'undici';

vi.mock('../src/lib/db', () => ({
  default: {
    prepare: vi.fn()
  }
}));

// El motor no se ejecuta con la función apagada (migración 51); aquí se mide
// la protección SSRF, así que se da por encendida.
vi.mock('../src/lib/funcionesEspacio', () => ({
  funciones: () => ({ sprints: false, tiempo: false, puntos: false, automatizaciones: true, auditoria: false }),
}));

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn()
  }
}));

vi.mock('undici', () => ({
  fetch: vi.fn(),
  Agent: vi.fn()
}));

describe('SSRF Protection in Automations', () => {
  let fetchSpy: any;
  let consoleSpy: any;

  beforeEach(() => {
    fetchSpy = (undiciFetch as any).mockResolvedValue(new Response());
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const runTrigger = async () => {
    await new Promise((resolve) => {
      ForgeEvents.emit('issue.status_changed', { issueId: 'test-1', workspaceId: 'ws-1', oldStatus: 'todo', newStatus: 'done' });
      setTimeout(resolve, 50);
    });
  };

  const setupMock = (url: string, resolvedIp: string) => {
    (db.prepare as any).mockReturnValue({
      all: () => [{
        trigger_condition: JSON.stringify({ to_status: 'done' }),
        action_type: 'webhook',
        action_payload: JSON.stringify({ url })
      }]
    });
    (dns.lookup as any).mockResolvedValue({ address: resolvedIp });
  };

  it('should block non-HTTPS webhooks (like http://localhost)', async () => {
    setupMock('http://localhost:4321/api', '127.0.0.1');
    await runTrigger();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Webhook must use HTTPS'), expect.anything());
  });

  const blockedCases = [
    { name: 'localhost IPv4', url: 'https://localhost', ip: '127.0.0.1' },
    { name: 'loopback alternate', url: 'https://127.1', ip: '127.0.0.1' }, // dns.lookup normalizes 127.1 to 127.0.0.1
    { name: 'zero network', url: 'https://0.0.0.0', ip: '0.0.0.0' },
    { name: 'cloud metadata', url: 'https://169.254.169.254/latest', ip: '169.254.169.254' },
    { name: 'private 10.x', url: 'https://10.1.2.3', ip: '10.1.2.3' },
    { name: 'private 172.16.x', url: 'https://172.16.0.1', ip: '172.16.0.1' },
    { name: 'private 192.168.x', url: 'https://192.168.1.100', ip: '192.168.1.100' },
    { name: 'IPv6 loopback', url: 'https://[::1]', ip: '::1' },
    { name: 'IPv6 Link-Local', url: 'https://[fe80::1]', ip: 'fe80::1' },
    { name: 'DNS Rebinding attack domain', url: 'https://my-internal-server.com', ip: '192.168.0.5' }
  ];

  for (const tc of blockedCases) {
    it(`should block ${tc.name} (${tc.ip})`, async () => {
      setupMock(tc.url, tc.ip);
      await runTrigger();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Blocked SSRF attempt to private network'),
        expect.anything()
      );
    });
  }

  it('should allow valid external webhooks', async () => {
    setupMock('https://api.github.com/webhook', '140.82.113.3');
    await runTrigger();
    expect(fetchSpy).toHaveBeenCalled();
  });
});
