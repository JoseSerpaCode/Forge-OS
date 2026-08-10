/**
 * Quién puede tratar con quién.
 *
 * Las cuentas de invitado son anónimas, duran 30 días y se crean pulsando un
 * botón sin dar un solo dato. Eso las hace perfectas para probar el producto y
 * pésimas como identidad social: aceptar a un invitado como amigo es aceptar a
 * alguien que desaparece en un mes, y una cuenta desechable que puede mandar
 * solicitudes o bloquear a gente es una herramienta de acoso que no cuesta nada
 * fabricar.
 *
 * Así que **un invitado ve la web entera pero no participa en nada social**, y
 * nadie puede dirigirle a él una acción social tampoco. Es simétrico a
 * propósito: si solo se cortara un sentido, el invitado seguiría siendo un
 * objetivo, y bloquear a un usuario que caduca solo no protege a nadie.
 *
 * La regla vive aquí y no repartida por cada endpoint porque ya estaba escrita
 * tres veces con tres redacciones distintas, y la cuarta —bloquear— se había
 * quedado sin ella.
 */

export type SocialParty = { is_guest?: number | boolean | null } | null | undefined;

const isGuest = (u: SocialParty): boolean => Boolean(u && (u.is_guest === 1 || u.is_guest === true));

/**
 * ¿Pueden estas dos cuentas dirigirse una acción social?
 *
 * Falso si **cualquiera** de las dos es un invitado. Ver perfiles no pasa por
 * aquí: mirar no es interactuar, y esconder a los usuarios de un invitado le
 * dejaría un producto a medias sin proteger a nadie.
 */
export function canInteractSocially(a: SocialParty, b: SocialParty): boolean {
  return Boolean(a) && Boolean(b) && !isGuest(a) && !isGuest(b);
}

/**
 * Por qué se ha rechazado, para poder decírselo al usuario.
 *
 * Distingue los dos casos porque la salida es distinta: el invitado tiene algo
 * que hacer —registrarse—, y quien apunta a un invitado no, así que ofrecerle
 * «crea una cuenta» sería mandarle a arreglar un problema que no es suyo.
 */
export function socialBlockReason(actor: SocialParty, target: SocialParty): 'actor_is_guest' | 'target_is_guest' | null {
  if (isGuest(actor)) return 'actor_is_guest';
  if (isGuest(target)) return 'target_is_guest';
  return null;
}

/** Mensajes de la API. La interfaz traduce por su cuenta; esto es para el log y para clientes sin i18n. */
export const SOCIAL_DENIED = {
  actor_is_guest: 'Guest accounts cannot perform social actions. Create an account to continue.',
  target_is_guest: 'This account is temporary and cannot be interacted with.',
} as const;
