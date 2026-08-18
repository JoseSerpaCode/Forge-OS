import { describe, it, expect } from 'vitest';
import { escaparHtml, escaparLike, hrefSeguro } from '../src/lib/texto';

describe('escaparHtml', () => {
  it('neutraliza una etiqueta', () => {
    expect(escaparHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapa la comilla simple, no solo la doble', () => {
    // Un valor puede acabar dentro de un atributo con comillas simples, donde
    // `"` no cierra nada pero `'` sí. Una de las cuatro copias no lo hacía.
    expect(escaparHtml("O'Brien")).toBe('O&#39;Brien');
  });

  it('el ampersand va primero', () => {
    // Si se sustituyera `<` antes que `&`, el `&lt;` recién creado se volvería
    // a escapar y saldría `&amp;lt;`.
    expect(escaparHtml('&<')).toBe('&amp;&lt;');
  });

  it('null y undefined dan cadena vacía, no «null»', () => {
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(undefined)).toBe('');
  });
});

describe('escaparLike', () => {
  it('los comodines se buscan como texto', () => {
    // Sin esto, buscar «100%» devuelve todo.
    expect(escaparLike('100%')).toBe('100\\%');
    expect(escaparLike('a_b')).toBe('a\\_b');
  });

  it('la propia barra de escape también se escapa', () => {
    // Buscar «C:\» sin escapar la barra deja un escape colgando que se come el
    // carácter siguiente.
    expect(escaparLike('C:\\')).toBe('C:\\\\');
  });
});

describe('hrefSeguro', () => {
  it('deja pasar rutas propias y http(s)', () => {
    expect(hrefSeguro('/w/algo')).toBe('/w/algo');
    expect(hrefSeguro('https://ejemplo.com')).toBe('https://ejemplo.com');
  });

  it('corta javascript: y data:', () => {
    // Un `javascript:` en un href ejecuta código con solo pulsarlo.
    expect(hrefSeguro('javascript:alert(1)')).toBe('#');
    expect(hrefSeguro('data:text/html,<script>alert(1)</script>')).toBe('#');
  });

  it('corta las protocol-relative, que salen del sitio sin decirlo', () => {
    expect(hrefSeguro('//evil.example')).toBe('#');
  });

  it('lo vacío da almohadilla, no undefined en el atributo', () => {
    expect(hrefSeguro(null)).toBe('#');
    expect(hrefSeguro('   ')).toBe('#');
  });
});
