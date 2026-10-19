import { describe, it, expect } from 'vitest';
import { interpretar } from '../src/lib/altaRapida';

/**
 * El alta rápida, con un «hoy» fijo.
 *
 * Martes 20 de octubre de 2026. Sin un día fijo, «el viernes» daría una fecha
 * distinta cada día y el test pasaría o fallaría según cuándo se ejecute.
 */
const MARTES = new Date(2026, 9, 20, 10, 0, 0);
const VIERNES = new Date(2026, 9, 23, 10, 0, 0);
const etiquetas = [
  { id: 'l-calc', name: 'Cálculo' },
  { id: 'l-fis', name: 'Física II' },
];
const es = (texto: string, hoy = MARTES, ignorar?: Set<number>) =>
  interpretar(texto, { hoy, lang: 'es', etiquetas, ignorar });

describe('la frase completa', () => {
  it('separa título, fecha, hora, etiqueta, prioridad y apunte', () => {
    const r = es('Entregar taller viernes 18:00 #Cálculo !1 [[Tema 3]]');
    expect(r.titulo).toBe('Entregar taller');
    expect(r.fecha).toBe('2026-10-23');
    expect(r.hora).toBe('18:00');
    expect(r.etiquetas.map((e) => e.id)).toEqual(['l-calc']);
    expect(r.prioridad).toBe('highest');
    expect(r.apuntes).toEqual(['Tema 3']);
  });

  it('sin nada reconocible, todo es título', () => {
    const r = es('Leer capítulo de termodinámica');
    expect(r.titulo).toBe('Leer capítulo de termodinámica');
    expect(r.fecha).toBeNull();
    expect(r.tramos).toEqual([]);
  });
});

describe('fechas en español', () => {
  it('hoy, mañana y pasado mañana', () => {
    expect(es('Estudiar hoy').fecha).toBe('2026-10-20');
    expect(es('Estudiar mañana').fecha).toBe('2026-10-21');
    expect(es('Estudiar pasado mañana').fecha).toBe('2026-10-22');
    expect(es('Estudiar pasado mañana').titulo).toBe('Estudiar');
  });

  it('un día de la semana es el próximo; el mismo día, el de la semana que viene', () => {
    expect(es('Quiz el viernes').fecha).toBe('2026-10-23');
    expect(es('Quiz el viernes', VIERNES).fecha).toBe('2026-10-30');
    expect(es('Quiz miércoles').fecha).toBe('2026-10-21');
    expect(es('Quiz miercoles').fecha).toBe('2026-10-21');
  });

  it('numéricas en orden día/mes', () => {
    expect(es('Parcial 15/11').fecha).toBe('2026-11-15');
    expect(es('Parcial 15/11/2027').fecha).toBe('2027-11-15');
  });

  it('una fecha ya pasada sin año es la del año siguiente', () => {
    expect(es('Parcial 15 de marzo').fecha).toBe('2027-03-15');
    expect(es('Parcial 15 de marzo').titulo).toBe('Parcial');
    expect(es('Parcial 5/1').fecha).toBe('2027-01-05');
  });

  it('«el 15» es de este mes, o del siguiente si ya pasó', () => {
    expect(es('Pagar el 25').fecha).toBe('2026-10-25');
    expect(es('Pagar el 5').fecha).toBe('2026-11-05');
  });

  it('en N días y la semana que viene', () => {
    expect(es('Repasar en 3 días').fecha).toBe('2026-10-23');
    expect(es('Repasar la próxima semana').fecha).toBe('2026-10-26');
  });

  it('una fecha imposible no es fecha', () => {
    const r = es('Revisar 31/02');
    expect(r.fecha).toBeNull();
    expect(r.titulo).toBe('Revisar 31/02');
  });
});

describe('horas', () => {
  it('18:00, 18h, 18h30, a las 18 y 6pm', () => {
    expect(es('Entregar 18:00').hora).toBe('18:00');
    expect(es('Entregar 18h').hora).toBe('18:00');
    expect(es('Entregar 18h30').hora).toBe('18:30');
    expect(es('Entregar a las 18').hora).toBe('18:00');
    expect(es('Entregar 6pm').hora).toBe('18:00');
    expect(es('Entregar a las 18').titulo).toBe('Entregar');
  });

  it('una hora sin fecha es para hoy', () => {
    expect(es('Llamar 17:30').fecha).toBe('2026-10-20');
  });

  it('una hora imposible no es hora', () => {
    expect(es('Código 25:99').hora).toBeNull();
  });
});

describe('etiquetas', () => {
  it('sin distinguir mayúsculas, tildes ni separadores', () => {
    expect(es('Tarea #calculo').etiquetas.map((e) => e.id)).toEqual(['l-calc']);
    expect(es('Tarea #fisica-ii').etiquetas.map((e) => e.id)).toEqual(['l-fis']);
  });

  it('una que no existe no se asigna ni se crea: se ofrece', () => {
    const r = es('Tarea #inglés');
    expect(r.etiquetas).toEqual([]);
    expect(r.etiquetasNuevas).toEqual(['inglés']);
    expect(r.titulo).toBe('Tarea');
  });
});

describe('prioridad', () => {
  it('!1 a !4', () => {
    expect(es('Algo !1').prioridad).toBe('highest');
    expect(es('Algo !2').prioridad).toBe('high');
    expect(es('Algo !3').prioridad).toBe('medium');
    expect(es('Algo !4').prioridad).toBe('low');
  });

  it('!7 no es prioridad y se queda en el título', () => {
    const r = es('Hola !7');
    expect(r.prioridad).toBeNull();
    expect(r.titulo).toBe('Hola !7');
  });
});

describe('quitar un chip devuelve sus palabras al título', () => {
  it('«El lunes» como parte del título', () => {
    const texto = 'Leer el lunes de Galdós';
    const primero = es(texto);
    expect(primero.fecha).toBe('2026-10-26');
    const tramo = primero.tramos.find((t) => t.tipo === 'fecha')!;
    const despues = es(texto, MARTES, new Set([tramo.inicio]));
    expect(despues.fecha).toBeNull();
    expect(despues.titulo).toBe('Leer el lunes de Galdós');
  });
});

describe('en inglés', () => {
  const en = (texto: string) => interpretar(texto, { hoy: MARTES, lang: 'en', etiquetas });
  it('tomorrow, weekdays, mm/dd y month day', () => {
    expect(en('Essay tomorrow').fecha).toBe('2026-10-21');
    expect(en('Essay friday').fecha).toBe('2026-10-23');
    expect(en('Essay fri').fecha).toBe('2026-10-23');
    expect(en('Essay 11/15').fecha).toBe('2026-11-15');
    expect(en('Essay march 15').fecha).toBe('2027-03-15');
    expect(en('Essay at 6pm').hora).toBe('18:00');
  });
});

describe('repeticiones', () => {
  it('cada lunes: regla semanal y la fecha es el próximo lunes', () => {
    const r = es('Leer cada lunes');
    expect(r.recurrencia).toBe('w:1:MO');
    expect(r.fecha).toBe('2026-10-26');
    expect(r.titulo).toBe('Leer');
  });
  it('cada lunes y jueves, cada 2 semanas el viernes, cada 3 días', () => {
    expect(es('Gimnasio cada lunes y jueves').recurrencia).toBe('w:1:MO,TH');
    expect(es('Informe cada 2 semanas el viernes').recurrencia).toBe('w:2:FR');
    expect(es('Regar cada 3 días').recurrencia).toBe('d:3');
  });
  it('cada mes toma el día de la fecha; cada fin de mes; el 15', () => {
    expect(es('Pagar cada mes 05/11').recurrencia).toBe('m:1:5');
    expect(es('Pagar cada fin de mes').recurrencia).toBe('m:1:-1');
    expect(es('Pagar cada mes el 15').recurrencia).toBe('m:1:15');
  });
  it('cada semana toma el día de la fecha si la hay', () => {
    expect(es('Repaso cada semana el viernes').recurrencia).toBe('w:1:FR');
  });
  it('en inglés', () => {
    expect(interpretar('Run every monday and friday', { hoy: MARTES, lang: 'en' }).recurrencia).toBe('w:1:MO,FR');
    expect(interpretar('Stretch every day', { hoy: MARTES, lang: 'en' }).recurrencia).toBe('d:1');
  });
});

describe('fecha de trabajo', () => {
  it('«entregar viernes hacer martes»: la primera es la entrega, la de «hacer» el día de trabajo', () => {
    const r = es('Informe viernes hacer el lunes');
    expect(r.fecha).toBe('2026-10-23');
    expect(r.fechaTrabajo).toBe('2026-10-26');
    expect(r.titulo).toBe('Informe');
  });
  it('solo «hacer el jueves»: sin entrega', () => {
    const r = es('Repasar hacer el jueves');
    expect(r.fecha).toBeNull();
    expect(r.fechaTrabajo).toBe('2026-10-22');
  });
});

describe('recordatorios', () => {
  it('«recordar 1 h antes», «avísame 2 días antes»', () => {
    const r = es('Entregar viernes 18:00 recordar 1 h antes');
    expect(r.recordatorio).toBe(60);
    expect(r.titulo).toBe('Entregar');
    expect(es('Parcial 15/11 avísame 2 días antes').recordatorio).toBe(2880);
  });
});

describe('prioridad por nombre', () => {
  it('!urgente, !alta, !normal, !baja y en inglés, sin importar mayúsculas', () => {
    expect(es('Algo !urgente').prioridad).toBe('highest');
    expect(es('Algo !Alta').prioridad).toBe('high');
    expect(es('Algo !normal').prioridad).toBe('medium');
    expect(es('Algo !baja').prioridad).toBe('low');
    expect(es('Algo !urgent').prioridad).toBe('highest');
    expect(es('Algo !HIGH').prioridad).toBe('high');
    expect(es('Algo !low').prioridad).toBe('low');
    expect(es('Algo !alta').titulo).toBe('Algo');
  });
  it('una palabra que no es prioridad se queda en el título', () => {
    const r = es('Hola !mundo');
    expect(r.prioridad).toBeNull();
    expect(r.titulo).toBe('Hola !mundo');
  });
});
