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

  /**
   * Los textos que necesitan los scripts del cliente.
   *
   * Los llamantes viven dentro de `<script>` sin `define:vars`, así que `t()` no
   * les llega. Antes cada componente llevaba sus propios `data-*`; con dieciséis
   * mensajes eso eran dieciséis atributos sueltos que se desincronizan.
   *
   * Lo pone `MainLayout`, así que existe en toda página con sesión. Se declara
   * como opcional porque un script podría correr antes de que se asigne.
   */
  forgeMsg?: Record<string, string>;

  /**
   * Redimensionar y subir una imagen.
   *
   * Va por `window` porque dos de los tres llamantes están en `<script
   * is:inline define:vars>`, que no admite imports. Lo pone `MainLayout`.
   */
  /** Escapado de texto, para los `<script is:inline>` que no pueden importar. */
  forgeTexto?: {
    escapar: (valor: unknown) => string;
    href: (url: unknown) => string;
  };

  forgeImagen?: {
    subir: (file: File, opciones: { maxAncho: number; nombre?: string; entidad?: { tipo: string; id: string } }) =>
      Promise<{ ok: true; url: string } | { ok: false; motivo: string }>;
    ANCHOS: { avatar: number; banner: number; icono: number };
  };
  /** Diálogo de confirmación de la aplicación (MainLayout). Se usa en lugar del
      `confirm()` del navegador, que se puede bloquear tras el primer aviso y
      deja los botones sin hacer nada en silencio. */
  forgeConfirm?: (message: string, onConfirm: () => void, title?: string) => void;
}
