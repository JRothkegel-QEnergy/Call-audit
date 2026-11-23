# Estado del proceso UX · Métricas de la prueba del prompt

- **Estado:** aprobado e implementado el 2026-11-10 (falta desplegar a prod).
- **Último pedido abierto (2026-11-13):** Motivos de renuncia sugeridos en la revisión, `12-motivos-sugeridos-en-revision.md`, esperando S1-S4 (ver la sección al final).
- **Tipo:** cambio menor sobre el diseño aprobado de call-audit (Cambios 12, 15 y 17). Revisión rápida, proceso comprimido a pedido de Johannes.
- **Código afectado (después de aprobar):** `frontend/src/app/(app)/admin/prompts/[version]/prompt-version.tsx` (TestTab), nuevo `components/ui/metric-help.tsx`; según Q1, `components/admin/ai-quality.tsx` y `app/(app)/admin/prompts/page.tsx`; según Q2, `src/call_audit/golden_split.py` (`call_rates`).

## Aprobaciones

| Paso | Estado | Fecha | Notas |
|---|---|---|---|
| Propuesta (copy, metas, tabla por motivo, patrón "?") | Aprobada | 2026-11-10 | Johannes aprobó las recomendaciones de Q1, Q2 y Q3 |

## Decisiones tomadas

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-10 | La leyenda "?" usa Popover (clic, toque o teclado) y no Tooltip ni `title=` | Diseñador (requisito de Johannes: teclado y touch) |
| 2026-11-10 | El cumplimiento de la meta se muestra con badge de texto e ícono, no solo con color | Diseñador (WCAG 1.4.1) |
| 2026-11-10 | Q1: el vocabulario nuevo va en la prueba del prompt, en Calidad de la IA y en el listado de versiones; Discrepancias se mantiene | Johannes |
| 2026-11-10 | Q2: tasa y conteo juntos ("33 % · 36 de 109"); el backend agrega los conteos en `call_rates` | Johannes |
| 2026-11-10 | Q3: "Llamadas con el motivo incumplido" se reemplaza por "Errores por motivo" | Johannes |

---

## Mosaico de acuerdo IA vs. la corredora (pedido 2026-11-11)

- **Estado:** Fase 0 aprobada (D1-D5) el 2026-11-11. Fase 1 (propuesta) aprobada y cerrada el 2026-11-11 (E1-E5). Lista para implementar (02 §11); sin código de UI aún.
- **Archivos:** `01-mosaico-brief.md`, `02-mosaico-propuesta.md`.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-11 | Mostrar ambas unidades: por llamada (titular) y llamada × motivo (detalle) | Johannes |
| 2026-11-11 | Solo en la app, no en la presentación | Johannes |
| 2026-11-11 | D1: se analiza la causa en cada versión, sobre los desacuerdos de validación (pagado, ≈ US$3-5 por vuelta). Sus propuestas de regla no se usan; solo atribuyen la causa. Hay estado "análisis pendiente/en curso" | Johannes |
| 2026-11-11 | D2: azul solo si todos los patrones del caso dicen `auditor`; lo demás (transcript, missing_data, sin patrón) va a rojo o amarillo según la dirección. Por llamada: azul solo si todos sus motivos en desacuerdo son azules | Johannes |
| 2026-11-11 | D3: un solo azul; el desglose por dirección va en la tabla | Johannes |
| 2026-11-11 | D4: se mantiene la tabla FP/FN actual; el mosaico se rotula "% del total de llamadas" | Johannes |
| 2026-11-11 | D5: "Coincide con el revisor" y azul = "Inconsistencia del revisor (según el análisis)" | Johannes |
| 2026-11-11 | Loop de mejora: pausa en cada vuelta para aprobar reglas, máx. 5 vueltas, validación como medida. La evolución usa solo validación | Johannes |
| 2026-11-11 | E1: botón "Analizar causa" en la pestaña Prueba, con costo y confirmación; el loop lo usa en cada vuelta | Johannes |
| 2026-11-11 | E2: "Coincide con el revisor" en la pestaña Prueba, la lista de versiones y Calidad de la IA; el "?" define "revisor"; Discrepancias no se toca | Johannes |
| 2026-11-11 | E3: colores aprobados tal cual (§4 de 02) | Johannes |
| 2026-11-11 | E4: la evolución muestra solo la cadena del loop, rotulada "vuelta N"; el backend guarda id del loop, número de vuelta y versión padre | Johannes |
| 2026-11-11 | E5: Marimekko en A, barras alineadas en C | Johannes |
| 2026-11-11 | Propuesta cerrada; glosario agregado en `../call-audit/06-ux-writing.md` §8. Implementación: Johannes, después del backend del loop | Diseñador |

---

## Pestaña Prueba: orden, KPIs y revisión caso a caso (pedido 2026-11-12)

- **Estado:** Fase 0 **aprobada** el 2026-11-12 (G1-G13). Primera entrega (verificación del 27 %, `04-verificacion-propuesta.md`) **aprobada (V1-V5) e implementada** el 2026-11-12, sin commitear ni desplegar. Segunda entrega (G6-G12): propuesta de cómo se muestran los números en `05-numeros-propuesta.md`, esperando N1-N8.
- **Origen:** feedback del jefe sobre la captura de v2.15 (desorden, KPIs poco claros, mucho gráfico, no se puede revisar caso a caso).
- **Archivo:** `03-orden-y-detalle-brief.md` (diagnóstico §1, problemas P-04 a P-08, objetivos O-04 a O-06, supuestos H-07 a H-11).
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-12 | Se trata como rediseño de la pestaña (Fase 0), no como cambio menor; se reutilizan D1-D5, E1-E5 y el glosario | Diseñador |
| 2026-11-12 | Alcance ampliado a Análisis de discrepancias y Estadísticas (Operación y Calidad de la IA). Brief 03 ampliado: §5-§8, P-09 a P-18, O-07 a O-10, H-12 a H-14, glosario propuesto. Esperando Q1-Q9 | Johannes (vía coordinador) |
| 2026-11-12 | Reunión con el jefe incorporada (§8, A1-A7): prioridad n.º 1 verificar el 27 % caso a caso con registro; universo único de 220 (resuelve la antigua Q3); H-07 confirmado, H-11 descartado; R-14 a R-18; decisiones consolidadas en §9 (Q1-Q13). Esperando aprobación | Jefe y Johannes (vía coordinador) |
| 2026-11-12 | **Fase 0 aprobada** (Johannes: "Sí, todas"). G1 = Q1 B · G2 = Q2 C · G3 = Q3 C · G4 = Q4 A · G5 = Q5 A · G6 = Q6 A · G7 = Q7 A · G8 = Q8 A · G9 = Q9 A · G10 = Q10 A · G11 = Q11 A · G12 = Q12 A · G13 = Q13 B (detalle en §9 del brief 03) | Johannes (vía coordinador) |
| 2026-11-12 | Fase 1, primera entrega: propuesta de la verificación del 27 % (`04-verificacion-propuesta.md`). Tabla nueva `disagreement_verifications` (no se extiende `DiscrepancyClassification`); se guarda la respuesta correcta del motivo, válida para todas las versiones. Supuestos H-18 y H-19. Esperando V1-V5 | Diseñador |
| 2026-11-12 | **V1-V5 aprobadas** (Johannes: "Apruebo"): V1 A tabla nueva con la respuesta correcta · V2 A explicación antes, marcada · V3 A los cinco segmentos · V4 A rutas propias · V5 A rol de solo lectura en esta entrega | Johannes |
| 2026-11-12 | Implementada la primera entrega: migración 0008 `disagreement_verifications`; `call_audit/verification.py`; endpoints `GET /api/admin/prompts/{v}/agreement/calls[/{caseId}]`, `PUT/DELETE /api/admin/verifications/{caseId}/{criterionId}`; rol `qubico_viewer` (lectura del admin, 403 al escribir); mosaico clicable con línea de verificación; páginas `/admin/prompts/[version]/calls` y `/calls/[caseId]`. Desvíos: el PUT devuelve solo el registro (la UI recarga el caso); la vista exige una prueba terminada de la versión (la vigente sin prueba no tiene lista). Revisado en el navegador con una copia local y una prueba sintética | Coordinador |
| 2026-11-12 | Segunda entrega, propuesta de números (`05-numeros-propuesta.md`): diagnóstico de 179/204/143 y 22/23 leído en el código (Discrepancias mide la vigente en **entrenamiento**, no todas las llamadas; 204 = 179 + dudas de la IA; 23 incluye motivos solo con dudas); reglas N-R1..N-R9; cabecera común de KPIs en Prueba, Calidad de la IA y Discrepancias; qué se quita de cada vista; Operación a Procesamiento. Supuestos H-20, H-21; riesgos R-A (medir en las mismas 220 de donde salen las reglas) y R-B. Esperando N1-N8 | Diseñador |
| 2026-11-12 | **N1-N8 aprobadas** (Johannes: "Sí, todas (A)") | Johannes |
| 2026-11-12 | Implementada la segunda entrega (números): bloque `agreement` con `approved`/`rejected`, `bridge`, `byCriterion` y `scope`; listas `fp`, `fn`, `disagree` y `?motivo=` en `/agreement/calls`; `GET /api/admin/quality` solo con la vigente y las pruebas sobre validación (sin datos por llamada ni corridas por etiqueta); `quality` en el resumen de Discrepancias. Front: `QualityHeader` en Prueba, Calidad de la IA y Discrepancias › Resumen; Calidad de la IA reducida a cabecera + mosaico + comparación + desacuerdos por motivo; Resumen con frase puente, barra y «¿En qué motivos?»; «¿Dónde se arregla?» y el % explicado pasan a Patrones; «caso» → «desacuerdo»; Operación eliminada (2 tarjetas en Procesamiento, `?tab=operation` redirige). Desvío: los patrones siguen saliendo del análisis en entrenamiento (G8 C de hecho), así que R-A no aplica y no se puso el aviso de N8. Revisado en el navegador con la copia local | Coordinador |

---

## Ajustes tras ver producción (pedido 2026-11-13)

- **Estado:** propuesta en `06-ajustes-feedback.md`, esperando F1-F5. Sin código de UI aún.
- **Origen:** feedback de Johannes sobre la segunda entrega desplegada (`73677ba`): volver al caso a caso en cuadritos; "error de planilla" → "error del revisor"; Discrepancias no cambia al elegir otro análisis; Calidad de la IA no cambia al agregar otra versión.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Se trata como cambio sobre diseño aprobado (sin repetir fases). Diagnóstico confirmado en código: el Resumen de Discrepancias usa siempre `latest_quality` (última prueba en validación) y una línea de universo fija; `latest_finished` excluye `attribution`; `decide()` rechaza `attribution_only`; Calidad de la IA usa `selected[0]` | Diseñador (con diagnóstico del coordinador) |
| 2026-11-13 | Propuesta: mapa por caso de vuelta con reglas N1-N8 (220, colores E3, duda aparte, clic al caso); "Posible error del revisor" / "Error del revisor" (verificado); Resumen sigue al análisis elegido con línea de universo real; habilitar decidir en `attribution` con aviso N8 A; versión activa en Calidad de la IA. Supuestos H-22, H-23; riesgos R-A (ahora vigente) y R-C. Esperando F1-F5 | Diseñador |
| 2026-11-13 | **F1-F5 aprobadas** (Johannes: "Sí, todas (A)") | Johannes |
| 2026-11-13 | Implementados F1-F5: `GET /api/admin/quality/grid?series=` y acordeón «Análisis por caso» (aprobadas / rechazadas por el revisor, colores E3, clic al caso y al motivo); «Posible error del revisor» / «Error del revisor» en toda la app y glosario §8.3; `latest_finished` incluye los análisis de causa y `decide()` ya no los bloquea; el Resumen y Patrones siguen al análisis elegido (`verification.quality_for_analysis`) con la línea de universo real; aviso N8 A en Patrones (análisis de causa) y en la cabecera (`sameCallRules`); control «Ver:» y botón «Ver» en la comparación de Calidad de la IA (URL `?series=…&ver=`). Desvíos: se mantuvo el parámetro `?analysis=` y `?series=` existentes en vez de `?analisis=` / `?v=`; la columna activa de «Desacuerdos por motivo» no se resalta. Revisado en el navegador con la copia local | Coordinador |

---

## Ficha del seguro en la revisión caso a caso (pedido 2026-11-13)

- **Estado:** propuesta en `07-ficha-en-caso.md`, esperando C1-C4. Sin código de UI aún.
- **Origen:** Johannes: "Aquí deberíamos tener también la información del caso y de la persona a la derecha. Igual que en la vista del auditor."
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Se trata como cambio menor sobre la pantalla aprobada en `04-verificacion-propuesta.md` (un gate). Sin backend nuevo: `getCase` ya trae `customer` y `productSheets`; el resaltado requiere cargar la pauta (`loadRubric()`) | Diseñador |
| 2026-11-13 | Propuesta: tres columnas desde `xl` + botón y panel lateral bajo `xl`; abierta al entrar y plegado que se mantiene entre casos; reutilizar `ProductSheetColumn`/`ProductSheetContent` con resaltado según el motivo en foco; visible para `qubico_viewer`. Supuestos H-24, H-25. Esperando C1-C4 | Diseñador |
| 2026-11-13 | **C1-C4 aprobadas** (Johannes: "Sí, todas (A)") | Johannes |
| 2026-11-13 | Implementada la Ficha del seguro en la revisión caso a caso (`case-review.tsx`): `ProductSheetColumn` / `ProductSheetContent` con resaltado según el motivo en foco, abierta por defecto y recordada al pasar de caso. **Desvío por H-24:** a 1280 px las tarjetas «Por verificar» quedaban en ~337 px y los botones 2x2 se partían, así que la tercera columna va desde `2xl` (1536 px), como preveía C1 B; bajo eso, botón «Ficha del seguro» con panel lateral. Revisado en el navegador a 1600 y 1280 px | Coordinador |

---

## Datos de la llamada y tipificación del ejecutivo (pedido 2026-11-13)

- **Estado:** propuesta en `09-info-llamada-y-tipificacion.md`, esperando T1-T4. Sin código de UI aún.
- **Origen:** Johannes: "Me molesta que en la revisión no tenga la información de la llamada. Aparte que debería poder ver en todos lados qué motivo tipificó el ejecutivo."
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Se trata como cambio menor sobre pantallas aprobadas (un gate). Diagnóstico: la revisión ya pide `getCase` (ejecutivo, seguros, fecha, duración disponibles sin backend); la tipificación vive en `call_metadata["typification"]` y no llega al front salvo en el panel «Modelo»; el pipeline rellena `RETENCION` sin dejar marca. La Ficha (C1-C4) está en local, sin desplegar | Diseñador |
| 2026-11-13 | Propuesta: encabezado de la revisión alineado con el del auditor (sin «Decisión del motor»); rótulo «Tipificó: {gestión} · Motivo de renuncia: {motivo}» con «(asumida)» / «no informado»; en revisión, detalle de llamada, columna en la lista por segmento y tooltip del mosaico; no en la cola; Discrepancias después (lo toca 08). Backend: marca `assumed` en `complete_row` y bloque `typification` en `case_detail`, `segment_calls` y `quality/grid`. Supuestos H-T1, H-T2; riesgo R-T1. Esperando T1-T4 | Diseñador |

---

## Resumen de Discrepancias con más información (pedido 2026-11-13)

- **Estado:** propuesta en `10-resumen-mas-informacion.md`, esperando R1-R5. Sin código de UI aún.
- **Origen:** Johannes: "Siento que ahora el Resumen de la página de Análisis de discrepancias tiene muy poca información." Pidió proponerlo junto al analista de datos; insumo en `08-resumen-insumo-analista.md` (P1-P6, valores reales de v2.15).
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Se trata como cambio sobre diseño aprobado (N-R1..N-R9, F1-F5), un gate. No se agregan gráficos: se mantienen mosaico y barra; lo nuevo son frases con cifra, base y enlace | Diseñador |
| 2026-11-13 | Propuesta: Resumen ordenado por las preguntas del analista (B1 metas en dos lecturas, B2 franja de evolución pareada, B3 confianza del azul, B5 dos columnas "Corregir en el prompt" / "Calibrar con el revisor" con concentración, crónicos, cobertura y techo, B6 tabla con selector A corregir / A calibrar / Todo). Fuente única `agreement` para cerrar el cuadre 187 vs. 203. No vuelven las tarjetas de avance, «¿Quién tiene más razón?», % explicado ni el azul por revisor. Supuestos H-R1, H-R2; riesgos R-R1 a R-R3. Esperando R1-R5 | Diseñador (con insumo del analista) |
| 2026-11-13 | **T1-T4 y R1-R5 aprobadas** (Johannes: "Sí, todas (A)") | Johannes |
| 2026-11-13 | Implementado T1-T4: `typification_out` (serializers) en el detalle de llamada, la lista por segmento y el análisis por caso; `TypificationLine` / `typificationLabel` (components/call/typification.tsx); encabezado de la revisión como el del auditor (fecha y hora, ejecutivo, seguros, duración, tipificación); `pipeline.complete_row` marca la tipificación asumida desde ahora (T4 A). | Coordinador |
| 2026-11-13 | Implementado R1-R5: `call_audit/discrepancy_insights.py` (fuente única sobre las filas del mosaico: dos columnas, cobertura por patrón, techo, crónicos, evolución con McNemar, estabilidad del azul, muestra de 30) y prueba de cuadre; Patrones usa las mismas cifras cuando el análisis es de la misma prueba y avisa los del motivo 1 aparte; metas en dos lecturas en `QualityHeader`; franja de evolución, confianza del azul, columnas «Corregir en el prompt» / «Calibrar con el revisor» y selector en «¿En qué motivos?» con «Ya estaba»; listas `changed` (`?vs=`) y muestra (`?muestra=30`). Desvíos: la muestra de 30 son las primeras 30 del orden aleatorio fijo, sin estratificar por motivo; desde una lista «changed» o la muestra, la revisión navega por la parte completa. Revisado en el navegador con la copia local (una sola prueba: sin evolución ni crónicos) | Coordinador |

---

## Ficha completa del seguro (pedido 2026-11-13)

- **Estado:** K1-K6 aprobadas (todas A) e implementadas.
- **Origen:** Johannes, en un caso SONAP con motivo 6: no encuentra en la ficha el examen preventivo que cita la IA («sangre oculta en deposiciones»); pide un botón «ver más» con un modal con el detalle total.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Se trata como cambio menor sobre la Ficha aprobada en `07-ficha-en-caso.md` (un gate); afecta también el detalle de llamada del auditor. Diagnóstico: el catálogo tiene el dato (asistencias, primas, siniestros, exclusiones, notas…), pero `product_sheet()` (`import_bench.py:155`) solo pasa nombre, categoría, prima, devolución, retracto y coberturas; la sección «Asistencias · Primas · Siniestros · Observaciones» del front es un placeholder | Diseñador (con diagnóstico del coordinador) |
| 2026-11-13 | Propuesta: bloque `detail` genérico en `product_sheet()` rotulado con `LABELS`; «Asistencias» en la columna (resaltada con motivos 2, 4, 6) en lugar del placeholder; botón «Ver ficha completa» al final y en el encabezado de la columna; `Dialog` de 880 px con índice, 9 secciones desplegadas, tablas para asistencias, primas y siniestros, y apertura en la sección relevante para el motivo en foco; sin buscador propio (Ctrl+F). Supuestos H-K1 a H-K3. Esperando K1-K6 | Diseñador |
| 2026-11-13 | Johannes aprueba K1-K6 (todas A) | Johannes |
| 2026-11-13 | Implementado: `catalog/detail.py` (`sheet_detail`, secciones rotuladas; un campo nuevo cae en «Otros datos»); `product_sheets_out` arma `detail` desde la versión del catálogo registrada en la validación (si no hay versión, la vigente del producto; sin catálogo en la base, products.json); `ProductSheetFullDialog` (components/call/product-sheet-full.tsx); «Asistencias» en la columna y botón «Ver ficha completa» al final y en el encabezado. H-K1 confirmado: las asistencias van al prompt (`render.py`); exclusiones, tasas y edades por plazo no (`NOT_IN_PROMPT`), pero se muestran igual. Desvío: en la tabla de asistencias se omite la columna «Fono» cuando repite el fono de asistencias general. Revisado en el navegador (escritorio 1600 px y teléfono 375 px) con una copia de la base local | Coordinador |

---

## Motivos de renuncia sugeridos en la revisión caso a caso (pedido 2026-11-13)

- **Estado:** S1-S4 aprobadas (todas A) e implementadas.
- **Origen:** Johannes: "Tengo una duda, porque cuando se tipifica con motivo 18, ya no me da las opciones de motivo de renuncia q podrían ser?" y luego "Sí, agrégalas".
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Se trata como cambio menor sobre la revisión caso a caso (un gate), reutilizando el bloque aprobado del auditor (`rubric-checklist.tsx:270`). Diagnóstico: los hallazgos del motivo 18 traen `suggestedReasons` (v2.8+); `case_comparison` ya los envía en `ai.suggestedReasons` (árbol de trabajo), pero falta el tipo en el front y `CriterionCard` no los pinta | Diseñador (con diagnóstico del coordinador) |
| 2026-11-13 | Propuesta: componente compartido `SuggestedReasons`; en la tarjeta, después de las citas y antes de «Comentario de la IA»; en «Por verificar» y «Coinciden con la planilla»; citas de sugerencias sin caja ámbar (gris cursiva) para no confundirlas con la evidencia; sin «Escuchar» (no hay timestamp); comillas «». Supuesto H-S1. Esperando S1-S4 | Diseñador |
| 2026-11-13 | Johannes aprueba S1-S4 (todas A) | Johannes |
| 2026-11-13 | Implementado: `case_comparison` (verification.py) envía `ai.suggestedReasons`; componente `SuggestedReasons` + `QuoteWarning` en `components/call/suggested-reasons.tsx`, usado en `rubric-checklist.tsx` (sin cambios visibles) y en `CriterionCard` de `case-review.tsx` con `plainQuotes`. Test en `test_verification.py`. Revisado en el navegador con una prueba sintética en una copia de la base local (llamada real con motivo 18 y 3 sugerencias). H-S1 queda por validar con Johannes en casos reales | Coordinador |

---

## Rol verificador y asignación de casos (pedido 2026-11-13)

- **Estado:** propuesta en `13-rol-verificador-asignacion.md`, esperando V1-V9. Sin código de UI aún.
- **Origen:** Johannes quiere 5 personas verificando en paralelo las ~1.100 llamadas de la corrida v2.15, cada una con su set asignado y con los filtros por segmento del admin.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-13 | Ya decidido: rol `qubico_verifier` («Verificador») con la vista del admin sobre la versión, mosaico, listas y revisión del caso (planilla visible), registra solo en sus llamadas; asignación por llamada en tabla nueva, estratificada por segmento; el admin ve avance y asigna/reasigna. Se trata como cambio sobre `04`/`05` (un gate) | Johannes (vía coordinador) |
| 2026-11-13 | Propuesta: repartir solo llamadas con motivos en desacuerdo sin registro, después de la corrida (V1); menú «Verificación» con filtro «Asignadas a: Mí · Todas» y tarjeta «Te quedan…» (V2-V3); no asignadas en solo lectura con aviso (V4); `Repartir llamadas` estratificado por segmento × split y `Pasar pendientes a…` (V5); tabla de avance por verificador (V6); 10 % doble, a ciegas, con lista «Desacuerdo entre verificadores» (V7, requiere un registro por verificador); split oculto al verificador (V8); cada uno corrige lo suyo (V9). Supuestos H-V1 a H-V3; riesgos R-V1 a R-V4. Esperando V1-V9 | Diseñador |
| 2026-11-13 | **Aprobado:** V1 B (se reparten las ~1.100, incluidas las de acuerdo total); V2, V3, V4, V5, V6, V8, V9 A; V7 fuera de alcance («eso veámoslo después»): sin dobles, sin % doble en `Repartir llamadas`, sin «Acuerdo en dobles», modelo de registros sin cambios | Johannes |
| 2026-11-13 | Ajuste por V1 B: llamada sin motivos en desacuerdo se cierra con `Sin observaciones` (un clic, deshacible), guardado en la tabla de asignación; «revisada» = todos los desacuerdos registrados o `Sin observaciones`. Abierto O-V1 (IA y planilla ambas equivocadas en un motivo coincidente: sin registro en esta entrega) y R-V5 | Diseñador |

---

## Corrida completa en curso en Calidad de la IA (pedido 2026-11-16)

- **Estado:** revisión rápida en `14-corrida-en-curso.md`, esperando U1-U5. Sin código de UI aún.
- **Origen:** una corrida completa (`purpose = "full"`) de v3.0 en curso no aparece en Calidad de la IA hasta terminar.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-16 | Ya decidido: «Serie parcial en curso», seleccionable, tarjetas y mosaico sobre las llamadas de validación ya terminadas, universo «87 de 220 · en curso», se actualiza al recargar. Cambio menor sobre `05`/`06` (un gate) | Johannes (vía coordinador) |
| 2026-11-16 | Propuesta: microcopy de opción, título, universo, aviso de cifras parciales y línea de avance con «Ver cifras parciales»; badge neutro «Parcial · meta ≤ X %»; Análisis por caso y listas habilitados (clic al caso solo si la página de caso acepta corrida no terminada); botón «Actualizar» + hora sin auto-refresco; mínimo 20 llamadas de validación. Supuesto H-U1 (orden de procesamiento sesgado); riesgo R-U1. Esperando U1-U5 | Diseñador |

---

## Acuerdo en motivos dentro de «Coincide con el revisor» (pedido 2026-11-16)

- **Estado:** brief en `15-acuerdo-en-motivos-brief.md`, esperando M1-M5. Sin código de UI aún.
- **Origen:** Johannes: el verde cuenta como acuerdo llamadas con el mismo veredicto aunque rechacen por motivos distintos. Quiere un gráfico nuevo, aparte, solo con las «Coincide con el revisor», partido entre las que coinciden en motivos y las de «Desacuerdo en motivo de rechazo», con otros colores. El mosaico no cambia.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-16 | Ya decidido: gráfico nuevo y aparte; mosaico sin cambios; colores distintos; es solo visualización (el análisis por motivo ya cubre estos casos). Cambio menor sobre `02`/`05` (un gate) | Johannes (vía coordinador) |
| 2026-11-16 | Brief: P-20 / O-20; tramos Ambos aprueban 307 · Mismos motivos 134 · Desacuerdo parcial 155 · Desacuerdo total 113 (v3.0, verde = 709); barra al 100 % del verde como zoom bajo el mosaico. Supuestos H-M1 (motivo dudoso de la IA no cuenta como rechazo), H-M2; riesgos R-M1 a R-M3. Esperando M1-M5 | Diseñador |
| 2026-11-16 | Johannes aprueba M1-M5 (todas A) y H-M1, H-M2 | Johannes |
| 2026-11-16 | Propuesta de detalle en `15` §8-§12: `reasonMatch` (bothPass/same/partial/none) en `call_rows`/`compute_rows`; listas `agreePass/agreeSame/agreePartial/agreeNone`; `ReasonMatchBar` entre el mosaico y «Detalle por motivo» en Prueba y Calidad de la IA; tokens `--reason-*` con contraste validado. Lista para implementar | Diseñador |

---

## Lista completa del verificador con filtro por motivo (pedido 2026-11-17)

- **Estado:** L1-L4 **aprobadas (A)** por Johannes el 2026-11-17, implementadas y desplegadas a producción el mismo día (`16-lista-verificador-por-motivo.md`).
- **Origen:** Johannes: «puedes hacer también para que en la vista del revisor, pueda ver el listado total y filtrar por motivo?» (revisor = verificador). Se necesita hoy: 4 verificadores × ~155 de las 630 divergentes de v3.0; la Weekly parte por motivos 25 y 18.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-17 | Cambio menor sobre `13` (V2, V3) y la lista de `04`/`05` (un gate). Diagnóstico: la lista completa (`calls?segment=all`) ya existe con select de motivo, pero el acceso es un link chico; `matches()` con `segment=all` + `criterion` deja fuera las dudosas de la IA; las opciones del select se reducen al filtrar y no tienen conteos; el foco en la revisión no va al motivo filtrado. P-21 / O-21 | Diseñador |
| 2026-11-17 | Propuesta: L1 reutilizar la lista con botón `Ver mis llamadas`; L2 select con conteos (`criterionCounts`) ordenado por cantidad e incluyendo dudosas; L3 no ocultar motivos en la revisión, foco inicial en el filtrado, pendiente = llamada; L4 el admin usa la misma página. Supuestos H-L1, H-L2; riesgos R-L1, R-L2. Esperando L1-L4 | Diseñador |

---

## Bandeja y revisadas del verificador (pedido 2026-11-20)

- **Estado:** W1-W6 **aprobadas (todas A)** por Johannes el 2026-11-20 e implementadas el mismo día (`18-verificador-bandeja-y-revisadas.md`). Sin desplegar.
- **Origen:** Johannes: «Ahora necesito modificar la vista de verificador, necesito que al igual que la vista de auditor, tenga un inbox con las llamadas asignadas y otra pestaña con las llamadas ya revisadas.»
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-20 | Cambio menor sobre `13` (V2, V3) y `16` (L1, L2), un gate. Diagnóstico: el verificador entra a un mosaico (página analítica bajo `/admin/...`); su lista existe a dos clics (`calls?segment=all&asignadas=me`) y mezcla pendientes y revisadas; no hay filtro «Sin observaciones», ni fecha del último registro por llamada (`decided_at` no llega al front), ni contador en el menú. P-23 / O-23 | Diseñador (con diagnóstico del coordinador) |
| 2026-11-20 | Propuesta: W1 ítems de menú `Por revisar` (inicio, contador) · `Revisadas` · `Resumen` (página actual); W2 reglas de 13 sin cambios, las a medias en Por revisar con «Avance»; W3 orden aleatorio fijo + `Seguir revisando` + criterio + búsqueda; W4 Revisadas por `lastReviewedAt` desc. con filtro Resultado (backend nuevo); W5 admin sin cambios. Supuestos H-W1, H-W2; riesgos R-W1, R-W2. Esperando W1-W5 | Diseñador |
| 2026-11-20 | Johannes responde a W1-W5: «incluye filtro por discrepancias.» No aprueba W1-W5 explícitamente | Johannes (vía coordinador) |
| 2026-11-20 | Se suma W6 (`18` §2.1): «discrepancia» tiene tres lecturas en el código (tipo por veredicto de la llamada = partes del mosaico + `reasonMatch` de `15`; lado del criterio fp/fn/duda; con/sin discrepancia). Recomendada A: select `Discrepancia:` con tipo de la llamada agrupado en 5 opciones con conteos (incluye «Sin discrepancias»), sin «Posible error del revisor» (R-V1), en Por revisar y Revisadas; backend `discrepancia=` + `discrepancyCounts` sin IA. Supuesto H-W3; riesgo R-W3. Esperando W1-W6 | Diseñador |
| 2026-11-20 | **W1-W6 aprobadas, todas A** (Johannes: «Sí, todas en A») | Johannes |
| 2026-11-20 | Implementado. Desvíos menores por la regla de identificadores en inglés: rutas `/verification` (Por revisar), `/verification/reviewed` y `/verification/summary`; parámetros de API `tray=pending\|reviewed` y `discrepancy=`; en la URL del front, `bandeja=pendientes\|revisadas` y `discrepancia=` | Coordinador |

---

## Resumen con avance y orden por columna en las bandejas (pedido 2026-11-23)

- **Estado:** X1-X5 **aprobadas (todas A)** por Johannes el 2026-11-23 e implementadas el mismo día (`19-resumen-avance-y-orden-bandejas.md`). Sin desplegar.
- **Origen:** Johannes: «En la vista resumen pongamos un grafico que sea Total, revisados, por revisar. Borra el grafico actual de acuerdo con el revisor. Tambien en la lista de por revisar y revisadas, agrega un sort por fecha, por cumple o no cumple de qubyt y de planilla. Esos sort deberian ser que apriete sobre el nombre de la columna y salga una flechita para arriba o para abajo si es ascendente o descendente.»
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-23 | Ya decidido: gráfico Total · Revisadas · Por revisar en el Resumen; se borra el mosaico del Resumen; orden por Fecha, Qubyt y Planilla en las dos bandejas, clic en el encabezado con flecha ↑/↓. Cambio menor sobre `18` (un gate). Base: `18` implementado (commit `f0aa2c6`, `develop`) | Johannes (vía coordinador) |
| 2026-11-23 | Diagnóstico: el Resumen reutiliza `VerificationView` entero (también es la pestaña del admin); sin totales de avance para `Todas` en el overview del verificador; las bandejas ordenan en el cliente y `Siguiente` sigue el orden del servidor; hay patrón de encabezado ordenable en `discrepancy-evaluators.tsx`. Propuesta: X1 tres cifras + barra apilada; X2 el gráfico reemplaza la tarjeta y respeta `Mí · Todas`; X3 mosaico fuera solo en el Resumen del verificador; X4 ciclo ↑ → ↓ → defecto, Qubyt Cumple → Dudosa → No cumple, defecto aleatorio / `Revisada el` ↓, orden en la URL; X5 `Siguiente` sigue el orden elegido (backend en `verification.py`, sin tocar `assignments.py`). Supuestos H-X1, H-X2; riesgos R-X1, R-X2. Esperando X1-X5 | Diseñador |
| 2026-11-23 | **X1-X5 aprobadas, todas A** (Johannes: «Sí, todas en A») | Johannes |
| 2026-11-23 | Implementado. API con identificadores en inglés: `sort=date\|reviewed\|ai\|reviewer\|call` y `dir=asc\|desc` (en la URL del front, `orden=fecha\|revisada\|qubyt\|planilla\|llamada`); `progress` en el overview calculado en la ruta, sin tocar `assignments.py` | Coordinador |

---

## Ver y verificar criterios en acuerdo en la revisión del caso (pedido 2026-11-23)

- **Estado:** Y1-Y5 **aprobadas (todas A)** por Johannes el 2026-11-23 e implementadas el mismo día (`20-verificar-criterios-en-acuerdo.md`). Sin desplegar.
- **Origen:** Johannes: «En la revisión, si yo aprieto coinciden con la planilla, deberia poder apretar algo sobre cada criterio para ver el motivo por el que coincide y tambien deberia poder aprobar o rechazar.» Retoma O-V1 de `13`.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-23 | Ya decidido: cada criterio en acuerdo se abre para ver por qué coincide y se puede aprobar o rechazar | Johannes (vía coordinador) |
| 2026-11-23 | Diagnóstico: `case_comparison` ya envía veredicto, citas, comentario y sugerencias de los acuerdos (solo falta pintarlos); ~25-30 acuerdos por llamada, casi todos «ambos Cumple»; `DisagreementVerification` sin versión con `correct`; bug latente: un registro de desacuerdo de otra versión se rotula «Error de Qubyt/del revisor» en un acuerdo. P-24 / O-24 | Diseñador |
| 2026-11-23 | Propuesta: Y1 misma tarjeta en acordeón, «Ambos No cumple» primero y abierto; Y2 Aprobar = ambos tienen razón, Rechazar = ambos se equivocaron; Y3 opcional (aprobado implícito); Y4 rechazo = Qubyt se equivocó + contador «Ambos se equivocaron»; Y5 un rechazo cierra la llamada sin desacuerdos, si no `Sin observaciones` como hoy. Decisión técnica: outcomes `both_right`/`both_wrong` en `DisagreementVerification`, sin migración. Supuestos H-Y1, H-Y2; riesgos R-Y1 a R-Y3. Esperando Y1-Y5 | Diseñador |
| 2026-11-23 | **Y1-Y5 aprobadas, todas A** (Johannes: «Sí, todas en A») | Johannes |
| 2026-11-23 | Implementado sin migración y sin tocar `assignments.py`: `call_status` cuenta los acuerdos rechazados, así que «revisada» sale sola | Coordinador |
