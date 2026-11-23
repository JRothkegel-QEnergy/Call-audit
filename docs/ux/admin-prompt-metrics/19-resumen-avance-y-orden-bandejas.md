# 19 · Resumen con avance y orden por columna en las bandejas (revisión rápida, 2026-11-23)

Cambio menor sobre `18-verificador-bandeja-y-revisadas.md` (W1-W6 aprobadas en A e implementadas, commit `f0aa2c6`,
`develop`). Un solo gate: decisiones X1-X5. Sin código hasta que se aprueben. Legal y anonimización omitidos por
instrucción de Johannes. En el front la IA se llama Qubyt.

**Pedido (Johannes, 2026-11-23):** «En la vista resumen pongamos un grafico que sea Total, revisados, por revisar.
Borra el grafico actual de acuerdo con el revisor. Tambien en la lista de por revisar y revisadas, agrega un sort por
fecha, por cumple o no cumple de qubyt y de planilla. Esos sort deberian ser que apriete sobre el nombre de la columna y
salga una flechita para arriba o para abajo si es ascendente o descendente.»

**Ya decidido por Johannes (no se pregunta):** gráfico con Total, Revisadas y Por revisar en el Resumen; se borra el
mosaico «Acuerdo con el revisor» del Resumen; orden por Fecha, Qubyt y Planilla en las dos bandejas, al hacer clic en
el nombre de la columna, con flecha ↑ (ascendente) o ↓ (descendente).

## 1. Diagnóstico

- **Resumen** (`/verification/summary`) renderiza `VerificationView` tal cual: tarjeta «Te quedan {d} de {n}» con
  barra de avance chica, `Ver mis llamadas` y `Seguir revisando`; filtro `Asignadas a: Mí · Todas`; link «Ver mis {n}
  llamadas ›»; mosaico. El mismo componente es la pestaña Verificación del admin.
- **Datos para el gráfico:** con `Mí`, `getVerificationOverview(…, "me").me` ya trae `assigned`, `pending` (y
  `reviewed`/`reviewedToday` desde `18`). Con `Todas` no hay totales de avance en la respuesta del verificador; el
  admin los tiene en `/verification/progress`. Hace falta sumar `progress: {total, reviewed, pending}` al overview para
  el alcance pedido (sin IA, sin tocar `assignments.py`: se calcula en la ruta o en `verification.py`).
- **Bandejas** (`tray-view.tsx`): Por revisar ordena en el cliente por `order` (aleatorio fijo) o por llamada con el
  link «Ordenar por llamada»; Revisadas usa el orden del servidor (`lastReviewedAt` desc.) y no tiene control de orden.
  Ningún encabezado es clicable ni tiene `aria-sort`.
- **Patrón existente a reutilizar:** `components/admin/discrepancy-evaluators.tsx` (`sortHeader` + `ariaSort`, íconos
  `ArrowUp`/`ArrowDown` de lucide) y `analysis/criteria/page.tsx`. No hay componente compartido; conviene extraer
  `SortableTh` a `components/ui/` y usarlo en las bandejas.
- **`Siguiente` / `Anterior`** en la revisión del caso recorren la bandeja en el orden del servidor (`case_comparison`):
  si el orden de la tabla cambia solo en el cliente, `Siguiente` deja de coincidir con lo que se ve.

## 2. Decisiones

| # | Pregunta | Recomendada (A) | Alternativa (B) |
|---|---|---|---|
| X1 | ¿Qué gráfico? | **Tres cifras + una barra de avance apilada.** Arriba, tres cifras grandes: `Total {n}` · `Revisadas {r} ({p} %)` · `Por revisar {d}`. Debajo, una barra horizontal al 100 % partida en Revisadas (color primario) y Por revisar (gris), con las cifras como texto al lado de cada tramo. Revisadas + Por revisar = Total, así que una barra parte-todo se lee de un vistazo; tres barras separadas repetirían el total. Con `Seguir revisando` debajo. | Gráfico de barras verticales con tres barras (Total, Revisadas, Por revisar). |
| X2 | ¿Qué pasa con la tarjeta «Te quedan…» y el filtro `Mí · Todas`? | **La tarjeta se reemplaza por el gráfico** (dice lo mismo); `Seguir revisando` queda bajo el gráfico. **El filtro `Mí · Todas` se mantiene** y mueve el gráfico: `Mí` (por defecto) = tus llamadas asignadas; `Todas` = toda la corrida completa, para ver el avance del equipo. Requiere `progress` en el overview para `Todas`. Se quita el link «Ver mis {n} llamadas ›» (ya está `Por revisar` en el menú). | Solo lo del verificador: sin filtro, el gráfico siempre es `Mí`. |
| X3 | ¿El mosaico se borra en todos lados? | **Solo en el Resumen del verificador.** La pestaña Verificación del admin (`/admin/prompts/{v}/verification`) mantiene mosaico, avance por verificador y reparto. Técnicamente: el Resumen deja de reutilizar `VerificationView` entero y usa un componente propio con el gráfico. | Borrarlo también en la pestaña del admin (y poner el mismo gráfico ahí). |
| X4 | ¿Cómo funciona el clic en el encabezado y cuál es el orden por defecto? | **Ciclo de 3 clics: ↑ ascendente → ↓ descendente → vuelve al orden por defecto** (sin flecha). Ascendente: Fecha = más antigua primero; Qubyt = Cumple → Dudosa → No cumple; Planilla = Cumple → No cumple; empates en el orden por defecto. **Por defecto:** Por revisar = orden aleatorio fijo (como hoy; la columna `#` muestra que no hay columna ordenada); Revisadas = `Revisada el` ↓. En **Revisadas también se ordena por `Revisada el`** (además de Fecha de la llamada). El link «Ordenar por llamada» se reemplaza por el encabezado `Llamada` clicable. El orden va en la URL (`orden=fecha&dir=asc`): sobrevive a `Volver a Por revisar` y se puede compartir. | Ciclo de 2 (↑/↓) sin volver al defecto, con un link «Volver al orden aleatorio»; solo Fecha, Qubyt y Planilla clicables. |
| X5 | ¿`Siguiente` / `Anterior` siguen el orden elegido? | **Sí:** la revisión del caso recibe el orden en la URL y `case_comparison` recorre la bandeja en ese orden (igual que ya sigue los filtros de criterio y discrepancia). Requiere backend: aceptar `orden`/`dir` en `segment_calls` y `case_comparison` (en `verification.py`). | No: el orden es solo visual; `Siguiente` sigue el orden por defecto de la bandeja (sin backend, pero lo que se ve y lo que recorre `Siguiente` no coinciden). |

## 3. Especificación (si se aprueba todo A)

### Backend (`src/call_audit/verification.py` y `api/routes_verification.py`; no tocar `assignments.py`)

1. Overview: `progress: { total, reviewed, pending }` para el alcance `me` / `all` (para `all`, todas las llamadas de
   la corrida completa, asignadas o no; las sin asignar cuentan como por revisar). Mantener `me` como está.
2. `segment_calls` y `case_comparison`: parámetros `orden=fecha|revisada|qubyt|planilla|llamada` y `dir=asc|desc`.
   Rango de veredicto: `compliant` 0, `uncertain` 1, `non_compliant` 2. Empate: el orden por defecto de la bandeja.
   Sin `orden`: el de hoy. Valor inválido: se ignora.
3. Tests: `qubyt asc` deja Cumple → Dudosa → No cumple; `Siguiente` con `orden` recorre el mismo orden que la lista;
   `progress.total == reviewed + pending` en `me` y `all`.

### Frontend

1. `components/ui/sortable-th.tsx` (nuevo, extraído del patrón de `discrepancy-evaluators.tsx`): `<th aria-sort>` con
   un `<button>` dentro (texto + `ArrowUp`/`ArrowDown` `aria-hidden`; sin flecha si no está ordenada).
2. `tray-view.tsx`: encabezados clicables `Llamada`, `Fecha`, `Qubyt`, `Planilla` y, en Revisadas, `Revisada el`;
   `#` (Por revisar) queda fijo. Orden en la URL; enlaces al caso llevan `orden`/`dir`. Se quita el link «Ordenar por
   llamada»; la descripción de Por revisar dice el orden actual.
3. `verification/summary/page.tsx`: componente propio `VerifierSummary` (filtro `Mí · Todas` + gráfico +
   `Seguir revisando`); deja de usar `VerificationView`. El admin no cambia.
4. `case-review.tsx`: pasa `orden`/`dir` al pedir la comparación y en `Volver a…`, `Anterior` y `Siguiente`.

### Microcopy

- Resumen · título `Resumen` · descripción `Tu avance en la verificación de la corrida completa.` (Todas: `El avance del
  equipo en la verificación de la corrida completa.`).
- Cifras: `Total` · `Revisadas` · `Por revisar`; bajo Revisadas, `{p} % del total`. Barra con `aria-label`: `{r} de
  {n} llamadas revisadas`.
- Sin pendientes: `¡Listo! Revisaste tus {n} llamadas.` (como hoy). Sin asignación: el texto de hoy.
- Botón: `Seguir revisando` (solo con `Mí` y pendientes).
- Descripción de Por revisar según orden: `… en un orden al azar fijo, el mismo para todos.` / `… ordenadas por
  {columna}, {ascendente|descendente}.`

### Accesibilidad (sin preguntas; se aplica)

- `aria-sort="ascending|descending"` solo en la columna ordenada; las demás sin `aria-sort` (o `none`), como el patrón
  existente. El clic va en un `<button>` dentro del `<th>` (teclado: Tab + Enter/Espacio), con `aria-label`
  `Ordenar por {columna}` y la flecha `aria-hidden`.
- Región `aria-live="polite"` que anuncia `Ordenado por {columna}, {ascendente|descendente}` o `Orden aleatorio fijo`.
- Gráfico: las cifras van en texto (no solo en la barra); los tramos no dependen solo del color (etiqueta de texto en
  cada uno; WCAG 1.4.1) y el gris de Por revisar con contraste ≥ 3:1 contra el fondo (1.4.11).

## 4. Supuestos y riesgos

- **H-X1 [SUPUESTO]:** «gráfico» admite cifras + barra de avance; si Johannes imagina barras separadas, X1 B.
- **H-X2 [SUPUESTO]:** «fecha» = fecha de la llamada en Por revisar; en Revisadas se ofrecen las dos (llamada y
  revisión).
- **R-X1:** ordenar Por revisar por Qubyt o Planilla rompe el orden al azar que mantiene la muestra sin sesgo si una
  revisión queda a medias (13 V8). Es aceptable porque es una elección del verificador y el defecto sigue siendo el
  aleatorio; la descripción lo dice.
- **R-X2:** sin el mosaico, el verificador ya no ve el acuerdo Qubyt vs. planilla del Resumen; lo sigue viendo el admin.
