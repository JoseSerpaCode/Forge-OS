/**
 * El responsable en el navegador: traducir la opción elegida, repintar la
 * tarjeta y crear un contacto al vuelo. Lo comparten el panel de la tarea y
 * el alta, para que los dos digan y hagan lo mismo.
 */

const PREFIJO = 'c:';

/** Lo que espera la API a partir del valor del `<select>`. */
export function aPayload(valor: string): { assignee_id: string | null; assignee_contact_id: string | null } {
  if (!valor) return { assignee_id: null, assignee_contact_id: null };
  return valor.startsWith(PREFIJO)
    ? { assignee_id: null, assignee_contact_id: valor.slice(PREFIJO.length) }
    : { assignee_id: valor, assignee_contact_id: null };
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  return partes.slice(0, 2).map((p) => [...p][0] ?? '').join('').toLocaleUpperCase() || '?';
}

/** Repinta el círculo del responsable de una tarjeta, sin foto: iniciales. */
export function pintarEnTarjeta(card: HTMLElement, valor: string, nombre: string, sinAsignar: string) {
  card.dataset.responsable = valor;
  card.dataset.assigneeId = valor.startsWith(PREFIJO) ? '' : valor;
  const caja = card.querySelector<HTMLElement>('.card-responsable');
  if (!caja) return;
  const etiqueta = valor ? nombre : sinAsignar;
  caja.title = etiqueta;
  caja.setAttribute('aria-label', etiqueta);
  caja.classList.toggle('border-dashed', valor.startsWith(PREFIJO));
  caja.classList.toggle('border-forge-muted', valor.startsWith(PREFIJO));
  caja.classList.toggle('border-forge-border', !valor.startsWith(PREFIJO));
  caja.replaceChildren();
  if (valor) {
    const s = document.createElement('span');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = iniciales(nombre);
    caja.append(s);
  }
}

/**
 * «Nuevo contacto…»: pide el nombre, lo crea y lo añade a **todos** los
 * desplegables de responsable de la página, ya seleccionado en el que lo
 * pidió. Devuelve el valor nuevo, o `null` si se canceló.
 */
export function nuevoContacto(): Promise<{ valor: string; nombre: string } | null> {
  const dialogo = document.getElementById('contacto-rapido') as HTMLDialogElement | null;
  const form = document.getElementById('contacto-rapido-form') as HTMLFormElement | null;
  const campo = document.getElementById('contacto-rapido-nombre') as HTMLInputElement | null;
  if (!dialogo || !form || !campo) return Promise.resolve(null);

  return new Promise((resolver) => {
    let hecho = false;
    const terminar = (r: { valor: string; nombre: string } | null) => {
      if (hecho) return;
      hecho = true;
      form.removeEventListener('submit', alEnviar);
      dialogo.removeEventListener('close', alCerrar);
      cancelar?.removeEventListener('click', alCancelar);
      if (dialogo.open) dialogo.close();
      resolver(r);
    };
    const alEnviar = async (e: Event) => {
      e.preventDefault();
      const nombre = campo.value.trim();
      if (!nombre) return;
      const res = await fetch('/api/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nombre }),
      }).catch(() => null);
      if (!res?.ok) { window.showToast?.(dialogo.dataset.tError || '', true); return; }
      const c = await res.json();
      const valor = `${PREFIJO}${c.id}`;
      document.querySelectorAll<HTMLSelectElement>('select.select-responsable').forEach((sel) => {
        if (sel.querySelector(`option[value="${CSS.escape(valor)}"]`)) return;
        const op = document.createElement('option');
        op.value = valor;
        op.textContent = c.name;
        const grupo = sel.querySelector('optgroup.grupo-contactos');
        const nuevo = grupo?.querySelector('option[value="__nuevo"]');
        if (grupo && nuevo) grupo.insertBefore(op, nuevo); else (grupo ?? sel).append(op);
      });
      terminar({ valor, nombre: c.name });
    };
    const alCerrar = () => terminar(null);
    const cancelar = document.getElementById('contacto-rapido-cancelar');
    const alCancelar = () => terminar(null);
    form.addEventListener('submit', alEnviar);
    dialogo.addEventListener('close', alCerrar);
    cancelar?.addEventListener('click', alCancelar);
    campo.value = '';
    dialogo.showModal();
    campo.focus();
  });
}
