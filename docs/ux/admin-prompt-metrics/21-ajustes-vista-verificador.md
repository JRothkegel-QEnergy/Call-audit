# 21 · Ajustes a la vista del verificador: columnas, filtros, estados, colores y logo (revisión rápida, 2026-11-23)

Cambio menor sobre `18`, `19` y `20` (implementados, commit `3e92c2d`, `develop`). Un solo gate: decisiones Z1-Z5.
Sin código hasta que se aprueben. Legal y anonimización omitidos por instrucción de Johannes. «qubit» en el dictado =
**Qubyt**. Se cruza con el «Cambio 21» de `docs/ux/call-audit/21-qubyt-sin-prompt-no-admin.md` (otra sesión, sin
commitear): ver §3.

## 1. Pedido (Johannes, 2026-11-23) y lo que ya decidió

Texto completo en `estado.md`. Ya decidido (no se pregunta):

**Por revisar**
- Sin columna `#`. Columnas: `ID llamada` · `Fecha llamada` · `Veredicto Qubyt` · `Veredicto revisor` ·
  `Criterios rechazados por Qubyt` · `Avance`.
- Criterios como `C1…C33` (no `M`), en todo lugar donde aparezcan.
- Avance: `Por revisar` (en vez de «Sin empezar»), `{k} de {t} criterios` y `Revisado` (pasa a Revisadas). Se quita
  «Sin desacuerdos · por confirmar».
- Filtros: buscador por ID de llamada (se queda) · `Criterios rechazados por Qubyt` (el de criterio, renombrado) ·
  `Veredicto Qubyt` (Cumple / No cumple) · `Veredicto revisor` (Cumple / No cumple). Se quita el filtro Discrepancia.

**Revisadas**
- Columnas: `ID llamada` · `Fecha llamada` · `Veredicto Qubyt` · `Veredicto revisor` · `Criterios rechazados por Qubyt`
  · `Revisado por` · `Fecha de revisión`. Sin columna Resultado ni Avance.
- Filtros: ID de llamada · criterios · `Veredicto Qubyt` · `Veredicto revisor`. Se quita Discrepancia.

**Las dos listas:** en «Criterios rechazados por Qubyt» van **solo** los que rechazó Qubyt, **no** los que también
rechazó el revisor; chips en rojo; ya revisados, con ✗ o ✓.

**Revisión del caso (tarjeta de la llamada):** sin la versión de Qubyt (`v3.1`); «IA» → «Qubyt» (`Qubyt: Cumple`);
evaluador de la planilla con formato de nombre (`valeria.salinas` → `Valeria Salinas`); «Estado de la llamada» →
`Estado de revisión de la llamada`, con los mismos estados que la columna Avance. En la tarjeta de cada criterio:
`Error de Qubyt` · `Error del revisor` · `Ambiguo` · `Falta información`.

**Toda la app:** badges en rojo pastel en vez de rojo intenso; ningún badge con borde punteado (borde sólido); colores
pastel en vez de fuertes.

**Logo:** más grande en el login y en la vista de llamadas; login «80x80» y «letra 80x100»; menú lateral «45x105».

## 2. Decisiones abiertas

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| Z1 | «Criterios rechazados por Qubyt» muestra solo los que Qubyt rechaza y la planilla aprueba (C-rojos). Pero el verificador también tiene que revisar los criterios donde **la planilla rechaza y Qubyt aprueba**, y los que Qubyt dejó **en duda**: con la columna literal no se ven en la lista, y una llamada «Qubyt Cumple / revisor No cumple» saldría con la columna vacía aunque tenga trabajo. ¿Qué hacemos con esos? | **Columna literal (solo los rechazados por Qubyt, en rojo) y, en la misma celda, después, los otros criterios por revisar en gris con su rótulo** (`C5 · lo rechaza el revisor`, `C18 · Qubyt en duda` en el tooltip y para lector de pantalla). Así la columna dice lo que pediste y `{k} de {t} criterios` cuadra con lo que se ve. Los filtros de criterio de **las dos listas** son el mismo: «Criterios rechazados por Qubyt» (en Revisadas, lo que dictaste como «criterios de discrepancia»). | Solo los rechazados por Qubyt; los demás criterios por revisar no se ven en la lista (sí en la revisión del caso y en el conteo de Avance). Y en Revisadas, el filtro «Criterios de discrepancia» incluye todos los criterios en desacuerdo (como hoy). |
| Z2 | En un criterio ya revisado, ¿qué es ✓ y qué es ✗? | **✓ = Qubyt tenía razón** (el verificador registró `Error del revisor`: el rechazo de Qubyt se aprueba); **✗ = Qubyt se equivocó** (`Error de Qubyt`); **?** = `Ambiguo` o `Falta información`. Cada chip lleva el texto para lector de pantalla («C7, Qubyt tenía razón»). | ✓ = el criterio ya tiene registro (cualquier salida), sin distinguir quién tenía razón; ✗ no se usa. |
| Z3 | Columna «Revisado por» en Revisadas: ¿de quién es el nombre? En la app «revisor» es el evaluador de la planilla (por eso «Veredicto revisor»), pero «revisado por» suena al verificador, y en Revisadas solo ves tus propias llamadas (diría siempre tu nombre). | **El evaluador de la planilla** (`Valeria Salinas`), con el mismo formato de nombre que pediste para la tarjeta; la columna se llama `Revisor` para no confundir. | El verificador que hizo el último registro de la llamada (útil solo si después el admin usa esta lista para todos). |
| Z4 | «Eso también cambiarlo en el prompt» (M → C). El prompt de Qubyt (capa 2) **no usa «M1»**: dice «motivo 4», «motivo 16»… (42 veces). Cambiarlo a «criterio» es una **versión nueva del prompt**: cambia el texto que lee el modelo y habría que correr una prueba pagada antes de activarla. | **Ahora solo la app** (chips `C1…`, textos que aún digan «motivo» o «M» a la vista del verificador y del admin). El cambio «motivo → criterio» del prompt de capa 2 se hace en la **próxima versión del prompt** que igual vayan a probar, sin correr nada extra ahora. | Versión nueva del prompt solo con «motivo → criterio», como borrador; la prueba pagada se corre solo con tu OK y el costo estimado. |
| Z5 | Medidas del logo. El logo es una sola imagen (cubo + «Qubico») con proporción fija de ~5 : 1; «80x80 + letra 80x100» y «45x105» no calzan con esa proporción sin deformarlo. | **Separar cubo y logotipo** (se recorta del PNG/SVG de la marca, sin deformar): **login**: cubo 80 × 80 px y logotipo a 80 px de alto (ancho según su proporción). **Menú lateral**: el logo completo a 45 px de alto, recortando el ancho al menú (o, si 105 es el ancho, a 105 px de ancho y ~21 px de alto: dime cuál de los dos números es el alto). **Vista de la llamada** (menú colapsado): cubo a 44 × 44 px (lo máximo que cabe en 64 px). | Mantener la imagen completa y solo escalarla: login a 80 px de alto (~407 px de ancho), menú lateral al ancho disponible (~192 × 38 px), cubo colapsado a 44 px. |

## 3. Cruce con el «Cambio 21» (otra sesión, sin commitear)

Revisé `git diff` de `case-review.tsx`, `verification-labels.ts`, `badges.tsx` y `globals.css`. `tray-view.tsx` aún
no tiene cambios.

**Ya cubre:**
- «IA v3.1: …» → `Qubyt: …` en la tarjeta de la llamada y en las de criterio (la versión solo la ve el admin).
- `Error de la IA` → `Error de Qubyt` (`outcomeLabel`); `La IA se equivocó` → `Qubyt se equivocó`; «IA de análisis» →
  «Qubyt» en la explicación.
- «Según IA» → «Según Qubyt» (`SourceBadge`).

**No cubre (lo hace este cambio):**
- **La línea de versión:** el Cambio 21 la reemplaza por «Corrida completa» para el verificador; Johannes pide
  **borrarla**: se quita la línea entera para el verificador (el admin la sigue viendo).
- Todo lo de las listas (columnas, `C`, Avance, filtros, ✓/✗, Revisado por), el formato del nombre del evaluador,
  «Estado de revisión de la llamada», colores pastel, bordes sólidos y logo.

**Conflicto a coordinar:** el diff de `globals.css` agrega `.seg button[data-verdict="non_compliant"]` con **rojo lleno**
(`--red-700`) al elegirlo. Choca con «evitar colores fuertes». Propuesta: seleccionado = fondo `--red-200` + texto
`--red-800` + borde sólido `--red-700` (contraste ≥ 4.5:1), sin relleno intenso. Hay que acordarlo con esa sesión antes
de implementar.

## 4. Lo que asumo (no se pregunta; avísame si no)

- **Veredicto Qubyt también tiene `Dudosa`:** la corrida tiene llamadas con Qubyt en duda; si el filtro solo ofrece
  Cumple / No cumple, esas no se pueden filtrar. Se agrega la opción `Dudosa` solo cuando hay alguna. El revisor solo
  tiene Cumple / No cumple.
- **Avance de una llamada sin criterios en desacuerdo:** `Por revisar` (se cierra con `Sin observaciones` como hoy).
- **Estado de revisión de la llamada** (tarjeta): `Por revisar` · `{k} de {t} criterios revisados` · `Revisada`. El
  resultado (Confirmada / Qubyt se equivocó / …) se deja de mostrar ahí, como en las listas; cada criterio sigue
  mostrando su registro.
- **Nombre del evaluador:** se formatea solo al mostrarlo (separa por `.`, `_` o espacio y pone mayúscula inicial en
  cada parte: `valeria.salinas` → `Valeria Salinas`, `maria.jose.perez` → `Maria Jose Perez`); el dato guardado no
  cambia. No agrega tildes que no vienen en el dato.
- **Rojo de los chips de criterios rechazados:** el rojo pastel nuevo (fondo `--red-100`, texto `--red-800`, borde
  sólido `--red-300`), igual que el badge «No cumple», para que los dos se lean como «rechazo».
- **Pastel y bordes sólidos en toda la app:** aplica a badges, chips, etiquetas de veredicto (`.vt-*`), `.src`,
  estados vacíos (`.empty-state`) y botones de veredicto seleccionados; los gráficos (mosaico, tendencias) y el botón
  primario no cambian. Las líneas punteadas de los gráficos (series de «Equipo») no son badges y se quedan.
- **`C` en todos lados:** también en la lista del admin (`calls-list.tsx`) y en los datos de demostración.

## 5. Especificación (si se aprueba todo A)

### Backend (`src/call_audit/verification.py`, `api/routes_verification.py`; no tocar `assignments.py`)

1. **Filtro de criterio por «rechazados por Qubyt»:** en las bandejas, `criterion` filtra por `kind == "fp"` y
   `criterionCounts` cuenta solo `fp` (hoy cuenta `fp`, `fn` y `undecided`). Mismo criterio en `case_comparison` para
   `Siguiente`.
2. **Filtros de veredicto:** `ai_verdict=compliant|non_compliant|uncertain` y `reviewer_verdict=compliant|non_compliant`
   en `segment_calls` y `case_comparison` (para que `Siguiente`/`Anterior` sigan la lista filtrada, como X5), con
   conteos por opción.
3. **Revisor (Z3 A):** `evaluator` en cada `SegmentCall` (desde `call_metadata.external_evaluator`, como ya lo envía
   `case_comparison`).
4. Tests: `criterion` en bandeja deja fuera las llamadas con ese criterio solo en `fn`/`undecided`; los filtros de
   veredicto combinados con criterio; `evaluator` presente.

### Frontend

1. `tray-view.tsx`: columnas y nombres de §1; sin `#`; celda de criterios según Z1 A (rojos primero, grises después) y
   marcas ✓ / ✗ / ? según Z2 A; `Avance` con los 3 estados; `Revisor` (Z3 A) y `Fecha de revisión` en Revisadas; quitar
   el filtro Discrepancia y Resultado; agregar los selects de veredicto. Encabezados ordenables de `19` se mantienen
   (`ID llamada`, `Fecha llamada`, `Veredicto Qubyt`, `Veredicto revisor`, `Fecha de revisión`).
2. `calls-list.tsx` (admin): `M` → `C`.
3. `case-review.tsx`: sin línea de versión para el verificador; `Evaluador de la planilla: {formatPersonName(…)}`;
   `Estado de revisión de la llamada: …`.
4. `lib/format.ts`: `formatPersonName()`.
5. `globals.css` / `styles/tokens.css`: tokens pastel (`--verdict-fail-*`, `--verdict-doubt-*`, `--source-ai-*`,
   `.nav-badge-alert`) y `dashed` → `solid` en `.vt-doubt`, `.src`, `.empty-state`. Contraste de texto ≥ 4.5:1 sobre
   cada fondo pastel (WCAG 1.4.3) y borde ≥ 3:1 donde el borde es lo único que distingue (1.4.11).
6. `components/brand/logo.tsx`: variante `wordmark` (Z5 A) con el recorte; tamaños en `login/page.tsx` y
   `sidebar-nav.tsx`.

### Microcopy

- Columnas: `ID llamada` · `Fecha llamada` · `Veredicto Qubyt` · `Veredicto revisor` · `Criterios rechazados por Qubyt`
  · `Avance` · `Revisor` · `Fecha de revisión`.
- Filtros: `Criterios rechazados por Qubyt:` (`Todos · {n} llamadas`, `C25 · {c} llamadas · {p} pendientes`) ·
  `Veredicto Qubyt:` (`Todos · Cumple · No cumple · Dudosa`) · `Veredicto revisor:` (`Todos · Cumple · No cumple`).
- Avance: `Por revisar` · `{k} de {t} criterios` · `Revisado`.
- Chip (lector de pantalla): `C7, rechazado por Qubyt, sin revisar` / `…, Qubyt tenía razón` / `…, Qubyt se equivocó`
  / `…, ambiguo o falta información`; gris: `C5, lo rechaza el revisor` / `C18, Qubyt en duda`.
- Tarjeta: `Estado de revisión de la llamada: Por revisar | {k} de {t} criterios revisados | Revisada`.

## 6. Supuestos y riesgos

- **H-Z1 [SUPUESTO]:** «el logo de Qubyt» es el logo de la app (hoy el de Qubico, el único que existe). Si Qubyt
  tiene logo propio, hay que pasarlo.
- **R-Z1:** con Z1 B, el verificador no ve en la lista los criterios que rechazó solo el revisor; puede creer que una
  llamada no tiene trabajo.
- **R-Z2:** los colores pastel bajan el contraste si no se ajusta el texto; se valida cada par fondo/texto.
- **R-Z3:** el Cambio 21 y este cambio tocan los mismos archivos (`case-review.tsx`, `tray-view.tsx`,
  `verification-labels.ts`, `globals.css`): implementarlo después de que el Cambio 21 se commitee.
