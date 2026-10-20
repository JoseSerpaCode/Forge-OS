import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Plantillas: lo que se guarda pasa por la lista blanca, las etiquetas
 * borradas se saltan y la entrega cuenta desde el día en que se usa.
 */
let tmp: string;
let db: any;
let plantillas: typeof import('../src/lib/plantillas');
let IssueService: typeof import('../src/lib/IssueService').IssueService;

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-plantillas-'));
  process.env.DATABASE_URL = path.join(tmp, 'tpl.db');
  process.env.NODE_ENV = 'test';
  vi.resetModules();
  db = (await import('../src/lib/db')).default;
  plantillas = await import('../src/lib/plantillas');
  IssueService = (await import('../src/lib/IssueService')).IssueService;
  db.exec(`
    INSERT INTO users (id, username, password_hash) VALUES ('u','duena','x');
    INSERT INTO workspaces (id, name, sys_tag, created_by) VALUES ('w','W','w','u'), ('w2','W2','w2','u');
    INSERT INTO workspace_members (workspace_id, user_id, ws_role) VALUES ('w','u','owner'), ('w2','u','owner');
    INSERT INTO labels (id, workspace_id, name, color) VALUES ('l1','w','Cálculo','#FF5D00'), ('l2','w','Física','#3B82F6');
    INSERT INTO issues (id, workspace_id, type, title, description, reporter_id, status, priority, due_date)
      VALUES ('t','w','task','Parcial','Repasar todo','u','todo','high', date('now', '+7 days'));
    INSERT INTO issue_labels (issue_id, label_id) VALUES ('t','l1'), ('t','l2');
  `);
  IssueService.crearSubtarea('t', 'Tema 1', 'u', 0);
  IssueService.crearSubtarea('t', 'Tema 2', 'u', 0);
});

afterAll(() => {
  try { db?.close(); } catch { /* cerrada */ }
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe('lista blanca', () => {
  it('se cae lo que no se reconoce; sin título no hay plantilla', () => {
    expect(plantillas.limpiarContenido({ title: 'X', priority: 'urgentisima', due_offset: 999, sql: 'x', subtareas: ['a', 3, ''] }))
      .toEqual({ title: 'X', subtareas: ['a'] });
    expect(plantillas.limpiarContenido({ description: 'sin título' })).toBeNull();
  });
  it('una regla sin entrega se descarta: no tendría de dónde contar', () => {
    expect(plantillas.limpiarContenido({ title: 'X', recurrence: 'w:1:MO' })).toEqual({ title: 'X' });
  });
});

describe('guardar y usar', () => {
  it('guarda título, prioridad, etiquetas, subtareas y la entrega relativa', () => {
    const r = plantillas.desdeTarea('t', 'w', 'Parcial', 'u', 7);
    expect(r.ok).toBe(true);
    const p = plantillas.listar('w')[0];
    expect(p.contenido).toMatchObject({ title: 'Parcial', priority: 'high', label_ids: ['l1', 'l2'], subtareas: ['Tema 1', 'Tema 2'], due_offset: 7 });
  });

  it('al usarla: la entrega cuenta desde ese día, las subtareas vuelven, y una etiqueta borrada se salta y se dice', async () => {
    const id = plantillas.listar('w')[0].id;
    db.exec("DELETE FROM labels WHERE id = 'l2'");
    const r = await plantillas.usar(id, 'w', 'u', 0, '2026-10-20');
    expect(r).toMatchObject({ etiquetasSaltadas: 1 });
    const nueva = db.prepare('SELECT title, due_date, priority FROM issues WHERE id = ?').get(r!.id);
    expect(nueva).toEqual({ title: 'Parcial', due_date: '2026-10-27', priority: 'high' });
    expect(db.prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?').all(r!.id)).toEqual([{ label_id: 'l1' }]);
    expect(db.prepare('SELECT title FROM issues WHERE parent_issue_id = ? ORDER BY position').all(r!.id).map((x: any) => x.title)).toEqual(['Tema 1', 'Tema 2']);
  });

  it('la plantilla de otro espacio no se puede usar ni borrar desde este', async () => {
    const id = plantillas.listar('w')[0].id;
    expect(await plantillas.usar(id, 'w2', 'u', 0, '2026-10-20')).toBeNull();
    expect(plantillas.borrar(id, 'w2')).toBe(false);
    // Control: desde su espacio, sí.
    expect(plantillas.borrar(id, 'w')).toBe(true);
  });

  it('borrar la cuenta que la creó no la borra', () => {
    plantillas.desdeTarea('t', 'w', 'Sobrevive', 'u', null);
    db.exec("INSERT INTO users (id, username, password_hash) VALUES ('otra','otra','x')");
    db.exec("UPDATE task_templates SET created_by = 'otra' WHERE name = 'Sobrevive'");
    db.exec("DELETE FROM users WHERE id = 'otra'");
    expect(db.prepare("SELECT created_by FROM task_templates WHERE name = 'Sobrevive'").get()).toEqual({ created_by: null });
  });
});

describe('crear y editar desde los ajustes', () => {
  it('crea sin pasar por una tarea, y se queda solo con las etiquetas del espacio', () => {
    const r = plantillas.crear('w', 'Informe', { title: 'Informe de laboratorio', label_ids: ['l1', 'de-otro-espacio'], due_offset: 7, recurrence: 'd:7' }, 'u');
    expect(r.ok).toBe(true);
    const p = plantillas.listar('w').find((x) => x.name === 'Informe')!;
    expect(p.contenido).toEqual({ title: 'Informe de laboratorio', label_ids: ['l1'], due_offset: 7, recurrence: 'd:7' });
  });
  it('sin nombre o sin título no se crea', () => {
    expect(plantillas.crear('w', '  ', { title: 'X' }, 'u')).toEqual({ ok: false, error: 'nombre_vacio' });
    expect(plantillas.crear('w', 'X'.repeat(61), { title: 'X' }, 'u')).toEqual({ ok: false, error: 'nombre_largo' });
    expect(plantillas.crear('w', 'Sin título', { description: 'nada' }, 'u')).toEqual({ ok: false, error: 'titulo_vacio' });
  });
  it('edita nombre y contenido, y no toca la de otro espacio', () => {
    const { id } = plantillas.crear('w', 'Borrador', { title: 'Uno' }, 'u') as { ok: true; id: string };
    expect(plantillas.actualizar(id, 'w', 'Definitiva', { title: 'Dos', subtareas: ['a', 'b'] }).ok).toBe(true);
    const p = plantillas.listar('w').find((x) => x.id === id)!;
    expect(p).toMatchObject({ name: 'Definitiva', contenido: { title: 'Dos', subtareas: ['a', 'b'] } });
    expect(plantillas.actualizar(id, 'w2', 'Robada', { title: 'X' })).toEqual({ ok: false, error: 'no_existe' });
  });
  it('las de serie pasan la misma lista blanca sin perder nada', async () => {
    const { plantillasDeSerie } = await import('../src/lib/plantillasDeSerie');
    for (const lang of ['es', 'en']) {
      for (const p of plantillasDeSerie(lang)) {
        expect(plantillas.limpiarContenido(p.contenido), `${lang}/${p.clave}`).toEqual(p.contenido);
      }
    }
  });
});
