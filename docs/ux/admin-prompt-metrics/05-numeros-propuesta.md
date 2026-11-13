# Cómo se muestran los números · Propuesta (Fase 1, segunda entrega)

- **Fecha:** 2026-11-12 · **Pide:** Johannes ("haz el cambio de cómo se muestran los números"), sobre el feedback del jefe.
- **Base aprobada:** `03-orden-y-detalle-brief.md` §5-§9 (G6-G12), `02-mosaico-propuesta.md` (mosaico, colores E3),
  `04-verificacion-propuesta.md` (lista y caso por segmento, ya desplegado), glosario `../call-audit/06-ux-writing.md` §8.
- **Alcance:** solo cómo se muestran y cuadran las cifras en **Análisis de discrepancias › Resumen** y **Estadísticas**
  (Calidad de la IA y Operación). La pestaña Prueba recibe la misma cabecera de KPIs (G11) y nada más de esta entrega.
- **Fuera:** temas legales y anonimización (instrucción de Johannes); correr IA pagada. Todo sale de resultados guardados.
- **Trazabilidad:** P-09..P-18 → O-07..O-10 → R-14, R-18 → este documento. Proceso comprimido: Fase 0 ya aprobada.

## 1. De dónde sale hoy cada cifra (diagnóstico leído en el código)

Corrige §5.2 del brief: el 204 **no** es una foto anterior, y Discrepancias **no** mide sobre todas las llamadas.

| Cifra de la captura | Qué cuenta en realidad | Origen |
|---|---|---|
| **179** "casos en desacuerdo" | Motivo × llamada donde IA y planilla difieren (`fp` + `fn`), **sin** las dudas de la IA | `discrepancy_runs.analysis_summary` → `summary.disagreements` |
| **204** "casos analizados" y la línea "N casos en desacuerdo" | Lo mismo **más** los motivos en que la IA quedó dudosa (`ai_uncertain`). 204 − 179 ≈ dudas de la IA | `summary.analyzedCases`, `overview.cases` (`DISAGREEMENT = fp, fn, ai_uncertain`) |
| **143** "casos" bajo "propuestas por decidir" | Motivo × llamada que caen en patrones aún sin decidir; sale de los casos guardados en el patrón, no de la corrida de hoy | `summary.pendingCases` |
| **22** "en 22 motivos" | Motivos con al menos un `fp` o `fn` | `criteriaWithDisagreements` |
| **23** "motivos analizados" | Motivos con `fp`, `fn` **o duda**: el análisis también corre donde solo hay dudas | `analysis.doneCriteria` (`criteria_with_disagreements`) |
| "N llamadas" de la línea gris | Llamadas del **set de entrenamiento** (≈ 60 %) con corrida vigente (v2.10) | `discrepancy_runs.table` → `golden_split.default_split("train")` |
| "¿Quién tiene más razón?" | Campo `whoIsRight` de cada patrón: **otro** juicio de la IA, distinto de la causa `auditor` que pinta el azul del mosaico | `byWhoIsRight` |

Calidad de la IA, además:

| Cifra | Problema | Origen |
|---|---|---|
| Referencia "N llamadas (x Cumple · y No cumple)" | Cuenta **todas** las llamadas con planilla (≈ 1.000), aunque la prueba elegida solo cubre las 220 | `GET /api/admin/quality` → `calls` |
| Detección, Falsas alarmas, Coincidencia, Calce equilibrado | **Dudosa cuenta como No cumple**; en Prueba la dudosa va aparte. La misma v2.15 da FP y FN distintos en las dos pantallas | `lib/quality.ts` `seriesMetrics` vs. `golden_split.call_rates` |
| "Desacuerdo" | Aquí = difiere el veredicto **o** al menos un motivo; en el glosario 8.3 = un motivo de una llamada | `ai-quality.tsx` (`Term`) |

**Conclusión:** las cifras no cuadran porque se mezclan tres universos (entrenamiento con v2.10, validación con v2.15, todo
lo que tiene planilla), dos unidades con el mismo nombre ("caso") y dos tratamientos de la duda de la IA.

## 2. Reglas de números (aplican a las tres pantallas)

| # | Regla | Ejemplo |
|---|---|---|
| N-R1 | **Un universo:** las llamadas de validación de la versión elegida (por defecto, la última prueba terminada). Se dice una vez, arriba, con lo que queda fuera. | "v2.15 · 218 de las 220 llamadas de validación (2 con error de la IA, fuera del cálculo)" |
| N-R2 | **Dos unidades, siempre escritas:** **llamadas** (veredicto) y **desacuerdos por motivo** (un motivo de una llamada). Ninguna cifra de métricas dice "caso". | "59 llamadas", "179 desacuerdos por motivo" |
| N-R3 | **La duda no es desacuerdo.** "Sin decisión de la IA" va aparte en las dos unidades y no suma a FP ni FN (como `call_rates` y el mosaico). | "3 llamadas sin decisión · 25 motivos sin decisión" |
| N-R4 | **Toda tasa lleva su conteo y su base:** % grande, debajo "N de D <unidad> <base>". | "33 % · 36 de 109 llamadas que el revisor aprobó" |
| N-R5 | **Las partes suman el todo a la vista:** el mosaico suma n; FP = amarillo + azul de ese lado; FN = rojo + azul de ese lado; las barras por motivo suman el total de desacuerdos. Si algo no suma, se dice por qué. | "36 = 19 IA No / Revisor Sí + 17 posible error de planilla" |
| N-R6 | **Una cifra, un significado, en todas las pantallas:** misma fuente (`agreement` y `call_rates` de la prueba), mismo nombre, mismo color (E3). | — |
| N-R7 | **Avance del trabajo ≠ calidad de la IA:** propuestas por decidir y seguimiento salen de la fila de KPIs y quedan como contador de pestaña. | Patrones (8), Seguimiento (3) |
| N-R8 | **Formato:** % entero en KPIs; en el mosaico, `fmtPct` actual (un decimal bajo 10 %). Miles con punto, decimales con coma. Conteos con `tabular`. | "1,4 %", "1.000" |
| N-R9 | **Toda cifra clicable lleva a sus llamadas** (R-14) usando la lista ya desplegada `/admin/prompts/[v]/calls`. | — |

Vocabulario por motivo (para no chocar con "IA Sí / Revisor No", que es de llamada y se lee mal con motivos en negativo, §7
del glosario): **"Solo la IA lo marca"** (amarillo, `fp`) y **"Solo el revisor lo marca"** (rojo, `fn`). Reemplazan a
"Solo la IA detectó" y "Omitidos por la IA". Discrepancias pasa a usar los colores del mosaico (E3) en vez de `series-1/2`.

## 3. Cabecera común "Calidad de v{X}" (un componente, tres lugares)

Va igual en **Prueba**, **Calidad de la IA** y **Discrepancias › Resumen** (O-07). Orden de la historia acordado el 12-nov
(A5): aciertos → errores del revisor → lo que hay que corregir. Cifras de ejemplo, ilustrativas.

```
Calidad de v2.15 · 218 de las 220 llamadas de validación (2 con error, fuera)                 [Cambiar versión ▾]
┌────────────────────┬──────────────────────────┬────────────────────────┬────────────────────────┐
│ Coincide con el    │ Posible error de planilla│ Falsas alarmas         │ Rechazos no detectados │
│ revisor            │                          │                        │                        │
│ 57 %               │ 27 %                     │ 33 %   ✗ meta ≤ 5 %    │ 30 %   ✗ meta ≤ 20 %   │
│ 125 de 218 llamadas│ 59 llamadas              │ 36 de 109 aprobadas    │ 33 de 109 rechazadas   │
│ vs v2.10: +4 pts   │ verificadas: 41 de 59    │ por el revisor         │ por el revisor         │
│                    │ revisadas son error de   │ = 19 a corregir        │ = 20 a corregir        │
│                    │ planilla (69 %)          │ + 17 posible error de  │ + 13 posible error de  │
│                    │                          │ planilla               │ planilla               │
│ Ver llamadas ›     │ Ver llamadas ›           │ Ver llamadas ›         │ Ver llamadas ›         │
└────────────────────┴──────────────────────────┴────────────────────────┴────────────────────────┘
 Sin decisión de la IA: 3 llamadas (1,4 %) pasan a un auditor · Ver llamadas ›
 [Mosaico "Acuerdo con el revisor" debajo, el componente actual sin cambios de cálculo]
```

| KPI | Valor | Conteo y base | Fuente (sin IA) | Clic |
|---|---|---|---|---|
| Coincide con el revisor | `agree / n` | "N de n llamadas" + cambio vs. la vigente si tiene prueba en las 220 | `agreement.byCall.agree`, `n` | `?segment=agree` |
| Posible error de planilla | `reviewer / n` | "N llamadas" + línea de verificación (`VerificationLine`, ya existe) | `byCall.reviewer`, `verification.reviewer` | `?segment=reviewer` |
| Falsas alarmas | `fpCount / nApproved` | "N de D aprobadas por el revisor" + desglose `promptFp` + `reviewerFp` | `call_rates`, `byCall.promptFp/reviewerFp` | `?segment=fp` (nuevo: amarillo + azul de ese lado) |
| Rechazos no detectados | `fnCount / nRejected` | "N de D rechazadas por el revisor" + desglose `promptFn` + `reviewerFn` | `call_rates`, `byCall.promptFn/reviewerFn` | `?segment=fn` (nuevo) |
| Sin decisión (línea, no tarjeta) | `undecided / n` | "N llamadas pasan a un auditor" | `byCall.undecided` | `?segment=undecided` |

- **Meta:** badge con texto e ícono (✓ / ✗ + "meta ≤ 5 %"), no solo color (decisión del 10-nov).
- **Por qué FP y FN no usan "% del total":** son las metas del proyecto y se miden sobre aprobadas / rechazadas. El cuadre con
  el mosaico se da en **conteos** (36 = 19 + 17), que sí suman, en vez de en porcentajes que no pueden sumar.
- **Cambio vs. la vigente:** solo si la vigente tiene prueba sobre las mismas 220; si no, no se muestra (no se compara con
  otro universo).
- **Sin análisis de causa:** la tarjeta azul dice "Causa sin analizar" y FP/FN muestran el desglose sin azul ("36 = 36 a
  corregir o posible error de planilla, sin analizar").

## 4. Análisis de discrepancias › Resumen

Universo = la prueba de la versión elegida sobre las 220 de validación y su análisis de causa (G8). Con eso desaparecen
"desactualizado", `staleCases` y la foto anterior: los resultados de una prueba no cambian.

### 4.1 Qué queda, de arriba abajo

1. **Estado del análisis** (una línea, como hoy): "Análisis de causa de v2.15 · 12-nov · US$3,80 · 23 motivos".
2. **Cabecera común (§3)** con el mosaico. Resuelve "no se ve el gráfico de acuerdo con el revisor" (P-12).
3. **Puente llamada → motivo** (una frase, siempre): "En las 218 llamadas hay **179 desacuerdos por motivo** en **22
   motivos** (un motivo de una llamada en que la IA y el revisor no marcan lo mismo; una llamada puede tener varios). Además,
   la IA quedó sin decisión en **25 motivos**." Y debajo: "Los 179 están en 112 llamadas: 93 en desacuerdo de veredicto y 19 que
   coinciden en el veredicto pero difieren en algún motivo."
4. **"Desacuerdos por motivo" (barra única, mismos colores del mosaico):** los 179 partidos en Solo el revisor lo marca (rojo)
   · Solo la IA lo marca (amarillo) · Posible error de planilla (azul). Es el Gráfico B de Prueba (`DisagreementZoom`) sin el
   verde. Reemplaza a "¿Quién tiene más razón?" (P-09, P-11).
5. **"¿En qué motivos?"** (`CriteriaChart`, ya existe) con los cambios: colores E3; rótulos de §2; la suma de las barras = 179
   y se dice ("Suman 179"); las dudas como columna aparte "sin decisión", no dentro de la barra; clic en un motivo → la lista de
   llamadas filtrada por ese motivo (y desde ahí, a sus patrones).
6. **"Cómo leer este análisis"** plegado, reescrito con N-R2/N-R3 (sin "caso").

### 4.2 Qué sale del Resumen

| Hoy | Destino | Por qué |
|---|---|---|
| Tarjeta "179 casos en desacuerdo · en 22 motivos" | Frase puente (§4.1-3) | Unidad sin nombrar |
| Tarjeta "% explicado por patrones · 204" | Pestaña Patrones, encabezado: "La IA de análisis agrupó 151 de 179 desacuerdos en 27 patrones; 28 quedaron sin patrón" | Es del trabajo de calibración, no de la calidad |
| Tarjeta "N propuestas por decidir · 143 casos" | Contador de la pestaña Patrones (ya existe); sin "casos" | N-R7 |
| Tarjeta "aceptadas ya resueltas" | Contador de Seguimiento (ya existe) | N-R7 |
| Barra "¿Dónde se arregla?" | Encabezado de Patrones, en desacuerdos por motivo | Es el paso 3 de la historia (calibración) |
| Barra "¿Quién tiene más razón?" | Se quita | Segundo juicio de la IA que compite con el azul |
| Línea "N llamadas · N casos · N con revisión manual" | Universo (N-R1) y frase puente; revisión manual Qubico pasa a "Cómo leer" | Duplicada |
| "Calce de llamada: X de N" | KPI "Coincide con el revisor" | Duplicada con otro nombre |

### 4.3 Otras pestañas (solo números y palabras)

- **Patrones y detalle de patrón:** "12 casos" → "12 desacuerdos"; "Ver casos (12)" → "Ver los 12 desacuerdos"; "Menos de 3
  casos" → "Menos de 3 desacuerdos".
- **Evaluadores:** columnas "Solo la IA detectó / Omitidos por la IA · casos" → "Solo la IA lo marca / Solo el revisor lo
  marca · desacuerdos"; la nota "Un caso es un motivo de una llamada…" pasa a "Un desacuerdo es…".

## 5. Estadísticas › Calidad de la IA

Es la **pantalla de análisis** de G7: Resumen → Por motivo → Llamadas → Caso. Ya parte de la última prueba (G9, desplegado).

### 5.1 Qué queda

1. **Selector de versiones** (el actual "Agregar corrida", máx. 6), rotulado "Versiones a comparar". Solo ofrece corridas
   **con resultado en las 220**; la vigente se recalcula sobre esas 220.
2. **Cabecera común (§3)** de la primera versión elegida + mosaico.
3. **"Comparación entre versiones"** (solo con 2 o más elegidas; es la "Evolución entre versiones" de G10): una tabla, una fila
   por versión, columnas = los 4 KPIs + sin decisión + costo por llamada, cada celda "% · N de D", con ✓/✗ de meta. Reemplaza al
   ranking y a las matrices.
4. **"Por motivo"**: tabla motivos × versiones con **desacuerdos por motivo** (Solo el revisor lo marca / Solo la IA lo marca),
   clic → lista de llamadas de esa versión filtrada por motivo. Reemplaza a "¿En qué motivos se equivoca cada corrida?" (sin
   "+n" ni borde grueso: se explica con la columna).
5. **Llamadas:** no hay lista propia; cada cifra lleva a `/admin/prompts/[v]/calls` (ya desplegado).
6. **"Cómo leer"** plegado, con el glosario único (sin Detección, Calce equilibrado ni Coincidencia).

### 5.2 Qué se quita

| Hoy | Por qué | Reemplazo |
|---|---|---|
| Titular "X es la que mejor calza…" | Ordena por "Calce equilibrado", que sale | Cabecera común |
| Ranking con 4 métricas (Calce equilibrado, Detección, Falsas alarmas, Coincidencia) | 2 métricas sin meta, Detección = 100 − FN (dos nombres para lo mismo) | Comparación entre versiones |
| Matriz 2×2 por corrida | Repite el mosaico con otra regla para la duda | Mosaico |
| Mapa llamada por llamada | Mucho dibujo para lo que la lista hace mejor | Clic en cada cifra → lista |
| Lista "Llamadas en desacuerdo" propia | Duplica la lista por segmento con otra definición de desacuerdo | Lista de `/admin/prompts/[v]/calls` |
| Referencia "≈ 1.000 llamadas" | Otro universo | N-R1 |
| "Dudosa cuenta como No cumple" | Contradice Prueba | N-R3 |

Resultado: de 5 secciones abiertas + 1 matriz por corrida a **cabecera + mosaico + 2 tablas** (la comparación solo si hay más
de una versión).

## 6. Estadísticas › Operación (G12 A, ya aprobado)

- **Se elimina la pestaña.** Estadísticas queda con **Calidad de la IA** (por defecto) y **Costo**.
- A **Procesamiento** (`/admin/processing`), arriba, dos tarjetas con el periodo de hoy: "Llamadas procesadas · N (N min) ·
  últimos 30 días" y "En cola de revisión · N · la más antigua, N h".
- Se quitan: "Mediana hasta el resultado" (suele estar vacía), "Lotes con error" (ya está en Procesamiento), el gráfico de
  procesadas por día. "Casos revisados por día" mide al equipo de auditores, no a la IA: ver N7.
- `/admin/stats` sin `tab` abre Calidad de la IA; `?tab=operation` redirige a Procesamiento.

## 7. Datos que pide la UI (backend, sin IA)

| Pieza | Cambio |
|---|---|
| Discrepancias › Resumen | `overview` lee la prueba de la versión elegida (por defecto, la última) y su análisis `attribution`, con `table(session, evaluation)` (validación), en vez de la vigente en entrenamiento. Devuelve el bloque `agreement` y `call_rates` de esa prueba (ya existen). |
| Puente llamada → motivo | Agregar a `agreement`: `callsWithItemDisagreement` y su partición (en desacuerdo de veredicto / coinciden en veredicto); `byCallCriterion` ya trae fp/fn/azul/sin decisión. |
| Lista por segmento | Aceptar `segment=fp` y `segment=fn` (lado de la falsa alarma o del rechazo, incluido el azul de ese lado) y `motivo=` en `/agreement/calls`. |
| Calidad de la IA | `GET /api/admin/quality` filtra `calls` a las 220 de validación; la serie vigente se calcula sobre ellas; las métricas del front pasan a `call_rates` (duda aparte) o se piden al backend. |
| Operación | Endpoint de stats de operación se reutiliza en Procesamiento (2 tarjetas). |

## 8. Accesibilidad (WCAG 2.2 AA, revisión rápida)

- Cada tarjeta KPI es un `<a>` con nombre accesible completo: "Falsas alarmas: 33 %, 36 de 109 llamadas aprobadas por el
  revisor, no cumple la meta de 5 %. Ver llamadas".
- Meta: ícono + texto, nunca solo color (1.4.1). Colores E3 ya validados en contraste.
- Las tablas de comparación usan `<th scope>`; las barras siguen `aria-hidden` con su equivalente en texto (patrón actual).
- Objetivos de clic ≥ 24 × 24 px (2.5.8) en las celdas clicables de las tablas.

## 9. Supuestos y riesgos

- **[SUPUESTO] H-20:** las cifras de ejemplo (125 / 59 / 36 de 109 / 112 llamadas con desacuerdo por motivo) son ilustrativas; las
  reales salen de la prueba de v2.15 en producción. No se consultó la BD de producción.
- **[SUPUESTO] H-21:** la vigente (v2.10) tiene resultado en las 220 de validación; si no, no entra a la comparación y la tarjeta no
  muestra "vs v2.10".
- **Riesgo R-A (metodológico):** con G8 A, las propuestas que salen del análisis de las 220 entran a la bandeja. Una versión hecha
  con esas reglas se mide sobre las **mismas** 220 de donde salieron, y su mejora se verá más grande de lo que es. Hoy la cuarta IA
  aprende solo de entrenamiento (`golden_split`, 60/20/20) justamente para evitarlo. Ver N8.
- **Riesgo R-B:** al dejar de contar la duda como No cumple, las cifras de Calidad de la IA de corridas antiguas cambian respecto
  de lo que el jefe ya vio. Conviene avisarlo una vez ("desde el 12-nov la duda se cuenta aparte, como en Prueba").

## 10. Decisiones para Johannes

| # | Decisión | Opciones | Recomendada |
|---|---|---|---|
| N1 | Unidades y palabras | A "llamadas" y "desacuerdos por motivo"; "caso" sale de todas las pantallas de métricas, incluido Discrepancias (Patrones, Evaluadores); por motivo "Solo la IA lo marca / Solo el revisor lo marca" con colores del mosaico · B igual, pero Discrepancias conserva "caso" | A |
| N2 | Cabecera común de KPIs | A 4 tarjetas (Coincide → Posible error de planilla con verificación → Falsas alarmas → Rechazos no detectados, con meta) + línea de sin decisión, igual en Prueba, Calidad de la IA y Discrepancias · B solo las 2 metas del proyecto | A |
| N3 | Base de FP y FN | A se mantiene sobre aprobadas / rechazadas (meta del proyecto) y se cuadra con el mosaico en conteos ("36 = 19 + 17") · B pasar a % del total, como el mosaico (deja de compararse con la meta) | A |
| N4 | La duda de la IA en Calidad de la IA | A aparte, como en Prueba y el mosaico (cambian las cifras históricas, con aviso) · B sigue contando como No cumple | A |
| N5 | Universo de Calidad de la IA | A solo las 220 de validación; solo se comparan versiones con resultado en ellas · B todas las llamadas con planilla, con nota de cobertura (como hoy) | A |
| N6 | Qué se quita de Calidad de la IA | A titular, ranking de 4 métricas, matrices, mapa llamada por llamada y lista propia; quedan cabecera + mosaico + comparación entre versiones + por motivo · B además dejar el mapa plegado | A |
| N7 | Discrepancias › Resumen y Operación | A Resumen = estado + cabecera + mosaico + puente + barra de desacuerdos + por motivo; tarjetas de avance a contadores de pestaña; "¿Quién tiene más razón?" se quita; "¿Dónde se arregla?" y "% explicado" pasan a Patrones. Operación: 2 tarjetas a Procesamiento y "revisados por día" se quita del admin · B igual, pero "revisados por día" va como tercera tarjeta en Procesamiento | A |
| N8 | Riesgo de medir en las mismas 220 de donde salen las reglas (R-A) | A mantener G8 (números y análisis sobre las 220) y marcar en la cabecera "medido en las mismas llamadas de donde salieron N reglas" cuando aplique · B números sobre las 220, pero las propuestas siguen saliendo solo de entrenamiento (G8 C) · C mantener G8 sin aviso | A |

Esperando aprobación para continuar con la Fase 1 (implementación de la segunda entrega).
