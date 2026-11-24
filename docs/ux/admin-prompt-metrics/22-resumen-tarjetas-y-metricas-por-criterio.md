# 22 · Resumen del verificador: tarjetas, barra contenida y métricas por criterio (revisión rápida, 2026-11-23)

Cambio menor sobre `19-resumen-avance-y-orden-bandejas.md` (X1-X5 aprobadas en A e implementadas). Un solo gate:
decisiones AA1-AA5. Sin código hasta que se aprueben. Legal y anonimización omitidos por instrucción de Johannes. En el
front la IA se llama Qubyt.

**Pedido (Johannes, 2026-11-23, textual):** «en el perfil de verificador, tengo este grafico actualmente, puedes encerrar
los datos total, revisadas y por revisar en tarjetas para que se vea esteticamente mejor, tambien el grafico se ve como
desparramado. Tambien quiero incluyamos métricas por criterio, onda % de criterio X aprobado, % de criterio rechazado.
Tambien incluye % de criterios aprobados, % de criterios no aprobados y total de criterios evaluados.»

## 0. Decisión final aprobada (2026-11-23) — prevalece sobre §2-§5 donde difieran

Johannes (textual): «AA1. Qubyt aprobado es que el verificador de la IA dijo que la llamada cumple, de hecho no pongas
aprobado, pon que cumple. Rechazado es que no cumple, lo mismo que antes, pon que no cumple. AA2. Criterio evaluado por
la IA verificadora. AA3. Esq en ningún lado deberia verse eso, ambiguo o falta información no son parte de la
verificación Qubyt. AA5. A». AA4 sin respuesta → A (coordinador).

- **AA1 → B adaptada:** las métricas son el **veredicto de Qubyt** por criterio. `Cumple` = Qubyt no lo marcó en
  `failCriteria`; `No cumple` = está en `failCriteria`. No se usan las palabras «aprobado/rechazado».
- **AA2 → nueva:** evaluado = criterio de capa 2 **que Qubyt evaluó** en las llamadas del alcance (corrida sin error),
  revisadas o no. Los criterios `uncertain` de Qubyt **no cuentan ni se muestran**.
- **AA3:** no existe «Sin definir»; Ambiguo / Falta información no aparecen. Cumple % + No cumple % = 100 %.
- **AA4 → A:** sigue el toggle `Mí · Todas`.
- **AA5 → A:** tabla ordenable con mini barra (verde pastel Cumple · rojo pastel No cumple), orden por defecto
  `No cumple` ↓. **Se quita «pocos datos»**: con el universo de Qubyt cada criterio tiene del orden de cientos de
  evaluados; no hace falta.
- **Bloque 2 ya no depende de llamadas revisadas:** se muestra apenas el alcance tenga llamadas evaluadas por Qubyt.
- **Backend:** `criteria {evaluated, compliant, nonCompliant, byCriterion[{criterionId, name, evaluated, compliant,
  nonCompliant}]}`; tests: `compliant + nonCompliant == evaluated`, `uncertain` excluido, `me` solo asignadas.

### UX writing final (reemplaza las filas de criterios de §3)

| Lugar | Texto |
|---|---|
| Bloque 2 · título | `Criterios evaluados por Qubyt` · subtítulo `En las {n} llamadas que evaluó Qubyt.` |
| Tarjetas | `Criterios evaluados` / nota `criterios` · `Cumple` / `{p} %` grande, nota `{k} criterios` · `No cumple` / `{p} %`, nota `{k} criterios` |
| Ayuda | `Lo que dijo Qubyt en cada criterio. No incluye los criterios en que Qubyt quedó en duda.` |
| Bloque 3 · título | `Por criterio` · subtítulo `Ordenado por % No cumple, de mayor a menor.` (o `Ordenado por {columna}, {ascendente\|descendente}.`) |
| Columnas | `Criterio` · `Evaluados` · `Cumple` · `No cumple` |
| Caption (lector) | `Cumple y No cumple de Qubyt por criterio` |
| Celda sin datos | `—` · title `Qubyt no evaluó este criterio en estas llamadas.` |
| Vacío bloque 2 (`Mí` y `Todas`) | `Qubyt todavía no ha evaluado estas llamadas.` |
| Se eliminan | «Aprobado/Rechazado», «Sin definir», «pocos datos», «De las llamadas revisadas», vacío «Cuando revises tu primera llamada…» |

**Ya decidido (no se pregunta):** Total, Revisadas y Por revisar en tarjetas; el gráfico deja de verse desparramado;
métricas por criterio (% aprobado y % rechazado de cada criterio); totales: % aprobados, % no aprobados y total de
criterios evaluados.

## 1. Diagnóstico

- `verification/summary/page.tsx`: una sola `.card` con `<dl>` `grid-cols-3` y una barra `h-9 w-full`, sin ancho
  máximo. En ~1900 px las tres cifras quedan a ~600 px una de otra y la barra mide ~1800 × 36 px: eso es lo
  «desparramado» (P-30). Las cifras no tienen contenedor propio (P-31).
- El overview (`GET /admin/prompts/{v}/verification`) solo trae `progress {total, reviewed, pending}`. **No hay conteos
  por criterio**; hay que agregarlos (sin IA, conteos de BD).
- Datos disponibles por (caso, criterio de capa 2) en `DisagreementVerification`: `outcome` y `correct`. Con
  `verification.effective()` se traduce a la versión vigente:
  - Desacuerdos: `ai_error` (Qubyt se equivocó), `reviewer_error` (Qubyt tenía razón), `ambiguous`, `missing_info`.
  - Acuerdos (20): `both_right` (aprobado), `both_wrong` (rechazado). Un acuerdo sin marcar **cuenta como aprobado
    implícito** (20 Y3 A).
- **Lenguaje ya fijado en la app:** en la revisión, «Aprobar / Rechazar» y ✓ / ✗ se refieren a **lo que dijo Qubyt**
  (20 Y2, 21 Z2: ✓ = Qubyt tenía razón, ✗ = Qubyt se equivocó, ? = ambiguo o falta información). Ojo con una colisión:
  la columna «Criterios rechazados por Qubyt» (21) usa «rechazado» para «Qubyt dijo No cumple». Ver AA1.
- Hay ~32 criterios de capa 2 (`golden_split.layer2_criteria()`): una lista por criterio tiene ~32 filas.
- Patrones reutilizables: `.card`, `.seg` (toggle `Mí · Todas`), `SortableTh` (`components/ui/sortable-th.tsx`, de 19),
  badges pastel y sin borde punteado (21).

## 2. Propuesta de layout (si se aprueba todo A)

Todo el contenido va en un contenedor de **ancho máximo ~1040 px** (`max-w-5xl`), alineado a la izquierda bajo el
encabezado, con `gap` de 24 px entre bloques. Eso corrige lo desparramado sin tocar el resto de la app.

```
Resumen
Tu avance en la verificación de la corrida completa.
Asignadas a: [ Mí | Todas ]

Llamadas
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Total      │ │ Revisadas  │ │ Por revisar│
│ 156        │ │ 30         │ │ 126        │
│ llamadas   │ │ 19 % del   │ │ 81 % del   │
│            │ │ total      │ │ total      │
└────────────┘ └────────────┘ └────────────┘
████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  (barra 10 px, redondeada)
■ Revisadas 30 (19 %)   □ Por revisar 126 (81 %)
[ Seguir revisando › ]

Criterios evaluados                       (de las llamadas revisadas)
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Evaluados  │ │ ✓ Aprobados│ │ ✗ No       │
│ 960        │ │ 91 %       │ │ aprobados  │
│ criterios  │ │ 874        │ │ 9 %   86   │
└────────────┘ └────────────┘ └────────────┘
Aprobado = Qubyt tenía razón. No aprobado = Qubyt se equivocó o quedó sin definir.

Por criterio
┌──────┬──────────────────────────┬──────────┬──────────┬───────────┬──────────────┐
│ ID ↕ │ Criterio                 │Evaluados↕│Aprobado ↕│Rechazado ↓│              │
├──────┼──────────────────────────┼──────────┼──────────┼───────────┼──────────────┤
│ C16  │ Ofrece alternativas…     │ 30       │ 70 %     │ 27 %      │ ███████▒░    │
│ C9   │ …                        │ 30       │ 80 %     │ 20 %      │ ████████▒    │
└──────┴──────────────────────────┴──────────┴──────────┴───────────┴──────────────┘
```

### Bloque «Llamadas»

- **3 tarjetas KPI** (`.card` cada una, `grid-cols-3` desde `sm`, 1 columna en móvil): etiqueta arriba (texto
  secundario 14 px), cifra (30 px, `tabular-nums`, semibold), nota abajo (`llamadas` / `{p} % del total`). Sin íconos
  decorativos.
- **Barra contenida**: misma anchura que la fila de tarjetas (no la pantalla), **10 px de alto**, redondeada, sin texto
  adentro. Las cifras pasan a una **leyenda debajo** con muestra de color + texto (no depende solo del color). Revisadas
  = primario; Por revisar = gris con contraste ≥ 3:1 contra el fondo.
- `Seguir revisando` debajo de la barra (solo con `Mí` y pendientes); `¡Listo!…` y `Ver revisadas` como hoy.

### Bloque «Criterios evaluados»

- **3 tarjetas KPI** con la misma forma: `Evaluados` (n), `Aprobados` (% grande + cantidad en la nota), `No aprobados`
  (% grande + cantidad). Los % de Aprobados + No aprobados suman 100 %. En la tarjeta No aprobados, la nota desglosa:
  `{k} rechazados · {u} sin definir` (AA3).
- Una línea de ayuda bajo las tarjetas define los términos (texto abajo, §3).

### Bloque «Por criterio»

- **Tabla** (no gráfico de barras): con ~32 criterios, la tabla deja leer el número exacto, ordenar y buscar el criterio
  por ID; una barra horizontal por fila da el vistazo visual.
- Columnas: `Criterio` (ID `C16` + nombre corto, truncado con `title` completo), `Evaluados`, `Aprobado` (%),
  `Rechazado` (%), y una **mini barra apilada** de 100 % (verde pastel aprobado · rojo pastel rechazado · gris sin
  definir) `aria-hidden`, porque los % ya están en texto.
- **Orden por defecto: `Rechazado` ↓** (lo que más falla Qubyt arriba); empate por ID. Encabezados ordenables con
  `SortableTh` (ciclo ↑ → ↓ → defecto, como en 19 X4), orden solo en el cliente (no hay `Siguiente` que respetar).
- Criterios con 0 evaluados: al final, con `—` en los %, sin barra.
- Muestra baja: si un criterio tiene **menos de 5 evaluados**, el % va en gris con nota `pocos datos` (evita leer 100 %
  rechazado con 1 caso). Umbral [SUPUESTO] H-AA2.

### Estados

| Estado | Qué se ve |
|---|---|
| Cargando | Esqueletos de las 6 tarjetas y 5 filas de tabla (`LoadingState` actual mientras no exista esqueleto). |
| Error | `AsyncView` como hoy (`No pudimos cargar el resumen…` + reintentar). |
| Sin llamadas asignadas (`Mí`, total 0) | Texto actual de `EMPTY`; no se muestran los bloques de criterios. |
| Llamadas asignadas pero 0 revisadas | Bloque Llamadas normal; bloque Criterios reemplazado por estado vacío (texto §3). |
| `Todas` | Mismas secciones con los datos del equipo; sin `Seguir revisando`. |

### Móvil (< 640 px)

- Tarjetas KPI en 1 columna (o 3 compactas si caben: cifra 24 px); barra y leyenda a lo ancho del contenedor con
  gutter de 16 px.
- Tabla: dentro de un contenedor con `overflow-x-auto` (no hay scroll horizontal de página); la columna de nombre se
  oculta y queda `C16` con `title`; la mini barra se oculta (los % quedan en texto).

### Accesibilidad (sin preguntas; se aplica)

- Cada bloque es una `<section>` con `<h2>`; las tarjetas KPI son un `<dl>` (etiqueta `<dt>`, cifra `<dd>`).
- Barra de avance: `role="img"` con `aria-label` `{r} de {n} llamadas revisadas ({p} %)`; la leyenda está en texto.
- Tabla: `<caption class="sr-only">`, `aria-sort` en la columna ordenada, botones con `aria-label` `Ordenar por {col}`.
- Colores pastel: el texto de los % no va coloreado sobre fondo de color (contraste del texto ≥ 4.5:1); los tramos de la
  mini barra ≥ 3:1 contra el fondo o separados por 1 px de fondo.
- ✓ / ✗ siempre acompañados de texto («Aprobados», «No aprobados»).

## 3. UX writing

| Lugar | Texto |
|---|---|
| Título / descripción | `Resumen` · `Tu avance en la verificación de la corrida completa.` (Todas: `El avance del equipo en la verificación de la corrida completa.`) — sin cambios |
| Bloque 1 · título | `Llamadas` |
| Tarjetas | `Total` / nota `llamadas` · `Revisadas` / `{p} % del total` · `Por revisar` / `{q} % del total` |
| Leyenda barra | `Revisadas {r} ({p} %)` · `Por revisar {d} ({q} %)` |
| Barra `aria-label` | `{r} de {n} llamadas revisadas ({p} %)` |
| Botones | `Seguir revisando` · `Ver revisadas` (sin cambios) |
| Bloque 2 · título | `Criterios evaluados` · subtítulo `De las llamadas revisadas.` |
| Tarjetas | `Evaluados` / nota `criterios` · `Aprobados` / `{k} criterios` · `No aprobados` / `{k} rechazados · {u} sin definir` |
| Ayuda bajo tarjetas | `Aprobado: Qubyt tenía razón (incluye los acuerdos que no marcaste). Rechazado: Qubyt se equivocó. Sin definir: ambiguo o falta información.` |
| Bloque 3 · título | `Por criterio` · subtítulo `Ordenado por % rechazado, de mayor a menor.` (cambia con el orden: `Ordenado por {columna}, {ascendente\|descendente}.`) |
| Columnas | `Criterio` · `Evaluados` · `Aprobado` · `Rechazado` |
| Caption (lector) | `Aprobados y rechazados por criterio` |
| Celda sin datos | `—` · `title`: `Todavía no hay llamadas revisadas con este criterio.` |
| Muestra baja | `pocos datos` · `title`: `Menos de 5 evaluados: el porcentaje puede cambiar mucho.` |
| Vacío bloque 2 (`Mí`) | `Cuando revises tu primera llamada, acá verás cómo le fue a Qubyt en cada criterio.` |
| Vacío bloque 2 (`Todas`) | `Todavía nadie del equipo ha revisado llamadas.` |

Glosario: «Aprobado / Rechazado» = sobre lo que dijo Qubyt (mismo sentido que los botones Aprobar/Rechazar y ✓/✗ de la
revisión). «Evaluado» = criterio contado en una llamada revisada. «Sin definir» = Ambiguo o Falta información.

## 4. Decisiones

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| AA1 | ¿Qué es «criterio aprobado / rechazado»? | **Sobre Qubyt:** aprobado = Qubyt tenía razón en ese criterio (`reviewer_error`, `both_right` o acuerdo sin marcar); rechazado = Qubyt se equivocó (`ai_error`, `both_wrong`). Es el mismo sentido que Aprobar/Rechazar y ✓/✗ en la revisión, y responde «¿en qué criterios falla Qubyt?». | **Sobre la llamada:** aprobado = el criterio **se cumple** según la decisión final del verificador (`correct` = Cumple), rechazado = **no se cumple**. Respondería «¿qué criterios incumplen más los ejecutivos?»; en pantalla diría `Cumple` / `No cumple` para no chocar con Aprobar/Rechazar. |
| AA2 | ¿Qué cuenta como «criterio evaluado»? | **Todos los criterios de capa 2 de las llamadas revisadas**; los acuerdos sin marcar cuentan como aprobados (20 Y3 A). Da la tasa real de acierto de Qubyt (≈ 32 × llamadas revisadas). Los % de aprobado serán altos (casi todos los acuerdos son «ambos Cumple»), así que la tabla por criterio, ordenada por % rechazado, es la que muestra dónde está el problema. | **Solo los que el verificador marcó** (desacuerdos + acuerdos marcados a mano, en cualquier llamada, revisada o no). Menos criterios y % de rechazo mucho más altos, pero sesgado: solo mide los casos en disputa. |
| AA3 | ¿Dónde van «Ambiguo» y «Falta información»? | **Tercer grupo «Sin definir»**: cuenta como evaluado y como **no aprobado**; en la tarjeta No aprobados se desglosa `{k} rechazados · {u} sin definir`; en la tabla, gris en la mini barra (Aprobado % + Rechazado % pueden sumar menos de 100). | Fuera del conteo: no cuentan como evaluados (No aprobados = Rechazados). |
| AA4 | ¿Las métricas de criterios siguen el toggle `Mí · Todas`? | **Sí**, igual que el avance: `Mí` = criterios de tus llamadas asignadas; `Todas` = de todo el equipo. | Siempre de todo el equipo (el toggle solo mueve el avance). |
| AA5 | ¿Tabla o gráfico de barras por criterio? | **Tabla ordenable con mini barra por fila**, orden por defecto % rechazado ↓, criterios con < 5 evaluados marcados `pocos datos`. | Gráfico de barras horizontales apiladas (una por criterio, ~32 barras), sin orden por columna. |

## 5. Especificación técnica (si se aprueba todo A)

### Backend (`src/call_audit/verification.py` y `api/routes_verification.py`; no tocar `assignments.py`)

1. Overview suma `criteria` para el alcance `me` / `all`:
   `{ evaluated, approved, rejected, undecided, byCriterion: [{ criterionId, name, evaluated, approved, rejected, undecided }] }`.
2. Conteo sobre las llamadas **revisadas** del alcance, criterios de `golden_split.layer2_criteria()`, usando
   `effective()` para traducir registros de otra versión: `reviewer_error`/`both_right`/acuerdo sin registro →
   approved; `ai_error`/`both_wrong` → rejected; `ambiguous`/`missing_info` → undecided; desacuerdo sin registro en una
   llamada revisada → undecided [SUPUESTO H-AA3: no debería pasar si «revisada» exige todos los desacuerdos marcados].
3. Nombre corto del criterio desde la rúbrica; ID en el front como `C{n}` (21).
4. Tests: `approved + rejected + undecided == evaluated` (total y por criterio); un `both_wrong` cuenta rechazado; un
   acuerdo sin registro cuenta aprobado; `me` solo cuenta llamadas asignadas al usuario.

### Frontend

1. `verification/summary/page.tsx`: contenedor `max-w-5xl`; componentes locales `KpiCard`, `ProgressBar` (10 px +
   leyenda), `CriteriaKpis`, `CriteriaTable` (con `SortableTh`). Tipos en `lib/api/admin-types.ts`.
2. Sin tokens nuevos: primario, gris muted, y los pastel verde/rojo de los badges (21).

## 6. Supuestos y riesgos

- **H-AA1 [SUPUESTO]:** Johannes usa «aprobado/rechazado» en el sentido de la revisión (sobre Qubyt). Si piensa en
  cumplimiento del ejecutivo, AA1 B.
- **H-AA2 [SUPUESTO]:** umbral de 5 evaluados para `pocos datos`.
- **H-AA3 [SUPUESTO]:** una llamada revisada no deja desacuerdos sin marcar.
- **R-AA1:** con AA2 A los % de aprobado se ven altos (~90 %+) y pueden dar una impresión optimista de Qubyt; la tabla
  por criterio ordenada por % rechazado lo compensa.
- **R-AA2:** colisión de palabras: «Criterios rechazados por Qubyt» (lista, 21) = Qubyt dijo No cumple; «Rechazado»
  (Resumen) = el verificador rechazó lo que dijo Qubyt. La línea de ayuda lo aclara; si molesta, renombrar la columna de
  21 a «Criterios No cumple de Qubyt» en un cambio aparte.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-23 | Ya decidido: tarjetas para Total/Revisadas/Por revisar, gráfico no desparramado, métricas por criterio y totales de criterios. Cambio menor sobre `19` (un gate) | Johannes (vía coordinador) |
| 2026-11-23 | Diagnóstico P-30/P-31 (sin ancho máximo, cifras sin contenedor); overview sin conteos por criterio. Propuesta AA1-AA5 todas A. Esperando aprobación | Diseñador |
| 2026-11-23 | **Aprobado (ver §0):** métricas = veredicto de Qubyt por criterio (`Cumple` / `No cumple`, sin «aprobado/rechazado»); evaluado = criterio que Qubyt evaluó en las llamadas del alcance, `uncertain` excluido; sin «Sin definir» ni «pocos datos»; AA4 A (sigue `Mí · Todas`, sin respuesta → recomendada); AA5 A (tabla, `No cumple` ↓) | Johannes (vía coordinador) |


## Cambio menor AE5: «Evaluados» → «Total», al final (2026-11-24)

Pedido (Johannes, textual): «finalmente en la vista resumen, la columna evaluados cámbiala por total y ponla al final.» Tabla por criterio de `verification/summary/page.tsx`: `Criterio` · `Cumple` ·
`No cumple` · [barra de proporción, sin rótulo, `aria-hidden`, oculta en móvil] · `Total` (alineada a la derecha,
sigue ordenable). Total va después de la barra, literal «al final»; en móvil, sin la barra, igual queda última. Mismo
dato que «Evaluados» (definición AA2 aprobada sin cambios). Registrado también en `23` §6 y `estado.md`.

## Cambio menor AE6: nombre del calibrador en vez de «Mí» (2026-11-24)

Pedido (Johannes, textual, sobre el Resumen del calibrador): «aquí agrega el nombre del calibrador en vez de poner Mí» Selector «Asignadas a: [<nombre> | Todas]» con el
nombre del usuario logueado formateado con `personName` (p. ej. «Verificador 1»); sin nombre, cae a «Mí». Por
coherencia se aplica igual al selector equivalente de la lista del calibrador (`verification-view.tsx`, rama
`isVerifier`): es la misma persona y el mismo filtro, y no debe cambiar de rótulo entre pantallas. Sin cambios de
comportamiento ni de URL (AA4 sigue). Registrado también en `23` §6 y `estado.md`.

## Cambio menor AE7-AE10: navbar, íconos, título del ranking y sin atajos (2026-11-24)

Pedido (Johannes, textual): «Abajo del logo de qubyt poner -> "Auditoria inteligente de llamadas" en el navbar. Cambiar iconos del navbar por iconos que hagan más sentido con por calibrar, y calibradas. (quizás invertir los iconos) renombrar tabla de la página resumen que se llama "Por criterio" a "Ranking de criterios según tasa de no cumplimiento" Borrar los atajos de teclado y las preferencias. Deshabilitar los atajos para todas las vistas.»

- **AE7** `components/shell/sidebar-nav.tsx`: subtítulo bajo el logo «Auditoría inteligente de llamadas» (con tilde), todos los roles.
- **AE8** íconos lucide del calibrador: Por calibrar = `ClipboardList` (por hacer), Calibradas = `ClipboardCheck` (hecho). Mismo
  objeto con y sin check: el par se lee como estado de una misma tarea, más claro que `ListChecks`. Resumen sigue `BarChart3`.
- **AE9** `verification/summary/page.tsx`: título de la tabla «Ranking de criterios según tasa de no cumplimiento». Se borra
  el subtítulo «Ordenado por % No cumple, de mayor a menor» (redundante); el orden sigue indicado en la cabecera con `aria-sort`.
- **AE10** fuera «Atajos de teclado» y «Preferencias» del menú (todos los roles), la página `/settings`, el diálogo de atajos y
  el «?» global. Se desactivan todos los atajos de teclado (calibrador, detalle de llamada incl. flechas ←/→ del audio,
  patrones) con `SHORTCUTS_ENABLED=false` (reversible); se ocultan los `<Kbd>` y el checkbox «atajos» del caso. La
  `welcome-card` (cola del auditor) se elimina: su único contenido eran atajos. Se mantienen Enter en filas enfocadas y
  flechas en tablist/segmented (teclado nativo, WCAG 2.1.1). La velocidad del audio queda en 1,5x por defecto y se sigue
  cambiando desde el reproductor. Nota: quitar atajos de una tecla también cumple WCAG 2.1.4.

Registrado también en `23` §6 y `estado.md`.

## Cambio menor AE11-AE23 (2026-11-24)

Detalle en `23` §7. Toca esta vista: AE11 (rótulos «Supervisor 2»/«Supervisor»), AE22 (selector «Asignadas a» con compañeros que comparten llamadas, si se aprueba A).
