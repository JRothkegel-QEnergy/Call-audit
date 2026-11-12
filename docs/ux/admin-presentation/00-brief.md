# Fase 0 · Brief y encuadre · Vista "Avance del proyecto" (presentación a socios)

Fecha: 2026-11-10 · Estado: **pendiente de aprobación** · Actor: Admin (`qubico_admin`) que presenta; audiencia: socios de Qubico y, más adelante, la corredora.
Nombre de trabajo: **Avance del proyecto** (ruta tentativa `/admin/progress`). El nombre final se decide en la Fase 3.
IDs locales de este proceso: `P-xx`, `O-xx`, `R-xx`, `H-xx`, `D-xx`. No chocan con los de `docs/ux/call-audit/` porque viven en esta carpeta.

---

## 1. Problema

En la última reunión, Agustín Desmadryl (socio) sintió que todo estaba "muy desordenado".

| ID | Dolencia | Evidencia |
|---|---|---|
| P-01 | Se mostraron cifras sueltas (285 desacuerdos, 33.000 observaciones, 36/63/2 %, 33 criterios) **sin un número principal ni comparación con la meta** | Relato de Johannes sobre la reunión |
| P-02 | La demo partió por el detalle (reglas del prompt) y no por la conclusión. La audiencia no sabía qué mirar ni qué decidir | Relato de Johannes |
| P-03 | No hay **tendencia**: nada muestra si mejoramos de una versión del prompt a otra ni de una reunión a la siguiente | Relato de Johannes; no hay historial por versión en la app (§5) |
| P-04 | Las métricas útiles están en jerga técnica (F1, precisión, recall, train/val/test) sin traducir para quien decide | `golden_split.summary`, `transcripts/golden_split/2026-11-10/summary.md` |
| P-05 | La historia vive en **cuatro lugares**: Calidad de la IA (`/admin/stats?tab=quality`), Análisis de discrepancias (`/admin/discrepancies`), la prueba de cada versión (`/admin/prompts/[version]`) y el informe del golden set, que hoy es un Markdown fuera del repo y fuera de la app | Revisión del código (§5) |
| P-06 | Lo que se muestra a los socios no se podría mostrar tal cual a la corredora (costos de Qubico, detalle interno del prompt) | Pedido: "eventualmente mostrar a Verónica" |

## 2. Objetivo de negocio

Que en cada reunión Johannes pueda **contar el estado del proyecto en orden, gráfico por gráfico, partiendo por la conclusión**. Que Agustín y Rodrigo se lleven tres cosas: el número principal, si va hacia la meta y qué se decide ahora. A futuro, la misma estructura debe servir para mostrarle el avance a la corredora.

## 3. Métricas de éxito (KPIs de la vista)

| ID | KPI | Meta propuesta |
|---|---|---|
| K-01 | Al cerrar la reunión, Agustín puede decir el número principal, su meta y si subió o bajó desde la reunión anterior | Sí, sin ayuda [SUPUESTO] |
| K-02 | Cifras en pantalla sin denominador, sin meta ni comparación | 0 |
| K-03 | Gráficos cuyo título no es una conclusión (p. ej. "Calce por versión" en vez de "v2.11 mejora el calce en val, pero no llega a la meta") | 0 |
| K-04 | Tiempo de Johannes para preparar la presentación de una reunión | < 10 min, sin correr scripts ni IA [SUPUESTO] |
| K-05 | Cifras que cambian mientras se presenta | 0 (depende de la decisión 3) |

## 4. Alcance

**Sí (propuesta para validar):**
- R-01 Vista de solo lectura para el admin, que se presenta **gráfico por gráfico** con un orden fijo y un título-conclusión en cada uno.
- R-02 Un **número principal** comparado contra la meta del proyecto: hasta 5 % de falsos positivos y hasta 20 % de falsos negativos a nivel de llamada (`docs/context.md`).
- R-03 Explicación simple del golden set y de su división fija train 60 % / val 20 % / test 20 % (`golden_split.py`).
- R-04 Evolución por versión del prompt (v2.10 → v2.11 → …) en val, y en test cuando corresponda.
- R-05 Los 3 a 5 motivos que más pesan, con precisión y detección traducidas a lenguaje simple.
- R-06 Costo por llamada y por ronda de optimización.
- R-07 Cierre con "qué decidimos hoy / próximos pasos".
- R-08 Cada cifra se muestra con su denominador y, cuando la muestra es chica, con su margen de error (§6).

**No:**
- Reemplazar Calidad de la IA, Discrepancias ni la prueba del prompt. Esas siguen siendo las herramientas de trabajo; la vista nueva **resume y enlaza** a ellas.
- Correr IA nueva para alimentar la vista. Todo sale de corridas y pruebas ya guardadas (memoria: sin corridas pagadas sin motivo).
- Editar el prompt, aceptar reglas ni lanzar pruebas desde la vista.
- Dashboard operativo diario (eso es Estadísticas → Operación).
- Por ahora, una versión para la corredora (ver decisión 1).

## 5. Lo que ya existe (investigación de lo existente)

| Pieza | Qué ya hace | Qué le falta para esta vista |
|---|---|---|
| **Calidad de la IA** (`/admin/stats?tab=quality`, Cambio 15, `ai-quality.tsx`) | Por corrida: detección, falsos positivos, falsos negativos y calce equilibrado, con la meta como línea vertical. Titular con conclusión ("Cumple la meta de detección, no la de falsos positivos"), tabla por motivo, mapa y lista de desacuerdos | Mide sobre **todas** las llamadas con planilla: no distingue train/val/test. No muestra F1 ni precisión por motivo. Es una herramienta de exploración (selector de hasta 6 corridas), no un relato |
| **Prueba de una versión** (`/admin/prompts/[version]`, Cambio 12/18) | Compara la vigente contra la probada. La prueba corre por defecto en val (`prompt_evaluation.eval_split`), y `metrics()` ya calcula `criterionScores` (precisión, recall, F1, macro, micro) y `splits` | **Ninguna vista del front muestra `criterionScores`** (no aparece en `frontend/src`). Compara de a dos versiones, no la serie completa |
| **Análisis de discrepancias** (`/admin/discrepancies`, Cambios 16, 19 y 20) | Cifras clave, "¿Dónde se arregla?", barras por motivo, patrones y seguimiento. Es la fuente de los "285 desacuerdos" y las "33.000 observaciones" | Son números de trabajo (insumo de la cuarta IA). Mostrados sueltos generan justamente P-01 |
| **Golden set** (`golden_split.py`) | División fija y determinística (hash del `call_id`, estratificada por veredicto y por motivo raro), guardada en `cases.call_metadata["golden_split"]`. `summary()` entrega calce, F1 macro (motivos con ≥ 5 marcas) y micro, y el detalle por motivo | Solo se ve como Markdown fuera de la app (`transcripts/golden_split/2026-11-10/summary.md`). **Ningún endpoint del admin expone el set ni las métricas por set** |
| **Estadísticas → Operación y Costo** | Llamadas procesadas y costo por modelo y versión del prompt, con filtros de periodo (`admin-stats-filters`, sin commit) | El costo de una "ronda de optimización" no existe como unidad |
| **Gráficos en el front** | Hechos a mano con Tailwind 4 y los tokens de `08-tokens.css`, incluida la paleta `--series-1..6` (D-57). Sin librería de gráficos | Nada que agregar a priori: se reutiliza |

**Conclusiones de lo existente:**
1. **No hace falta otra herramienta de análisis**: casi todas las métricas ya existen. Lo que falta es **el relato** (orden, conclusión, meta y tendencia) y un puñado de datos que hoy no llegan a la API.
2. **Hay un desalineamiento de métricas que hay que resolver antes de diseñar.** La meta del proyecto está en falsos positivos y falsos negativos *a nivel de llamada*. El golden set decide versiones con *calce* y *F1 por motivo*. Calidad de la IA calcula FP y FN por llamada, pero sobre todas las llamadas y no sobre val. Hoy nadie entrega "FP y FN en val por versión", que es justo lo que pide la reunión (decisión 4).
3. **La línea base está lejos de la meta, y la vista lo va a mostrar sin maquillaje.** Con un set balanceado (50 % rechazadas), un calce de 0,57 implica que FP y FN por llamada promedian cerca de 43 %, contra metas de 5 % y 20 %. Es una conclusión dura pero útil: el relato debe mostrar distancia y tendencia, no solo el punto. La cifra exacta de FP y FN en val hay que calcularla (H-03).
4. **La muestra es chica y eso cambia cómo se leen las tendencias.** Val tiene 219 llamadas con corrida. El margen de error de un calce de 0,57 es de unos ±6,5 puntos (IC 95 %). Por eso **test 0,62 contra val 0,57 no es una diferencia real**, y una versión que mejore 3 puntos en val tampoco lo es todavía. Por motivo es peor: el 18 tiene 40 marcas en val, el 25 tiene 0. La vista debe mostrar "mejora clara / dentro del margen / empeora", no decimales sueltos (R-08).
5. **Datos de backend que faltan** (los diseña `pipeline-architect` o `analista-datos`, no son UI):
   - G-1 Métricas por set (val y test) por versión del prompt, guardadas y consultables. Hoy son `PromptEvaluation.metrics` por prueba más el script del golden set.
   - G-2 FP y FN por llamada dentro de `golden_split.summary` (hoy solo calce y F1).
   - G-3 Endpoint del admin con el resumen del golden set (tamaños, balance y evaluadoras por set).
   - G-4 Costo de una ronda de optimización como suma registrada (análisis de discrepancias + prueba en val), no como estimación.
   - G-5 Si se aprueba la "foto por reunión" (decisión 3): guardar una edición con fecha.
6. **Motivos que más pesan hoy en val** (v2.10, `summary.md`):
   - **25**: la IA lo marca 48 veces y la planilla 0. Son falsos positivos puros, la mayor fuente de error por volumen.
   - **18**: 40 marcas de la planilla; precisión 0,33, detección 0,25.
   - **3**: 11 marcas; la IA no detecta ninguna.
   - **15**: 14 marcas; precisión 0,57, detección 0,29.
   - **33**: 11 marcas; precisión 0,33, detección 0,18.
   - También pesan **11** (13 marcas de la IA, 12 falsas) y **32** (10 marcas de la IA, todas falsas). El "top 5" conviene elegirlo con una regla fija (H-05) y no a mano.

## 6. Restricciones técnicas

- Next.js 16 / React 19 / Tailwind 4, tokens de `docs/ux/call-audit/08-tokens.css`. Los gráficos se hacen a mano, como en Cambio 15 y 19. No hay Figma conectado al proyecto: los wireframes se entregan en texto o HTML, como en los cambios anteriores.
- Datos: `PromptEvaluation` (results con `split`, metrics con `criterionScores`), `Case.call_metadata["golden_split"]`, `ModelRun` (costo y latencia), `golden_split.summary`.
- Sin IA nueva. Recalcular métricas desde resultados guardados no tiene costo.
- Un solo desarrollador (Johannes). La primera versión tiene que ser chica.

## 7. Plataforma y contexto de uso

- Web de escritorio, proyectada o compartida por videollamada [SUPUESTO H-01]. Debe leerse a distancia: textos grandes, un gráfico por pantalla y alto contraste.
- La maneja Johannes (presentador). La audiencia mira, no navega (salvo la decisión 1).

## 8. Stakeholders y quién decide

| Rol | Quién | Interés |
|---|---|---|
| Decide los gates del diseño y presenta | Johannes Rothkegel (Lead Developer) | Contar el avance ordenado y sin preparar a mano |
| Audiencia principal | Agustín Desmadryl (socio) | Tendencias y conclusiones claras: ¿vamos hacia la meta? ¿qué decidimos? |
| Audiencia principal | Rodrigo Martínez (recién incorporado) | Entender el sistema y el método desde cero: necesita la parte "qué hace y por qué el golden set" |
| Audiencia posible | Jean Paul de Dompierre (socio, `docs/context.md`) | [SUPUESTO H-02] mismo interés que Agustín |
| Audiencia futura | Verónica (la corredora) | Ver el avance hacia la meta acordada, sin el detalle interno de Qubico |

Proto-personas preliminares (se detallan en la Fase 1 si se aprueba el proceso):
- **Socio que decide** (Agustín): poco tiempo y foco en negocio. Quiere un número, una tendencia y una decisión. Se pierde con el detalle de reglas.
- **Socio nuevo** (Rodrigo): necesita el contexto mínimo (qué hace el sistema, cómo se mide) antes de las cifras.
- **Presentador** (Johannes): domina el detalle y necesita una estructura que lo obligue a partir por la conclusión y que le deje bajar al detalle solo si se lo piden.

## 9. Mercado / jurisdicción

Chile, uso interno de Qubico. Más adelante, la corredora (BancoEstado Corredores de Seguros).

## 10. Legal

Por instrucción de Johannes (memoria del proyecto), no se plantean temas legales ni de anonimización hasta que él lo pida. `registro-legal.md` queda abierto y sin ítems.

## 11. Propuesta de relato (borrador para validar; ver decisión 5)

El relato parte por la conclusión (pirámide). Cada paso es un gráfico con un título que dice la conclusión.

| # | Pantalla | Pregunta que responde | Origen del dato | Requisito |
|---|---|---|---|---|
| 1 | **Dónde estamos** | ¿Cumplimos la meta? ¿Vamos mejor que la reunión pasada? | FP y FN por llamada en val, versión vigente, contra 5 % / 20 % y contra la edición anterior | R-02 |
| 2 | Qué hace el sistema | ¿Qué audita y sobre qué universo? | Llamadas procesadas, 33 motivos en 5 bloques | — |
| 3 | Cómo medimos: el golden set | ¿Por qué podemos creer las cifras? | 1.100 llamadas, 60/20/20 con propósito (aprende / decide / confirma) | R-03 |
| 4 | Evolución por versión | ¿Las versiones nuevas mejoran de verdad? | Serie v2.10 → v2.11 → … en val (y test si corresponde), con el margen de error | R-04, R-08 |
| 5 | Dónde se concentra el error | ¿Qué motivos frenan la meta? | 3–5 motivos con regla fija, en lenguaje simple ("de cada 10 alertas del motivo 25, 0 son reales") | R-05 |
| 6 | Cuánto cuesta | ¿Es sostenible operar y mejorar? | US$ por llamada (capa 2) y por ronda de optimización | R-06 |
| 7 | Qué decidimos hoy | ¿Qué sigue? | Texto que escribe Johannes por edición | R-07 |

Cada pantalla tiene "Ver detalle", que lleva a la herramienta de trabajo correspondiente (Calidad de la IA, Discrepancias o la versión del prompt), para cuando alguien pregunte.

Diferencias con la lista del pedido: el número principal pasa al inicio (era el punto 3), se agrega el cierre "Qué decidimos" y lo técnico del golden set queda en una sola pantalla de método.
