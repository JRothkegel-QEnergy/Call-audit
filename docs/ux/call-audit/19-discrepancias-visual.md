# Cambio 19 · Análisis de discrepancias más visual

> Revisión rápida sobre lo aprobado (fases 0–8 y Cambio 16 «Análisis de discrepancias»). Fecha: 2026-11-06. **Estado: aprobado e implementado (2026-11-06; P1–P5 = A, D-80 a D-87; §7 con corte de 10 casos y «Depende de la empresa» en un segmento).**
> **Pedido de Johannes (textual):** "Actualmente tenemos la pestaña de análisis de discrepancias pero aún siento que le falta algo más visual, más gráfico que ayude a entender más rápido lo que se necesita."
> **Numeración:** P-19.x, R-19.x; decisiones desde D-80 (el Cambio 18 reserva desde D-75; revisar al aprobar); supuestos H-132 a H-138. Sin ítems L nuevos (preferencia de Johannes).
> **Revisado:** `16-ia-discrepancias.md` (§2, §7), `CHANGELOG.md` 2026-11-04 y 2026-11-05, `docs/plan-ia-discrepancias.md`, `prompts/discrepancy_analysis/v1.2.0/system.txt` y `merge.txt` (esquema de salida), `frontend/src/app/(app)/admin/discrepancies/page.tsx`, `.../patterns/[id]/pattern-detail.tsx`, `frontend/src/components/admin/discrepancy-parts.tsx`, `frontend/src/lib/discrepancy-labels.ts`, `frontend/src/lib/api/admin-types.ts`, `src/call_audit/discrepancy_runs.py` (`pattern_out`), `frontend/src/components/admin/ai-quality.tsx` (gráficos existentes) y `08-tokens.css` (`--series-1..6`).
> **No contradice:** D-61 a D-70 (ubicación, convivencia con Calidad de la IA, corrida vigente, aceptar no toca el prompt, detalle del patrón). Es una capa de lectura sobre la misma información; no cambia el flujo lanzar → revisar → aceptar/descartar.
> **No revisado en el navegador:** el diagnóstico sale del código y de los datos agregados de producción; falta verlo con datos reales en pantalla.
> **Ajuste 2026-11-09 (Cambio 20, D-92 a D-97):** el orden de bloques de §7.2 queda reemplazado. Resumen conserva D-80 y el mapa de prioridad pasa a Patrones › Todos los motivos. Detalle en `20-analisis-pestanas-por-motivo.md`.

---

## 0. Decisiones

| # | Decisión | Origen |
|---|---|---|
| D-80 | Arriba, la vista responde "¿cuánto es del prompt y cuánto del auditor, y en qué motivos?": cifras clave + barra de acción + barras por motivo | Johannes (P1 A) |
| D-81 | Se exponen en la API `who_is_right`, `concentration`, `side_effects`, `expected_fix`, `tentative` y `unexplained_cases` | Johannes (P2 A) |
| D-82 | Mapa de prioridad de patrones, plegado por defecto y usable como filtro | Johannes (P3 A) |
| D-83 | Barras por motivo por defecto, con "Ver como tabla" (tabla actual completa) | Johannes (P4 A) |
| D-84 | Lo del prompt de análisis v1.0.0 se oculta solo cuando el análisis mostrado no lo tiene | Johannes (P5 A) |
| D-85 | El diseño se basa en el análisis v1.0.0 que ya existe; no se vuelve a correr ahora (~20 USD). Todo lo derivable sin IA debe servir con v1.0.0; lo de v1.1+ queda con estado "sin dato en este análisis" | Johannes (vía PM) |
| D-86 | "Quién tiene más razón" sí se grafica, rotulado **"según el análisis"**, no como medición | Johannes (vía PM) |
| D-87 | Lo ven todos los `qubico_admin`; no la corredora ni el supervisor | Johannes (vía PM) |

## 1. Proporcionalidad

Es un cambio sobre un diseño aprobado (Cambio 16), sin CUJ nuevo, sin sección nueva y sin cambio de navegación. Va por **revisión rápida, en dos gates** (igual que los Cambios 14–16): este gate fija el problema y el alcance (P1–P5); el siguiente entrega §7 (estructura, wireframe con datos sintéticos, estados, textos, accesibilidad e impacto en tipos/API). No hace falta volver a las fases.

## 2. Diagnóstico de la vista actual (código, 2026-11-06)

**Lo que se ve hoy, de arriba hacia abajo (pestaña Análisis):** tarjeta de texto con la corrida y el último análisis → línea de cobertura → tabla "¿Dónde están los desacuerdos?" con **9 columnas numéricas × 29 motivos** → plegable por evaluador → filtros → lista vertical de tarjetas de patrón de texto (título, 4–5 etiquetas, explicación, evidencia, propuesta, botones) → observaciones → ayuda.

| # | Hallazgo | Efecto | Tipo |
|---|---|---|---|
| 1 | **"Quién tiene más razón" no llega a la vista.** El prompt v1.1/v1.2 decide por patrón `who_is_right` (ia · auditor · ambiguo), que es lo que define la acción (auditor → regla del prompt; IA → calibrar). Se guarda en `discrepancy_patterns.data`, pero `pattern_out` no lo envía y el front no lo tiene en `DiscrepancyPattern` | Lo más importante del análisis hay que deducirlo leyendo la explicación de cada tarjeta | Contenido (requiere backend) |
| 2 | Tampoco llegan `concentration` (ejecutivos o auditor donde se concentra), `side_effects` (casos que coinciden y podrían romperse), `expected_fix` (casos que la propuesta corregiría), `tentative` ni `unexplained_cases` | No se ve el riesgo ni el beneficio de aceptar una propuesta | Contenido (requiere backend) |
| 3 | La tabla por motivo es una pared de números: 9 columnas, sin forma visual. La relación más útil (de más vs. se le pasa, y su tamaño frente al total) hay que calcularla de cabeza | Lectura lenta; no salta a la vista que 3–4 motivos concentran la mayoría | Visual |
| 4 | Los patrones son una lista larga de tarjetas de texto ordenadas por impacto, sin resumen. No hay forma de ver "cuántos casos explica cada tipo de acción" ni "cuánto he resuelto" | No se responde rápido "¿qué hago primero?" ni "¿cuánto avancé?" | Visual |
| 5 | Vocabulario del prompt v1.0.0 todavía visible: filtro Tipo con "Pregunta a la empresa" y "Pedido de datos", lista "Preguntas a la empresa" en Seguimiento, y filtro Causa con **8 botones** (6 causas de v1.1+ y 2 de v1.0.0). Desde v1.2.0 solo hay `prompt_rule` y `calibrate_auditor` | Ruido: opciones que en el análisis vigente salen vacías | Limpieza |
| 6 | El detalle del patrón muestra los casos en tabla de texto; la mirada que manda ("¿la revisión manual le da razón a quién?") es una columna más | Correcto pero sin síntesis visual del patrón | Visual (menor) |
| 7 | Ya existen piezas visuales reutilizables en Calidad de la IA (Cambio 15): barras y matriz hechas con CSS, sin librería de gráficos, y la paleta `--series-1..6` validada en contraste | Se puede hacer más visual sin dependencia nueva | Oportunidad |

**Escala de producción:** 29 motivos, 1.385 casos; los motivos 25 y 18 solos suman ~200 desacuerdos (dato agregado de `prod-2026-11-04/summary.md`). La distribución es muy desigual: un gráfico de barras ordenado lo muestra mejor que una tabla.

## 3. Problema y objetivo

- **P-19.1** Para saber qué hacer primero hay que leer la tabla y todas las tarjetas. No hay una lectura de 10 segundos.
- **P-19.2** La decisión central del análisis (quién tiene más razón, y por lo tanto si se arregla en el prompt o calibrando al auditor) no está en pantalla (hallazgo 1).
- **P-19.3** No se ve el avance: cuántos de los desacuerdos ya tienen una propuesta aceptada, incluida en una versión o calibrada.
- **P-19.4** Al aceptar no se ve el costo/beneficio: cuántos casos corrige y cuántos podría romper (hallazgo 2).

**Objetivo:** que el admin, al abrir la pestaña, entienda en una mirada (a) dónde están los desacuerdos, (b) cuánto es del prompt y cuánto del auditor, y (c) qué patrón atacar primero, sin perder el detalle actual, que queda debajo.

**Requisitos tentativos** (se cierran con P1–P5):
- **R-19.1** Un resumen visual arriba de la tabla con 3–4 cifras clave y un gráfico de "quién tiene más razón" sobre los casos analizados.
- **R-19.2** La tabla por motivo pasa a ser un gráfico de barras divergentes (Solo la IA detectó ← | → Omitidos por la IA), con los números en texto y la tabla completa disponible ("Ver como tabla").
- **R-19.3** La tarjeta de patrón muestra "Tiene más razón: auditor / IA / ambiguo" como dato principal, una barra de casos (corregiría / podría cambiar) y la concentración, si la hay.
- **R-19.4** Una vista de prioridad de patrones (casos × confianza) que se pueda usar como filtro.
- **R-19.5** Limpieza de vocabulario v1.0.0: ocultar tipos y causas que no aparecen en el análisis mostrado.

## 4. Ideas exploradas (divergencia)

| Idea | Qué responde | Veredicto |
|---|---|---|
| **A · Barras divergentes por motivo** (izquierda: Solo la IA detectó; derecha: Omitidos por la IA; marca gris de coincidencias; orden por desacuerdos) | ¿Dónde y en qué dirección? | **Recomendada.** Reemplaza la pared de números; mismos datos del paso 1, sin IA |
| **B · Barra 100 % "¿Quién tiene más razón?"** sobre los casos analizados: El auditor (→ regla del prompt) · La IA (→ calibrar) · Ambiguo · Sin patrón (observaciones + sin explicar). También por motivo, dentro de la barra de A | ¿Es del prompt o del auditor? | **Recomendada.** Es la respuesta que hoy falta (P-19.2). Requiere exponer `who_is_right` |
| **C · Cifras clave** (casos en desacuerdo · % explicado por patrones · casos que corregirían las reglas pendientes · avance de Seguimiento) | ¿Cuánto hay y cuánto avancé? | **Recomendada**, máximo 4 cifras |
| **D · Mapa de prioridad** en cuatro cuadrantes (muchos/pocos casos × confianza alta/baja), con los patrones como fichas; clic filtra la lista | ¿Qué patrón primero? | Recomendada como opción (P3). Un gráfico de dispersión real se descarta: se lee mal con 50+ puntos y es difícil de hacer accesible |
| **E · Embudo de avance** (casos → en patrón → con propuesta → aceptada → incluida/calibrada) | ¿Cuánto resolví? | Variante de C; se puede hacer como una barra apilada en Seguimiento |
| F · Diagrama Sankey casos → causa → acción → estado | Todo junto | **Descartada:** vistoso pero lento de leer y poco accesible |
| G · Mapa de calor motivo × causa | ¿Qué causa domina por motivo? | Descartada por ahora: con 6 causas y 29 motivos queda casi vacío; B ya da la lectura clave |
| H · Mini gráfico de casos en la tarjeta (corregiría / podría cambiar / resto) | ¿Conviene aceptar? | **Recomendada** si se exponen `expected_fix` y `side_effects` (P-19.4) |

**Boceto de la parte de arriba (texto, datos sintéticos):**

```
Análisis de discrepancias      [ Análisis ] [ Seguimiento (4) ] [ Historial ]
Corrida vigente Gemini 3.8 Flash · v2.10 · Último análisis 05-11 18:40 · Sonnet 5.5 · 20,50 USD

 1.385 casos en desacuerdo │ 78 % explicado por patrones │ 410 casos se corregirían con reglas pendientes │ 3 de 12 propuestas resueltas

¿Quién tiene más razón?  (casos analizados)
 [■■■■■■■■■■■■ El auditor 52 % → regla del prompt][▒▒▒▒▒▒ La IA 26 % → calibrar][░░░ Ambiguo 8 %][   Sin patrón 14 %]

¿Dónde están los desacuerdos?                                   [ Ver como tabla ]
                         Solo la IA detectó ◄──┼──► Omitidos por la IA
 25 · No tipifica todas las gestiones   97 ████████████│                     0
 18 · Tipifica motivo de renuncia inc.  36     ████│████████            69
  1 · Deja en espera por tiempo exc.    51      █████│▌                   4
  …
```

## 5. Preguntas y decisiones para Johannes

**P1 · ¿Qué tiene que responder la vista en los primeros 10 segundos?** (define qué va arriba)
- **A (recomendada):** "¿Cuánto es del prompt y cuánto del auditor, y en qué motivos?" → cifras clave (C) + barra "¿Quién tiene más razón?" (B) + barras divergentes por motivo (A).
- B: "¿Qué patrón ataco primero?" → mapa de prioridad (D) arriba y lo demás debajo.
- C: "¿Cuánto avancé?" → embudo de avance (E) arriba.

**P2 · ¿Exponemos en la API lo que el prompt ya devuelve y hoy no se ve?** (`who_is_right`, `concentration`, `side_effects`, `expected_fix`, `tentative`, `unexplained_cases`). Es un cambio chico en `pattern_out` y en `admin-types.ts`, sin IA ni costo; los análisis hechos con v1.0.0 mostrarían "Sin dato".
- **A (recomendada):** sí, todos; sin ellos B y H no se pueden dibujar.
- B: solo `who_is_right`.
- C: no; el cambio queda solo en lo visual del paso 1 (barras divergentes y cifras).

**P3 · ¿Incluimos el mapa de prioridad de patrones (D)?**
- **A (recomendada):** sí, plegado por defecto, encima de la lista de patrones; clic en un cuadrante filtra la lista.
- B: no; basta con ordenar la lista por impacto como hoy y mostrar la barra de casos en cada tarjeta.

**P4 · ¿La tabla por motivo se reemplaza por el gráfico o conviven?**
- **A (recomendada):** el gráfico de barras divergentes por defecto, con "Ver como tabla" que muestra la tabla actual completa (la preferencia queda en la URL).
- B: gráfico y tabla, uno debajo del otro.
- C: la tabla queda y se le agrega una mini barra en cada fila.

**P5 · ¿Limpiamos lo que quedó del prompt v1.0.0?** (filtros "Pregunta a la empresa" / "Pedido de datos", lista "Preguntas a la empresa" en Seguimiento, causas viejas en el filtro)
- **A (recomendada):** se ocultan cuando el análisis mostrado no las tiene (en análisis antiguos del Historial siguen visibles). El filtro Causa muestra solo las causas presentes.
- B: se eliminan del todo, incluidos los análisis antiguos.
- C: se dejan como están.

**¿Tienes una referencia visual en mente?** (opcional, sin bloquear) Si hay un dashboard o pantalla que te guste, o algo del `dashboard.html` local que extrañes acá, me sirve para el §7.

## 6. Supuestos (en `hipotesis.md` desde el 2026-11-06; H-132 a H-138 sin objeción al aprobar P1–P5)

| ID | Supuesto |
|---|---|
| H-132 | La vista la usan todos los `qubico_admin` (D-87) en escritorio ≥ 1280 px (H-106); no se presenta a la empresa tal cual, así que no hace falta modo presentación ni exportar imágenes |
| H-133 | Los gráficos se hacen con HTML/CSS (o SVG simple), como Calidad de la IA, sin librería de gráficos nueva |
| H-134 | Colores: "El auditor tiene más razón" y "La IA tiene más razón" usan dos `--series-*` validados, nunca verde/rojo (no hay "bueno/malo": ambos piden una acción); el texto y el patrón de relleno los distinguen sin color |
| H-135 | Las cifras de "quién tiene más razón" cuentan casos (no patrones): un patrón de 88 casos pesa más que uno de 3 |
| H-136 | "Sin patrón" junta observaciones y `unexplained_cases`; se muestra para no inflar la sensación de que todo está explicado |
| H-137 | El resumen visual solo considera el análisis mostrado; si está desactualizado (H-111), el aviso se repite junto a las cifras |
| H-138 | Ningún gráfico reemplaza el detalle: cada barra o ficha lleva a la lista o tabla filtrada (motivo, quién tiene razón o cuadrante) |
| H-139 | El corte "muchos casos" del mapa de prioridad es 10 casos, fijo; si la mayoría de los patrones cae en un solo lado, se ajusta (o se usa la mediana del análisis) |
| H-140 | Un caso que aparece en dos patrones cuenta para el de mejor prioridad, para que las barras sumen el total |
| H-141 | "Explicado por patrones" usa como base los casos enviados al análisis (fp + fn + IA dudosa) de los motivos analizados; "Casos en desacuerdo" es solo fp + fn de todos los motivos, como la tabla del paso 1 |
| H-142 | Pregunta y pedido de datos a la empresa se juntan como "Depende de la empresa" en la barra; en filtros y Seguimiento siguen separados como hoy |

## 7. Diseño de la vista (aprobado e implementado 2026-11-06)

> Datos de los ejemplos: **sintéticos**. Los nombres de los motivos son reales; conteos, patrones y textos son inventados. Base: el análisis existente, hecho con el **prompt de análisis v1.0.0** (D-85). Cada bloque indica qué cambia cuando haya un análisis v1.1 o posterior.

### 7.1 Qué se puede mostrar con cada análisis

| Dato | De dónde sale | v1.0.0 (hoy) | v1.1+ |
|---|---|---|---|
| fp / fn / IA dudosa por motivo | Paso 1, sin IA | Sí | Sí |
| fp / fn / dudosa por patrón | Cruce de los casos del patrón con el paso 1, sin IA | Sí | Sí |
| Casos explicados / sin patrón por motivo | Casos del motivo analizado que no están en ningún patrón ni observación | Sí | Sí (más `unexplained_cases`, que caen en "Sin patrón") |
| Dónde se arregla (tipo de propuesta) | `proposal.type` del patrón | Sí, con 4 tipos (incluye "Depende de la empresa") | Sí, con 2 tipos |
| Confianza | `confidence` | Sí | Sí |
| Revisión manual a favor de quién | `manualSidesWith` de los casos | Sí | Sí |
| Avance de Seguimiento | Decisiones (`proposal_decisions`) | Sí | Sí |
| Quién tiene más razón | `who_is_right` | **Sin dato** | Sí, "según el análisis" (D-86) |
| Corregiría (casos) | `expected_fix` | **Sin dato** | Sí |
| Podría cambiar | `side_effects` (texto) | **Sin dato** | Sí |
| Concentración | `concentration` (texto) | **Sin dato** | Sí |
| Tentativo | `tentative` | **Sin dato** | Sí |

**Regla:** nunca se deduce "quién tiene más razón" a partir de la causa de v1.0.0 (por ejemplo, Evaluador ≠ "la IA tiene razón"). Lo que falta se dice una vez por bloque, sin ceros falsos ni barras vacías.

### 7.2 Estructura de la pestaña Análisis

Cambia el orden de §7.2 del Cambio 16; los bloques marcados **nuevo** son el Cambio 19.

| # | Bloque | Notas |
|---|---|---|
| 1 | Encabezado (sin cambios): corrida vigente, último análisis, aviso de desactualizado, Analizar | Se suma "prompt de análisis v1.0.0" visible, porque define qué datos hay |
| 2 | **Nuevo · Resumen**: 4 cifras clave | `section` con `h2` "Resumen" |
| 3 | **Nuevo · ¿Dónde se arregla?**: barra 100 % por tipo de propuesta, en casos | Debajo, en v1.1+: barra "¿Quién tiene más razón? · según el análisis"; en v1.0.0, la línea "sin dato" |
| 4 | **Cambia · ¿Dónde están los desacuerdos?**: barras divergentes por motivo, con "Ver como tabla" (D-83) | La tabla actual queda igual en la vista tabla |
| 5 | Por evaluador de la planilla (plegable, sin cambios) | |
| 6 | **Nuevo · Prioridad de los patrones** (plegable, cerrado por defecto, D-82) | Encima de la lista; filtra la lista |
| 7 | Patrones (filtros + tarjetas) | Tarjeta con mini barra de casos y, en v1.1+, más razón, corregiría, podría cambiar y concentración |
| 8 | Observaciones · Cómo leer este análisis (sin cambios; la ayuda suma cómo leer los gráficos) | |

Estado en la URL (se suma a §7.1 del Cambio 16): `view=chart|table` (por defecto `chart`), `quad=start|check|quick|later`, `action=prompt_rule|calibrate_auditor|company|none|observation|unpatterned`, `right=auditor|ia|ambiguo`.

### 7.3 Wireframe · pestaña Análisis con el análisis v1.0.0

```
Análisis de discrepancias
[ Análisis ] [ Seguimiento (3) ] [ Historial ]
──────────────────────────────────────────────────────────────────────────────────────────────
Comparamos la corrida vigente Gemini 3.8 Flash · v2.10 con la planilla de calidad y la revisión manual Qubico.
Último análisis: 04-11-2026 21:10 · Sonnet 5.5 · prompt de análisis v1.0.0 · 28 motivos · 3,25 USD
                                                                          [ Analizar de nuevo ]
Resumen
┌───────────────────┬────────────────────────┬────────────────────────┬────────────────────────┐
│ 1.120             │ 71 %                   │ 52 propuestas          │ 3 de 9                 │
│ casos en          │ explicado por patrones │ por decidir            │ aceptadas ya resueltas │
│ desacuerdo        │ 912 de 1.285 casos     │ 840 casos              │ 6 esperan versión,     │
│ en 28 motivos     │ analizados             │                        │ pregunta o calibración │
└───────────────────┴────────────────────────┴────────────────────────┴────────────────────────┘

¿Dónde se arregla?  casos de los 28 motivos analizados, según la propuesta de cada patrón
[████ Regla del prompt 18 %][▓▓▓▓▓ Calibrar al auditor 22 %][▒▒▒▒▒▒▒ Depende de la empresa 26 %][░ Sin propuesta 2 %][· Observación 3 %][  Sin patrón 29 %]
 Regla del prompt 231 · Calibrar al auditor 283 · Depende de la empresa 334 · Sin propuesta 26 · Observación 38 · Sin patrón 373
¿Quién tiene más razón?  Sin dato en este análisis: el prompt de análisis v1.0.0 no lo decide.
                         Aparece al correr un análisis nuevo.

¿Dónde están los desacuerdos?                 [ Gráfico | Tabla ]     ■ en un patrón  ▨ sin patrón
                                     Solo la IA detectó ◄────┼────► Omitidos por la IA
 25 · No tipifica todas las gestiones      97 ■■■■■■■■■■■■■■│                        0   22 dudosas · 1 patrón
 18 · Tipifica motivo de renuncia inc.     36       ■■■■▨▨│■■■■■■■■■▨▨▨             69   6 dudosas · 3 patrones
  1 · Deja en espera por tiempo excesivo   51      ■■■■■■■│■                         4   0 dudosas · 1 patrón
  6 · No maneja información del producto   14          ▨■■│■■■▨                     24   4 dudosas · 2 patrones
  …
 19 · Tipifica renuncia y es retención      0             │▨                         2   sin analizar
 ▸ Mostrar 4 motivos sin desacuerdos
 Clic en un motivo: muestra sus patrones abajo.

▸ Por evaluador de la planilla

▸ Prioridad de los patrones  (52 pendientes)                       ← plegable, cerrado
  ┌─────────────────────────────┬─────────────────────────────┐
  │ Empezar aquí                │ Revisar casos primero       │   10 o más casos
  │ confianza alta · 10+ casos  │ confianza media o baja      │
  │ [M25 · 88] [M1 · 47] …   7  │ [M18 · 21] [M6 · 12] …   9  │
  ├─────────────────────────────┼─────────────────────────────┤
  │ Rápidos                     │ Dejar para después          │   menos de 10 casos
  │ confianza alta · < 10 casos │ confianza media o baja      │
  │ [M13 · 6] …             14  │ [M32 · 4] …             22  │
  └─────────────────────────────┴─────────────────────────────┘
        confianza alta              confianza media o baja
  Clic en un cuadrante: filtra la lista. Clic en una ficha: va a ese patrón.

Patrones · ordenados por impacto
ⓘ Este análisis usó el prompt de análisis v1.0.0: no trae quién tiene más razón, casos que
  corregiría, posibles efectos ni concentración. Aparecen al correr un análisis nuevo.
Causa: (Todas) (Criterio del prompt) (Evaluador de la planilla) (Transcripción) (Dato faltante)
Tipo:  (Todos) (Regla del prompt) (Calibrar con el auditor) (Pregunta a la empresa) (Pedido de datos a la empresa)
Estado: [Pendientes ▾]   Motivo 18 ✕   [Quitar filtros]

┌ 2 · Motivo 18 · Cuando el cliente da dos razones, la IA acepta cualquiera
│ Omitidos por la IA · Criterio del prompt · Confianza media · 21 casos · Pendiente
│ Casos: [■■■■■■■■■■■■■■■■■■■■■] 0 solo la IA · 21 omitidos · 0 dudosas
│ La planilla exige la razón principal; la IA acepta la tipificación si calza con cualquiera.
│ Evidencia: llamada 231063 · «es que me quedé sin pega y aparte no lo uso»
│ Propuesta · Regla del prompt: "Si el cliente da más de un motivo, la tipificación debe…"
│ 3 casos con desacuerdo entre revisores: van a calibración.
│ [ Aceptar ]  [ Descartar ]  [ Ver casos (21) ]
└──────────────────────────────────────────────────────────────────────────────────────────────
```

**Cómo se calculan las cifras** (todas sin IA, en el backend):
- **Casos en desacuerdo:** fp + fn de la corrida vigente (paso 1), en todos los motivos. Sub-línea: "en {m} motivos" y, si hay, "{k} motivos sin analizar".
- **Explicado por patrones:** casos distintos (llamada × motivo) que están en un patrón (no observación), sobre los casos enviados al análisis en los motivos analizados (fp + fn + IA dudosa). Sub-línea: "{a} de {b} casos analizados".
- **Por decidir:** propuestas en estado Pendiente (sin observaciones) y sus casos.
- **Aceptadas ya resueltas:** Incluida en vX + Preguntada + Calibrada, sobre todas las aceptadas (sin descartadas). Sub-línea con las que esperan. Clic → Seguimiento.
- **¿Dónde se arregla?:** cada caso analizado cuenta una vez; si está en dos patrones, cuenta para el de mejor prioridad (rango menor). Segmentos: Regla del prompt · Calibrar con el auditor · **Depende de la empresa** (pregunta o pedido de datos; solo aparece si el análisis los tiene, D-84) · Sin propuesta (patrón sin propuesta) · Observación · Sin patrón. Clic en un segmento filtra la lista de patrones por ese tipo (Observación abre el plegable; Sin patrón muestra la línea de §7.6).

### 7.4 Diferencias con un análisis v1.1 o posterior

```
¿Dónde se arregla?  casos de los 29 motivos analizados, según la propuesta de cada patrón
[████ Regla del prompt 41 %][▓▓▓▓ Calibrar con el auditor 30 %][░ Sin propuesta 9 %][· Observación 4 %][  Sin patrón 16 %]

¿Quién tiene más razón?  según el análisis, no es una medición
[████ El auditor 43 %][▓▓▓▓ La IA 33 %][▒ Ambiguo 8 %][  Sin patrón 16 %]
```

Tarjeta de patrón, líneas que se suman (entre la mini barra y la explicación):

```
│ Más razón: el auditor · según el análisis          [Tentativo]   ← solo si tentative
│ Si se acepta: corregiría 17 de 21 casos [■■■■■■■■■■■■■■■■■□□□□]
│ Podría cambiar: 2 casos donde ambos marcan No cumple (231870, 230991).
│ Concentración: 12 de 21 casos son del auditor A-03.
```

Sin "podría cambiar" o sin concentración en el JSON (vacío): esa línea no aparece. En el detalle del patrón, la tabla de casos suma la columna **Corregiría** (Sí / —) y el filtro "Lo corregiría". "Depende de la empresa" y las causas v1.0.0 desaparecen de filtros y barra (D-84).

### 7.5 Detalle del patrón y Seguimiento

**Detalle del patrón** (`/admin/discrepancies/patterns/[id]`), encima de la tabla de casos:

```
Casos (21)       [■■■■■■■■■■■■■■■■■■■■■] 0 solo la IA · 21 omitidos · 0 dudosas
Revisión manual  [■■■□□□□…] 2 dan razón a la IA · 1 a la planilla · 18 sin revisión
Antes de aceptar  Sin dato en este análisis (prompt de análisis v1.0.0): quién tiene más razón,
                  casos que corregiría, posibles efectos y concentración.
```

En v1.1+, "Antes de aceptar" muestra más razón, corregiría (con barra), podría cambiar y concentración.

**Seguimiento**, arriba de las listas:

```
Avance de las propuestas aceptadas (9)
[■■■ Resueltas 3][□□□□□□ Esperan 6]   · 2 descartadas
 Para la próxima versión 2 · Preguntas a la empresa 3 · Para calibrar 4
```

La lista "Preguntas a la empresa" se muestra solo si tiene elementos (con el análisis v1.0.0 sí los tiene). El resto de Seguimiento no cambia.

### 7.6 Estados

| Estado | Qué se ve |
|---|---|
| Sin análisis con IA | Resumen solo con "Casos en desacuerdo" (las otras 3 cifras no se muestran). En lugar de las barras de acción: "Todavía no hay análisis con IA. Analizar busca patrones y propone dónde se arregla cada uno; no cambia el prompt." Barras por motivo completas, todas "sin analizar" (sin ■/▨). Sin mapa de prioridad |
| Análisis v1.0.0 (hoy) | §7.3: barra de acción con 4 tipos; "¿Quién tiene más razón?" con la línea "Sin dato en este análisis…"; un solo aviso ⓘ sobre la lista de patrones; las tarjetas no muestran líneas vacías |
| Análisis v1.1+ | §7.4 |
| Análisis parcial (detenido o fallido) | Las cifras cuentan solo los motivos terminados y lo dicen: "en {k} de {n} motivos analizados". Los pendientes salen "sin analizar" en las barras por motivo |
| En curso | Se ve el resumen del último análisis terminado, con la línea de avance del encabezado; al terminar cada motivo se refresca (cada 5 s, como hoy) |
| Desactualizado (H-111) | Aviso ámbar en el encabezado (como hoy) y, junto al título "Resumen", la etiqueta "Desactualizado" con ícono. Si cambió la corrida vigente, "{k} casos del análisis ya no están en desacuerdo" bajo "Explicado por patrones" |
| Análisis anterior (solo lectura) | Igual que hoy (banner "Estás viendo el análisis del…"); el resumen y los gráficos son de ese análisis; Seguimiento siempre muestra el estado actual |
| Motivo analizado sin patrones | Barras solo ▨; texto "0 patrones" |
| Solo observaciones | "¿Dónde se arregla?" con segmentos Observación y Sin patrón; mapa oculto ("No hay patrones para priorizar") |
| Cuadrante vacío | El cuadrante dice "Ninguno" y no es clicable |
| Filtro por cuadrante, acción o "más razón" sin resultados | "Ningún patrón con estos filtros." + Quitar filtros (como hoy) |
| Sin patrón seleccionado en la barra | Línea: "{k} casos analizados sin patrón: la IA no encontró algo en común. Revísalos desde Calidad de la IA." con enlace al motivo |
| Pantalla < 1280 px | Las barras por motivo pasan a una columna (etiqueta arriba, barra abajo); el mapa se apila 1×4 |

### 7.7 Textos y glosario

**Títulos:** Resumen · ¿Dónde se arregla? · ¿Quién tiene más razón? · ¿Dónde están los desacuerdos? · Prioridad de los patrones · Avance de las propuestas aceptadas.

**Cifras:** "casos en desacuerdo" · "explicado por patrones" · "propuestas por decidir" · "aceptadas ya resueltas".

**Cuadrantes:** Empezar aquí · Revisar casos primero · Rápidos · Dejar para después. Ejes: "10 o más casos / menos de 10 casos" y "confianza alta / confianza media o baja".

**Sin dato:** "Sin dato en este análisis: el prompt de análisis v{X} no lo decide. Aparece al correr un análisis nuevo." (aviso único sobre los patrones: el de §7.3).

| Término | Definición en la UI | Nota |
|---|---|---|
| **Dónde se arregla** | Qué tipo de cambio propone el análisis para los casos de un patrón | Viene de `proposal.type` |
| **Depende de la empresa** | Propuestas de pregunta o pedido de datos a la empresa | Solo análisis v1.0.0 (D-84) |
| **Sin patrón** | Caso analizado que no quedó en ningún patrón ni observación | Incluye `unexplained_cases` en v1.1+ |
| **Explicado por patrones** | Caso analizado que quedó en un patrón con 3 o más casos | Las observaciones no cuentan |
| **Más razón (según el análisis)** | Qué lado tiene más razón para la IA de análisis: el auditor, la IA o ambiguo | No es una medición (D-86); nunca "correcto" / "incorrecto" |
| **Corregiría** | Casos del patrón que dejarían de estar en desacuerdo si se aplica la propuesta, según el análisis | `expected_fix` |
| **Podría cambiar** | Casos donde hoy coinciden y la propuesta podría cambiar la marca, según el análisis | `side_effects` |
| **Concentración** | Ejecutivos o auditor donde se juntan los casos del patrón | `concentration`; solo para el admin (D-87) |
| **Tentativo** | Patrón que el análisis marca como hipótesis | `tentative` |

En "Cómo leer este análisis" se suma: "Las barras cuentan casos (llamada × motivo), no patrones. «Según el análisis» quiere decir que lo decidió la IA de análisis y nadie lo ha verificado."

### 7.8 Accesibilidad (WCAG 2.2 AA)

- **Cada gráfico es un `figure` con `figcaption`** y su equivalente en texto: la barra de acción y la de más razón llevan debajo la lista de segmentos con el número; las barras por motivo tienen "Ver como tabla"; el mapa de prioridad lista las fichas como texto.
- **No solo color (1.4.1):** ■ en un patrón y ▨ sin patrón son relleno sólido y rayado; dirección por posición (izquierda/derecha) y rótulo; segmentos separados por 2 px de fondo y con etiqueta de texto cuando caben (si no, en la lista de abajo). Contraste de cada segmento con el fondo ≥ 3:1 (1.4.11).
- **Colores:** dirección con `--series-1` (Solo la IA detectó) y `--series-2` (Omitidos), los mismos de C15 en otro contexto, sin significado de bueno/malo; acción con `--series-3` (Regla del prompt), `--series-4` (Calibrar), gris neutro (Depende de la empresa), rayado (Sin propuesta), punteado (Observación), sin relleno (Sin patrón). Más razón: `--series-5` (El auditor), `--series-6` (La IA), gris (Ambiguo). Nunca verde/rojo (H-134).
- **Interacción:** cada fila de motivo, segmento y cuadrante es un `button` con `aria-pressed` cuando filtra, y nombre accesible completo (p. ej. "Motivo 18: 36 solo la IA detectó, 69 omitidos por la IA, 80 en un patrón, 25 sin patrón. Ver sus patrones"). Las barras dibujadas van `aria-hidden`. Al filtrar, el foco pasa al título "Patrones" (como "Ver patrones" hoy) y `aria-live` anuncia "{n} patrones".
- **Mapa:** `role="group"` por cuadrante con su nombre; las fichas son enlaces al `article` del patrón; tamaño ≥ 24 × 24 px (2.5.8).
- **Teclado:** orden de tabulación de arriba abajo; Gráfico/Tabla es un `seg` con `aria-pressed`.
- **Movimiento:** sin animaciones de crecimiento de barras; si se usan, respetan `prefers-reduced-motion`.

### 7.9 Impacto en `admin-types.ts`, `pattern_out` y el overview (no es código)

Sin migración: lo de v1.1+ ya está en `discrepancy_patterns.data`.

- **`pattern_out`** (`src/call_audit/discrepancy_runs.py`): suma `whoIsRight` (`"auditor" | "ia" | "ambiguo" | null`), `concentration` (`string | null`, vacío → null), `sideEffects` (`string | null`), `expectedFix` (`string[] | null`), `tentative` (`boolean | null`) y `kindCounts` (`{ fp, fn, uncertain }`, cruce de los casos con el paso 1). Una clave ausente en `data` va como `null` = "sin dato"; nunca `false` ni `[]` inventados.
- **`DiscrepancyAnalysisRun`**: `capabilities: { whoIsRight: boolean; expectedFix: boolean; sideEffects: boolean; concentration: boolean; unexplained: boolean }`, según si las claves aparecen en los patrones de ese análisis (más robusto que comparar la versión del prompt).
- **`DiscrepancyCriterionRow`**: `explained: { fp: number; fn: number; uncertain: number } | null` (casos del motivo en un patrón; `null` si el motivo no se analizó) y `analyzedCases: number | null`.
- **`DiscrepancyOverview`**: `summary: { disagreements; criteriaWithDisagreements; criteriaNotAnalyzed; analyzedCases; explainedCases; byAction: { prompt_rule; calibrate_auditor; company; none; observation; unpatterned }; byWhoIsRight: { auditor; ia; ambiguo; unpatterned } | null; pendingProposals; pendingCases; staleCases }` y `followUp: { accepted; resolved; discarded }`. `company` = `client_question` + `data_request`.
- **`DiscrepancyCase`** (detalle): `expectedFix: boolean | null`.
- **Regla de conteo:** caso = llamada × motivo, distinto; si está en varios patrones, cuenta para el de menor rango. Va en el backend para que las cifras del resumen, la barra y el mapa sumen lo mismo.
- **Filtros (D-84):** el front arma las opciones de Causa y Tipo desde los patrones del análisis mostrado, no desde `CAUSE`/`PROPOSAL` completos.
- **Tokens:** sin tokens nuevos; se reusan `--series-1..6` y los neutros de `08-tokens.css`.
