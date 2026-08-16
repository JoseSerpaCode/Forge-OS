import type { APIRoute } from 'astro';
import { IssueService } from '../../../../lib/IssueService';
import { handleApiError } from '../../../../lib/errors';


/**
 * Duplicar un ticket.
 *
 * `POST` sobre una subruta y no `POST /api/issues` con un `copy_of`: crear y
 * copiar tienen reglas distintas —la copia hereda etiquetas, descarta horas y
 * puede acabar en otro sprint que el que se pidió— y meterlas en el mismo
 * endpoint obliga a que cada campo del cuerpo signifique dos cosas según venga
 * o no acompañado.
 *
 * No lleva cuerpo: qué se copia lo decide el servidor. Si lo decidiera el
 * cliente, el día que alguien mande `logged_hours` se inventarían horas
 * trabajadas que nadie trabajó.
 */
export const POST: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  try {
    const resultado = await IssueService.duplicate(params.id!, user.id, user.is_sysadmin);
    return new Response(JSON.stringify(resultado), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // `handleApiError` ya traduce `ApiError` a su código. Escribirlo a mano
    // aquí es como se coló un `err.status` que no existe —la propiedad se llama
    // `statusCode`— y con él cualquier 403 o 404 salía como 500.
    return handleApiError(err);
  }
};
