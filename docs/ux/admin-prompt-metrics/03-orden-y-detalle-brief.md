# Calidad de la IA en el admin: orden, KPIs, lenguaje común y revisión caso a caso · Brief (Fase 0)

> **Ampliado el 2026-11-12:** el alcance pasa de la pestaña Prueba a tres pantallas (Prueba, Análisis de discrepancias y
> Estadísticas). §1-§4 son el diagnóstico de Prueba; §5-§7 agregan las otras dos y el glosario; §8 incorpora la
> reunión con el jefe del 12 nov; §9 consolida las decisiones.

- **Fecha:** 2026-11-12 · **Pide:** jefe de Johannes (feedback sobre la captura de v2.15) · **Usuario:** admin de Qubico y el jefe.
- **Pantalla:** Admin → Versiones del prompt → v{X} → pestaña **Prueba** (`/admin/prompts/[version]`).
- **Base aprobada que se reutiliza:** `00-cambio-metricas-prompt.md` (tabla de métricas y metas), `01-mosaico-brief.md` y
  `02-mosaico-propuesta.md` (mosaico, colores E3, copy, contrato `agreement`), glosario en `../call-audit/06-ux-writing.md` §8.
- **Tipo:** rediseño de la pestaña (jerarquía y flujo nuevo de revisión). No es un cambio menor: corresponde Fase 0.
- **Legal y anonimización:** fuera de esta ronda por instrucción de Johannes (no hay `registro-legal.md` nuevo).

## Feedback textual

> "Está todo muy desordenado, no se ven los kpi claros, hay mucha data, mucho grafico y es dificil acceder a la información de
> forma fácil. Lo otro, es importante poder ir a revisar caso a caso la información de este grafico para poder entender en que
> nos hemos estado equivocando."

## 1. Diagnóstico de la pantalla actual

### 1.1 Dónde está

| Pieza | Archivo |
|---|---|
| Página y pestaña Prueba (`TestTab`, `GoalSummary`, `METRIC_ROWS`, `CriterionErrors`) | `frontend/src/app/(app)/admin/prompts/[version]/prompt-version.tsx` |
| Mosaico, zoom por motivo, evolución, aviso del análisis, leyenda | `frontend/src/components/admin/agreement-charts.tsx` |
| Clasificación de cada llamada en rojo/amarillo/azul/gris/verde | `src/call_audit/agreement.py` (`compute`, `blue_cases`) |
| Resultado por llamada de cada prueba | `PromptEvaluation.results` (`src/call_audit/prompt_evaluation.py`, `score`) |

### 1.2 Qué se ve hoy, de arriba abajo (pestaña Prueba)

| # | Bloque | Contenido |
|---|---|---|
| 0 | Sobre las pestañas | Encabezado, estado, modelo, "Por qué", aviso "Prueba terminada · 220 llamadas · Costo real" |
| 1 | Titular | "Resultado contra la planilla…" + texto de ayuda + frase `GoalSummary` (FP sobre aprobadas, FN sobre rechazadas) |
| 2 | Aviso del análisis de causa | Solo si no está listo |
| 3 | **Gráfico A** · Mosaico por llamada | Mosaico + 4 totales de grupo + leyenda de 5 partes con línea de apoyo + "Ver como tabla" + pie de costo |
| 4 | **Gráfico B** · Detalle por motivo | n = 220 × 33; línea de verde; barra del desacuerdo al 100 %; 3 rótulos; nota del azul |
| 5 | **Gráfico C** · Evolución del loop | Una fila por vuelta con barra + 6 columnas numéricas; selector Por llamada / Por motivo |
| 6 | Tabla de métricas | 8 filas (coincide, FP, FN, sin decisión, auditores de la app, citas, costo, p95) × meta + vigente + esta, con badges y deltas |
| 7 | Errores por motivo | Hasta 33 filas × 6 columnas (marcados, FP y FN por versión) |

En total: 3 gráficos, 2 tablas grandes, 3 leyendas/ayudas largas y del orden de 150 números visibles, todo expandido.

### 1.3 Problemas (trazables)

| ID | Problema | Evidencia |
|---|---|---|
| P-04 | **KPIs que no calzan entre sí.** El titular dice falsas alarmas 36 % y rechazos 47 % (sobre aprobadas / rechazadas); el mosaico de justo abajo dice 8,6 % y 5,9 % (sobre el total, y sin el azul). Parecen lo mismo y no se pueden reconciliar sin leer las ayudas. Ya era el riesgo 5 de `01-mosaico-brief.md`. | Captura v2.15 |
| P-05 | **Las metas no están arriba.** "≤ 5 %" y "≤ 20 %" solo aparecen en la tabla del bloque 6; el titular dice "no cumple" sin mostrar contra qué. | `TestTab` |
| P-06 | **Todo expandido a la vez.** No hay revelación progresiva: B, C, la tabla y los errores por motivo compiten con el mosaico. La leyenda repite lo que ya dicen los rótulos de grupo. | `TestTab`, `AgreementMosaic` |
| P-07 | **No se llega a los casos.** Los segmentos no son clicables y no existe una lista de las llamadas de cada segmento. No se puede responder "¿en qué nos equivocamos?". | `agreement-charts.tsx` |
| P-08 | **El detalle de llamada muestra otra versión.** `/calls/[id]` muestra los hallazgos de la corrida vigente (v2.10), no los de la versión en prueba (v2.15). Abrir un caso desde el mosaico de v2.15 mostraría evidencia equivocada. | `call-detail.tsx`, `QualityBanner` |

### 1.4 Vistas de detalle que ya existen

| Vista | Ruta | Qué sirve | Qué le falta para este pedido |
|---|---|---|---|
| Detalle de llamada | `/calls/[id]` | Audio, transcripción, checklist por motivo con evidencia, veredicto y comentario de la planilla | Muestra la corrida vigente, no la versión probada. Con `?serie=` solo agrega una línea con veredicto y números de motivo |
| Calidad de la IA | `/admin/stats?tab=quality` | Ya trae cada prueba como serie "Prueba vX", con mapa llamada por llamada y lista de discrepancias que enlaza a `/calls/[id]?serie=test:{id}` | Está en otra sección, no filtra por segmento del mosaico ni separa el azul, y el caso no muestra la evidencia de la prueba |
| Detalle de patrón | `/admin/discrepancies/patterns/[id]` | Casos de un patrón con causa y explicación de la IA de análisis, enlace a la llamada | Es del análisis de producción; los patrones del análisis de atribución de cada prueba (el azul) no tienen vista |

### 1.5 Datos disponibles sin correr IA pagada

- Por llamada de la prueba: veredicto de la IA, motivos incumplidos y dudosos, veredicto y motivos de la planilla
  (`externalFails`), error si lo hubo y, en las pruebas recientes, `findings` con comentario y citas por motivo.
- El segmento de cada llamada y de cada llamada × motivo se calcula igual que hoy (`agreement.compute`), sin IA.
- El azul: patrones del análisis de atribución con `cause` y `explanation`, por (motivo, llamada).
- Comentario del revisor: `Case.external_comment`, por llamada (no por motivo).
- Falta: un endpoint que devuelva la lista de casos de una prueba con su segmento, y el detalle del caso con la evidencia
  de esa versión. Es trabajo de backend sin costo de IA.

## 2. Objetivo y KPIs de éxito del rediseño

- **O-04:** que el jefe entienda en 5 s si la versión cumple las metas y cuánto le falta (P-04, P-05).
- **O-05:** de entrada, solo lo necesario para decidir; el resto, a un clic (P-06).
- **O-06:** desde cada segmento del mosaico, llegar en ≤ 2 clics a la lista de llamadas y en ≤ 3 al caso con IA vs. revisor,
  motivo y evidencia de **esa versión** (P-07, P-08).
- Medida de éxito (cualitativa, sin test formal): el jefe responde sin ayuda "¿cumple?", "¿qué tan lejos?" y "dame un
  ejemplo de rechazo no detectado y por qué".

## 3. Alcance

- **Sí:** jerarquía de la pestaña Prueba, KPIs, qué se oculta o mueve, lista de casos por segmento, detalle del caso,
  enlace al audio y la transcripción, contrato de datos que pide la UI.
- **No:** cambiar cómo se calculan las métricas o el mosaico (D1-D5, E1-E5 siguen), re-correr pruebas o análisis, la
  presentación/export. (Ampliado: Discrepancias y Estadísticas entran al alcance, ver §5.)

## 4. Supuestos ([SUPUESTO], a validar)

- **H-07:** el jefe navega la pantalla él mismo, no solo se la muestran.
- **H-08:** "caso" para el jefe es una llamada con sus motivos en desacuerdo, no una fila llamada × motivo.
- **H-09:** las pruebas de v2.12 en adelante guardan `findings` por llamada; si alguna no los tiene, el caso muestra solo
  veredictos y motivos, con aviso. No se verificó en producción (la BD local está desactualizada).
- **H-10:** con KPIs arriba y pestañas internas, B y la tabla de 8 métricas dejan de ser necesarios de entrada.
- **H-11:** el admin quiere leer los casos, no anotarlos todavía.

## 5. Ampliación: Análisis de discrepancias y Estadísticas

### 5.1 Feedback textual de Johannes

> "Lo otro, en analisis de discrepancia confunde un poco el lenguaje de lo que sale en los graficos. Casos en desacuerdo vs
> motivos, intentemos unificar el lenguaje. Aparte aqui en ningun lado se ve ese grafico que veiamos denantes sobre el acuerdo
> con el revisor, entones confunde. Luego la pestaña estadisticas, la parte operación no dice mucho, la parte calidad de la IA
> es mucha información y confunde, aparte que no muestra el mismo grafico y la corrida que muestra es de la v2.10 de gemini,
> deberia mostrar solo la ultima y si yo quiero puedo agregar otras corridas. Pero deberia partir siempre de la ultima."

### 5.2 Análisis de discrepancias (`/admin/discrepancies`)

- **Archivos:** `frontend/src/app/(app)/admin/discrepancies/page.tsx`; pestaña Resumen en
  `components/admin/discrepancy-summary.tsx`; tarjetas y barras en `components/admin/discrepancy-charts.tsx`
  (`SummaryTiles`, `ActionBar`, `WhoIsRightBar`, `CriteriaChart`, `PriorityMap`).
- **Pestañas:** Resumen, Patrones, Evaluadores, Seguimiento, Historial (D-92).
- **Resumen, de arriba abajo:** estado del análisis y botón para analizar → 4 tarjetas → barra "¿Dónde se arregla?" →
  barra "¿Quién tiene más razón?" → línea "N llamadas · N casos en desacuerdo · N con revisión manual" → "¿Dónde están los
  desacuerdos?" (barras divergentes por motivo, Gráfico/Tabla, "Ver los N motivos") → "Cómo leer este análisis" (plegado).
- **Qué mide:** la **corrida vigente de producción** contra la planilla, sobre **todas** las llamadas con planilla por motivo
  (no las 220 de validación). Es otra versión y otro conjunto de llamadas que la pestaña Prueba.

| ID | Problema | Evidencia (captura) |
|---|---|---|
| P-09 | **"Caso" se cuenta en tres bases.** 179 = desacuerdos de hoy; 204 = desacuerdos cuando se corrió el análisis (foto anterior); 143 = desacuerdos de las propuestas por decidir. Ninguna tarjeta dice cuál es cuál. | Tarjetas 1-3 |
| P-10 | **Motivos 22 vs. 23.** 22 = motivos con desacuerdo hoy; 23 = motivos analizados en la foto. | Tarjeta 1 y barra |
| P-11 | **"Caso" significa otra cosa que en el resto de la app.** Aquí es llamada × motivo; en la cola, en el detalle (`Case`) y en el mosaico la unidad es la llamada. "179 casos" se lee como 179 llamadas. | "Cómo leer este análisis" |
| P-12 | **No está el mosaico.** No hay ancla visual común con Prueba; las cifras no se relacionan con "Acuerdo con el revisor". | Resumen |
| P-13 | **Mezcla avance del trabajo (propuestas, seguimiento) con calidad de la IA** en la misma fila de tarjetas. | Tarjetas 3-4 |

### 5.3 Estadísticas (`/admin/stats`)

- **Archivos:** `frontend/src/app/(app)/admin/stats/page.tsx`; Calidad de la IA en `components/admin/ai-quality.tsx`;
  corridas por defecto en `lib/quality.ts` (`defaultSeries`); datos en `GET /api/admin/quality` (`routes_admin.py`).
- **Pestañas:** Operación, Calidad de la IA, Costo; filtros de periodo, modelo y prompt; "Exportar CSV".

**Operación:** 5 tarjetas (llamadas procesadas y minutos; mediana hasta el resultado, meta < 24 h, a menudo "—"; lotes con
error; en cola de revisión; casos revisados por día), un gráfico de procesadas por día y una tabla de lotes con error.

| ID | Problema | Evidencia |
|---|---|---|
| P-14 | **Operación no responde una pregunta de decisión.** Lotes con error y avance del worker ya están en **Procesamiento** (`/admin/processing`); la mediana suele estar vacía; "revisados por día" es del equipo de auditores, no de la IA. | `stats/page.tsx`, `processing/page.tsx` |

**Calidad de la IA, de arriba abajo:** corridas seleccionadas + "Agregar corrida" (hasta 6) → titular → "¿Qué corrida calza
mejor con la planilla?" (ranking con 4 métricas: Calce equilibrado, Detección, Falsas alarmas, Coincidencia) → "¿Acierta el
veredicto de la llamada?" (una matriz por corrida) → "¿En qué motivos se equivoca cada corrida?" (motivos × corridas) →
"Mapa llamada por llamada" → "Llamadas en desacuerdo" (lista con enlace al detalle).

| ID | Problema | Evidencia |
|---|---|---|
| P-15 | **Parte de la vigente, no de la última.** `defaultSeries` elige "Vigente" (producción, hoy v2.10 con Gemini) más la última corrida de cada otro modelo; las pruebas de versión (v2.12-v2.15) nunca entran por defecto. | `lib/quality.ts` |
| P-16 | **Otro vocabulario y otras métricas.** "Calce equilibrado", "Detección", "Coincidencia" y una matriz 2×2 en vez del mosaico; aquí "Dudosa cuenta como No cumple", en Prueba es una parte aparte (gris). Las cifras no calzan con Prueba. | `ai-quality.tsx` (`METRICS`, `Matrix`) |
| P-17 | **Conjuntos de llamadas distintos en la misma comparación.** Producción cubre todas las llamadas con planilla; las pruebas, solo las 220 de validación. Hoy solo lo avisa una nota de cobertura. | `routes_admin.py` (series `test:`), `CoverageNote` |
| P-18 | **Demasiado de entrada:** 5 secciones abiertas, una matriz por corrida y una tabla motivos × corridas. | `AiQualityView` |

### 5.4 Lo que se reutiliza

- Calidad de la IA ya tiene "Agregar corrida", el mapa llamada por llamada y la lista "Llamadas en desacuerdo" con enlace al
  detalle: base natural del drill-down.
- Discrepancias ya tiene pestañas, estado en la URL y patrones que enlazan a la llamada.
- El cálculo del mosaico (`agreement.compute`) sirve para cualquier corrida o prueba con resultados por llamada y planilla por
  motivo, sin IA. El azul solo existe donde hay análisis de causa.

## 6. Glosario único propuesto (se aprueba en Q6)

| Término | Qué es | Cómo se cuenta |
|---|---|---|
| **Llamada** | Una grabación con su planilla. Unidad del mosaico, de la cola y del detalle. | "220 llamadas" |
| **Motivo** | Uno de los 33 criterios de la pauta. | "en 22 motivos" |
| **Desacuerdo** | Un motivo de una llamada en que la IA y el revisor no marcan lo mismo (hoy "caso" en Discrepancias). Una llamada puede tener varios. | "179 desacuerdos en N llamadas" |
| **Llamada en desacuerdo** | Llamada cuyo veredicto final (Cumple / No cumple) es distinto al del revisor: rojo, amarillo o azul en el mosaico. | "32 llamadas en desacuerdo" |
| **Caso** | Sale de las métricas; en la app sigue siendo la llamada en la cola del auditor. | — |
| **Corrida** | Resultado de un prompt + modelo sobre un conjunto de llamadas. "Prueba de vX" = corrida sobre validación. | — |

Regla: **toda cifra dice su base**. Por A3 el universo es uno solo: las 220 llamadas de validación; el desglose llamada →
motivo se explica una vez (220 llamadas × 33 motivos = 7.260 marcas). Una cifra de una foto anterior se rotula como tal.

## 7. Objetivos y supuestos nuevos

- **O-07:** el mismo mosaico "Acuerdo con el revisor" como ancla en Prueba, Discrepancias y Calidad de la IA (P-12, P-16).
- **O-08:** un solo glosario y la base de cada cifra visible (P-09, P-10, P-11).
- **O-09:** Calidad de la IA parte de la última corrida o prueba; las demás se agregan (P-15).
- **O-10:** Estadísticas solo con lo que sirve para decidir (P-14, P-18).
- **[SUPUESTO] H-12:** el mosaico de la vigente no tiene azul hasta que exista su análisis de causa. Las causas del análisis de
  Discrepancias podrían alimentarlo sin costo, pero son de una foto anterior (a confirmar en la propuesta).
- **[SUPUESTO] H-13:** para Johannes, "la última" es la prueba más reciente de una versión (hoy v2.15), no la corrida de producción.
- **[SUPUESTO] H-14:** nadie usa Operación para decidir; Procesamiento cubre la operación del worker.

## 8. Reunión con el jefe (2026-11-12): acuerdos y efecto en el brief

| # | Acuerdo | Efecto en el diseño |
|---|---|---|
| A1 | Clic en una cifra (ej. el 27 %) abre las llamadas y compara IA vs. revisor, para verificar a mano. **Prioridad n.º 1**: validar el 27 % de "Posible error de planilla" y demostrarlo al gerente con casos. El jefe preguntó qué tan seguros estamos de ese 27 %. | El drill-down deja de ser solo lectura: hay que **registrar el veredicto humano por desacuerdo y sumarlo** ("de 59 revisadas, 41 confirmadas"). Hoy el 27 % es juicio de una IA no calibrada (H-05). |
| A2 | Una estructura de análisis única, de lo general a lo específico, igual para cualquier muestra; "radiografía completa y consistente" de una misma muestra hasta la causa raíz. | El mismo esqueleto en todas las pantallas (O-07, O-08). Se evalúa una sola pantalla de análisis (Q7). |
| A3 | El análisis de discrepancias corre sobre las 220 de validación, no sobre las 1.000. | **Resuelve la antigua Q3**: el universo de todas las cifras son las 220. Discrepancias deja de medir la vigente sobre todas las llamadas (P-09, P-10, P-17). |
| A4 | Revisión manual caso por caso en vez de un loop que aplica todas las reglas solo. Riesgo: saturar el prompt y tapar falta de datos con parches (ej. gestión no tipificada: SAP trae una fila por grabación). | La verificación necesita una salida "falta información" distinta de "error de la IA". La evolución "del loop" pasa a "entre versiones". |
| A5 | Narrativa: coincidencias → errores del humano → ajustes de calibración y prompt. | Orden de los niveles y de los KPIs: verde → azul (verificado) → rojo/amarillo. |
| A6 | Escuchar el audio desde la vista de patrones gustó: se mantiene. | La vista del caso lleva audio y transcripción. |
| A7 | El jefe tendrá cuenta propia. | **Confirma H-07.** Falta definir su permiso (Q13). |

### 8.1 Supuestos actualizados

- **H-07 · confirmado** (A7).
- **H-11 · descartado** (A1): el admin sí necesita registrar la verificación.
- **H-08 · se ajusta:** la lista es por llamada (lo que cuenta el mosaico), pero la verificación se registra por
  desacuerdo (llamada × motivo); una llamada azul queda "confirmada" si todos sus desacuerdos se confirman como error de planilla.
- **H-15 [SUPUESTO]:** la verificación no depende de la versión: si la planilla se equivocó en el motivo X de la llamada Y, eso
  vale para v2.10 y v2.15. Se registra una vez y se reutiliza en todas las versiones.
- **H-16 [SUPUESTO]:** revisar los 59 azules de v2.15 es factible (≈ 3-5 min cada uno con audio).
- **H-17 [SUPUESTO]:** ver la explicación de la IA de análisis antes de decidir sesga la verificación; para el gerente conviene
  registrar primero y ver la explicación después.
- Ya existe `DiscrepancyClassification` (clasificación del supervisor, `ai_correct` / `ai_wrong`, por llamada, Cambio 09). No
  alcanza (es por llamada, otro actor y otro flujo); la propuesta definirá si se extiende o se crea una tabla nueva.

### 8.2 Requisitos nuevos

| ID | Requisito | Origen |
|---|---|---|
| R-14 | Toda cifra de las pantallas de calidad se puede clicar y abre la lista de llamadas que la componen. | A1 |
| R-15 | Por cada desacuerdo, una persona registra quién tenía razón (con "falta información" como salida propia) y una nota opcional. | A1, A4 |
| R-16 | La verificación se suma y se muestra junto a la cifra de la IA ("27 % posible · 41 de 59 revisadas confirmadas"), con su avance. | A1 |
| R-17 | La vista del caso muestra, para la versión elegida: IA vs. revisor por motivo, criterio, cita, comentario de la planilla, audio y transcripción. | A1, A6, P-08 |
| R-18 | Universo único: las 220 de validación; el n y la base de cada cifra visibles. | A2, A3 |

## 9. Decisiones (consolidadas) · **aprobadas el 2026-11-12**

> **Aprobado** por Johannes ("Sí, todas"): Q1 B · Q2 C · Q3 C · Q4 A · Q5 A · Q6 A · Q7 A · Q8 A · Q9 A · Q10 A · Q11 A · Q12 A ·
> Q13 B. Quedan registradas como G1-G13 en `estado.md`. Fase 1 de la primera entrega en `04-verificacion-propuesta.md`.

Reemplaza la tabla anterior. **Bloque 1** hace falta para empezar la propuesta de la verificación del 27 %; **Bloque 2** tiene
recomendación por defecto y se puede aprobar en bloque. La antigua Q3 (base del mosaico) quedó resuelta por A3.

### Bloque 1 · Verificar el 27 % (prioridad n.º 1)

| ID | Pregunta | Opciones | Recomendada |
|---|---|---|---|
| Q1 | Orden de entrega | A todo junto · B (1) verificación del 27 %: clic en la cifra → lista → caso → registro → suma, sobre la prueba de v2.15; (2) estructura única: glosario, Discrepancias sobre 220, Calidad de la IA, Operación · C proceso completo 1-8 | B |
| Q2 | Qué se registra por desacuerdo | A "Error de la IA / Error de la planilla / Ambiguo" · B solo "IA / Planilla" · C A + "Falta información" (la llamada no alcanza para decidir; ej. tipificación sin dato en SAP), siempre con nota opcional | C |
| Q3 | Qué hace la verificación con las cifras | A se muestra aparte y las métricas oficiales no cambian · B los errores de planilla confirmados corrigen la referencia y se recalcula todo · C A ahora, y B como vista "con planilla corregida" cuando el gerente lo valide | C |
| Q4 | Cuántas revisar y cómo | A las 59 azules, en orden aleatorio, con avance y margen de error a la vista · B muestra aleatoria de 20-25 con margen · C las que elija la persona. En todas: la explicación de la IA de análisis se ve después de registrar (H-17) | A, con la explicación después |
| Q5 | Dónde se revisa el caso | A vista de revisión dedicada (pantalla completa): audio, transcripción, IA de esa versión vs. planilla por motivo, cita, comentario de la planilla, registro y "Siguiente" con atajos · B panel lateral sobre la lista · C extender `/calls/[id]` | A, reutilizando el reproductor y la transcripción del detalle de llamada |

### Bloque 2 · Estructura única (recomendación por defecto)

| ID | Pregunta | Opciones | Recomendada |
|---|---|---|---|
| Q6 | Glosario: "caso" | A sale de las métricas: llamada y desacuerdo (§6) · B "caso" = llamada × motivo · C "caso" = llamada y llamada × motivo = "desacuerdo" | A |
| Q7 | Estructura de lo general a lo específico (A2) | A una sola pantalla de análisis con selector de versión y niveles fijos: Resumen (KPIs + mosaico) → Por motivo → Llamadas → Caso; Prueba muestra solo los KPIs y enlaza; Discrepancias queda para trabajar patrones y seguimiento · B mismo esqueleto repetido en las 3 pantallas · C mantener las 3 pantallas y solo unificar lenguaje | A |
| Q8 | Discrepancias sobre las 220 (A3) | A usar el análisis de causa que ya se corre por versión sobre las 220 (sin costo extra); sus propuestas entran a la bandeja y se deciden una a una (cambia R-11) · B correr un análisis de reglas nuevo sobre las 220 (pagado, pedir OK con costo) · C A, sin que sus propuestas entren a la bandeja | A |
| Q9 | Desde qué corrida parte Calidad de la IA | A la última prueba terminada (hoy v2.15); la vigente y otras se agregan con un clic · B la vigente de producción · C última y vigente fijas | A |
| Q10 | Evolución entre versiones (A4) | A "Evolución del loop" pasa a "Evolución entre versiones" (cualquier versión probada en las 220) · B se mantiene por loop · C se quita | A |
| Q11 | KPIs de cabecera (orden A5) | A Coincide → Posible error de planilla (con lo confirmado) → falsas alarmas y rechazos no detectados contra las metas, con conteo y cambio vs. la vigente · B solo las metas del proyecto · C todo en % del total | A |
| Q12 | Estadísticas › Operación | A se elimina; llamadas procesadas y cola de revisión pasan a Procesamiento · B 3 tarjetas con meta · C se deja | A |
| Q13 | Permiso de la cuenta del jefe (A7) | A Admin Qubico completo · B solo lectura: ve todo, no registra verificación ni activa versiones (rol nuevo) · C como B, pero puede registrar verificación | B |
