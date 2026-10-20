# Diagnóstico visual y propuestas de rediseño

Estado a 19 de octubre de 2026, sobre `main` en `39bc61c` (v1.28.5).

Este documento no cambia código. Contiene:

1. **Por qué la aplicación parece hecha con IA**, para no repetir esos errores.
2. **Las inconsistencias** del sistema visual actual: colores, tipografía,
   componentes, espaciado y logo.
3. **Tres identidades nuevas completas**, con logo, paleta y tipografía.
4. **Un plan por fases**, pantalla por pantalla, empezando por el tablero.

---

## 0. Método

Las cifras salen de tres fuentes, para no opinar a ojo:

- **Recuento estático** con `grep` sobre `src/components`, `src/layouts` y
  `src/pages` (sin `src/pages/api`): clases de Tailwind, valores arbitrarios,
  hexadecimales, animaciones y bloques `<style>`.
- **Capturas reales** con la base de demostración (`npm run seed`, en una base
  temporal fuera del repositorio):
  - 13 pantallas autenticadas y 3 públicas, en tema claro y oscuro, a
    1440×900.
  - El tablero y el hub a 390×844.
  - La portada completa, de arriba abajo.

  Además se midió el DOM del tablero a 1280, 1440, 1600 y 1920 px.
- **Contraste calculado** con la fórmula de luminancia relativa de WCAG 2.x,
  componiendo la opacidad cuando el texto la lleva. Son cálculos, no una
  pasada de axe: lo que contradiga la auditoría anterior hay que confirmarlo
  en el navegador.

---

## 1. Por qué parece hecho con IA

### 1.1 El mecanismo

Una interfaz «parece IA» cuando está hecha de **las elecciones más probables**.
Los generadores de código aprendieron de miles de plantillas de 2022-2025:
shadcn/ui, Tailwind UI, portadas al estilo Vercel o Linear. Si nadie decide
otra cosa, devuelven la media de ese corpus. Ninguna de esas elecciones está
mal por separado. El problema es que:

1. **Vienen todas juntas.** Cuando aparecen diez a la vez, el ojo reconoce la
   plantilla antes que el producto.
2. **No responden a nada propio.** Están ahí porque son lo que sale por
   defecto, no porque Forge las necesite. Un resplandor que no significa nada
   es la firma más clara de algo que nadie decidió.
3. **Cada pantalla se generó por separado.** Esto se ve en el código: 29
   variantes de botón principal y 17 modales con 4 radios distintos son
   exactamente lo que pasa cuando cada pantalla se pide por su cuenta y nadie
   unifica después. **La inconsistencia es en sí misma una huella de IA.**

### 1.2 Los rasgos, medidos en Forge

| Rasgo | Dónde | Cifra |
|---|---|---|
| **Fondo casi negro con un único acento saturado** | `#0D0B0A` con `#FF5D00`, la combinación «oscuro + neón» por defecto | Tema oscuro por defecto |
| **Emblema = letra en un cuadrado redondeado con gradiente y halo** | `Logo.astro`, `forge-icon.svg` | Es la forma de icono que más se genera |
| **Resplandores y halos** | punto de columna, logo, botones (`shadow-[0_0_15px_rgba(255,93,0,0.3)]`) | 12 sombras de resplandor |
| **Manchas de gradiente radial** | detrás del titular de la portada y del acceso, tarjetas del bento | 10 `radial-gradient` y 13 gradientes lineales |
| **Desenfoque de cristal** | barra superior, columnas, modales | 33 `backdrop-blur` o `blur` |
| **Inter para todo y mono «técnica» para adornar** | toda la app | 67 `font-mono`, casi ninguno para código |
| **Antetítulos en mayúsculas espaciadas** | «OPEN SOURCE · NO SUBSCRIPTION · SELF-HOSTED», «TIME», «WORKSPACE», etiquetas de campo | 105 `uppercase` y 81 `tracking-wider/widest` |
| **Tarjetas `rounded-xl` con borde de 1 px a baja opacidad** | todas las pantallas | 115 `rounded-xl/2xl`, `border-forge-border/40` |
| **Iconos Lucide con trazo 2** | toda la app (hay hasta una clase `lucide lucide-chevron-right`) | 221 `<svg>` en línea |
| **Elevación al pasar el ratón** | tarjetas, botones, enlaces de la barra lateral | 17 `hover:-translate-y` o `scale-105` |
| **Animaciones de adorno** | `animate-ping`, `animate-pulse`, `animate-bounce`, barra que late | 8 |
| **Rejilla «bento»** | `landing/Bento.astro`, con una tarjeta huérfana en la segunda fila | 500 líneas |
| **Aparición al hacer scroll** | `.reveal` en el bento | Deja **~1000 px en negro** en una captura de página completa |
| **Ventana falsa con tres puntos de semáforo** | `TypeDemo.astro` (`.td-chrome`) | En el titular |
| **Demostración que se escribe sola** | `TypeDemo.astro` | En el titular |
| **Código en el titular** | «inside `forge.db`» en una píldora mono naranja | Portada y acceso |
| **Tarjetas de cifras genéricas** | «PENDING ISSUES 9», «KB PAGES 3» | Panel |
| **Estado vacío = icono en un cuadrado + título + frase** | bases de datos, columnas | — |

### 1.3 El texto también delata

La IA no solo elige colores. Este texto es de la propia interfaz
(`src/i18n/en/*.ts`):

- «Forge is **Better with Friends**», «**Bring your ideas to life** by
  collaborating with others»: frase de marketing en mayúsculas de título,
  dentro de una herramienta de trabajo.
- «Think of it as your own integrated spreadsheet or **Notion** table»: el
  producto se explica comparándose con otro.
- «Dashboard — Workspace Overview», «Analyze team performance and workload»:
  subtítulos que repiten el título con otras palabras.
- «Welcome back, avery»: el saludo por defecto de cualquier panel generado.

Los directorios de componentes se llaman `jira/` y `notion/`. No es un
problema visual en sí, pero explica uno: **la interfaz imita a Jira y a Notion
sin un punto de vista propio**, y la mezcla de dos productos ajenos con estilo
de plantilla es justo lo que se lee como genérico.

Curiosamente, la portada ya tiene el antídoto. Sus textos son concretos y
honestos: «A closed laptop does not cost an hour of tracked work», «Pulled
straight from the changelog, so it cannot quietly go stale». Esa voz es la
que el producto debería tener en todas partes. **El texto es lo más barato de
cambiar y lo que más humaniza.**

### 1.4 Reglas para no volver a caer

Cada regla responde a un rasgo de la tabla. Sirven para cualquiera de las
tres identidades.

1. **Cada decisión visual tiene que poder justificarse con una frase sobre
   Forge.** Si la única razón es «queda moderno», fuera.
2. **Un color significa una cosa.** El acento es acción. Los colores de
   estado son estado. El rojo es error. Nada «decora» con color.
3. **Sin efectos que no codifiquen información:** gradientes, resplandores,
   desenfoque, manchas radiales o animaciones perpetuas. Una sombra solo
   indica que algo flota (menú, modal, tarjeta arrastrada).
4. **El movimiento responde a una acción del usuario:** arrastrar, abrir,
   guardar. Nada se mueve al pasar el ratón ni al hacer scroll.
5. **Mayúsculas espaciadas: como mucho un uso, con regla escrita.** Por
   ejemplo, solo cabeceras de columna. Mono solo para código, atajos de
   teclado y claves.
6. **Ni Inter, ni Geist, ni Space Grotesk, ni Instrument Serif, ni DM Sans,
   ni Plus Jakarta, ni Manrope, ni Satoshi.** Hoy son la tipografía por
   defecto de lo generado. Hace falta una familia elegida por una razón.
7. **Iconos de un solo juego, con grosor ligado al tamaño, y menos.** Un
   icono junto a cada etiqueta de la barra lateral es redundante.
8. **Ninguna maqueta de plantilla en la portada:** ni bento, ni ventana falsa
   con semáforo, ni texto que se escribe solo, ni fila de «4 cifras». Se
   enseña el producto real, en capturas reales.
9. **Texto en tipo oración, concreto y sin superlativos.** Se describe lo que
   pasa («Los archivos se guardan en tu Drive»), no la emoción («Bring your
   ideas to life»).
10. **La consistencia es parte de la identidad.** Un solo botón, un solo modal,
    un solo campo. Sin componentes no hay identidad que valga, porque cada
    pantalla nueva vuelve a la media.

---

## 2. Inconsistencias del sistema actual

Siguen siendo válidas sea cual sea la identidad elegida: son los errores que
el rediseño tiene que cerrar, no heredar. La gravedad va de **A** (falla una
norma o confunde al usuario) a **C** (deuda).

Lo que **sí está bien** y no hay que perder:

- La adopción de tokens: unas 2000 apariciones de `forge-*` frente a 105 de la
  paleta por defecto de Tailwind.
- El trabajo de contraste documentado en `themes.css`.
- El logo convertido en un trazado (no en una fuente).
- Las reglas móviles de área táctil y de controles que aparecen al pasar el
  ratón.

### 2.1 Color

**A. Fallos de contraste vigentes.** Contradicen el «0 fallos» de la auditoría
anterior; aparecen en estados o temas que probablemente no se recorrieron:

| Dónde | Combinación | Contraste | Mínimo |
|---|---|---|---|
| `Hub.astro:268`, botón del banner | `text-white` sobre `bg-forge-secondary` (oscuro, `#FF8533`) | **2,43:1** | 4,5:1 |
| `IssueCard.astro:136`, botón Stop | `text-forge-bg` sobre `bg-forge-secondary` (claro), a 10 px | **4,27:1** | 4,5:1 |
| `IssueCard.astro:69`, descripción | `text-forge-muted` con `opacity-80` (claro) | **4,28:1** | 4,5:1 |
| `BoardColumn.astro:54`, «DROP ZONE» | `text-forge-muted` con `opacity-60` | **2,68:1** claro / 3,42:1 oscuro | 4,5:1 |

Los cuatro rompen reglas que `docs/desarrollo.md` ya escribe. **La regla existe pero
nada la comprueba.**

**A. Restos de una identidad anterior en cian (`#00E5FF`).**

- El elemento activo y el `:hover` de la barra lateral
  (`Sidebar.astro:358-370`): en oscuro es una píldora verde azulada con el
  texto en naranja; en claro, una píldora azul celeste.
- La sombra de una tarjeta del hub (`Hub.astro:137`).
- El avatar por defecto (`public/default-avatar.svg`), con fondo `#090A0F`
  fijo: en tema claro sale un círculo casi negro en el tablero, el panel y el
  hub.

**A. El estado de un ticket no tiene color propio, y cada pantalla le da uno
distinto:**

- **Tablero:** las cuatro columnas llevan el mismo punto naranja con halo.
- **Hub y panel:** «in progress» es azul y «todo» gris.
- **Métricas:** gris, `#3b82f6` y `#10b981`, escritos a mano
  (`metrics/index.astro:190-192`).
- **Carga de trabajo del panel:** barras **rojas**, el color del error.

El vocabulario tampoco coincide. «Por hacer» aparece como «TODO» (cabecera de
columna), «To do» (pestañas móviles), «todo» (desplegable móvil y píldoras) y
«TODO» otra vez en la leyenda de métricas.

**B. Las gráficas ignoran el tema.** `Chart.defaults.color = '#8b949e'` lleva
el comentario `// forge-muted`, pero es el gris de GitHub, no el de Forge.
Sobre blanco, el verde (`#10b981`, 2,54:1) y el ámbar (`#f59e0b`, 2,15:1)
quedan por debajo del 3:1 que WCAG 1.4.11 pide a los objetos gráficos.

**B. La paleta de Tailwind convive con los tokens:** 105 apariciones, 79 de
ellas rojas, casi todas en las dos páginas de ajustes, actividad y perfil. En
tema claro la tinta del error es `#C41C1C` pero su fondo sigue siendo
`red-500` al 10 %: dos tonos distintos para el mismo aviso.

**B. Los alias se solapan.** `forge-primary` y `forge-accent` son la misma
variable. `forge-accent-hover` se usa una vez. `border-forge-accent-primary`
(2 usos) **no genera clase**, porque `@theme` no la define.

**B. `forge-secondary` hace dos papeles.** Es color de marca (logo) y a la vez
color de foco (122 bordes), relleno (63) y anillo (29). Como en claro vale
`#CC4A00`, el logo cambia de color con el tema (ver 2.5).

**C. Las superficies apenas se distinguen.** Panel frente a fondo: 1,09:1 en
oscuro, 1,08:1 en claro. El borde frente al fondo: 1,37:1 y 1,21:1, y casi
siempre al 40-60 %. La jerarquía de capas depende de líneas que casi no se
ven: por eso el oscuro parece «cajas dentro de cajas» y el claro parece plano.

### 2.2 Tipografía

**A. Se usan pesos que no se cargan.** `MainLayout.astro:87-88` pide Inter
400–700. La aplicación usa `font-black` (900) 14 veces y `font-extrabold`
(800) 3, y el logotipo pide 800. El navegador sintetiza esos pesos, así que
**«Forge OS» se dibuja distinto en la portada** (`PublicLayout` sí carga el
800) **y en la barra lateral**.

**A. Las fuentes vienen de Google Fonts.** Cada visita manda la IP del
usuario a un tercero, en un producto que presume de no depender de terceros.
En la UE hay jurisprudencia en contra de hacerlo sin consentimiento
(LG München, 2022). Alojarlas en el propio servidor también quita dos
`preconnect` en la VM.

**B. Hay unos 45 tamaños de letra:**

- 9 tamaños nombrados de Tailwind.
- 6 arbitrarios: `[8px]` ×5, `[9px]` ×15, `[10px]` ×87, `[11px]` ×24,
  `[13px]` ×4 y `[15px]` ×2.
- Unos 30 valores en rem dentro de bloques `<style>`.

Hay 131 elementos por debajo de 12 px. El bloque móvil de `themes.css` que
reescribe `.text-\[10px\]` es el síntoma de que la escala vive fuera del
sistema.

**B. La jerarquía por peso está aplanada.** Hay 292 `font-bold` frente a 59
`font-semibold`: si casi todo es negrita, la negrita deja de marcar nada. El
`<h1>` de las diez pantallas principales usa tres tamaños y tres pesos.

**B. Hay cuatro tratamientos para el mismo nivel de metadato:**

- Cabecera de columna: sans, 13 px, mayúsculas.
- Etiqueta de campo: `text-xs`, mayúsculas, `tracking-wider`.
- Widget de tiempo: mono, 9 px, mayúsculas.
- Insignia de tipo: 10 px, `tracking-widest`.

### 2.3 Componentes

**A. No hay capa de componentes.** No existe `Button`, `Input`, `Modal`,
`Badge` ni `PageHeader`.

- **Botones principales:** 29 cadenas de clases distintas. Radios de
  `rounded` a `rounded-full`. Cinco efectos distintos al pasar el ratón,
  entre ellos `hover:bg-opacity-90` (`board.astro:424`), que **no hace nada
  en Tailwind 4**.
- **El botón principal no es uno:** en bases de datos es blanco y negro; en
  el hub, naranja claro con texto blanco; en el resto, naranja con texto
  oscuro.
- **Modales:** 17 `<dialog>` con radios `lg`, `xl`, `2xl` y `3xl`, fondo de
  `black/40` a `black/80` y siete anchos máximos.
- **Campos:** tres estilos en la misma pantalla. El modal del ticket mezcla
  desplegables con flecha propia y nativos, de alturas distintas.
- **Iconos:** 221 `<svg>` en línea frente a 3 usos de `Icon.astro`, con
  trazos de 1,5 a 3,5.
- **Chips:** cuatro estilos de píldora para cosas equivalentes (tipo,
  etiqueta, estado, rol).
- **Sombras:** nueve arbitrarias. Las negras densas se aplican también en
  tema claro.

**B. El foco se apaga en 91 sitios.** `focus:outline-none` gana al anillo
global de `@layer base`. Unos 62 lo sustituyen por `focus:ring`; los demás se
quedan solo con un cambio de color del borde. Hay que revisarlos contra WCAG
2.4.7.

**B. El movimiento es adorno.** Una tarjeta del tablero hace cinco cosas al
pasar el ratón: sube, cambia la sombra, cambia el borde, pone el título en
naranja y ensancha la franja. Y la tarjeta es arrastrable: moverla justo
antes de agarrarla resta precisión.

**C. Detalles sueltos:**

- `Sidebar.astro:382` tiene un `</style>` sobrante.
- Quedan textos escritos a mano sin i18n en el tablero: «Start», «Stop»,
  «Name», «DROP ZONE», «{workspace} Board» y «h registradas».
- La portada en inglés muestra el registro de cambios en español, con franja
  **roja** para entradas «FIXED»: se lee como una lista de errores.

### 2.4 Espaciado y maquetación

**A. El tablero no cabe en un portátil.** Cada columna tiene un mínimo de
320 px. A 1280 y a 1440 px se ven **3 columnas**; la cuarta («Done») queda
cortada y obliga a desplazarse en horizontal. Las cuatro caben solo desde
unos 1600 px. Cada tarjeta mide **199 px**: con 900 px de pantalla caben unas
tres por columna.

**A. Cada tarjeta lleva ruido que no informa:**

- Un id que es `id.substring(0,8)` de un `crypto.randomUUID()`: ocho
  caracteres hexadecimales en naranja, mayúsculas y mono, encima del título.
- Un botón «Start» en todas las tarjetas.
- Un avatar vacío aunque no haya responsable.

**B. Cada pantalla decide su contenedor y su cabecera:**

- **Panel, tablero y bases de datos:** ancho completo.
- **Métricas:** 16 px más adentro.
- **Archivos:** centrado a unos 900 px.
- **Hub:** centrado a unos 1024 px.
- **Ajustes:** centrado a unos 976 px.

El título de página cae entre 103 y 159 px según la pantalla, así que el
contenido salta al navegar.

**B. La escala de espaciado es demasiado fina.** Los medios pasos son muy
frecuentes (`gap-1.5` ×33, `py-1.5` ×56, `py-2.5` ×28): cajas que difieren
en 2 px sin intención.

### 2.5 Logo

- **El color cambia con el tema.** El gradiente termina en
  `--forge-accent-secondary` (`Logo.astro:59-60`), que vale `#FF8533` en
  oscuro y `#CC4A00` en claro. Con el favicon, son tres emblemas distintos.
- **El halo tiene esquinas rectas.** Es un `box-shadow` sobre una caja
  cuadrada, alrededor de un emblema redondeado. Se nota a tamaño `xl`.
- **La forma en sí es el problema de fondo:** una letra blanca en un
  cuadrado redondeado con gradiente naranja y halo. Es la plantilla de icono
  de aplicación más repetida de los últimos años y no dice nada de «forja».
  Ordenarlo no basta: **hay que sustituirlo**, como pides.

---

## 3. Tres identidades nuevas

Las tres cumplen las reglas de 1.4 y comparten la misma estructura de tokens,
así que el plan de la sección 4 vale para cualquiera:

```
bg · surface-1 · surface-2 · border · border-strong
text · muted · accent · on-accent · accent-text · focus
status-todo · status-progress · status-review · status-done · danger
```

**Todas las combinaciones están calculadas para AA en los dos temas:**

- Texto, tenue, `accent-text`, peligro y los cuatro estados: ≥ 4,5:1 sobre el
  fondo y sobre las dos superficies. Los estados valen también como texto.
- Borde fuerte y anillo de foco: ≥ 3:1.
- El borde normal se queda en 1,3–1,4:1 a propósito: es decorativo. Los
  controles interactivos usan el borde fuerte.

Las familias tipográficas son todas **OFL**, así que se pueden alojar en el
propio servidor.

### Identidad 1 — «Taller»

**Concepto.** El nombre ya dice «forja», y la forja tiene un lenguaje visual
propio que ninguna plantilla usa: **la marca del herrero**. Es el punzón que
se estampa en el metal, y no se parece nada a un halo de neón. La interfaz
toma el registro de la señalética de taller: tinta sobre papel gris cálido,
naranja de seguridad plano, rótulos condensados y bordes duros. Es una
herramienta de trabajo, no un escaparate.

**Por qué no parece IA:**

- Es **claro por defecto**. El oscuro existe, pero es grafito cálido, no
  negro neón.
- El naranja se usa como en una nave industrial: en superficies planas que
  señalan acción, sin degradados.
- Una tipografía condensada no sale nunca por defecto.

| Token | Claro (por defecto) | Oscuro |
|---|---|---|
| bg | `#EEECE7` | `#1B1A18` |
| surface-1 | `#F8F7F4` | `#232220` |
| surface-2 | `#E4E1DA` | `#2C2A27` |
| border / border-strong | `#CFCAC0` / `#7D776C` | `#3D3A36` / `#857E74` |
| text / muted | `#171614` / `#57534B` | `#ECE9E3` / `#ABA59B` |
| accent (relleno) / on-accent | `#E8590C` / `#171614` | `#F06A1F` / `#171614` |
| accent-text | `#A63C00` | `#FF9452` |
| focus | `#171614` (anillo de tinta, 2 px) | `#ECE9E3` |
| todo · progress · review · done | `#9C5A0F` `#1E5AA8` `#A23B72` `#266B2A` | `#BF7F28` `#5A8FE6` `#C66BB0` `#3FA86A` |
| danger | `#A61E1E` | `#FF7A6E` |

Los estados se usan solo como color de marca gráfica (muestra, cinta de
columna, barra), nunca como color de texto: el texto que los acompaña va en
tinta.

Estos cuatro valores sustituyen a una primera versión (gris, azul, ámbar y
verde) que no pasaba la validación de paletas categóricas. Hecho y En revisión
quedaban a ΔE 4 para deuteranopía, es decir, indistinguibles en las gráficas.
Los actuales pasan las cinco comprobaciones (banda de luminosidad, croma
mínimo, separación para daltonismo, separación con visión normal y ≥ 3:1
sobre la superficie) en los dos temas.

**Maquetas:** `docs/rediseno/index.html` enlaza las pantallas estáticas de
esta identidad, en claro y oscuro. Además de las once primeras:

- **Pantallas que faltaban:** ajustes del espacio (miembros y roles,
  solicitudes, tipos, etiquetas, automatizaciones, Drive, borrado con
  confirmación escrita), registro, personas, perfil público, actividad,
  índice de notas, editor en uso (menú «/», barra de formato, asa, tabla en
  edición, enlace a ticket) y 404.
- **`ventanas.html`:** las 16 capas (nuevo ticket, nuevo sprint, cerrar
  sprint, registrar tiempo, menú del sprint, nueva tabla, nueva fila,
  borrado, nuevo espacio, añadir miembro, automatización, ⌘ K,
  notificaciones, etiquetas, cambio de espacio y avisos).
- **`estados.html`:** esqueletos estáticos, errores de formulario con
  resumen, sin permiso (lectura, prueba, invitado, 403), sin conexión,
  error del servidor y vacíos tipográficos, sin ilustraciones.
- **`movil.html`:** cuatro pantallas reales a 390 px — barra inferior de
  cuatro destinos (Panel, Tablero, Notas, Más), ticket como hoja, editor con
  teclado y la hoja «Más».
- **`componentes.html`:** cada pieza en reposo, encima, foco, pulsado,
  deshabilitado, error y cargando; 51 iconos propios (las piezas con forma
  de columna acaban en arco); tabla de movimiento con su alternativa para
  `prefers-reduced-motion`; y la regla de colores elegidos por el equipo,
  con el contraste calculado: el color nunca tiñe texto, va en punto y
  tinte, y con esos tintes cualquier color deja el texto por encima de
  4,5:1.
- **`marca.html`:** imagen para redes de 1200 × 630, favicons de 16 y 32,
  icono de Apple, 192, 512 y adaptable de Android, exportados a
  `docs/rediseno/marca/` desde el mismo trazado.
- **Métricas:** ayuda flotante en el burndown y conmutador «Gráfica |
  Tabla»: cada gráfica tiene su tabla.

Las 27 páginas pasan **axe-core** (WCAG 2.1 A/AA y buenas prácticas) sin
fallos, en los dos temas, a 1280 y a 390 px, y ninguna desborda en
horizontal a 390 px.

**Tipografía:**

- **Archivo** (Omnibus-Type), variable con eje de anchura de 62 a 125:
  - Ancho normal para la interfaz.
  - **Condensado** para títulos de página y cabeceras de columna. Es el único
    sitio con mayúsculas, como un rótulo de taller.

  El condensado tiene además una ventaja práctica: hace que quepan cuatro
  columnas en un portátil.
- **IBM Plex Mono** solo para código y atajos de teclado.
- **Escala:** 12 · 13 · 14 · 16 · 20 · 26 · 34.
- **Pesos:** 400, 500 y 700.

**Forma:**

- **El arco de la fragua es la forma de firma**, sacada del logo:
  - Las columnas del tablero rematan en medio óvalo.
  - Los avatares tienen forma de arco.
  - En la portada, el acceso y el índice, una gran boca de fragua naranja
    enmarca el producto o la frase principal.
- **Esquinas suaves en lo demás:** 10 px en controles, 14 a 16 px en
  tarjetas y paneles. Botones, pestañas, etiquetas y estados en píldora.
- **Color con significado:**
  - Cada columna va teñida de su estado.
  - El tipo de ticket, las etiquetas y el estado son píldoras teñidas de su
    color, con el texto siempre en tinta.
  - Cada persona tiene un tono, que se ve en su avatar y en la carga de
    trabajo.
- **Contraste de anchura tipográfica:**
  - Títulos en Archivo muy estrecho (68 %) y peso 800.
  - Las cifras que importan (contadores de columna, horas, avance, puntos)
    en Archivo extendido (125 %).
- **Sombra** solo en la tarjeta arrastrada y en las capas flotantes. La
  tarjeta arrastrada se inclina 2,5°.
- **Ilustración:** personas abstractas hechas con las formas de la marca, sin
  cara ni rasgos: cuerpo en arco como los avatares, cabeza circular y
  extremidades como trazos redondeados de grosor fijo.
  - Llevan los tonos de las personas del espacio y juegan en la fragua como
    en un parque.
  - **Escena grande** en «Entrar» (juegan en la fragua) y en «Crear cuenta»
    (gente que llega: una entra con su tarjeta nueva, otra trepa y la de
    arriba le da la mano, otra trae una brasa). Misma fragua, otra historia.
  - **Figuras sueltas y pequeñas** en la portada, una por sección y ocupada
    en algo de esa sección: de pie sobre la etiqueta del archivo, con un
    ticket sobre el arco del tablero, lanzando una brasa junto a «Qué hace»,
    sentada en el borde de la ficha técnica, saltando sobre la llamada final
    y despidiéndose en el pie. Del tamaño de un icono grande: acompañan, no
    compiten.
  - No en pantallas de trabajo ni en estados vacíos, que se quedan
    tipográficos.
  - Se evita a propósito el estilo de ilustración corporativa de miembros
    exagerados, otro rasgo típico de lo generado.
- Densidad alta.

Esta forma sustituye a una primera versión de esquinas de 2 px que resultaba
demasiado rígida. El atrevimiento sale del logo y de la tipografía, no de
efectos: siguen sin gradientes, halos ni desenfoques.

**El tablero:**

- Columnas tituladas en Archivo condensado y mayúsculas, con una barra de
  color de estado de 4 px bajo el rótulo, como cinta de suelo.
- Tarjetas como fichas de producción: título, fila de tipo, etiquetas y
  responsable, y una muesca de color en la esquina superior en vez de la
  franja lateral.
- Al arrastrar, la tarjeta se inclina 1° y proyecta sombra. Es el único
  movimiento de la pantalla.

**Logo — «Fragua» (elegido).** La boca de una fragua sobre su hogar, con las
brasas encendidas dentro. Sustituye al primer boceto de esta identidad, un
cartucho de punzón con «FO» en hueco. Las cuatro propuestas que se
compararon, y por qué se descartaron las otras tres, están en
`docs/rediseno/logo.html`.

- **Construcción:** dos formas sobre una rejilla de 64 × 64.
  - Un arco con hueco que se apoya en una base más ancha: la fragua y su
    hogar.
  - Un montículo de brasas que repite la curva del arco.
- **Significado:** es el sitio donde se trabaja, lo mismo que un espacio de
  Forge. «Hogar» es a la vez el fuego de la fragua y la casa.
- **Color:**
  - El arco va en el color del texto: tinta sobre papel, papel sobre
    grafito.
  - Las brasas van siempre en el naranja de marca `#E8590C`, que es fijo y no
    cambia con el tema.
  - En una sola tinta también funciona: las brasas quedan como forma maciza
    dentro del hueco.
- **Icono de aplicación y favicon:** el símbolo al 70 % dentro de un
  cuadrado redondeado en tinta (`rx` 14 sobre 64). El cuadrado es la forma
  que piden iOS y Android para los iconos; aquí lo lleva solo el icono, no el
  logo. Hay una variante sobre naranja.
- **Logotipo:** «Forge OS» en Archivo bold, ancho normal, interletra −0,02 em,
  a la derecha del símbolo.
- **Variantes descartadas para el interior:**
  - Una gota de fuego simétrica: se leía como agua o como un marcador de mapa.
  - Una llama con lengua lateral: se parece a la de Tinder.
  - Una barra horizontal: parecía una señal de prohibido.
- **Pendiente:** buscar en el registro de marcas (clases 9 y 42) si hay
  algo parecido con «Forge» y un arco o una llama. No está hecho.

**Riesgos:**

- Archivo condensado en exceso cansa: limitarlo a títulos y cabeceras.
- El tema claro por defecto cambia la costumbre de quien ya usa la app en
  oscuro. Se puede mantener la preferencia guardada.

### Identidad 2 — «Cuaderno de ingeniería»

**Concepto.** El cuaderno de laboratorio o de proyecto: papel, tinta azul,
lápiz rojo para lo que corre prisa. La portada ya habla a este público
(«Hand in lab report 4», «Notes on chapter 7», «Midterm 2»). El modo oscuro
es un **plano azul (cianotipo)**, no negro, y eso basta para distinguirlo de
cualquier plantilla oscura.

**Por qué no parece IA:**

- El acento es **azul tinta** y no un neón, lo que ya rompe la combinación
  «negro + naranja».
- La serifa en las notas da una voz que ninguna interfaz generada tiene.
- La rejilla milimetrada aparece **solo** donde hay vacío (estados vacíos,
  zona de soltar), como el papel que asoma.

| Token | Claro (papel) | Oscuro (plano azul) |
|---|---|---|
| bg | `#F6F4EE` | `#0F1B2D` |
| surface-1 | `#FDFCF8` | `#15233A` |
| surface-2 | `#EEEBE3` | `#1C2D47` |
| border / border-strong | `#DCD7CC` / `#8A8478` | `#2A3D5C` / `#7187A8` |
| text / muted | `#1B1F2A` / `#565B66` | `#E8EEF7` / `#A7B4C8` |
| accent (relleno) / on-accent | `#2340A0` / `#FFFFFF` | `#8FB4FF` / `#0F1B2D` |
| accent-text | `#2340A0` | `#A3C2FF` |
| focus | `#2340A0` | `#FFD166` (lápiz amarillo sobre plano) |
| todo · progress · review · done | `#5F636D` `#0B6A6E` `#7A45AD` `#286B32` | `#9AA8BC` `#5FD0CF` `#C9A6FF` `#7FD68B` |
| danger (lápiz rojo) | `#B3261E` | `#FF8A80` |

**Tipografía:**

- **Literata**: títulos de página y cuerpo de las notas. Está diseñada para
  leer mucho rato en pantalla.
- **Public Sans**: la interfaz. Es neutra pero no es Inter; viene del sistema
  de diseño del gobierno de EE. UU. y prioriza la legibilidad.
- **Source Code Pro**: código.
- **Escala:** 12 · 13 · 14 · 16 · 18 · 24 · 32. Notas a 17 px con medida de
  70 caracteres.

**Forma:**

- Radios de 4 px (controles) y 6 px (tarjetas).
- Bordes finos.
- Sin sombras. La elevación se marca con el papel más claro (`surface-1`) y
  un borde.

**El tablero:**

- Columnas separadas por una línea vertical de margen, como la de un
  cuaderno, en vez de cajas.
- Tarjetas como fichas apuntadas: título en Public Sans semibold, fecha en
  lápiz rojo si vence.
- Estado vacío con la rejilla milimetrada.

**Logo — la F trazada sobre milimetrado.**

- **Emblema:** una «F» construida rellenando celdas de una rejilla de 5×6,
  como se dibuja una letra en papel cuadriculado.
- **Color:** tinta azul. En modo oscuro, blanco sobre plano azul.
- **Favicon:** la versión de 16 px se ajusta a una rejilla de 4×5 con celdas
  enteras, así que **se ve nítida sin antialias**, algo que un logo con
  gradiente no consigue nunca.
- **Logotipo:** «forge» en Literata semibold, en minúsculas, y «OS» en
  versalitas de Public Sans. Une la voz de las notas con la de la
  herramienta.

**Riesgos:**

- El azul tinta es un acento menos llamativo que el naranja: el botón
  principal tiene que ganarse la atención por tamaño y posición.
- Se pierde el naranja de la marca actual, que es lo que asocian quienes ya
  conocen el proyecto.
- El plano azul es muy característico. Si no gusta, no hay término medio.

### Identidad 3 — «Fichero»

**Concepto.** La oficina física de antes de las pantallas: carpetas de
manila, fichas, etiquetas adhesivas de colores, sellos de caucho. Un ticket
es una ficha; una página de notas es una hoja en una carpeta; los estados son
pegatinas. Es la más cálida y humana de las tres.

**Por qué no parece IA:** el acento es **ocre manila con texto en tinta**,
una combinación que ningún generador elige. Los estados son pegatinas
planas con color de fondo (no puntos con halo), y no hay un solo efecto.

| Token | Claro | Oscuro (escritorio de noche) |
|---|---|---|
| bg | `#F3EFE6` | `#1E1A16` |
| surface-1 (ficha) | `#FFFDF8` | `#26211C` |
| surface-2 (manila) | `#EAE3D4` | `#302A23` |
| border / border-strong | `#D8CFBD` / `#8C8270` | `#423A30` / `#8A7F6E` |
| text / muted | `#26221C` / `#5E574B` | `#EFE8DC` / `#B3A994` |
| accent (relleno) / on-accent | `#D9A21B` / `#26221C` | `#E3B23C` / `#1E1A16` |
| accent-text | `#7A5600` | `#E8BE5A` |
| focus | `#26221C` | `#EFE8DC` |
| todo · progress · review · done | `#6B6457` `#1F5E99` `#8A4396` `#2E6B4E` | `#ADA391` `#77AEE6` `#D29AE0` `#7CC59D` |
| danger (sello rojo) | `#B3261E` | `#FF8A7A` |

**Tipografía:**

- **Atkinson Hyperlegible Next** y **Atkinson Hyperlegible Mono** (Braille
  Institute, 2025). Sus formas están pensadas para que ninguna letra se
  confunda con otra, y eso les da un carácter propio. Además, la historia de
  accesibilidad encaja con el trabajo de contraste que el proyecto ya hizo.
- **Escala:** 13 · 14 · 15 · 17 · 20 · 26 · 32. Es un poco más grande que
  las otras dos, porque la familia es más ancha.
- **Pesos:** 400, 600 y 700.

**Forma:**

- Radios de 3 px en las fichas, con una **pestaña** superior en la cabecera
  de columna y en las carpetas de notas.
- Bordes de 1 px.
- Sin sombras salvo al arrastrar. Una ficha arrastrada se ve levantada del
  montón.

**El tablero:**

- Cada columna es una bandeja con pestaña de su color de estado.
- Las tarjetas son fichas con una línea de renglón bajo el título.
- Los tipos de ticket y las etiquetas son pegatinas rectangulares de fondo de
  color pálido y texto oscuro.
- El temporizador activo se muestra como un sello «EN MARCHA» en ocre.

**Logo — la ficha con pestaña.**

- **Emblema:** una ficha rectangular con una pestaña en la esquina superior
  izquierda. La pestaña y dos renglones de distinta longitud forman, en el
  hueco, una «F».
- **Color:** ocre con líneas en tinta.
- **Favicon:** solo la ficha y la pestaña.
- **Logotipo:** «Forge OS» en Atkinson Hyperlegible Next Bold.

**Riesgos:**

- Es la más fácil de llevar al **pastiche**: texturas de papel, sellos
  torcidos, fuentes de máquina de escribir. Hay que dibujarla plana, sin una
  sola textura.
- El ocre se asocia menos a «tecnología», lo que es bueno para diferenciarse
  y malo si el público espera una herramienta de ingeniería.
- Rompe del todo con la marca actual.

### Comparación y recomendación

| | Taller | Cuaderno | Fichero |
|---|---|---|---|
| Continuidad con la marca actual | Media: se queda el naranja, cambia todo lo demás | Baja | Nula |
| Distancia del aspecto «IA» | Alta | Muy alta | Muy alta |
| Rinde en el tablero (densidad) | **La mejor**: el condensado hace que quepan 4 columnas | Buena | Media: la familia es ancha |
| Rinde en las notas (lectura) | Buena | **La mejor** | Buena |
| Relación con el nombre «Forge» | **Directa** (marca de herrero) | Indirecta | Ninguna |
| Riesgo de caer en caricatura | Bajo | Bajo | **Alto** |
| Coste de migración | Medio | Medio | Medio-alto |

**Recomiendo «Taller».** El motivo:

1. **Es la única cuya idea sale del propio producto.** «Forge» es forja, y la
   marca del herrero es un símbolo con siglos de historia que ninguna
   plantilla tiene. Las otras dos son buenas ideas, pero se podrían aplicar
   igual a cualquier otra aplicación.
2. **Resuelve el problema funcional más grave** (el tablero no cabe en un
   portátil) con la propia tipografía, no con un apaño.
3. **Conserva el naranja**, que es lo único de la marca actual con valor de
   reconocimiento, y lo despoja de todo lo que lo hacía parecer generado:
   gradiente, halo y fondo negro.

**Cuándo elegir otra:**

- **«Cuaderno»**, si el público principal son estudiantes y equipos
  académicos. La portada apunta a ello, y para ese público es la de más
  personalidad.
- **«Fichero»** solo si se quiere una ruptura total y alguien con criterio de
  diseño puede vigilar que no derive en caricatura.

**Antes de decidir, conviene una prueba barata:** maquetar **solo el tablero**
en dos identidades como HTML estático o en Figma, con datos reales de la
demostración, y mirarlas a 1440 px en los dos temas. Elegir sobre el tablero
de verdad es mucho más fiable que elegir sobre una paleta.

---

## 4. Plan por fases

**Principios para todas las fases:**

- **Una PR por fase**, con capturas antes y después en los dos temas y en
  móvil (`npm run screenshots`).
- **Los selectores de las pruebas no se tocan sin migrar la prueba en la
  misma PR.** El tablero usa muchos: `.issue-card` (17 veces),
  `.issue-card h4`, `.board-column[data-status=…]`, `.column-content`,
  `.issue-count`, `.btn-start-timer`, `.btn-stop-timer`, `.mover-issue`,
  `#issue-details-modal`, `#new-sprint-modal`, `#btn-sprint-menu` y los
  `#modal-issue-*`.
- **Cuidado con las reglas móviles de `themes.css`.** Seleccionan por el
  **texto de la clase** (`[class*="group-hover:opacity-100"]`,
  `.text-\[10px\]`…). Un componente nuevo que consiga el mismo efecto con
  otra clase **pierde en silencio** el arreglo táctil.
  `tests/e2e/escritorio-hover.spec.ts` y `tests/e2e/movil/` tienen que pasar
  en cada fase.
- **Las reglas de accesibilidad de `docs/desarrollo.md` siguen vigentes:** etiquetas
  que envuelven, `aria-label` en controles repetidos y `dark:` atado a
  `[data-theme]`.
- **Las reglas de 1.4 se comprueban en cada PR**, no solo al final.

### Fase 0 — Decisión e infraestructura

1. **Elegir la identidad** con la maqueta del tablero descrita arriba. Sin
   código de la aplicación.
2. **Arreglos que no esperan al rediseño** (una PR corta):
   - Los cuatro fallos de contraste de 2.1.
   - El cian de la barra lateral, del hub y del avatar por defecto.
   - `hover:bg-opacity-90`, `border-forge-accent-primary` y el `</style>`
     sobrante.
3. **Marca nueva («Fragua»):**
   - `public/forge-icon.svg` y `Logo.astro` con el mismo trazado de
     `docs/rediseno/logo.html`: rejilla de 64, arco con hueco y montículo de
     brasas. La nota de `docs/desarrollo.md` sigue valiendo: si cambias uno, cambia el
     otro.
   - Imagen de OpenGraph.
   - Color de la marca **fijo**, desacoplado de los tokens de tema.
4. **Tokens nuevos** en `themes.css`, con la estructura de la sección 3, más
   escalas de tipo, radios, sombras por tema, foco y estados. Los nombres
   actuales se quedan como **alias** mientras dure la migración.
5. **Fuentes en el propio servidor:** `woff2` en `public/fonts`, solo los
   pesos de la escala, con `preload` de las dos principales. Se quitan los
   `<link>` a Google Fonts.
6. **Componentes base** en `src/components/ui/`:
   - `Button`, `IconButton`.
   - `Field` con `Input`, `Select` y `Textarea`.
   - `Modal`: un radio, un fondo y tres anchos.
   - `Badge`: tipo, etiqueta, estado y rol.
   - `Avatar`, con un avatar por defecto que sigue el tema.
   - `Panel`, `PageHeader` y `EmptyState`.
   - Completar `Icon.astro` con los iconos que hoy van en línea.
7. **Una sola fuente para el estado** (`src/lib/status.ts`): clave, clave de
   i18n, token y orden. Grafía única en tipo oración.
8. **Tema de las gráficas**, leído de las variables CSS y repintado al
   cambiar de tema.
9. **Barandillas.** Una prueba de vitest, en la línea de
   `tests/guest-search.test.ts`, que falle si aparece en `src/components`,
   `src/layouts` o `src/pages`:
   - Un hexadecimal fuera de lista, la paleta de Tailwind o `#00E5FF`.
   - Opacidad sobre texto.
   - `text-white` o `text-forge-bg` sobre acento.
   - `text-[8-11px]`.
   - `bg-opacity-*`.
   - **Las huellas de 1.2:** `radial-gradient`, `backdrop-blur`, sombras
     `0 0 Npx` (halos), `hover:-translate-y`, `hover:scale-*`,
     `animate-ping` y `animate-bounce`. Cada una con lista de excepciones
     explícita que se vacía fase a fase.

   Además, una pasada de axe con Playwright en cada pantalla y tema.

### Fase 1 — Tablero

Archivos:

- `w/[sys_tag]/board.astro`
- `components/jira/KanbanBoard.astro`, `BoardColumn.astro`, `IssueCard.astro`
  e `IssueDetailsModal.astro`
- `labels/LabelChip.astro` y `labels/LabelPicker.astro`

Cambios:

1. **Maquetación:**
   - Columnas con `minmax(15rem, 1fr)`: **cuatro a 1280 px** sin
     desplazamiento horizontal.
   - Título sin `max-w` fijo.
   - Barra de herramientas en dos grupos (filtros a la izquierda, acciones a
     la derecha), con todos los controles a la misma altura.
2. **Cabecera de columna:** color del estado desde `status.ts`, contador con
   `Badge`, sin halo ni línea de gradiente.
3. **Tarjeta compacta** (≤ 120 px con título de dos líneas):
   - Sin descripción (vive en el modal).
   - **Sin el id hexadecimal.**
   - Responsable solo si existe.
   - «Iniciar temporizador» como `IconButton` que aparece al pasar el ratón;
     las reglas móviles ya lo hacen visible en táctil.
   - El temporizador **activo** siempre visible, porque es estado.
   - Al pasar el ratón, solo el borde. Movimiento solo al arrastrar.
4. **Modales:** los tres del tablero y el del ticket, con `Modal` y `Field` y
   un solo estilo de desplegable.
5. **Móvil:** el mismo vocabulario de estado en pestañas, cabecera y
   selector.
6. **i18n:** «Start», «Stop», «Name», «DROP ZONE», «{workspace} Board» y
   «h registradas».

**Criterio de salida:**

- 4 columnas visibles a 1280 y 1440 px.
- Al menos 5 tarjetas por columna a 1440×900.
- axe sin fallos en los dos temas, con el modal abierto y cerrado.
- Pasan `kanban`, `board-scale`, `orden-tablero`, `planificacion`,
  `borrar-sprint`, `fecha-y-cancelar`, `estimado-al-crear`, `etiquetas`,
  `renombrar-tipo`, `a11y-etiquetas`, `escritorio-hover` y las de `movil/`.

### Fase 2 — Armazón: barra lateral, barra superior, navegación inferior, pie

- Elemento activo con `surface-2` y una marca de acento, sin desplazamiento.
- Fuera la barra naranja de 4 px de arriba y los iconos que solo repiten la
  etiqueta.
- Logo nuevo.
- Resolver los nombres «My Hub» y «Dashboard», que hoy se pisan.

### Fase 3 — Panel del espacio y hub

`w/[sys_tag]/index.astro`, `dashboard/Hub.astro` y `dashboard/TaskTable.astro`.

- `PageHeader` común.
- Sin «Welcome back» ni el banner «Better with Friends». Si hay algo que
  invitar a hacer, se dice en concreto.
- Cifras solo si sirven para decidir algo.
- Las barras de carga de trabajo en neutro, **nunca en rojo**.

### Fase 4 — Base de conocimiento

`notion/EditorClient.astro`, `PageTree.astro`, `PageTreeItem.astro` y `p/*`.

- Medida de lectura fija y escala `prose` atada a los tokens.
- Árbol sin caja propia.
- Migas sin «| Knowledge Base».
- **No tocar el esquema de Tiptap.**

### Fase 5 — Bases de datos y archivos

`db/*`, `db/CeldaValor.astro` y `files.astro`.

- Mismo contenedor y `PageHeader` en las dos.
- Botón principal único.
- Subtítulo sin «Think of it as… Notion».

### Fase 6 — Métricas

- Tema de gráficas con los colores de estado.
- Revisar el contraste 3:1 de cada serie en los dos temas.
- Título que no repita «Dashboard».

### Fase 7 — Ajustes, personas, actividad y perfil

- Es donde se concentran las 79 clases `red-*`: pasan a `danger`.
- Formularios con `Field`.
- **Ojo con el borrado de cuenta y las casillas de notificaciones**, que fija
  `a11y-etiquetas.spec.ts`.

### Fase 8 — Portada y acceso

Es donde más huellas de IA quedan:

- **Se quitan:** el bento con aparición al hacer scroll, la ventana falsa con
  semáforo, la demostración que se escribe sola, el halo radial, la píldora
  de código del titular y la fila de cuatro cifras.
- **Se queda la voz de los textos,** que es lo mejor que tiene, junto con
  **capturas reales** del producto ya rediseñado.
- **El registro de cambios** sale en el idioma de la página y sin franja roja
  para «arreglado».

### Fase 9 — Limpieza

- Quitar los alias de la fase 0 y las reglas `.text-\[Npx\]` del bloque móvil.
- Vaciar las listas de excepciones de las barandillas.
- Regenerar las capturas del README.
- Añadir a `docs/desarrollo.md` las reglas de 1.4 y la regla de que **todo botón,
  campo, modal o insignia sale de `src/components/ui/`**.

---

## 5. Decisiones pendientes

1. **Identidad:** «Taller» (recomendada), «Cuaderno» o «Fichero», decidida
   sobre la maqueta del tablero.
2. **Tema por defecto.** «Taller» y «Cuaderno» proponen el claro. Si se
   mantiene el oscuro, el oscuro de la identidad elegida tiene que funcionar
   igual de bien sin halos.
3. **Clave legible del ticket** (`ATL-123`). Es un cambio de esquema (número
   correlativo por espacio) y queda fuera de lo visual. Mientras no exista,
   la tarjeta va mejor **sin** id.
4. **Grafía de los estados** en las dos lenguas, igual en tablero, píldoras,
   gráficas y móvil.
5. **Nombres de la navegación:** «Mi hub», «Panel» y «Métricas», que hoy se
   pisan.
