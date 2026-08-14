/// <reference path="../.astro/types.d.ts" />
declare namespace App {
  interface Locals {
    user: {
      id: string;
      username: string;
      is_sysadmin: 0 | 1;
      is_guest: 0 | 1;
      theme_preference: string;
      last_workspace_id?: string;
      last_page_id?: string;
      avatar_url?: string;
      bio?: string;
      pronouns?: string;
      public_email?: string;
      github_id?: string;
      google_id?: string;
      /** Caducidad de la sesión en ms. El middleware la selecciona junto al
          usuario; la interfaz la necesita para avisar al invitado antes de que
          pierda su espacio de trabajo. */
      expires_at?: number;
    } | null;
    lang: 'en' | 'es';
  }
}

interface Window {
  showToast?: (message: string, type?: boolean | 'success' | 'error') => void;
  /** Diálogo de confirmación de la aplicación (MainLayout). Se usa en lugar del
      `confirm()` del navegador, que se puede bloquear tras el primer aviso y
      deja los botones sin hacer nada en silencio. */
  forgeConfirm?: (message: string, onConfirm: () => void) => void;
}
