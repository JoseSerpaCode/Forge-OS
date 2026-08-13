import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs'; import os from 'os'; import path from 'path';

/**
 * Recursos: deduplicación y alta.
 *
 * La normalización de URL es el corazón del módulo. Sin ella, el mismo enlace
 * compartido por dos canales entra dos veces —uno con `?utm_source=slack`, otro
 * sin— y la lista se llena de duplicados que nadie limpia. Por eso se prueba
 * caso por caso, y contra el esquema real: la garantía de «no hay dos URLs
 * iguales vivas en el mismo espacio» la da un índice único parcial, no el
 * código.
 */

let lib: typeof import('../src/lib/resources');
let db: any, tmp: string;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-res-'));
  process.env.DATABASE_URL = path.join(tmp, 'res.db');
  lib = await import('../src/lib/resources');
  db = (await import('../src/lib/db')).default;
  db.exec("INSERT INTO users (id, username, password_hash) VALUES ('u', 'res', 'x')");
  db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w', 'W', 'w', 'u')");
  db.exec("INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w2', 'W2', 'w2', 'u')");
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('normalización de URL', () => {
  const n = (u: string) => lib.normalizarUrl(u);

  it('trata como el mismo enlace lo que solo cambia en la envoltura', () => {
    const esperado = 'https://ejemplo.com/guia';
    expect(n('https://ejemplo.com/guia')).toBe(esperado);
    expect(n('https://www.ejemplo.com/guia')).toBe(esperado);
    expect(n('https://EJEMPLO.com/guia')).toBe(esperado);
    expect(n('https://ejemplo.com/guia/')).toBe(esperado);
    expect(n('https://ejemplo.com/guia#seccion-2')).toBe(esperado);
    expect(n('https://ejemplo.com:443/guia')).toBe(esperado);
    expect(n('https://ejemplo.com/guia?utm_source=slack&utm_campaign=x')).toBe(esperado);
  });

  it('no confunde la ruta, que sí distingue mayúsculas', () => {
    expect(n('https://ejemplo.com/Guia')).not.toBe(n('https://ejemplo.com/guia'));
  });

  it('ordena los parámetros que sí importan, pero no los pierde', () => {
    expect(n('https://ejemplo.com/b?z=1&a=2')).toBe(n('https://ejemplo.com/b?a=2&z=1'));
    expect(n('https://ejemplo.com/b?a=2')).not.toBe(n('https://ejemplo.com/b?a=3'));
  });

  it('descarta lo que no es un enlace usable', () => {
    // Un valor que no se puede normalizar no debe participar en la
    // deduplicación: haría chocar entre sí recursos que no tienen que ver.
    expect(n('javascript:alert(1)')).toBeNull();
    expect(n('file:///etc/passwd')).toBeNull();
    expect(n('no es una url')).toBeNull();
    expect(n('')).toBeNull();
    expect(n(null as any)).toBeNull();
  });
});

describe('alta de recursos', () => {
  it('el mismo enlace dos veces es un recurso, no dos', () => {
    const a = lib.crearRecurso({ workspaceId: 'w', type: 'link', title: 'Guía', url: 'https://ejemplo.com/guia', createdBy: 'u' });
    const b = lib.crearRecurso({ workspaceId: 'w', type: 'link', title: 'La guía otra vez', url: 'https://www.ejemplo.com/guia/?utm_source=slack', createdBy: 'u' });

    expect(b.yaExistia).toBe(true);
    expect(b.id).toBe(a.id);
    expect(lib.listar('w')).toHaveLength(1);
  });

  it('cada espacio tiene su propia lista', () => {
    const c = lib.crearRecurso({ workspaceId: 'w2', type: 'link', title: 'Guía', url: 'https://ejemplo.com/guia', createdBy: 'u' });
    expect(c.yaExistia).toBe(false);
    expect(lib.listar('w2')).toHaveLength(1);
  });

  it('lo que no tiene URL nace sin nada que enriquecer', () => {
    lib.crearRecurso({ workspaceId: 'w', type: 'note', title: 'Acuerdo de la reunión', body: 'Se decide X', createdBy: 'u' });
    const nota = db.prepare("SELECT enrich_status, url_normalized FROM resources WHERE type = 'note'").get() as any;
    // Dejarlo en 'pending' lo condenaría a esperar para siempre a una cola que
    // nunca va a mirarlo.
    expect(nota.enrich_status).toBe('skipped');
    expect(nota.url_normalized).toBeNull();
  });
});

describe('archivado', () => {
  it('archivar no borra, y deja volver a dar de alta la misma URL', () => {
    const original = lib.crearRecurso({ workspaceId: 'w', type: 'link', title: 'Temporal', url: 'https://ejemplo.com/temporal', createdBy: 'u' });
    expect(lib.archivar(original.id, 'w')).toBe(true);

    // Sigue en la tabla: si se borrara en duro y la URL siguiera citada en un
    // issue, la próxima ingesta lo recrearía y el archivado no serviría de nada.
    const fila = db.prepare('SELECT archived_at FROM resources WHERE id = ?').get(original.id) as any;
    expect(fila.archived_at).toBeTruthy();
    expect(lib.listar('w').some((r: any) => r.id === original.id)).toBe(false);

    // Y el índice de deduplicación no bloquea el alta nueva.
    const nuevo = lib.crearRecurso({ workspaceId: 'w', type: 'link', title: 'Otra vez', url: 'https://ejemplo.com/temporal', createdBy: 'u' });
    expect(nuevo.yaExistia).toBe(false);
    expect(nuevo.id).not.toBe(original.id);
  });

  it('no se puede archivar un recurso de otro espacio', () => {
    const ajeno = lib.crearRecurso({ workspaceId: 'w2', type: 'link', title: 'Ajeno', url: 'https://ejemplo.com/ajeno', createdBy: 'u' });
    expect(lib.archivar(ajeno.id, 'w')).toBe(false);
  });
});

describe('vínculos', () => {
  it('una URL citada en dos issues es un recurso con dos vínculos', () => {
    db.exec("INSERT INTO issues (id, workspace_id, title, type, status, reporter_id) VALUES ('i1', 'w', 'A', 'task', 'todo', 'u')");
    db.exec("INSERT INTO issues (id, workspace_id, title, type, status, reporter_id) VALUES ('i2', 'w', 'B', 'task', 'todo', 'u')");

    const r = lib.crearRecurso({ workspaceId: 'w', type: 'link', title: 'Compartido', url: 'https://ejemplo.com/compartido', createdBy: 'u' });
    lib.vincular(r.id, 'issue', 'i1');
    lib.vincular(r.id, 'issue', 'i2');

    expect(lib.deEntidad('issue', 'i1')).toHaveLength(1);
    expect(lib.deEntidad('issue', 'i2')).toHaveLength(1);
    const n = db.prepare('SELECT COUNT(*) AS n FROM resources WHERE url_normalized LIKE ?').get('%compartido%') as any;
    expect(n.n).toBe(1);
  });

  it('vincular dos veces lo mismo no duplica', () => {
    const r = db.prepare("SELECT id FROM resources WHERE title = 'Compartido'").get() as any;
    lib.vincular(r.id, 'issue', 'i1');
    const n = db.prepare('SELECT COUNT(*) AS n FROM resource_links WHERE resource_id = ?').get(r.id) as any;
    expect(n.n).toBe(2);
  });
});
