# Contribuyendo a Forge OS

¡Gracias por tu interés en contribuir a **Forge OS**! Este documento detalla nuestras convenciones y flujos de trabajo para mantener la calidad y seguridad del código.

## 🛠 Entorno de Desarrollo

1. Sigue las instrucciones de instalación en el [README.md](./README.md) para instalar dependencias con `npm install` y ejecutar `npm run dev`.
2. Asegúrate de estar corriendo en un entorno Node `>=22.12.0`.
3. Todos los cambios de la base de datos deben probarse localmente. Si modificas `schema.sql`, asegúrate de que la aplicación y el generador de seeds sigan funcionando.

## 🧪 Pruebas (Testing)

Usamos **Playwright** y **Vitest** para pruebas E2E y unitarias. 

- Para correr los tests E2E:
  ```bash
  npx playwright test
  ```
- **Estándar de Evidencia:** Toda PR que incluya cambios en la autenticación, seguridad, guardias de base de datos o lógica crítica de negocio **DEBE** ir acompañada de una prueba automatizada en la carpeta `tests/`. No se aceptarán cambios de seguridad basándose únicamente en la descripción de la PR.

## 🌿 Convención de Ramas (Branches)

Nombramos nuestras ramas utilizando el siguiente estándar:
`[tipo]/[nombre-modulo]`

Tipos válidos:
- `feature/` - Para nuevas funcionalidades (ej. `feature/kanban-rebalance`).
- `fix/` - Para correcciones de errores (ej. `fix/auth-cookie-bug`).
- `chore/` - Tareas de mantenimiento, dependencias o configuración (ej. `chore/update-deps`).
- `docs/` - Actualizaciones de documentación.

## 📝 Reglas Generales de Código

1. **Vanilla JS por encima de frameworks pesados:** Este proyecto utiliza Vanilla JavaScript puro para la lógica del frontend. Evita agregar librerías de UI externas innecesarias.
2. **Seguridad ante todo:** Todo input debe ser sanitizado. Los archivos subidos deben validarse rigurosamente por tipo MIME y limitarse a `10MB`.
3. **i18n:** Si agregas texto a la interfaz de usuario, debe pasar por el sistema de internacionalización (`src/i18n/ui.ts`). Nunca dejes strings quemados ("hardcoded") en las vistas.

¡Esperamos con entusiasmo tus Pull Requests!
