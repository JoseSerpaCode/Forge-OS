# Política de Seguridad de Forge OS

## Versiones Soportadas

Actualmente, solo la rama principal (`main`) y la versión activa en desarrollo reciben parches de seguridad. 

## Reporte de Vulnerabilidades

La seguridad es una prioridad crítica en **Forge OS**. Si descubres un problema de seguridad en el proyecto, **NO lo reportes abriendo un Issue público en GitHub**.

En su lugar, por favor envía un reporte detallado al correo electrónico:
📧 `joseserpamedinaxd@gmail.com`

Responderemos a tu reporte de manera privada lo antes posible para coordinar un parche antes de hacerlo público.

## Auditorías de Seguridad Interna

Forge OS ha pasado por rigurosas revisiones de seguridad internas que cubren vectores críticos de ataque, incluyendo pero no limitado a:
- Protección estricta contra inyección SQL (SQLi) mediante el uso exclusivo de prepared statements en `better-sqlite3`.
- Bloqueo y saneamiento contra Cross-Site Scripting (XSS) en todos los inputs e inyecciones de HTML (`innerHTML`).
- Control de Accesos (Insecure Direct Object References - IDOR) resuelto mediante guardias estrictos a nivel de Workspace.
- Prevención de Path Traversal y escalada de privilegios en el sistema de almacenamiento de archivos.
- Verificación exhaustiva contra vulnerabilidades SSRF en el motor de webhooks (Bloqueo de IPs internas y localhost).

Cualquier vulnerabilidad que evada estas protecciones será tratada como crítica.
