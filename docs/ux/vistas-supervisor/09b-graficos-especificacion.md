# Iteración 1 · Especificación de gráficos (fases 1, 5 y 6)

Fecha: 2026-11-18 · Estado: **entregada, esperando IT-Q11 a IT-Q14 y aprobación de Johannes**

Base: Fase 0 de la iteración aprobada (D-32 a D-36, `09-iteracion-graficos.md`). Alcance (D-35): **pestaña Auditores, ficha del auditor, pestaña Ejecutivos y ficha del ejecutivo**. Todo es solo lectura sobre la foto vigente (D-15). Las fases 1, 5 y 6 se entregan juntas, como en el proceso base (D-05, proceso comprimido).

---

## A. Fase 1 comprimida · CUJ de la iteración

### CUJ-5 · Ver en qué motivos cada auditor se aparta de la IA (interno, Qubico)

| Campo | Contenido |
|---|---|
| Persona | Analista de Qubico (`qubico_admin` o `qubico_viewer`, D-33) |
| Disparador | Foto nueva, o preparar la reunión con la corredora |
| Objetivo | Saber qué auditor marca distinto que la IA, en qué motivos, y si es la persona o la pauta |
| Pasos | Auditores → mapa de calor (fila = persona, columna = motivo) → barras del "top" → ficha del auditor → motivo → lista de llamadas |
| Éxito | En menos de 1 minuto dice "el auditor X se aparta en los motivos A y B" o "el motivo C se marca distinto en casi todos" [SUPUESTO] |
| Puntos de falla | Leer el desacuerdo como error del auditor (R-14); celdas con pocas llamadas leídas como cifra firme |
| Métrica | Test de 5 segundos sobre el mapa (H-22) |

### CUJ-2 (vigente) ampliado · Comparar ejecutivos y llevar evidencia al feedback

Se mantiene el CUJ-2 de `01-investigacion.md`. Cambio: el paso "comparar" se hace en el mapa de calor ejecutivo × motivo, y en la ficha se suma la evolución en el tiempo. Sigue sin ranking (D-07, D-32).

Sin cambios en personas: Verónica (supervisora) ve Ejecutivos; el analista de Qubico ve además Auditores.

---

## B. Fase 5 · Patrones de gráficos

### B.1 Reglas comunes a todos los gráficos

| Regla | Especificación |
|---|---|
| Construcción | A mano, sin librería (R-13): mapas de calor como `<table>` HTML con fondo de color por celda (como `/dashboard/criteria`); barras, puntos y líneas en SVG en línea o `div` con ancho %. Componentes nuevos en `frontend/src/components/analysis/charts.tsx` |
| Contenedor | `<figure>` con `<figcaption>` (título-conclusión + subtítulo). El SVG lleva `role="img"` y `aria-label` con el texto alternativo de §C.6. Los mapas de calor, al ser `<table>`, llevan `<caption>` y encabezados `scope` |
| Tabla debajo | Se mantiene la tabla existente de cada pantalla debajo de los gráficos: es la alternativa accesible y el detalle (R-12) |
| Cifras | Siempre en texto: rótulo directo o tooltip, y la tabla. Números con coma decimal (`pct0`, `pct1`, `ptsText` de `parts.tsx`) |
| Texto | Siempre en `--foreground` o `--muted-foreground`, nunca del color de la serie |
| Tooltip | Al pasar el mouse (y al enfocar, donde la marca es enfocable). Fondo `--popover`, borde `--border`, texto `--text-sm`. Radix Tooltip ya está en el proyecto |
| Pocas llamadas | Base < `config.low` (10): celda sin color, con "—", borde punteado `--neutral-300`; punto hueco (contorno 2 px, sin relleno); barra con relleno al 30 % y el ícono de `LowSampleMark` |
| Clic | Toda marca lleva a su lista de llamadas o ficha (§B.4). Cursor `pointer` |
| Filtros | Tipo de seguro y Flujo (barra existente) se aplican a todos los gráficos de la pantalla |
| Marcas | Barras de 12 px de alto con extremo redondeado de 4 px en el lado del dato; separación de 2 px entre celdas y barras; líneas de 2 px; puntos de 8 px (10 px al pasar el mouse); grilla y ejes en `--neutral-200` |
| Prohibido | Donut, torta, velocímetro, doble eje, 3D, números de posición, medallas, colores de "peor", una cifra que mezcle IA y auditor (D-02) |
| Modo oscuro | La app no tiene modo oscuro hoy; no se especifica |

### B.2 Colores (tokens nuevos, pendiente IT-Q11)

Se agregan a `frontend/src/styles/tokens.css` y a `docs/ux/call-audit/08-tokens.css`. Valores calculados con el validador de la skill dataviz (contraste WCAG con texto y separación bajo daltonismo).

**Escala de "cuánto marca distinto" (una sola tonalidad, violeta).** Uso: mapa de calor auditor × motivo (A-2).

| Token | Hex | Tramo de % que no coincide | Texto en la celda | Contraste del texto |
|---|---|---|---|---|
| `--seq-1` | `#efeaf8` | 0 a < 5 % | `--foreground` | 14,0:1 |
| `--seq-2` | `#d5c8ef` | 5 a < 10 % | `--foreground` | 10,5:1 |
| `--seq-3` | `#b09ae0` | 10 a < 15 % | `--foreground` | 6,7:1 |
| `--seq-4` | `#7656bf` | 15 a < 25 % (desde U = 15, D-21) | blanco | 5,5:1 |
| `--seq-5` | `#5f3fa6` | 25 % o más | blanco | 7,6:1 |

El corte en 15 coincide con U: desde `--seq-4` la celda cambia a texto blanco y se lee "sobre el umbral".

**Escala de "más o menos que el equipo" (divergente, ocre ↔ violeta, gris al centro).** Uso: mapa ejecutivo × motivo (E-2), puntos de desvío (E-3), barras de desvío de la ficha del ejecutivo (FE-2) y severidad de la ficha del auditor (FA-3).

| Token | Hex | Tramo | Texto en la celda | Contraste |
|---|---|---|---|---|
| `--div-pos-2` | `#946200` | más de +5 pts (más No cumple / más estricto) | blanco | 5,2:1 |
| `--div-pos-1` | `#ecc979` | +2 a +5 pts | `--foreground` | 10,4:1 |
| `--div-mid` | `var(--neutral-100)` `#f3f5f7` | −2 a +2 pts ("Igual que el equipo", D-21) | `--foreground` | 15,2:1 |
| `--div-neg-1` | `#cfbdef` | −5 a −2 pts | `--foreground` | 9,6:1 |
| `--div-neg-2` | `#7656bf` | menos de −5 pts (menos No cumple / más permisivo) | blanco | 5,5:1 |

Separación bajo daltonismo de los polos: ΔE 25 (deutan); de los tonos claros: ΔE 17. Además el signo va siempre en el texto ("+3", "−7"), así que el color nunca va solo.

**Regla:** la escala violeta de magnitud y la divergente **nunca aparecen en la misma pantalla** (la pestaña Auditores usa solo la de magnitud; la ficha del auditor solo la divergente).

**Colores que se mantienen:** IA = `--series-1` (azul, punto sólido); auditor = `--series-2` (óxido, punto con borde y relleno blanco: así no depende del color); promedio del equipo = `--neutral-700` (marca vertical de 2 px o línea punteada); personas en dispersión = `--ink-900`.

### B.3 Catálogo por pantalla

Notación de datos: campos del contrato de §D. "n" = llamadas de la base.

#### Pestaña Auditores (`/analysis/evaluators`, solo Qubico, D-33)

Orden en la página: banda de la foto → nota fija "Solo la ven personas de Qubico." → **A-1** → **A-2** → (dos columnas en ≥ 1280 px, una debajo de la otra en menos) **A-3** | **A-4** → tabla existente.

**A-1 · Cifras clave** (4 tarjetas, `--text-2xl`)

| Tarjeta | Valor | Base / pista | Origen |
|---|---|---|---|
| Auditores | n con ≥ 10 llamadas | "{total} en total" | `EvaluatorRow[]` (cliente) |
| Llamadas revisadas | Σ `evaluated` | "en los últimos {periodDays} días" | cliente |
| Marca distinto que la IA | promedio del equipo, motivos por llamada | "promedio del equipo" | **nuevo** `team.disagreementPerCall` en la matriz |
| Motivos que se marcan distinto | n de 33 | "en la mayoría de los auditores" | **nuevo** `criteria[].markedDifferent` en la matriz |

**A-2 · Mapa de calor auditor × motivo** (gráfico principal, D-34)

| Aspecto | Especificación |
|---|---|
| Forma | `<table>`: filas = auditores; columnas = 33 motivos agrupados por bloque en el orden de la pauta (Acreditación y cierre: 31, 33, 29, 30, 13, 15, 27 · Conocimiento del producto: 4, 2, 6, 5, 28 · Gestión de la retención: 14, 17, 9, 16, 3, 12, 32, 7, 26 · Trato: 1, 8, 11, 10 · Tipificación: 18–25). Primera fila de encabezado con el nombre del bloque (`colspan`), segunda con el número del motivo |
| Celda | 28 × 28 px, fondo `--seq-1..5` según `disagreementPct`, cifra entera dentro (`--text-xs`, tabular). Separación de 2 px |
| Datos | `getAnalysisEvaluatorMatrix` → `rows[].cells[]` |
| Escala | Tramos fijos de §B.2 (no relativa al máximo: así dos fotos se comparan) |
| Orden de filas | Igual que la tabla: por `disagreementPerCall` de mayor a menor, "pocas llamadas" al final (D-32). Sin números de posición |
| Columna marcada | Si `markedDifferent` (D-06/D-21): ícono `TriangleAlert` de 12 px sobre el número del motivo y borde superior de 2 px `--foreground` en la columna |
| Columna fija | Nombre del auditor (160 px, `position: sticky`), con enlace a su ficha. El mapa desplaza horizontalmente dentro de su contenedor si no cabe (≈ 1.130 px de ancho total) |
| Tooltip | §C.4 |
| Clic en celda | `/analysis/calls?evaluator={name}&criterion={id}&source=mismatch` + filtros activos |
| Leyenda | Debajo: 5 muestras con sus tramos + muestra "—" de pocas llamadas + ícono de columna marcada |
| Pocas llamadas | Toda la fila del auditor con < 10 llamadas: celdas "—", fila al final |
| Vacío | Sin auditores: estado vacío existente de la pestaña (06 §10.1) y no se dibuja el mapa |

**A-3 · Barras: cuánto marca distinto cada auditor** ("top", D-32)

| Aspecto | Especificación |
|---|---|
| Forma | Barras horizontales, una por auditor, nombre a la izquierda (enlace a ficha), cifra a la derecha ("1,8 por llamada") y "{n} llamadas" en texto secundario |
| Datos | `EvaluatorRow.disagreementPerCall`, `evaluated` |
| Escala | 0 al máximo redondeado al 0,5 superior; eje inferior con 3–4 marcas |
| Color | Barra `--seq-4`; marca vertical del promedio del equipo en `--neutral-700` con rótulo "Equipo {x}" |
| Orden | De mayor a menor; "pocas llamadas" al final con su marca |
| Cantidad | Pendiente IT-Q13 (recomendado: todos si son ≤ 8; si no, 8 y "Ver todos los auditores") |
| Clic | Ficha del auditor |

**A-4 · Dispersión: más estricto o más permisivo**

| Aspecto | Especificación |
|---|---|
| Forma | SVG 2D, 360 × 280 px. Eje x = `severityPerCall` (izquierda "Más permisivo", derecha "Más estricto", 0 al centro con línea `--neutral-300`). Eje y = `disagreementPerCall` (abajo 0) |
| Puntos | 8 px `--ink-900`, nombre al lado (si dos se superponen, el rótulo se desplaza abajo) |
| Referencia | Línea horizontal punteada en el promedio del equipo, rótulo "Promedio del equipo" |
| Pocas llamadas | Punto hueco |
| Clic | Ficha del auditor |
| Nota | Reutiliza el patrón de `PriorityMap` (`discrepancy-charts.tsx`) |

#### Ficha del auditor (`/analysis/evaluators/[id]`)

Orden: volver "← Auditores" → nombre → **FA-1** → **FA-2** → **FA-3** → **FA-4** → tabla existente (con kappa en el detalle técnico plegado, D-06).

**FA-1 · Cifras clave**: Llamadas revisadas (`evaluated`) · Marca distinto que la IA ("{x} motivos por llamada", pista "equipo {y}") · Más estricto o permisivo (texto existente: "Más estricto (+{x})" / "Más permisivo (−{x})" / "Parejo") · Frente al equipo (`vsTeam`, "+{x} sobre el equipo").

**FA-2 · Puntos: el auditor frente al equipo, por motivo**

| Aspecto | Especificación |
|---|---|
| Forma | Una fila por motivo: "Motivo {N}" + nombre corto, eje 0–máx %; punto `--ink-900` 8 px = % del auditor; marca vertical `--neutral-700` = promedio del equipo; línea gris de 2 px entre ambos; a la derecha "{a} % · equipo {b} %" y "{m} de {n} llamadas" |
| Datos | `EvaluatorDetail.criteria[]`: `disagreementPct`, **nuevos** `teamDisagreementPct`, `mismatchCalls`, `evaluated` |
| Orden | Por diferencia `disagreementPct − teamDisagreementPct` de mayor a menor; 10 motivos y "Ver los 33 motivos" (como D-23) |
| Clic | Fila → `/analysis/calls?evaluator=…&criterion=…&source=mismatch` |

**FA-3 · Barras divergentes: hacia dónde se inclina en cada motivo**

| Aspecto | Especificación |
|---|---|
| Forma | Barras desde un 0 central; derecha = más estricto (`severityPts` > 0), izquierda = más permisivo. Cifra con signo al final de la barra |
| Color | Tramos divergentes de §B.2 (`--div-pos-*` estricto, `--div-neg-*` permisivo; ±2 en `--div-mid` y rótulo "Parejo") |
| Orden | Los mismos 10 (o 33) motivos y en el mismo orden que FA-2, para leerlos en paralelo |
| Escala | Simétrica: ± el máximo absoluto redondeado a 5 |

**FA-4 · Línea: cómo ha cambiado** (D-36)

| Aspecto | Especificación |
|---|---|
| Forma | SVG 480 × 180 px, 3 puntos unidos (tramos de §D.1), eje y en "motivos por llamada" desde 0 |
| Series | Auditor `--ink-900` (línea 2 px, puntos 8 px, cifra sobre cada punto) · Equipo `--neutral-700` punteada con rótulo "Equipo" al final |
| Datos | **nuevo** `EvaluatorDetail.trend[]` |
| Pocas llamadas | Tramo con < 10: punto hueco y "pocas llamadas" bajo la fecha |
| Vacío | Menos de 2 tramos con ≥ 10 llamadas: no se dibuja; texto §C.5 |

#### Pestaña Ejecutivos (`/analysis/agents`)

Si la pestaña está cerrada por volumen (D-27), se mantiene el aviso actual y **no se dibuja ningún gráfico**. Con selector "Motivo" activo, los gráficos se mantienen y la columna de ese motivo se resalta en E-2.

Orden: banda → **E-1** → **E-2** → **E-3** → tabla existente (su columna "Según la IA / Según el auditor" cambia las barras pareadas por **E-4**).

**E-1 · Cifras clave**: Ejecutivos (n con ≥ 10 llamadas, pista "{total} en total") · Con algún No cumple, según la IA (**nuevo** `team.aiPct`) · Según el auditor (**nuevo** `team.sheetPct`, pista "sobre {m} revisadas") · Dentro del rango del equipo ("{n} de {m}", pista "a ±2 pts del promedio", **nuevo** `team.withinRange`). IA y auditor en tarjetas separadas (D-02).

**E-2 · Mapa de calor ejecutivo × motivo**

| Aspecto | Especificación |
|---|---|
| Forma | `<table>`: filas = ejecutivos; columnas = 10 motivos; botón "Ver los 33 motivos" muestra todos agrupados por bloque como A-2 |
| Columnas por defecto | Los 10 motivos con más ejecutivos fuera de ±2 pts (**nuevo** `criteria[].agentsOutside`), empate por mayor desvío absoluto; el motivo 25 (y los `data_explained`) nunca entre los 10 por defecto (D-10) |
| Celda | 36 × 28 px, fondo divergente §B.2 según `deviationPts` (según la IA, D-22), cifra con signo dentro ("+4", "0", "−3") |
| Datos | `getAnalysisAgentMatrix` |
| Orden de filas | El mismo de la tabla: por desvío global de mayor a menor, "pocas llamadas" al final (D-07, D-32). **Sin números de posición ni recorte** |
| Columna fija | Nombre (enlace a ficha) + "{n} llamadas" en texto secundario |
| Página | Mismas 50 filas por página que la tabla (D-17); la paginación controla ambos |
| Tooltip | §C.4 |
| Clic en celda | `/analysis/calls?agent={id}&criterion={id}&source=ai` + filtros |
| Leyenda | "Menos No cumple que el equipo · Igual (±2 pts) · Más No cumple que el equipo", con muestras de los 5 tonos y "—" pocas llamadas |

**E-3 · Puntos: desvío de cada ejecutivo frente al equipo**

| Aspecto | Especificación |
|---|---|
| Forma | Una fila por ejecutivo (mismo orden que E-2), eje horizontal simétrico en pts con 0 al centro; franja gris `--div-mid` de −2 a +2 rotulada "Igual que el equipo"; punto 8 px coloreado por tramo divergente; cifra con signo a la derecha |
| Datos | `AgentRow.deviationPts` (con el motivo del selector si lo hay) |
| Pocas llamadas | Punto hueco |
| Clic | Ficha del ejecutivo |

**E-4 · Pesas IA vs auditor (dentro de la tabla)**: en cada fila, una pista de 120 px de 0 a 100 % (o al máximo de la columna) con punto IA `--series-1` sólido, punto auditor `--series-2` con borde, línea gris entre ambos; las cifras siguen en texto en la celda. Reemplaza `PairedBars` solo en Ejecutivos y su ficha; Motivos no cambia (D-35).

#### Ficha del ejecutivo (`/analysis/agents/[id]`)

Orden: volver → nombre → **FE-1** → **FE-2** → **FE-3** → **FE-4** → "Sus llamadas".

**FE-1 · Cifras clave**: Llamadas ("{calls} con corrida · {evaluated} revisadas por un auditor") · Con algún No cumple, según la IA (`aiPct`) · Según el auditor (`sheetPct`) · Frente al equipo (`deviationPts`, texto existente).

**FE-2 · Barras divergentes: motivos donde más se aleja del equipo**

| Aspecto | Especificación |
|---|---|
| Forma | Barras desde 0 central; derecha = más No cumple que el equipo, izquierda = menos. Cifra con signo al final |
| Color | Tramos divergentes de §B.2 |
| Datos | `AgentDetail.criteria[].deviationPts` (10 motivos, "Ver los 33", D-23) |
| Orden | El del contrato actual (mayor desvío primero, `data_explained` al final con `NoticeDataExplained`) |
| Clic | `/analysis/calls?agent=…&criterion=…&source=ai` |

**FE-3 · Pesas IA vs auditor por motivo**: mismos motivos y orden que FE-2; por fila, punto IA y punto auditor (como E-4), eje común 0 al máximo del conjunto. Cifras "IA {a} % · auditor {b} %" a la derecha. Si `sheetPct` es null: solo el punto IA y "sin revisión del auditor".

**FE-4 · Línea: cómo ha cambiado** (D-36): como FA-4, eje y en % de llamadas con algún No cumple. Series: IA (`--series-1`, sólida), auditor (`--series-2`, puntos con borde), equipo según la IA (`--neutral-700`, punteada). 3 series, rótulo directo al final de cada línea. Datos: **nuevo** `AgentDetail.trend[]`.

### B.4 Navegación desde los gráficos

| Desde | Destino |
|---|---|
| Nombre de fila (A-2, A-3, A-4, E-2, E-3) | Ficha de la persona |
| Celda de A-2 / fila de FA-2 | Lista de llamadas: auditor + motivo + "La IA y el auditor no coinciden" |
| Celda de E-2 / fila de FE-2 | Lista de llamadas: ejecutivo + motivo + "No cumple según la IA" |
| Volver | "← Auditores" / "← Ejecutivos" conservan filtros y página (patrón existente `withFilters`) |

### B.5 Accesibilidad (WCAG 2.2 AA)

| Criterio | Cómo se cumple |
|---|---|
| 1.1.1 Contenido no textual | `aria-label` de cada SVG (§C.6); mapas como `<table>` con `<caption>` |
| 1.3.1 Información y relaciones | Encabezados de fila y columna con `scope`; bloque de motivos con `colspan` |
| 1.4.1 Uso del color | Cifra en cada celda y barra; signo en los desvíos; auditor con borde vs IA sólido; pocas llamadas con "—" y borde punteado |
| 1.4.3 Contraste del texto | Texto en celdas según la tabla de §B.2 (≥ 4,5:1 en todas) |
| 1.4.11 Contraste no textual | Barras y puntos de datos ≥ 3:1 contra el blanco (`--seq-4/5`, `--div-*-2`, series, tinta). Los tonos claros llevan cifra |
| 2.1.1 Teclado | Pendiente IT-Q14 (recomendado: celdas pulsables con mouse; con teclado, el mismo destino por nombre → ficha → fila del motivo, y por los enlaces de la tabla de abajo) |
| 2.4.7 Foco visible | Enlaces de nombres y filas con el anillo `--ring` existente |
| 2.5.8 Tamaño del objetivo | Celdas de 28 px ≥ 24 px; filas de FA-2/FE-2 de 32 px |
| 1.4.10 Reflujo | Bajo 1280 px los gráficos se apilan; los mapas desplazan dentro de su contenedor con la columna de nombres fija |

---

## C. Fase 6 · Textos finales

Glosario sin cambios: "Según la IA", "Según el auditor", "Marca distinto que la IA", "No coinciden", "Frente al equipo", "Igual que el equipo", "Más estricto", "Más permisivo", "Parejo", "pocas llamadas". La palabra "discrepancia" **no** se usa en esta sección (es el nombre de `/discrepancies`); se dice "marca distinto que la IA" o "no coincide con la IA".

### C.1 Pestaña Auditores

| Lugar | Texto |
|---|---|
| Nota fija (existente) | Solo la ven personas de Qubico. |
| Nota de lectura (nueva, bajo las cifras) | Marcar distinto que la IA no es un error: la IA es el punto de comparación común, no la respuesta correcta. Sirve para ver si es la persona o la pauta. |
| A-1 tarjetas | **Auditores** · {n} · "con 10 llamadas o más · {total} en total" ‖ **Llamadas revisadas** · {n} · "en los últimos {d} días" ‖ **Marca distinto que la IA** · {x} · "motivos por llamada, promedio del equipo" ‖ **Motivos que se marcan distinto** · {n} de 33 · "en la mayoría de los auditores" |
| A-2 título (si hay motivos marcados) | En {n} motivos la mayoría de los auditores no coincide con la IA: puede ser la pauta, no la persona |
| A-2 título (si no hay) | Ningún motivo se marca distinto en la mayoría de los auditores |
| A-2 subtítulo | % de las llamadas de cada auditor en que no coincide con la IA, por motivo. Una fila oscura es una persona que se aparta; una columna oscura, un motivo que conviene revisar. |
| A-2 leyenda | 0–4 % · 5–9 % · 10–14 % · 15–24 % · 25 % o más · — pocas llamadas (menos de 10) · ▲ Se marca distinto |
| A-3 título | {nombre} es quien más marca distinto que la IA: {x} motivos por llamada, frente a {y} del equipo |
| A-3 título (si nadie está a más de 0,2 del equipo) | Los auditores marcan distinto que la IA en cantidades parecidas |
| A-3 rótulos | "{x} por llamada" · "{n} llamadas" · marca "Equipo {y}" · enlace "Ver todos los auditores" |
| A-4 título | Más estricto o más permisivo que la IA |
| A-4 subtítulo | Arriba, quienes más marcan distinto; a la derecha, quienes marcan No cumple cuando la IA no lo hace. |
| A-4 ejes | "Más permisivo" ← → "Más estricto" · "Marca distinto que la IA (motivos por llamada)" |

### C.2 Ficha del auditor

| Lugar | Texto |
|---|---|
| FA-1 tarjetas | **Llamadas revisadas** · {n} ‖ **Marca distinto que la IA** · {x} · "motivos por llamada · equipo {y}" ‖ **Más estricto o permisivo** · "Más estricto (+{x})" / "Más permisivo (−{x})" / "Parejo" ‖ **Frente al equipo** · "+{x} sobre el equipo" / "−{x} bajo el equipo" / "Igual que el equipo" |
| FA-2 título | Donde más se aparta del equipo: Motivo {N}, {a} % frente a {b} % |
| FA-2 título (si ningún motivo supera al equipo por más de 2 pts) | Se aparta de la IA en la misma medida que el equipo en todos los motivos |
| FA-2 subtítulo | % de sus llamadas en que no coincide con la IA, frente al promedio de los auditores. |
| FA-2 rótulo por fila | "{a} % · equipo {b} %" · "{m} de {n} llamadas" |
| FA-3 título | Hacia dónde se inclina en cada motivo |
| FA-3 subtítulo | Cuando no coincide con la IA, ¿marca No cumple (más estricto) o Cumple (más permisivo)? En puntos. |
| FA-3 rótulos | "+{x} más estricto" · "−{x} más permisivo" · "Parejo" |
| FA-4 título | Cómo ha cambiado: de {x} a {y} motivos por llamada |
| FA-4 título (sin cambio, diferencia ≤ 0,2) | Se mantiene en {y} motivos por llamada en los últimos {d} días |
| Enlace | Ver los 33 motivos · Ver menos |

### C.3 Pestaña y ficha de Ejecutivos

| Lugar | Texto |
|---|---|
| E-1 tarjetas | **Ejecutivos** · {n} · "con 10 llamadas o más · {total} en total" ‖ **Con algún No cumple, según la IA** · {x} % · "de {n} llamadas" ‖ **Según el auditor** · {y} % · "de {m} revisadas por un auditor" ‖ **Dentro del rango del equipo** · {n} de {m} · "a ±2 pts del promedio, según la IA" |
| E-2 título | Dónde se aparta cada ejecutivo del equipo |
| E-2 subtítulo | Según la IA, en los 10 motivos donde los ejecutivos están más dispersos. No es un ranking: sirve para elegir qué llamadas escuchar. |
| E-2 leyenda | Menos No cumple que el equipo · Igual (±2 pts) · Más No cumple que el equipo · — pocas llamadas |
| E-2 botón | Ver los 33 motivos · Ver los 10 principales |
| E-3 título | {n} de {m} ejecutivos están dentro del rango del equipo |
| E-3 subtítulo | Diferencia con el promedio del equipo en llamadas con algún No cumple, según la IA, en puntos. |
| E-3 franja | Igual que el equipo |
| FE-1 tarjetas | **Llamadas** · {calls} · "{evaluated} revisadas por un auditor" ‖ **Con algún No cumple, según la IA** · {a} % ‖ **Según el auditor** · {b} % ‖ **Frente al equipo** · texto existente |
| FE-2 título | Más No cumple que el equipo en {n} motivos (si n = 0: "En ningún motivo se aleja del equipo") |
| FE-2 subtítulo (existente) | Motivos donde más se aleja del equipo |
| FE-3 título | Según la IA y según el auditor, en los mismos motivos |
| FE-3 sin auditor | sin revisión del auditor |
| FE-4 título | Cómo ha cambiado: de {x} % a {y} % de llamadas con algún No cumple, según la IA |
| FE-4 rótulos de línea | Según la IA · Según el auditor · Equipo, según la IA |

### C.4 Tooltips

| Gráfico | Texto |
|---|---|
| A-2 celda | **{Auditor} · Motivo {N}** / No coincide con la IA en {m} de {n} llamadas ({x} %) / {Más estricto (+{s} pts) · Más permisivo (−{s} pts) · Parejo} / Equipo: {t} % / Clic para ver las llamadas |
| A-2 celda con pocas llamadas | **{Auditor} · Motivo {N}** / Pocas llamadas ({n}): la cifra todavía no es confiable |
| A-2 encabezado marcado | Se marca distinto: la mayoría de los auditores no coincide con la IA en este motivo. Puede ser la pauta, no la persona. |
| E-2 celda | **{Ejecutivo} · Motivo {N}** / Según la IA: {a} % · equipo {t} % ({±d} pts) / Según el auditor: {b} % ({m} revisadas) / {n} llamadas · Clic para ver las llamadas |
| A-3, A-4, E-3 | **{Nombre}** / {cifra del gráfico} / {n} llamadas |
| FA-4 / FE-4 punto | **{fecha desde} – {fecha hasta}** / {serie}: {valor} / {n} llamadas |

### C.5 Estados vacíos y de poca muestra

| Caso | Texto |
|---|---|
| Auditores sin datos (existente, 06 §10.1) | Esta foto no trae auditores. / La pestaña se llena con las revisiones hechas en la app o cuando la planilla importada incluye la columna del evaluador de calidad. |
| Todos los auditores con pocas llamadas | Ningún auditor tiene 10 llamadas revisadas o más. Los gráficos se llenan a medida que se revisan más llamadas. (se muestran A-2 con "—" y A-3; A-4 se oculta) |
| Ejecutivos cerrado (existente, D-27) | Sin cambios; no se dibujan gráficos |
| Evolución sin muestra | Todavía no hay llamadas suficientes para ver la evolución: se necesitan 10 en al menos dos tramos. |
| Foto de menos de 60 días | La evolución aparece cuando la foto cubre 60 días o más. |
| Tramo con pocas llamadas | rótulo bajo la fecha: "pocas llamadas" |
| Filtro que deja sin datos | No hay llamadas con estos filtros. · Quitar filtros (patrón existente) |

### C.6 Textos alternativos (`aria-label`, armados con las cifras)

| Gráfico | Plantilla |
|---|---|
| A-3 | Barras: motivos por llamada en que cada auditor marca distinto que la IA. {Nombre 1}: {x}; {Nombre 2}: {y}; … Promedio del equipo: {t}. |
| A-4 | Dispersión de {n} auditores según cuánto marcan distinto que la IA y si son más estrictos o más permisivos. El detalle está en la tabla de abajo. |
| E-3 | Puntos: desvío de cada ejecutivo frente al equipo, según la IA. {n} de {m} dentro de ±2 pts. El detalle está en la tabla de abajo. |
| FA-2 | {Nombre}: % de llamadas en que no coincide con la IA por motivo, frente al equipo. Motivo {N}: {a} % frente a {b} %; … |
| FA-3 | {Nombre}: severidad por motivo. Motivo {N}: {±x} pts; … |
| FE-2 | {Nombre}: desvío frente al equipo por motivo, según la IA. Motivo {N}: {±x} pts; … |
| FE-3 | {Nombre}: % No cumple por motivo según la IA y según el auditor. Motivo {N}: IA {a} %, auditor {b} %; … |
| FA-4 / FE-4 | Evolución en 3 tramos de 30 días. {Serie}: {v1}, {v2}, {v3}. Equipo: {t1}, {t2}, {t3}. |
| `<caption>` A-2 | Auditores por motivo: % de llamadas en que no coinciden con la IA |
| `<caption>` E-2 | Ejecutivos por motivo: diferencia con el equipo según la IA, en puntos |

---

## D. Cambios al contrato de la API

Todo se calcula en `src/call_audit/analysis/compute.py` con las llamadas que ya guarda la foto (`AnalysisSnapshotCall`). No requiere re-correr IA ni cambiar la retención de fotos (D-36). Campos nuevos en camelCase; los existentes no cambian de forma (solo se agregan campos).

### D.1 Tramos de la evolución (en `AnalysisSnapshotMeta`)

Pendiente IT-Q12 (recomendado: 3 tramos de 30 días hacia atrás desde `periodTo`). Campo nuevo:

```json
"periods": [
  { "id": "p1", "from": "2026-08-20", "to": "2026-09-18" },
  { "id": "p2", "from": "2026-09-19", "to": "2026-10-18" },
  { "id": "p3", "from": "2026-10-19", "to": "2026-11-17" }
]
```

Si `periodDays` < 60: `periods` vacío (§C.5).

### D.2 Nuevo · `GET /api/analysis/evaluators/matrix?type=&flow=` → `getAnalysisEvaluatorMatrix(filters)`

Solo `qubico_admin` y `qubico_viewer` (D-33); 403 para `supervisor`, como el resto de `/evaluators`.

```json
{
  "criteria": [
    { "criterionId": 31, "blockId": "A", "markedDifferent": false, "teamDisagreementPct": 6.2 }
  ],
  "team": { "evaluated": 240, "disagreementPerCall": 1.42 },
  "rows": [
    {
      "name": "Rosa Muñoz",
      "evaluated": 62,
      "disagreementPerCall": 1.8,
      "lowSample": false,
      "cells": [
        { "criterionId": 31, "mismatchCalls": 5, "disagreementPct": 8.1, "severityPts": 3.2, "lowSample": false }
      ]
    }
  ]
}
```

- `criteria`: los 33, en el orden de la pauta por bloque (§B.3 A-2), con el `blockId` de la rúbrica (`A` a `E`, `rubrics/bancoestado_retention/`). `markedDifferent` = la misma regla de "Se marca distinto" (D-06/D-21). `teamDisagreementPct` = mismatches de todos los auditores / llamadas revisadas.
- `rows`: mismo orden que `listAnalysisEvaluators`. `cells`: 33 por fila, mismo orden que `criteria`. `lowSample` de la celda = `evaluated` del auditor < `config.low` (cada llamada revisada evalúa los 33 motivos).
- `team.disagreementPerCall` = el `team` que ya calcula `evaluator_rows`.

### D.3 Ampliación · `EvaluatorDetail`

```json
{
  "name": "Rosa Muñoz",
  "evaluated": 62,
  "criteria": [
    {
      "criterionId": 18,
      "disagreementPct": 19.4, "severityPts": 9.7, "kappa": 0.41,
      "mismatchCalls": 12, "evaluated": 62, "teamDisagreementPct": 11.3
    }
  ],
  "trend": [
    { "periodId": "p1", "evaluated": 20, "disagreementPerCall": 2.1, "teamDisagreementPerCall": 1.6, "lowSample": false }
  ]
}
```

`criteria` se ordena por `disagreementPct − teamDisagreementPct` (hoy por `disagreementPct`).

### D.4 Nuevo · `GET /api/analysis/agents/matrix?type=&flow=&page=` → `getAnalysisAgentMatrix(filters)`

Mismos permisos y misma regla de apertura (D-27) que `/agents`.

```json
{
  "gate": { "open": true, "agentsWithEnough": 8, "totalAgents": 10 },
  "criteria": [
    { "criterionId": 18, "blockId": "E", "teamAiPct": 12.1, "agentsOutside": 6, "dataExplained": false }
  ],
  "rows": [
    {
      "agentId": "ag-101", "name": "Camila Soto", "calls": 34, "lowSample": false,
      "cells": [
        { "criterionId": 18, "aiPct": 17.6, "sheetPct": 15.0, "evaluated": 20, "deviationPts": 5.5 }
      ]
    }
  ],
  "total": 10, "page": 1, "pageSize": 50
}
```

- `criteria`: los 33 en orden de pauta; `agentsOutside` = ejecutivos con ≥ 10 llamadas y |`deviationPts`| > `config.equal`. El cliente elige los 10 por defecto (§B.3 E-2) excluyendo `dataExplained`.
- `rows`: mismo orden y paginación que `listAnalysisAgents` sin motivo. Si `gate.open` es false: `rows` vacío.

### D.5 Ampliación · `AgentsPage`

```json
"team": { "calls": 240, "evaluated": 180, "aiPct": 48.3, "sheetPct": 44.1, "withinRange": 5, "agentsWithEnough": 8 }
```

`aiPct`/`sheetPct` respetan el motivo del selector (si hay). `withinRange` = ejecutivos con ≥ 10 llamadas y |`deviationPts`| ≤ `config.equal`.

### D.6 Ampliación · `AgentDetail`

```json
"trend": [
  { "periodId": "p1", "calls": 12, "evaluated": 8, "aiPct": 50.0, "sheetPct": 37.5, "teamAiPct": 47.9, "lowSample": false }
]
```

`lowSample` = `calls` < `config.low` en el tramo.

### D.7 Tipos TypeScript (para `analysis-types.ts`)

```ts
export interface AnalysisPeriod { id: string; from: string; to: string }
// AnalysisSnapshotMeta: + periods: AnalysisPeriod[]

export interface EvaluatorMatrix {
  criteria: { criterionId: number; blockId: string; markedDifferent: boolean; teamDisagreementPct: number }[];
  team: { evaluated: number; disagreementPerCall: number };
  rows: {
    name: string; evaluated: number; disagreementPerCall: number; lowSample: boolean;
    cells: { criterionId: number; mismatchCalls: number; disagreementPct: number; severityPts: number; lowSample: boolean }[];
  }[];
}
// EvaluatorDetail.criteria[]: + mismatchCalls, evaluated, teamDisagreementPct
// EvaluatorDetail: + trend: { periodId: string; evaluated: number; disagreementPerCall: number; teamDisagreementPerCall: number; lowSample: boolean }[]

export interface AgentMatrix {
  gate: AgentsGate;
  criteria: { criterionId: number; blockId: string; teamAiPct: number; agentsOutside: number; dataExplained: boolean }[];
  rows: {
    agentId: string; name: string; calls: number; lowSample: boolean;
    cells: { criterionId: number; aiPct: number; sheetPct: number | null; evaluated: number; deviationPts: number }[];
  }[];
  total: number; page: number; pageSize: number;
}
// AgentsPage: + team: { calls; evaluated; aiPct; sheetPct: number | null; withinRange; agentsWithEnough }
// AgentDetail: + trend: { periodId; calls; evaluated; aiPct; sheetPct: number | null; teamAiPct; lowSample }[]

// AnalysisApi: + getAnalysisEvaluatorMatrix(filters: AnalysisFilters): Promise<EvaluatorMatrix>
//              + getAnalysisAgentMatrix(filters: AnalysisFilters & { page?: number }): Promise<AgentMatrix>
```

El mock (`analysis-mock.ts`) debe implementar los mismos cálculos para que la demo se lea igual (como hoy, F-9).

---

## E. Supuestos y riesgos

- H-21, H-22 y H-23 siguen abiertas. Revisión de código: cada llamada revisada evalúa los 33 motivos, así que la base de cada celda del mapa de auditores es el total revisado por esa persona; H-23 (celdas vacías) solo afecta a auditores con < 10 llamadas.
- **[SUPUESTO]** 33 columnas de 28 px caben en el área de contenido a 1440 px (≈ 1.160 px útiles); bajo eso, desplazamiento horizontal dentro del mapa.
- **Riesgo:** en producción puede haber muchos más ejecutivos que en la demo (P-4); el mapa de E-2 pagina igual que la tabla (50 filas).
- **Riesgo:** los tramos de 30 días con pocas llamadas por persona darán puntos huecos frecuentes al comienzo.
