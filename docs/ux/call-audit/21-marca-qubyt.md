# Cambio 21 · Marca Qubyt (re-theming + logo)

- Fecha: 2026-11-20 (propuesta y aprobación) · 2026-11-23 (port a este frontend) · Estado: **aprobado e implementado; falta la verificación visual**
- Tipo: revisión rápida sobre la Fase 8 (tokens + assets). No cambia pantallas, flujos, AI ni CUJ.
- Origen: paleta de la presentación a S4P (Aptos; colores por frecuencia) + logos Qubyt.
- Numeración: en la rama `feature/frontend-mock` este cambio se llamó "Cambio 11" (D-29 a D-32), pero en esta rama esos números ya los usa el catálogo de seguros. Aquí es **Cambio 21**, con **D-98 a D-102**.
- Contrastes calculados con la fórmula WCAG 2.x (luminancia relativa). Texto ≥ 4.5:1, componentes/foco ≥ 3:1 (1.4.3, 1.4.11). Logotipos exentos de 1.4.3.

## 1. Diagnóstico de la paleta de la presentación

| Color | Uso en la presentación | Sobre blanco | ¿Sirve en la app? |
|---|---|---|---|
| `#3A6491` azul medio | títulos, acentos | 6.16 | Sí: **primary** (texto, botón, foco) |
| `#133B64` azul marino | portada, énfasis | 11.43 | Sí: texto de acento, panel oscuro del login |
| `#1F2A37` tinta | texto | 14.54 | Sí: **foreground** |
| `#5B6B7B` slate | texto secundario | 5.48 (5.06 sobre fondo) | Sí: **muted-foreground** (no usar sobre `#E5E9EF`: 4.50 justo) |
| `#61B4D1` celeste | acento | **2.34** | **No para texto ni controles en claro.** Sí sobre marino (4.88) y decorativo |
| `#9FB3C8`, `#8FA6BE` | rellenos de gráficos | 2.15 / 2.51 | Solo relleno decorativo; no como único portador de información |
| `#6E8CAB`, `#6F97A6` | gráficos | 3.50 / 3.16 | Solo componentes/gráficos (≥ 3:1), nunca texto |
| `#BFC7D1`, `#B9C3CF`, `#C9CFD6`, `#D5DCE4` | bordes | 1.4–1.8 | Solo divisores decorativos; **no** como borde de input (falla 1.4.11) |
| `#E5E9EF`, `#E3E7EC` | fondos de tarjeta | 1.22 | Superficie `muted`; demasiado oscuro para el fondo de página |
| `#BEE0EC` celeste muy claro | — | — | Selección de texto (tinta encima: 10.43) |
| `#A2C4C9` / `#8FB3C0` verde-azulados | gráficos | < 3 | No se usan (sin rol en la app) |

Tonos que **derivo** (no están en la presentación) porque la paleta no trae equivalentes válidos:
- `#2F5680` primary-hover (un paso más oscuro que `#3A6491`; 7.60 con blanco).
- `#EAF0F6` accent (fondo de hover/nav activa, tinte de `#3A6491`; primary encima 5.36, marino encima 9.96).
- `#D6E2EE` primary-200 (bordes de chips/estados, selección alternativa).
- `#F4F6F9` background (versión más clara y fría de `#E5E9EF`; las tarjetas blancas se separan con sombra + borde).
- `#66737F` subtle-foreground (4.86 sobre blanco; **solo sobre blanco**, igual que hoy).
- `#7B8794` input (borde de controles: 3.66 blanco / 3.38 fondo). Ningún gris de la presentación da ≥ 3:1.

## 2. Mapeo a tokens

| Token | Hoy | Propuesto | Contraste clave |
|---|---|---|---|
| `--ink-900` / `--foreground` | `#1b1f24` | `#1F2A37` | 14.54 blanco · 13.43 fondo |
| `--background` | `#f5f7f8` | `#F4F6F9` | — |
| `--card`, `--popover`, `--secondary` | blanco | blanco | — |
| `--primary` (rampa `--blue-600`) | `#0f766e` | `#3A6491` | 6.16 con blanco |
| `--primary-hover` (`--blue-700`) | `#0b5953` | `#2F5680` | 7.60 |
| `--blue-800` (antes `--teal-800`) | `#0b4843` | `#133B64` | 11.43 |
| `--accent` (`--blue-100`) | `#e7f4f2` | `#EAF0F6` | — |
| `--accent-foreground` / links | `#0b4843` | `#133B64` | 9.96 sobre accent |
| `--blue-200` (antes `--teal-200`) | `#c7e7e2` | `#D6E2EE` | decorativo |
| `--ring` | `#0f766e` | `#3A6491` | 6.16 blanco · 5.36 sobre accent |
| `--muted` (`--neutral-100`) | `#f3f5f7` | `#EEF1F5` | muted-fg encima 4.83 |
| `--muted-foreground` (`--neutral-700`) | `#545b66` | `#5B6B7B` | 5.48 / 5.06 |
| `--subtle-foreground` (`--neutral-600`) | `#6e7682` | `#66737F` | 4.86, solo sobre blanco |
| `--input` (`--neutral-500`) | `#8a929c` | `#7B8794` | 3.66 / 3.38 |
| `--neutral-300` | `#d6dbe0` | `#C9CFD6` | decorativo |
| `--border` (`--neutral-200`) | `#e2e6ea` | `#D5DCE4` | decorativo |
| `--neutral-800` (texto de "Cumple") | `#3a4048` | `#3A4656` | ≥ 9 |
| `--source-human-bg` ("Confirmado") | ink | ink `#1F2A37` (se mantiene) | 14.54 |
| `--brand-cyan` (nuevo, decorativo) | — | `#61B4D1` | solo sobre marino o decorativo |
| `::selection` | teal-200 | `#BEE0EC` | 10.43 con tinta |
| Rojo / ámbar de veredictos | — | **sin cambios** | no chocan con el azul (rojo vs primary 1.08 en luminancia, pero distinto tono y siempre con etiqueta) |

Notas:
- Renombrar la rampa `teal-*` a `blue-*` (o `brand-*`) para que el nombre no mienta; afecta `globals.css` (`.st-teal`, chips, `::selection`), `transcript.tsx` y `tokens.css`.
- "Confirmado" se queda en **tinta** y no en marino: marino vs botón primary sería demasiado parecido (lectura "es un botón"). Tinta vs primary: 2.36, se distinguen.
- `Cumple` sigue gris neutro (D-20): no usar azul para "Cumple" para no confundir con acción.

## 3. Colores hardcodeados a corregir (fuera de tokens)

| Archivo | Hoy | Cambio |
|---|---|---|
| `app/(app)/dashboard/criteria/page.tsx` | heatmap `rgb(15 118 110 / α)` y texto blanco si α > 0.55 | Usar el primary; elegir texto blanco/tinta **por contraste** (hoy con α 0.56 el blanco queda en ~2.4:1, falla también con el teal) |
| `app/login/page.tsx:52,56` | `#c9ced4`, `#9aa3ad` sobre ink | Tokens `--on-dark-muted: #C9D4E0` (7.61 sobre marino) y `--on-dark-subtle: #9FB3C8` (5.31) |
| `components/call/rubric-checklist.tsx:192`, `transcript.tsx:92`, `globals.css:275` | `#fbfcfc`, `#fafbfc` | Token `--row-hover` (p. ej. `#F7F9FB`) |
| `components/call/transcript.tsx:97` | `var(--teal-800)` | `var(--accent-foreground)` |
| `components/ui/dialog.tsx` overlays | `rgb(13 15 18 / …)` | `rgb(31 42 55 / …)` (tinta nueva) |
| `globals.css`, `layout.tsx`, `audio-player.tsx` | `#fff` | `var(--white)` (cosmético, opcional) |

## 4. Logo: qué variante en cada lugar

| Lugar | Fondo | Variante | Tamaño |
|---|---|---|---|
| Sidebar expandida | blanco | **Horizontal C** (marino → celeste) | h 28 |
| Sidebar colapsada | blanco | **Símbolo** | 28×28 |
| Privacy | blanco | **Horizontal C** | h 30 |
| Login, panel oscuro | marino `#133B64` | **Horizontal A** (cian → lila) — se lee bien en oscuro; no hace falta generar wordmark blanco | h 40–48 |
| Favicon (nuevo) | — | Símbolo, 32/180 px | — |

- El símbolo trae un anillo lila claro, así que se separa del panel marino; no hace falta cambiar el color del panel.
- El panel del login pasa de tinta a **marino `#133B64`** (es el fondo de portada de la presentación). Título blanco 11.43; párrafo `#C9D4E0` 7.61; nota `#9FB3C8` 5.31.
- La "t" celeste del wordmark C tiene poco contraste con blanco, pero los logotipos están exentos de 1.4.3 y el símbolo + "Qub" lo anclan.
- Assets: recortar el halo transparente sobrante y exportar a 2× del uso (~96 px de alto) en PNG; el original (2917×1200) es innecesariamente pesado. SVG sigue pendiente (H-28 pasa a Qubyt).
- `alt="Qubyt"` en todas las variantes. Componente: `BrandLogo` mantiene la API (`variant`, `onDark`); `onDark` pasa a elegir la variante A.

## 5. Versión animada

- **Solo en el login**, el símbolo animado (webm, `muted autoplay playsInline`, con `poster` = PNG estático), **una sola reproducción** y queda en el último cuadro. Si fuera en bucle > 5 s exigiría control de pausa (WCAG 2.2.2).
- Con `prefers-reduced-motion: reduce` se muestra el PNG estático (sin video).
- **No** en la app (sidebar, carga): es una herramienta densa de revisión y el movimiento distrae.
- No usar el GIF (pesado, sin control de reproducción). MP4 como respaldo de Safari si el webm con alfa falla; si el MP4 no trae transparencia, ponerlo sobre el marino exacto del panel.

## 6. Fuera de alcance

- Tipografía: se mantiene **Archivo**. Aptos es una fuente de Microsoft sin licencia de uso web libre; Archivo (OFL) ya está integrada.
- Pantallas, flujos, copy y modo oscuro: sin cambios.
- Artefactos `08-tokens.css`, `08-tokens.json` y `08-design-system.html` se actualizan al implementar.

## 7. Gráficos (pantallas que solo existen en esta rama)

Regla: la paleta de la presentación donde no rompa la semántica; el color nunca va solo (leyenda con texto, valores en celda, rayado/punteado para estados).

| Token | Antes | Ahora | Contraste | Dónde |
|---|---|---|---|---|
| `--series-1` | #2a78d6 | **#3a6491** azul Qubyt | 6,16 blanco / 5,43 neutral-100 | Calidad de la IA (modelo 1), Análisis «Según la IA», Discrepancias (FP) |
| `--series-3` | #0f8a5f | **#2a7d9a** celeste oscuro (de #61b4d1) | 4,67 / 4,12 | Calidad de la IA, Discrepancias (regla del prompt) |
| `--series-2,4,5,6` | — | sin cambios (óxido, ocre, frambuesa, violeta = lila del logo) | ≥ 3,75 | se necesitan 6 tonos distinguibles; la presentación solo trae azules |
| `--seq-1..5` | violetas | **blue-100 · blue-300 · #9fb3c8 · blue-600 · blue-900** | tinta 12,66 / 9,93 / 6,75 · blanco 6,16 / 11,43 | Calidad del servicio › Evaluadores (mapa de calor) |
| `--div-neg-1/2` | violetas | **blue-300 / blue-600** (ocre ↔ azul) | tinta 9,93 · blanco 6,16 | Calidad del servicio › Agentes |
| `--reviewer-bg` | #2a6fc4 | **blue-600** (con rayado) | blanco 6,16 | Mosaico de acuerdo IA vs revisor |
| verde/rojo/amarillo del mosaico, violetas de «Desacuerdo parcial/total» | — | sin cambios | — | son semánticos (coincide / falla / falsa alarma) o el lila del logo |

Colores fijos corregidos en pantallas nuevas:
- `var(--fail-700,#b42318)` y `var(--danger,#b42318)` (tokens inexistentes, caían a un rojo ajeno) → `var(--red-700)` (6,64:1). Catálogo, ficha, formulario de ficha, revisión de casos del prompt.
- `var(--amber-700,#9a6700)` → `var(--amber-800)` (Resumen de discrepancias).
- `var(--ink-700,#333)` → `var(--ink-800)`; `var(--neutral-400,#a3a3a3)` → `var(--neutral-500)`; fallbacks de `--neutral-100/200/500` quitados.
- `text-teal-700` (link de Análisis) → `text-accent-foreground`.
- `"#fff"` de gráficos y mosaico → `var(--white)`.

## 8. Logo del correo de invitación (backend, NO cambiado)

`src/call_audit/notify/email.py` arma `APP_BASE_URL/brand/qubico-logo.png` (alt "Qubico", firma "— Qubico") y usa tinta #1b1f24, gris #545b66 y botón #0f766e.
- `frontend/public/brand/qubico-logo.png` **se mantiene**: borrarlo rompe el logo de los correos ya enviados y de los nuevos.
- Se agregó `frontend/public/brand/qubyt-logo.png` (154×64, transparente), listo para el correo.
- Recomendación (pendiente de OK): cambiar en `email.py` el logo a `qubyt-logo.png` (alt "Qubyt") y los colores a #1f2a37 / #5b6b7b / botón #3a6491. La firma "— Qubico" se queda: el correo lo envía la empresa.

## 9. Implementación en este frontend (2026-11-23)

- `styles/tokens.css` (sincronizado con `08-tokens.css`; `08-tokens.json` actualizado), `app/globals.css` (Tailwind: `blue-900`, `on-dark-*`; sin `teal-700`).
- `components/brand/logo.tsx` (`BrandLogo` + `AnimatedBrandLogo`), assets `src/assets/brand/qubyt-*.png`, video `public/brand/qubyt-symbol-animated.webm`, `app/icon.png` + `app/apple-icon.png` (no había `favicon.ico`).
- Login: panel `bg-blue-900`, logo animado, textos `on-dark-*`, copy D-101. Invitación, privacidad y sidebar toman el logo nuevo vía `BrandLogo`.
- Tono `teal` de `StatusBadge` → `blue` en todos sus usos.
- Heatmap de `dashboard/criteria`: `heatCellStyle` (rampa blanco → blue-900 con salto de banda; mínimo 4,73:1).
- Los PNG `qubico-*` de `src/assets/brand/` ya no se importan (no se borraron).

## 10. Decisiones

- D-98 · Paleta Qubyt (§2 y §7).
- D-99 · Login: panel marino + logo A + animación una vez, estática con prefers-reduced-motion.
- D-100 · Rampa `teal-*` → `blue-*`.
- D-101 · Copy del login: "Qubyt propone hallazgos sobre el 100 % de las llamadas."
- D-102 · Favicon con el símbolo Qubyt.
