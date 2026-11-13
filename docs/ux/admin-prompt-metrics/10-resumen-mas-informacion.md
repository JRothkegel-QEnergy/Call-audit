# Resumen de Análisis de discrepancias · Más información (propuesta)

- **Fecha:** 2026-11-13 · **Pide:** Johannes ("el Resumen tiene muy poca información"), junto al analista de datos.
- **Insumo:** `08-resumen-insumo-analista.md` (preguntas P1-P6, métricas y valores reales de v2.15). Todas las cifras de
  este documento salen de ahí; aquí solo se decide **dónde y cómo** se muestran.
- **Tipo:** cambio sobre diseño aprobado (N-R1..N-R9 de `05`, F1-F5 de `06`). Un gate: decisiones R1-R5.
- **Restricciones que se mantienen:** cabecera común de KPIs, pocos gráficos (no se agrega ninguno), cada cifra con su
  base ("n de N") y clic a sus llamadas, colores E3, orden de historia aciertos → errores del revisor → qué corregir /
  calibrar. Sin IA pagada: todo sale de datos ya guardados.
- **No se toca:** `09-info-llamada-y-tipificacion.md` (encabezado de la revisión y tipificación, otro diseñador).

## 1. Diagnóstico

El Resumen actual responde solo P1 (cabecera + mosaico) y a medias P3 y P4 (KPI azul sin su confianza; tabla por motivo
ordenada por el total, que mezcla lo que se corrige en el prompt con lo que se calibra con el revisor). No responde P2
(¿mejoró?), P5 (¿cuánto tiene propuesta y qué gano?) ni P6 (¿qué calibrar?). Lo que falta no son más gráficos: son
**frases con cifra** al lado de lo que ya está. Además hay un bug de cuadre (187 en el Resumen frente a 203 en Patrones)
que hay que cerrar antes de agregar cifras.

## 2. Estructura propuesta (de arriba abajo, una pregunta por bloque)

```
[Estado del análisis + línea de universo]                       (se mantiene)
B1  P1  ¿Qué tan bien está?        Cabecera de KPIs, metas en dos lecturas           (ajuste)
B2  P2  ¿Mejoró?                   Franja "Frente a v2.14" (1 línea + 2 enlaces)     (nuevo)
B3  P3  ¿Cuánto le creemos al azul? Línea de verificación bajo el KPI azul            (nuevo)
B4      Mosaico por llamada + barra por motivo                                        (se mantiene)
B5  P4+P5 | P6  Dos columnas: "Corregir en el prompt" | "Calibrar con el revisor"     (nuevo, sin gráficos)
B6      ¿En qué motivos? con selector A corregir / A calibrar / Todo                  (ajuste)
```

Sigue siendo **una sola pantalla con dos gráficos** (mosaico y barra), como hoy. Lo nuevo es texto con cifras, enlaces y
dos columnas de tarjetas.

### B1 · Cabecera de KPIs con la meta en dos lecturas (P1)

`QualityHeader` igual que hoy, con un cambio en las dos tarjetas con meta (falsas alarmas y rechazos no detectados):

```
Rechazos no detectados                         Meta ≤ 20 %   [✗ No cumple]
47,3 %  · 52 de 110 rechazadas
Sin el posible error del revisor: 11,8 % · 13 de 110   [✓ Cumpliría]  ⓘ depende del azul (1 de 59 verificada)
```

- La cifra grande es siempre el **total** (la comparación firme, según el analista). El "a corregir" va como sublínea,
  más chica, con su propio badge en condicional ("Cumpliría" / "No cumpliría") para que nadie lo lea como logro.
- Badge con texto e ícono, no solo color (WCAG 1.4.1, ya decidido el 2026-11-10).
- Clic: el total abre `fp` / `fn`; la sublínea abre las mismas listas filtradas sin azul (`?sinAzul=1`, nombre a definir
  en código).
- Cuando la verificación del azul alcance la muestra (R4), la nota "depende del azul" cambia a
  "x de 30 verificadas · y % confirmadas".

### B2 · Franja de evolución (P2)

Una línea bajo la cabecera, solo si existe una prueba anterior en validación (la versión padre; si no hay, se oculta):

```
Frente a v2.14: 7 llamadas pasan a coincidir · 9 dejan de coincidir → no distinguible con 220 llamadas.
[Ver las 16 que cambian ›]   [Ver la evolución en Calidad de la IA ›]
```

- Regla de redacción (del analista): si McNemar no es significativo, se escribe **"no distinguible con 220 llamadas"**,
  nunca "+0,9 pts". Si lo es: "mejora distinguible" / "empeora distinguible", con el p en el "?".
- La serie completa (v2.13 → v2.15, totales y "a corregir") vive en **Calidad de la IA**, que ya tiene la comparación
  por versión; el Resumen no repite la tabla (R2).
- "Ver las 16 que cambian" abre la lista de llamadas con dos grupos: "pasan a coincidir" y "dejan de coincidir".

### B3 · Confianza del azul (P3)

Bajo la tarjeta "Posible error del revisor", una línea y un botón:

```
Posible error del revisor  26,8 % · 59 de 220
Verificado a mano: 1 de 59 llamadas (1 confirmada).  [Verificar una muestra de 30 ›]
Cambió de color en 49 de 158 desacuerdos repetidos entre los 3 últimos análisis (31 %).  ⓘ
```

- "Verificar una muestra de 30" abre la lista de llamadas en modo muestra (R4), con progreso "x de 30" y el mismo flujo de
  verificación caso a caso ya implementado (`04`, V1-V5). No hay pantalla nueva.
- La línea de estabilidad solo aparece si hay al menos 2 análisis de causa comparables sobre las mismas llamadas. El "?"
  explica: "El color azul lo decide la IA de análisis. Si cambia entre análisis, la cifra no es firme hasta verificarla".

### B4 · Mosaico y barra (se mantiene)

Sin cambios de forma. La barra "Desacuerdos por motivo" pasa a sumar exactamente lo mismo que Patrones (fuente única, R1).

### B5 · Dos columnas: qué corregir y qué calibrar (P4, P5, P6)

Dos tarjetas lado a lado (apiladas bajo `md`), cada una con 3 cifras en frase y un top 5 de motivos en filas (no gráfico).

| Corregir en el prompt (rojo + amarillo) | Calibrar con el revisor (azul) |
|---|---|
| **77 desacuerdos** · 37 solo el revisor lo marca + 40 solo la IA lo marca | **110 desacuerdos** de 187 (58,8 %) |
| **Disperso:** 5 motivos suman el 50 %; 13 el 80 % (de 25 con alguno) | **Concentrado:** M18 Tipificación suma el 38 %; M18 + M15 + M6, el 60 % |
| **Crónico:** 59 de 77 (77 %) ya estaban en v2.13 y v2.14 · 11 nuevos | **Con propuesta de calibración:** 110 de 110 · 15 propuestas por decidir |
| **Con regla propuesta:** 22 de 77 (29 %) · 53 en observaciones · 2 sin patrón | |
| **Si aceptas las 6 reglas:** como mucho +5 llamadas (57,3 % → 59,5 %), dentro del margen de ±6 pts ⓘ | |
| Top 5: M30 9 · M6 9 · M32 8 · M18 7 · M3 6 | Top 5: M18 42 · M15 · M6 · (resto según `byCriterion`) |
| [Ver las 77 ›] [Ver las 6 reglas en Patrones ›] | [Ver las 110 ›] [Ver las 15 propuestas en Patrones ›] |

- Cada cifra enlaza a su lista: crónicos → lista filtrada "ya estaba en las versiones anteriores"; "con regla" / "en
  observaciones" → Patrones filtrado; cada motivo del top → `listHref(version, "disagree", motivo)` con el color.
- El techo de +5 lleva en su "?" las tres advertencias del analista (es un techo; las reglas salen de estas mismas 220
  llamadas, aviso N8 A; cae dentro del margen). La frase visible ya dice "como mucho" y "dentro del margen".
- La línea "Crónico" es la que habilita la decisión de escribir reglas a mano: el "?" lo dice en una frase ("Si un
  desacuerdo sigue en tres versiones, el loop no lo está corrigiendo").
- Esto reemplaza al antiguo «¿Dónde se arregla?» (quitado en N-R7): vuelve, pero **recalculado sobre la base del Resumen
  (187)** y separado por color. Las tarjetas de avance (por decidir / aceptadas / resueltas) **no vuelven** (mezclan
  universos y no dicen nada de calidad).
- El "azul por revisor" (un revisor 10/20, no concluyente) **no va al Resumen**; si se quiere, va a la pestaña
  Evaluadores con n e IC, rotulado como pista para elegir qué verificar.

### B6 · ¿En qué motivos? (ajuste)

- Selector segmentado arriba de la tabla: **A corregir en el prompt** (default) · **A calibrar con el revisor** · **Todo**.
  Ordena por la columna correspondiente. Hoy arriba quedan M18, M6 y M15, que son casi todo azul.
- Columna nueva **"Ya estaba"** (crónicos del motivo, en la vista "A corregir").
- Se mantiene el clic por celda a las llamadas del motivo y color.

## 3. Fuente única (bug de cuadre 187 vs. 203)

- **Todo el Resumen sale de `agreement`** (`verification.quality_for_analysis`), incluidas las dos columnas de B5 y la
  cobertura por destino. `discrepancy_runs.overview` deja de aportar cifras de desacuerdos al Resumen; solo el estado del
  análisis, costo y propuestas pendientes.
- La cobertura (con regla / observación / sin patrón) se calcula cruzando cada desacuerdo de `agreement` con su
  `best_pattern`, como hizo el analista; no con `byAction` de `discrepancies.build`.
- **Color único:** los 6 desacuerdos que hoy son amarillo en el Resumen y "duda de la IA" en la tabla se rigen por la regla
  de `agreement` en toda la app (la duda va aparte, como en N-R1).
- **Motivo 1:** según R1. Con la recomendación (fuera), Patrones mantiene sus patrones de M1 en un grupo aparte rotulado
  "Motivo 1 (capa 1) · no entra en las cifras del Resumen", y su contador total se muestra como "187 + 22 del motivo 1".
- Criterio de aceptación: para el mismo análisis, la barra del Resumen, la suma de B5 y el total de Patrones (sin M1)
  dan el mismo número.

## 4. Datos que necesita el backend (sin IA)

Todo se calcula con `agreement.call_rows`, patrones y verificaciones ya guardadas:

1. Prueba anterior comparable (padre en validación) y cruce pareado por `callId`: b, c, p de McNemar exacto, listas.
2. Verificación por color: `reviewed` / `confirmed` por llamada azul; muestra fija de 30 (R4) con semilla guardada.
3. Estabilidad del azul y persistencia del rojo + amarillo: cruce (motivo, `callId`, lado) con las 2 pruebas anteriores.
4. Cobertura por destino y techo de impacto (como en `docs/analisis/scripts/resumen_discrepancias.py`).
5. Concentración por color (acumulado por motivo) y top 5.

## 5. Microcopy clave

| Lugar | Texto |
|---|---|
| Sublínea de meta | "Sin el posible error del revisor: {x} % · {n} de {N} · Cumpliría / No cumpliría" |
| Nota de confianza | "Depende del azul: {v} de {N} llamadas verificadas" |
| Franja P2 (no significativo) | "Frente a {vAnterior}: {b} llamadas pasan a coincidir · {c} dejan de coincidir → no distinguible con {n} llamadas." |
| Franja P2 (significativo) | "Frente a {vAnterior}: mejora distinguible ({b} pasan a coincidir, {c} dejan de coincidir)." |
| Título columna 1 | "Corregir en el prompt" |
| Título columna 2 | "Calibrar con el revisor" |
| Crónico | "{n} de {N} ya estaban en {v-2} y {v-1}" |
| Techo | "Si aceptas las {k} reglas: como mucho +{m} llamadas ({a} % → {b} %), dentro del margen" |
| Botón muestra | "Verificar una muestra de 30" · progreso: "{x} de 30 verificadas" |

Vocabulario de `../call-audit/06-ux-writing.md` §8 (revisor, posible error del revisor, desacuerdo, coincide).

## 6. Accesibilidad (revisión rápida)

Sin gráficos nuevos. Badges con texto + ícono; las cifras de B5 son texto real (lectores de pantalla); el selector de B6
es un grupo de radio con teclado; cada enlace dice a qué lleva ("Ver las 77 llamadas…", no "Ver"); los "?" siguen el
patrón `MetricHelp` (Popover, clic/toque/teclado).

## 7. Supuestos y riesgos

- **H-R1 [SUPUESTO]:** la versión "anterior" para P2 es la padre en el loop (o la anterior en el listado si no hay loop);
  la serie comparable parte en v2.13 (v2.12 no tiene `split`).
- **H-R2 [SUPUESTO]:** una muestra de 30 azules estratificada (M18, M15, M6, resto) basta para decidir (IC ±15 pts).
- **R-R1:** mostrar el "a corregir" puede leerse como meta cumplida. Mitigación: cifra grande = total, badge en
  condicional, nota de verificación visible.
- **R-R2:** el techo de impacto sale de las mismas 220 llamadas (riesgo R-A vigente). Mitigación: "como mucho" y aviso N8 A.
- **R-R3:** la estabilidad y la persistencia requieren varias pruebas con análisis de causa; si faltan, esas líneas se
  ocultan (no se muestran en cero).

## 8. Decisiones (R1-R5)

| # | Decisión | A (recomendada) | B |
|---|---|---|---|
| R1 | Motivo 1 y fuente única | **Fuera** de las cifras de Discrepancias, igual que la prueba del prompt (base 187). Todo el Resumen sale de `agreement`; Patrones muestra M1 en un grupo aparte rotulado | Dentro: se suma M1 a `agreement` en toda la app (cambia también las cifras de la prueba del prompt y de Calidad de la IA) |
| R2 | Evolución | Franja de 1 línea en el Resumen (pareada contra la anterior, con McNemar) + serie completa en Calidad de la IA | Solo un enlace a Calidad de la IA |
| R3 | Metas | Dos lecturas: total como cifra principal y "sin el posible error del revisor" como sublínea en condicional | Solo el total; el "a corregir" va en el "?" |
| R4 | Verificación del azul | Muestra fija de 30 azules estratificada, con botón y progreso "x de 30" en el Resumen. Necesito saber quién la hace y cuándo (pregunta 4 del analista) | Sin muestra: solo el progreso sobre las 59 |
| R5 | Orden de implementación | Una entrega, con la fuente única (R1) como primer commit y su criterio de aceptación (§3) antes de agregar cifras | Dos entregas: primero fuente única + B1, B3, B5 y B6 (datos de una prueba); después P2, persistencia y estabilidad (cruces entre versiones) |
