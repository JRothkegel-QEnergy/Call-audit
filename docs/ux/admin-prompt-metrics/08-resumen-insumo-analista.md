# Resumen de Análisis de discrepancias · Insumo del analista

- **Fecha:** 2026-11-13 · **Pide:** Johannes ("el Resumen tiene muy poca información" tras la entrega F1-F5).
- **Para:** `disenador-ux`, que propone la pantalla con este insumo. Aquí no hay diseño: solo qué preguntas responde el
  Resumen, con qué métrica exacta y con qué valor real hoy.
- **Usuario objetivo:** el admin (Qubico) que decide **qué corregir en el prompt** y **qué calibrar con el revisor**.
- **Universo de todas las cifras:** la prueba de **v2.15 sobre las 220 llamadas de validación** (110 aprobadas y 110
  rechazadas por el revisor, 0 con error, 0 sin planilla) y su análisis de causa `93de0f61` (13-nov, US$3,95, 28 motivos).
  Unidades: **llamada** y **desacuerdo por motivo** (llamada × motivo, solo motivos de capa 2), igual que N-R2.
- **Fuente de datos:** BD de producción leída en modo solo lectura el 2026-11-13 (sin IA). Cálculo reproducible al final.
- **Base aprobada que se respeta:** N-R1..N-R9 (`05-numeros-propuesta.md` §2), colores E3, orden de historia aciertos →
  errores del revisor → lo que hay que corregir/calibrar.

## 0. Lo esencial en 5 líneas

1. **v2.15 no se distingue de v2.13 ni de v2.14.** Coincide 57,3 % las tres veces (126, 128 y 126 de 220). Entre v2.13 y
   v2.15, 9 llamadas pasan a coincidir y 9 dejan de hacerlo (McNemar p = 1,0). Hoy el Resumen no lo dice.
2. **Que se cumpla o no la meta depende del azul, y el azul casi no está verificado.** Rechazos no detectados: 47,3 % en
   total, pero 11,8 % "a corregir" si el azul es correcto (eso sí cumpliría la meta de ≤ 20 %). Se verificó a mano 1 de 59
   llamadas azules. Además, el 31 % de los desacuerdos que se repiten en las tres versiones cambia de color entre un
   análisis de causa y otro.
3. **Lo que hay que corregir en el prompt (rojo + amarillo = 77) está disperso y casi no se mueve.** Hacen falta 5 motivos
   para llegar al 50 % y 13 para el 80 %. El 77 % (59 de 77) ya estaba en v2.13 y v2.14.
4. **Las propuestas pendientes cubren poco.** Solo 22 de los 77 (29 %) caen en una regla de prompt propuesta; 53 (69 %)
   quedan en observaciones (menos de 3 casos). Aceptar las 6 reglas pendientes da, como mucho, +5 llamadas que coinciden
   (57,3 % → 59,5 %): dentro del ruido, y medido en las mismas llamadas de donde salieron.
5. **Lo que hay que calibrar con el revisor (azul = 110) está concentrado:** el motivo 18 (tipificación) suma el 38 %, y
   tres motivos (18, 15 y 6) suman el 60 %.

## 1. Preguntas que debe responder el Resumen (en orden de prioridad)

| # | Pregunta | Qué decisión habilita | ¿Hoy se responde? |
|---|---|---|---|
| P1 | ¿Qué tan bien está esta versión frente al revisor y a las metas? | Seguir iterando el prompt o no | Sí (cabecera y mosaico) |
| P2 | ¿Mejoró respecto de la versión anterior, o es ruido? | Promover la versión o descartarla, y si vale otra vuelta del loop | **No** |
| P3 | ¿Cuánto del error es del revisor, y cuánto le podemos creer a eso? | Verificar una muestra del azul antes de decidir nada sobre metas o calibración | A medias (el KPI azul está, pero no su confianza) |
| P4 | ¿Qué hay que corregir en el prompt, dónde se concentra y qué es crónico? | Qué motivos atacar en la próxima versión | A medias (la tabla mezcla los tres colores; sin persistencia) |
| P5 | ¿Cuánto de eso ya tiene propuesta y cuánto ganaría si la acepto? | Aceptar las propuestas o pedir otro análisis o una regla escrita a mano | **No** (se movió a Patrones sin el cruce con el rojo + amarillo) |
| P6 | ¿Qué hay que calibrar con el revisor y dónde se concentra? | Qué llevar a la corredora (motivos y, como hipótesis, revisores) | **No** |

## 2. Métricas por pregunta (definición, base, fuente y valor real de v2.15)

Notación del bloque `agreement` (`src/call_audit/agreement.py`): `byCall` (unidad llamada) y `byCallCriterion` (unidad
desacuerdo por motivo), con `promptFn` = rojo, `promptFp` = amarillo y `reviewer*` = azul. IC 95 % de Wilson.

### P1 · ¿Qué tan bien está? (se mantiene: cabecera común)

| Métrica | Definición | Unidad / base | Fuente | v2.15 | IC 95 % | Meta |
|---|---|---|---|---|---|---|
| Coincide con el revisor | `agree / n` | llamada / 220 | `byCall.agree`, `n` | 57,3 % (126/220) | 50,7–63,6 | — |
| Falsas alarmas (total) | `(promptFp + reviewerFp) / approved` | llamada / 110 aprobadas | `byCall` | 35,5 % (39/110) | 27,1–44,7 | ≤ 5 % ✗ |
| · a corregir (sin azul) | `promptFp / approved` | llamada / 110 | `byCall.promptFp` | 17,3 % (19/110) | 11,3–25,4 | ≤ 5 % ✗ |
| Rechazos no detectados (total) | `(promptFn + reviewerFn) / rejected` | llamada / 110 rechazadas | `byCall` | 47,3 % (52/110) | 38,2–56,5 | ≤ 20 % ✗ |
| · a corregir (sin azul) | `promptFn / rejected` | llamada / 110 | `byCall.promptFn` | 11,8 % (13/110) | 7,0–19,2 | ≤ 20 % ✓ *si el azul es correcto* |
| Sin decisión de la IA | `undecided / n` | llamada / 220 | `byCall.undecided` | 1,4 % (3/220) | 0,5–3,9 | — |

"Positivo" = la llamada No cumple. Falsa alarma (FP) = la IA dice No cumple y el revisor la aprobó. Rechazo no detectado
(FN) = la IA dice Cumple y el revisor la rechazó. **Recomendación nueva:** mostrar las dos lecturas de cada meta (total y
"a corregir"), porque el veredicto de la meta FN se da vuelta según se le crea o no al azul (P3).

### P2 · ¿Mejoró respecto de la anterior? (nuevo)

| Métrica | Definición | Unidad / base | Fuente | Valor |
|---|---|---|---|---|
| Serie por versión | Coincide, FP y FN (total y a corregir) de cada prueba en validación | llamada / 220 | `agreement.for_evaluation` de cada `verification.validation_test(v)` | Tabla de abajo |
| Cambio pareado de "Coincide" | Llamadas que pasan a coincidir (b) y que dejan de coincidir (c) entre dos versiones; McNemar exacto sobre b y c | llamada / 220 comunes | `agreement.call_rows` de ambas pruebas, cruce por `callId` | v2.14 → v2.15: +7 / −9 (p = 0,80). v2.13 → v2.15: +9 / −9 (p = 1,0) |
| Rotación | b + c: llamadas que cambian de estado entre dos versiones | llamada / 220 | ídem | 16 (v2.14 → v2.15), 18 (v2.13 → v2.15) |

| Versión | Coincide | FP total | FP a corregir | FN total | FN a corregir | Rojo / amarillo / azul (desacuerdos por motivo) |
|---|---|---|---|---|---|---|
| v2.13 | 57,3 % (126) | 31,8 % (35) | 18,2 % (20) | 48,2 % (53) | 12,7 % (14) | 41 / 36 / 111 = 188 |
| v2.14 | 58,2 % (128) | 32,7 % (36) | 14,5 % (16) | 46,4 % (51) | 10,0 % (11) | 42 / 37 / 106 = 185 |
| v2.15 | 57,3 % (126) | 35,5 % (39) | 17,3 % (19) | 47,3 % (52) | 11,8 % (13) | 37 / 40 / 110 = 187 |

Regla de lectura que debe ir en pantalla: con 220 llamadas, el IC de "Coincide" mide ±6–7 puntos. Una diferencia sin
McNemar significativo se escribe "no distinguible con esta muestra", no "+2 pts". El "a corregir" de cada versión depende
de su propio análisis de causa, así que la comparación firme es la de los totales.

### P3 · ¿Cuánto es error del revisor y cuánto le creemos? (KPI se mantiene; confianza nueva)

| Métrica | Definición | Unidad / base | Fuente | v2.15 |
|---|---|---|---|---|
| Posible error del revisor | `reviewer / n` | llamada / 220 | `byCall.reviewer` | 26,8 % (59/220), IC 21,4–33,0 |
| Desacuerdos azules | `byCallCriterion.reviewer` | desacuerdo / 187 | ídem | 110 de 187 (58,8 %) |
| Verificado a mano | Llamadas azules con todos sus desacuerdos revisados / llamadas azules | llamada / 59 | `verification.summaries(ev)["reviewer"]` (`reviewed`, `confirmed`) | **1 de 59** revisada (confirmada). Rojo, amarillo y sin decisión: 0 revisadas |
| Estabilidad del azul | De los desacuerdos que están, del mismo lado, en v2.13, v2.14 y v2.15: en cuántos de los 3 análisis de causa salió azul | desacuerdo / 158 | `blue` de `agreement.call_rows` en las tres pruebas | 3 de 3: 70 (44 %) · 0 de 3: 39 (25 %) · **mixto: 49 (31 %)** |

Lectura: el azul es un juicio de la IA de análisis (`blue_cases`: todos los patrones que contienen el caso tienen causa
`auditor`). Hoy se apoya en una sola verificación humana y cambia de color en casi un tercio de los casos repetidos. Hasta que
haya una muestra verificada, el "a corregir" de P1 es un piso optimista, no una cifra firme.

### P4 · ¿Qué hay que corregir en el prompt? (rojo + amarillo; nuevo enfoque)

| Métrica | Definición | Unidad / base | Fuente | v2.15 |
|---|---|---|---|---|
| A corregir en el prompt | `promptFn + promptFp` (motivos) | desacuerdo / 187 | `byCallCriterion` | 77 (rojo 37 + amarillo 40) |
| Concentración | % acumulado del rojo + amarillo en los N motivos con más; motivos necesarios para el 50 % y el 80 % | desacuerdo / 77 | `byCriterion` (`fn + fp`) ordenado | Top 1 (M30) 11,7 % · top 3 (M30, M6, M32) 33,8 % · top 5 50,6 % · **5 motivos para el 50 %, 13 para el 80 %**, en 25 motivos con alguno |
| Persistencia | De los rojo + amarillo de v2.15, cuántos (mismo motivo, misma llamada, mismo lado) ya estaban en las 2 versiones anteriores | desacuerdo / 77 | `call_rows` de v2.13, v2.14 y v2.15 | **59 (77 %) en ambas** · 7 en una · 11 nuevos (14 %) |

Top motivos por rojo + amarillo (detalle en `por_motivo_v215.csv`): M30 no reitera protocolo de cierre (3 + 6 = 9), M6
información del producto (2 + 7 = 9), M32 predispone al Sí (1 + 7 = 8), M18 tipificación (6 + 1 = 7), M3 excede 3 objeciones
(6 + 0 = 6).

Hallazgo para el diseño: la tabla «¿En qué motivos?» se ordena hoy por el **total** (rojo + amarillo + azul). Así, arriba
quedan M18, M6 y M15, cuyo volumen es casi todo azul (calibrar), y el que busca qué corregir en el prompt lo ve mezclado.
Conviene que se pueda ordenar o filtrar por "a corregir en el prompt" y por "a calibrar".

### P5 · ¿Cuánto ya tiene propuesta y qué gano al aceptarla? (nuevo)

| Métrica | Definición | Unidad / base | Fuente | v2.15 |
|---|---|---|---|---|
| Cobertura del rojo + amarillo | Cada desacuerdo rojo o amarillo se asigna al patrón de mejor prioridad que lo contiene (`discrepancy_runs.best_pattern`) y se agrupa por destino | desacuerdo / 77 | `DiscrepancyPattern.cases` + `action_of` | **Regla de prompt: 22 (28,6 %)** · Observación (< 3 casos): 53 (68,8 %) · Sin patrón: 2 |
| Cobertura del azul | Ídem | desacuerdo / 110 | ídem | Calibrar revisor: 110 (100 %, por construcción: azul = causa `auditor`) |
| Propuestas pendientes | Patrones no observación sin decidir, del análisis elegido | patrón | `summary.pendingProposals` | 21: 6 reglas de prompt + 15 de calibrar revisor (todas pendientes) |
| Techo de impacto | Si todas las reglas de prompt pendientes arreglaran todos sus desacuerdos: llamadas rojas o amarillas cuyos desacuerdos no azules quedan todos cubiertos y pasarían a coincidir | llamada / 220 | `call_rows` + patrones | **+5 llamadas** (2 rojas, 3 amarillas): Coincide 57,3 % → **59,5 % como máximo** (IC 52,9–65,8). FP a corregir 17,3 → 14,5 %. FN a corregir 11,8 → 10,0 % |

Advertencias que deben ir junto al techo: (a) es un techo (supone que cada regla arregla todo lo que cubre y no rompe nada);
(b) las reglas salieron de estas mismas 220 llamadas (aviso N8 A), así que la mejora medida va a salir inflada; (c) +5 llamadas
cae dentro del IC de v2.15. Si se usa `expected_fix` (lo que el propio análisis dice que se arreglaría), los cubiertos bajan de
22 a 18.

### P6 · ¿Qué calibrar con el revisor? (nuevo en el Resumen)

| Métrica | Definición | Unidad / base | Fuente | v2.15 |
|---|---|---|---|---|
| Concentración del azul | % acumulado del azul por motivo | desacuerdo / 110 | `byCriterion` (`reviewerFn + reviewerFp`) | **M18 38,2 % (42)** · top 3 (M18, M15, M6) 60,0 % · 6 motivos para el 80 %, en 12 motivos con alguno |
| Azul por revisor (hipótesis) | Llamadas azules del revisor / llamadas del revisor (evaluador de la planilla) | llamada / llamadas del revisor | `overview.evaluators` + `table` (`excel_evaluator`) | Global 26,8 %. un revisor 10/20 (50 %, IC 29,9–70,1) frente al resto 49/200 (24,5 %), Fisher p = 0,03 sin corregir por 27 revisores. **No concluyente** |

El azul por revisor se apoya en el azul, que no está verificado (P3). Sirve como pista para elegir qué verificar primero, no
para mostrársela a la corredora. Si se muestra, que sea en la pestaña Evaluadores con `n` e IC, no en el Resumen.

## 3. Lo que se quitó: qué vuelve y qué no

| Quitado | ¿Vuelve al Resumen? | Razón |
|---|---|---|
| Tarjetas de avance (por decidir 21, aceptadas 28, resueltas 25) | **No como tarjetas** (N-R7 sigue valiendo). Vuelve solo el cruce con la calidad: "22 de 77 por corregir tienen regla propuesta" (P5) | Un contador de trabajo no dice nada de la calidad. Lo que sí sirve para decidir es qué parte del problema tiene propuesta. Además, aceptadas y resueltas son de **todos** los análisis (`follow_up_counts`), no del elegido: mezclan universos |
| «¿Dónde se arregla?» (prompt / calibrar / corredora / sin patrón) | **Sí, rehecho** como la cobertura de P5 sobre el universo del Resumen (187), con el rojo + amarillo separado del azul | Es la pregunta central del usuario. Pero el `byAction` actual se calcula sobre la tabla de discrepancias (235 casos, incluye M1 y la duda) y no cuadra con la barra del Resumen (187). Hay que recalcularlo sobre `agreement` |
| «% explicado» | **No por separado.** Queda implícito en la cobertura: 132 de 187 (70,6 %) caen en un patrón con propuesta | Repetido con la cobertura y en otra base (154/235 en Patrones) |
| «¿Quién tiene más razón?» | **No** | Es un segundo juicio de la IA (`whoIsRight`) que compite con el azul. Encima, con lo de P3, ni siquiera el primer juicio es estable |
| Revisión manual Qubico | **No** (0 desacuerdos con revisión manual en validación: `manualCases` = 0). La reemplaza la verificación a mano de P3 | Hoy no aporta nada en este universo; la verificación es lo que corresponde |
| Llamadas fuera del cálculo | **Solo si hay alguna** (hoy 0 errores y 0 sin planilla, `agreement.scope`) | N-R1 ya lo cubre en la línea de universo. `callsOutside` del overview ("880 fuera del set val") no es una exclusión sino el otro grupo de llamadas: no mostrarlo |

## 4. Insights que hoy no se muestran y valen

Ordenados por valor para la decisión:

1. **Evolución pareada (P2).** Es lo que más le falta al Resumen. Tres versiones del prompt no movieron la coincidencia ni las
   metas de forma distinguible, y cada cambio de versión mueve unas 16–18 llamadas en ambas direcciones. Mensaje sugerido:
   "v2.15 frente a v2.14: 7 llamadas mejoran y 9 empeoran; no distinguible con 220 llamadas".
2. **Confianza del azul (P3).** "1 de 59 verificada" y "31 % cambia de color entre análisis" tienen que estar al lado del KPI
   azul, porque de eso depende que la meta FN se lea como cumplida (11,8 %) o muy lejos (47,3 %).
3. **Persistencia (P4).** El 77 % de lo que hay que corregir ya estaba hace dos versiones: el loop no lo está tocando. Sirve
   para priorizar escribir una regla a mano en los crónicos en vez de esperar otro análisis.
4. **Cobertura y techo (P5).** "22 de 77 tienen regla propuesta; aceptar las 6 da como mucho +5 llamadas". Evita que alguien
   espere un salto al aceptar la bandeja.
5. **Concentración separada por color (P4 y P6).** El azul se concentra (M18 = 38 %); el rojo + amarillo no (13 motivos para
   el 80 %). Implica dos estrategias distintas: calibrar pocos motivos con la corredora y corregir el prompt en muchos frentes
   chicos.

Descartado como insight de Resumen: el ranking de revisores (n chicas, depende del azul sin verificar) y "% explicado".

## 5. Calidad de datos y supuestos

- **No cuadran el Resumen y Patrones/Evaluadores (viola N-R6).** Para el mismo análisis, el Resumen cuenta **187**
  desacuerdos por motivo (`agreement`, solo motivos de capa 2) y `summary.disagreements` cuenta **203**
  (`discrepancies.build`). La diferencia: 22 desacuerdos del **motivo 1** (capa 1, fuera de `layer2_criteria`), que solo están
  en Patrones (hay un patrón de calibrar con 20 casos en M1). Además, 6 desacuerdos que el Resumen cuenta como amarillo y la
  tabla como duda de la IA (M6, M13, M16 y M18). La duda también difiere: 23 frente a 32. Hay que decidir si M1 entra o no y
  usar una sola fuente. **Recomiendo que todo el Resumen salga de `agreement`**, y que Patrones diga explícitamente que
  incluye M1 si lo mantiene.
- Hay prueba de v2.12 en las 220 (`split` vacío, anterior al split); no se usó en la evolución. `[SUPUESTO]` La serie
  comparable empieza en v2.13.
- `[SUPUESTO]` Persistencia y estabilidad cruzan por (motivo, `callId`); las 220 llamadas son las mismas en las tres pruebas
  (verificado: 220 comunes).
- El techo de impacto asigna cada desacuerdo a un solo patrón (`best_pattern`, como el producto) y no modela efectos
  colaterales de las reglas.
- "Sin dato" en revisores: 21 llamadas sin evaluador en la planilla, más 2 con "Null" literal.
- `TBD` (para `client-open-questions.md`): qué tolerancia acepta la corredora para dar el azul por bueno sin verificar, y si
  el motivo 1 se audita en este flujo.

## 6. Recomendaciones (para Johannes, fuera del diseño)

1. **Verificar a mano una muestra del azul antes de iterar el prompt de nuevo.** Con 30 llamadas azules al azar
   (estratificadas por M18, M15, M6 y el resto), el IC del "% confirmado" queda en unos ±15 puntos; con las 59, en ±11. Es lo
   que decide si la meta FN está cerca o lejos. Sin costo de IA, solo horas de una persona (`TBD`: cuántas).
2. **Unificar la fuente del Resumen y Patrones** (bug de la sección 5) antes de agregar cifras nuevas, o el usuario va a ver
   187 en una pestaña y 203 en otra.
3. **No esperar del loop lo que no está dando:** los crónicos (59 de 77) y las 53 observaciones piden reglas escritas a mano
   en M30, M6, M32 y M3, o pedir más llamadas de validación para medir diferencias de menos de ±7 puntos. No sugiero ninguna
   corrida pagada para esto.

## 7. Preguntas para Johannes

1. ¿El motivo 1 entra en las cifras de discrepancias o queda fuera, como en la prueba del prompt? Define el cuadre 187 vs. 203.
2. ¿Quieres la evolución (P2) en el Resumen o solo en Calidad de la IA, con un enlace desde el Resumen?
3. ¿Está bien mostrar las dos lecturas de cada meta (total y "a corregir"), o confunde y prefieres solo el total, con el azul
   como nota?
4. ¿Hay alguien que pueda verificar a mano 30 llamadas azules esta semana?

## 8. Reproducción

```
# 1. Volcado de solo lectura desde producción (sin IA; rollback, sin commit)
cd call-audit-rcv
source <(grep -E '^(KEY|HOST)=' .deploy/deploy.env) && ssh -i "$KEY" ec2-user@$HOST "docker exec -i call-audit-api-1 python -" \
  < ../docs/analisis/scripts/resumen_discrepancias_dump.py > ../docs/analisis/out/resumen-discrepancias/dump-AAAA-MM-DD.json
# 2. Cálculo (stdlib)
cd ..
python docs/analisis/scripts/resumen_discrepancias.py docs/analisis/out/resumen-discrepancias/dump-2026-11-13.json
```

Salidas en `docs/analisis/out/resumen-discrepancias/`: `resumen.json` (todas las cifras de este documento),
`cabecera_por_version.csv`, `por_motivo_v215.csv`, `cobertura_desacuerdos_v215.csv` (cada desacuerdo con su destino y
patrón) y `revisores_v215.csv`.
