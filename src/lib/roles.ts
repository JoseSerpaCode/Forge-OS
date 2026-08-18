import { useTranslations } from '../i18n/ui';

/**
 * El nombre de un rol, en el idioma de quien mira.
 *
 * Los roles se guardan en inglés porque son valores de la base —`owner`,
 * `editor`, `viewer`— y eso está bien. Lo que estaba mal es que se pintaban
 * **tal cual**: la barra lateral decía «VIEWER» y las tarjetas del hub «OWNER»
 * con toda la interfaz en español.
 *
 * Las traducciones ya existían (`ws.settings.role_*`), usadas solo en el
 * desplegable de invitar. Aquí se reutilizan en vez de añadir otras tres.
 *
 * `sysadmin` no es un rol de espacio: es una propiedad de la cuenta que aparece
 * cuando alguien administra la instancia. Tiene su propia clave.
 */
export function nombreDeRol(rol: string | null | undefined, lang: string): string {
  if (!rol) return '';
  const t = useTranslations((lang === 'es' ? 'es' : 'en') as 'es' | 'en');

  const clave = rol === 'sysadmin' ? 'ws.settings.role_sysadmin' : `ws.settings.role_${rol}`;
  const texto = t(clave as any);

  // `useTranslations` devuelve la clave cuando no la encuentra. Un rol nuevo sin
  // traducir es mejor verlo en crudo que ver `ws.settings.role_loquesea`.
  return texto === clave ? rol : texto;
}
