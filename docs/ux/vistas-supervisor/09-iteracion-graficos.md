# Iteración 1 · Calidad del servicio graficada: auditores y ejecutivos

Fecha: 2026-11-18 · Estado: **Fase 0 aprobada (D-32 a D-36). Fases 1, 5 y 6 en `09b-graficos-especificacion.md`**

## 0. Historia del pedido

- **Ronda IT-1** (2026-11-18). Johannes, textual: "quiero que la data se vea más graficada. Como si fuera una presentación a un board o a un gerente". Se plantearon IT-Q1 a IT-Q5 (vista Resumen, audiencia, mensaje en 5 segundos, exportación, tendencia).
- **Ronda IT-2** (2026-11-18). Johannes no eligió entre IT-Q1 e IT-Q5 y redefinió el foco, textual: "necesito ver en gráficos por cada, o quizás como el top de los auditores, o quizás cada auditor, como la cantidad de discrepancias que tienen, así como discrepancias entre la IA y sus resultados para cada ítem. Eso es como lo más importante. Y también necesito como un análisis de cada auditor, como de su performance, cosas así, pero eso necesito que esté graficado. Y eso para ejecutivos y auditores."

**Lectura del diseñador (validar con Johannes en IT-Q9):**
1. Lo principal: **por auditor, cuántas discrepancias tiene con la IA y en qué motivo** ("persona × ítem"), con una vista del conjunto ("top" o todos) y una ficha por auditor.
2. Una vista de **desempeño por persona, graficada**, para auditores y para ejecutivos.
3. Las pantallas son las cuatro que ya existen: **pestaña Auditores, ficha del auditor, pestaña Ejecutivos y ficha del ejecutivo**. Gráficos dentro de ellas; la vista "Resumen" tipo presentación queda postergada.

"Discrepancia" en esta iteración = **una llamada y un motivo en que el auditor y la IA marcan distinto** (la misma cuenta que "No coinciden", D-26). No es lo mismo que la sección admin "Análisis de discrepancias" (`/discrepancies`). El nombre visible se decide en la Fase 6 de la iteración (propuesta: "No coincide con la IA", para no cruzarlo con esa sección).

## 1. Qué se reabre y qué se mantiene

| Fase | Estado en la iteración | Qué se hace |
|---|---|---|
| 0 · Brief | **Reabierta (delta)** | Nuevo foco (§0), audiencia según IT-Q7, definición de desempeño (§3) |
| 1 · Investigación | **Reabierta, comprimida** | CUJ-5 "Ver en qué motivos cada auditor se aparta de la IA" (persona: analista de Qubico; Verónica solo si IT-Q7 = B). La proto-persona Gerente de la ronda IT-1 queda en pausa |
| 2 · Ideación + 3 · AI | **Se mantienen** | No hay vista nueva: mismas pestañas y fichas. Se reabren solo si IT-Q7 cambia quién ve Auditores (sitemap por rol) |
| 4 · User flows | **Reabierta, corta** | Celda del cruce persona × motivo → lista de llamadas filtrada (`/analysis/calls?evaluator=&criterion=` y `?agent=&criterion=`, que ya existen, D-17) |
| 5 · Patrones | **Reabierta (lo principal)** | Catálogo de gráficos de las 4 pantallas (§4), reglas de orden y "top" según IT-Q6, accesibilidad de gráficos |
| 6 · UX writing | **Reabierta (parcial)** | Nombre visible de "discrepancia", títulos de gráficos, leyendas y textos alternativos, aviso "esto no es una nota" |
| 7 · Prototipado / 8 · Alta fidelidad | Se rehacen para las 4 pantallas | Sobre `08-prototipo-alta-fidelidad.html`, datos de la demo (`analysis-mock.ts`: 4 auditores, 10 ejecutivos) |

**Se mantienen:** D-02 (IA y auditor nunca en una sola cifra), D-06 (severidad y desacuerdo por separado; kappa solo en el detalle técnico), D-10 (motivo 25 fuera del orden por defecto), D-18, D-21 (U = 15 pts, ±2 pts), D-22 (desvío del ejecutivo según la IA), D-23 (10 motivos y "Ver los 33"), D-26, D-27 (Ejecutivos solo con ≥ 5 ejecutivos con ≥ 10 llamadas), D-31, tokens y glosario. Las tablas quedan debajo de cada gráfico como detalle y alternativa accesible.

**En tensión, a decidir por Johannes (no se resuelven aquí):** D-07 (sin ranking de ejecutivos) frente a "el top"; D-01 y D-13 (Auditores solo para Qubico) frente a una vista de desempeño de auditores para la corredora. Ver IT-Q6 e IT-Q7.

## 2. Dolencias, oportunidades y requisitos

- **P-09** Todo es tabla: cuesta ver de un vistazo dónde se aparta cada persona. (Ronda IT-1.)
- **P-10** No hay forma de ver **a la vez** a todos los auditores en todos los motivos: hoy hay que entrar a la ficha de cada uno. Así no se distingue "este auditor marca distinto" (fila) de "este motivo está mal definido" (columna, D-06). (Ronda IT-2.)
- **O-12** Lectura en capas: cifras clave → gráfico → tabla → llamadas.
- **O-13** Un cruce **persona × motivo** para auditores y para ejecutivos, con la cifra en cada celda y enlace a las llamadas.
- **R-10** Cada una de las 4 pantallas abre con cifras clave y al menos un gráfico; la tabla queda debajo.
- **R-11** El orden de personas en los gráficos sigue IT-Q6; en ningún caso se muestran números de posición, medallas ni colores de "peor".
- **R-12** Cada gráfico tiene la cifra en texto (rótulo directo o tooltip), alternativa en tabla y no depende solo del color (WCAG 2.2 AA, 1.4.1 y 1.4.11).
- **R-13** Gráficos dibujados a mano (SVG o `div`), como `discrepancy-charts.tsx` y `agreement-charts.tsx`, sin sumar librería.
- **R-14** Desempeño se muestra como **consistencia frente a la IA y frente al equipo**, nunca como acierto o error: la IA no es la verdad (01-investigación §1.3: la IA es el punto de comparación común). Cada pantalla lleva una línea que lo dice.

## 3. Qué significa "desempeño" por rol

### 3.1 Auditor (frente a la IA, como evaluador común)

| Métrica | Qué responde | Existe hoy | Dónde está |
|---|---|---|---|
| Llamadas evaluadas | ¿Cuánto revisó? (base de todo lo demás) | Sí | `EvaluatorRow.evaluated` |
| Motivos que no coinciden con la IA, por llamada | ¿Cuánto se aparta de la IA en general? | Sí | `disagreementPerCall` |
| Severidad, por llamada (+ más estricto, − más permisivo) | ¿Hacia qué lado se aparta? | Sí | `severityPerCall` |
| Frente al equipo | ¿Se aparta más o menos que los demás auditores? | Sí | `vsTeam` |
| % que no coincide, por motivo | ¿En qué motivo se aparta? (el cruce persona × ítem) | Sí, por auditor | `EvaluatorDetail.criteria[].disagreementPct` |
| Severidad por motivo | ¿En ese motivo es más estricto o más permisivo? | Sí, por auditor | `criteria[].severityPts` |
| Kappa por motivo | Detalle técnico del acuerdo (solo interno, D-06) | Sí | `criteria[].kappa` |
| Cantidad de discrepancias por motivo (número, no %) | "La cantidad de discrepancias que tienen" | **Nuevo** (sale del cálculo actual) | Agregar `mismatchCalls` y `evaluated` por motivo en `EvaluatorDetail.criteria` |
| Promedio del equipo por motivo | Comparar al auditor contra los demás en cada motivo | **Nuevo** | Agregar `teamDisagreementPct` por motivo |
| Matriz de todos los auditores × 33 motivos | El cruce en una sola vista | **Nuevo endpoint** | `getAnalysisEvaluatorMatrix(filters)`; hoy obligaría a pedir la ficha de cada auditor |
| Evolución en el tiempo | ¿Mejora o empeora? | **Nuevo**, depende de IT-Q10 | Por mes dentro de los 90 días de la foto |
| Discrepancias resueltas a favor de quién (auditor o IA) | ¿Quién tenía razón? | **Nuevo y fuera de alcance** | Solo existe en `/discrepancies` para lo que se clasificó; no se propone mezclarlo ahora |
| Tiempo de revisión | ¿Qué tan rápido audita? | **No disponible** en la foto | No se propone |

### 3.2 Ejecutivo (según la IA y según el auditor, D-02)

| Métrica | Qué responde | Existe hoy | Dónde está |
|---|---|---|---|
| Llamadas (con corrida) y evaluadas por un auditor | Base | Sí | `AgentRow.calls`, `evaluated` |
| % No cumple según la IA y según el auditor | ¿Cuánto incumple, según cada fuente? | Sí | `aiPct`, `sheetPct` |
| Desvío frente al equipo (según la IA, D-22) | ¿Incumple más o menos que el resto? | Sí | `deviationPts` |
| Desvío por motivo | ¿En qué motivo se aparta del equipo? | Sí, por ejecutivo | `AgentDetail.criteria[].deviationPts` |
| % No cumple por motivo, IA y auditor | ¿En ese motivo, coinciden las dos fuentes? | Sí, por ejecutivo | `criteria[].aiPct`, `sheetPct` |
| Matriz de todos los ejecutivos × motivos | El cruce en una sola vista | **Nuevo endpoint** | `getAnalysisAgentMatrix(filters)` |
| Evolución en el tiempo | ¿Mejora o empeora? | **Nuevo**, depende de IT-Q10 | Igual que en auditor |

## 4. Catálogo de gráficos de las 4 pantallas (sin código)

Colores: IA `--series-1` (azul, sólido), auditor `--series-2` (óxido, borde y rayado), como en 08 §1. Magnitud = una sola tonalidad de claro a oscuro. Más o menos que el equipo = par divergente con gris al centro y franja "Igual que el equipo" (±2 pts, D-21). Celdas con menos de 10 llamadas: sin color, con "—" y el ícono de pocas llamadas. Las cifras siempre en texto o tooltip; todas las celdas y barras enlazan a la lista de llamadas.

### 4.1 Pestaña Auditores (solo Qubico mientras IT-Q7 no cambie D-01)

| # | Gráfico | Métrica | Por qué esta forma |
|---|---|---|---|
| A-1 | **Cifras clave**: auditores con ≥ 10 llamadas · llamadas evaluadas · motivos que no coinciden con la IA por llamada (promedio del equipo) · motivos "Se marca distinto" (D-06) | Base y promedio | Lo que se dice antes de mirar el gráfico |
| A-2 | **Mapa de calor auditor × motivo** (el gráfico principal). Filas: auditores. Columnas: 33 motivos agrupados en sus 5 bloques. Celda: lo que decida IT-Q8 (recomendado: % de sus llamadas en que no coincide con la IA en ese motivo, un tono). Encabezado de columna marcado si el motivo está "Se marca distinto" en la mayoría (D-06). Celda con tooltip: "{n} de {m} llamadas · más estricto / más permisivo · kappa {k}" | % no coincide por motivo | Es el cruce persona × ítem pedido. La **fila** muestra al auditor que se aparta; la **columna** muestra el motivo mal definido (D-06): las dos lecturas en una vista. Con 4–6 auditores cabe sin desplazar; las 33 columnas desplazan horizontalmente dentro del gráfico con la columna de nombres fija |
| A-3 | **Barras horizontales** de discrepancias por llamada por auditor, con una línea vertical del promedio del equipo y la cantidad de llamadas en texto | `disagreementPerCall`, `evaluated` | "La cantidad de discrepancias que tienen", leída de un vistazo. El orden lo decide IT-Q6 |
| A-4 | **Dispersión severidad × desacuerdo**: x = más permisivo ↔ más estricto, y = desacuerdo con la IA; un punto por auditor con su nombre al lado; línea del umbral U | `severityPerCall`, `disagreementPerCall` | Separa "marca distinto" de "marca más o menos" (D-06). Reutiliza el patrón de `PriorityMap` |

### 4.2 Ficha del auditor

| # | Gráfico | Métrica | Por qué |
|---|---|---|---|
| FA-1 | **Cifras clave**: llamadas evaluadas · discrepancias por llamada · más estricto/permisivo · frente al equipo | Fila de `EvaluatorRow` | Resumen de la persona |
| FA-2 | **Puntos auditor vs equipo por motivo**: por motivo, un punto con el % del auditor y una marca con el promedio del equipo; los 10 motivos con más diferencia, "Ver los 33" (como D-23) | `disagreementPct` + **nuevo** `teamDisagreementPct` | Responde "¿en qué motivo se aparta más que los demás?" sin dos barras por fila |
| FA-3 | **Barras divergentes de severidad por motivo** desde 0: hacia un lado más estricto, hacia el otro más permisivo | `severityPts` | Dirección del desacuerdo; forma estándar para valores con signo |
| FA-4 | **Cantidad de discrepancias por motivo** como barra fina de un tono junto a FA-2, con "{n} de {m} llamadas" | **Nuevo** `mismatchCalls` por motivo | Lo que Johannes llamó "la cantidad"; el % solo engaña con pocas llamadas |
| — | Kappa | Solo en la tabla de detalle | D-06 |

### 4.3 Pestaña Ejecutivos

| # | Gráfico | Métrica | Por qué |
|---|---|---|---|
| E-1 | **Cifras clave**: ejecutivos con ≥ 10 llamadas · % No cumple del equipo según la IA y según el auditor (dos cifras, D-02) · ejecutivos dentro del rango del equipo | Agregados de `AgentsPage` | |
| E-2 | **Mapa de calor ejecutivo × motivo**: celda = desvío frente al equipo según la IA (D-22), par divergente con gris en ±2 pts; columnas = los 10 motivos con más desvío del equipo, "Ver los 33"; el motivo 25 al final con su aviso (D-10). Tooltip: "% IA {a} · % auditor {b} · {n} llamadas" | **Nuevo** endpoint de matriz | El mismo cruce persona × ítem que A-2, para ejecutivos. Muestra dónde se concentra cada uno sin reducirlo a una cifra |
| E-3 | **Puntos sobre eje divergente**: desvío global de cada ejecutivo, 0 al centro, franja ±2 pts | `deviationPts` | Dispersión del equipo. El orden de filas lo decide IT-Q6 |
| E-4 | **Pesas IA vs auditor por ejecutivo**: % No cumple según cada fuente, unidos por una línea | `aiPct`, `sheetPct` | Muestra si las dos fuentes cuentan lo mismo de cada persona (D-02) |

### 4.4 Ficha del ejecutivo

| # | Gráfico | Métrica | Por qué |
|---|---|---|---|
| FE-1 | **Cifras clave**: llamadas · % No cumple según la IA · según el auditor · frente al equipo | `AgentRow` | |
| FE-2 | **Barras divergentes de desvío por motivo** (10 con más desvío, "Ver los 33", D-23) | `criteria[].deviationPts` | Dónde está por encima o por debajo del equipo |
| FE-3 | **Pesas IA vs auditor por motivo** para ese ejecutivo | `criteria[].aiPct`, `sheetPct` | Separa "incumple" de "las fuentes no coinciden" antes de dar feedback |

**Lo que no se hará:** donut o torta, velocímetros, doble eje, números de posición, medallas, colores de "peor", ni una cifra que mezcle IA y auditor.

**Cambios al contrato que salen de aquí** (para el handoff de la Fase 8): `getAnalysisEvaluatorMatrix`, `getAnalysisAgentMatrix`, `mismatchCalls`/`evaluated`/`teamDisagreementPct` por motivo en `EvaluatorDetail`, y agregados por mes si IT-Q10 = A. Todo sale de las llamadas que ya guarda la foto; no requiere re-correr IA.

## 5. Supuestos e hipótesis

- **H-19** (ronda IT-1, en pausa) Un gerente entiende el gráfico de pesas sin explicación.
- **H-20** (ronda IT-1, en pausa) A la gerencia le importa primero el cumplimiento del equipo.
- **H-21** Ver la dispersión de ejecutivos sin posiciones no se percibe como ranking.
- **H-22** El mapa de calor auditor × motivo permite distinguir "auditor que se aparta" de "motivo mal definido" sin explicación.
- **H-23** Con 4–6 auditores y 10 o más llamadas por motivo, la mayoría de las celdas del cruce tiene muestra suficiente. Si no, el mapa queda casi vacío y hay que agrupar por bloque (5 columnas). Validar con la primera foto real.
- **[SUPUESTO]** El evaluador viene en la planilla importada (P-5); sin él, la pestaña Auditores solo muestra a quien revisó en la app.
- **Riesgo:** mostrar el desempeño de auditores a la corredora puede leerse como evaluación de su personal hecha por la IA. Mitigación: R-14 y la decisión IT-Q7.
- **Riesgo:** un "top" de ejecutivos (los con más desvío) es un ranking aunque no lleve números. Ver IT-Q6.

## 6. Preguntas abiertas

Ronda IT-2 en `estado.md` (IT-Q6 a IT-Q10). De la ronda IT-1 sigue abierta solo la exportación (IT-Q4, en pausa); IT-Q5 pasa a IT-Q10; IT-Q1, IT-Q2 e IT-Q3 quedan reemplazadas por el nuevo foco si Johannes lo confirma en IT-Q9.
