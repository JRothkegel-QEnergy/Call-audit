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

---

## Ajustes a la vista del verificador: columnas, filtros, estados, colores y logo (pedido 2026-11-23)

- **Estado (antes de aprobar):** revisión rápida en `21-ajustes-vista-verificador.md`, esperando Z1-Z5. Sin código aún. Base: `18`/`19`/`20` implementados (commit `3e92c2d`, `develop`).
- **Origen (Johannes, textual; «qubit» = Qubyt):** «En la vista del verificador necesitamos hacer los siguientes cambios. En el listado por revisar, sacar la columna de número, cambiar el nombre de la columna llamada por ID llamada, cambiar la columna fecha por fecha de llamada, cambiar la columna qubit por veredicto qubit, luego agregar una columna que diga criterios rechazados por qubit, y en vez de que los criterios salgan como M1, M2 o hasta el M33, debería ser C1, C2, ya que cambiamos la palabra motivo por criterio, entonces ya no debería llamarse M. Eso también cambiarlo en el prompt. Luego, la columna planilla, cambiarla por veredicto revisor. Y finalmente en la columna avance, dejar los siguientes estados. Por revisar en vez de sin comenzar o sin empezar. Luego revisado, que eso pasa directamente a la lista de revisadas. Y lo que dice 1 de 2 criterios, 3 de 4 criterios, etcétera, está bien. Pero sacar los avances que dicen sin desacuerdos o por confirmar, eso sacarlo. Luego, los filtros. Está bien dejar el filtro por ID de llamada, que es el buscador. Luego en discrepancias, sacar el filtro de discrepancias. Dejar el filtro de criterios, pero llamarlo que sea, vamos a tener que sea filtro de criterios rechazados por qubit. Luego vamos a tener otro filtro que va a ser veredicto qubit, que puede ser cumple o no cumple. Y veredicto revisor, que también debería ser cumple o no cumple. En la llamada vamos a cambiar en la tarjeta que dice llamada, número, y sale el nombre del ejecutivo, sale toda la información. Borrar el versión 3.1 o la versión que se haya corrido de la IA, borrarla. Cambiar la palabra IA, por ejemplo, donde dice IA v3.1, cambiarlo por qubit. Y ahí debería ser qubit cumple, qubit no cumple. El evaluador de la planilla debería, su nombre, estar en camel case y sin el punto como separador, sino que un espacio. Entonces, por ejemplo, Valeria.salinas debería salir como Valeria, con la B corta en mayúscula, espacio, Salinas con S mayúscula. Estado de la llamada, cambiarlo por estado de revisión de la llamada, y acá en vez de pendiente también mantengamos un lenguaje homogéneo, entonces va a ser por revisar, o va a decir el porcentaje de criterios ya revisados. O más que el porcentaje, el número de criterios revisados. Tiene que ser concordante con el estado de avance que vamos a mostrar en las columnas de por revisar. Luego, en la tarjeta de los criterios, donde muestra la razón por qué fue rechazado, etcétera, donde dicen quién tenía razón, cambiar donde dice error de la IA, dejarlo como error de qubit, después error del revisor, ambiguo o falta de información. Está bien. Cambiar en toda la paleta de colores de los batch el rojo intenso por un rojo más pastel. Luego, en el listado de revisadas, eliminar también el filtro de discrepancias, cambiar los filtros por tener ID de llamada, que es el que está actualmente. Luego, los criterios de discrepancia. Luego, el veredicto qubit, veredicto revisor. Y esos van a ser cumple o no cumple. En avance va a ser... No hay avance acá. Perdón. Las columnas se van a llamar ID de llamada, fecha llamada, veredicto qubit, veredicto revisor. Criterios rechazados por qubit, en donde vamos a tener solo los criterios que fueron rechazados por qubit. No vamos a tener los criterios que también fueron rechazados por el revisor. Esto tiene que ser lo mismo para el listado de por revisar. Y en esta parte quiero que cambiemos el color del batch de estos criterios por un color rojo, porque son, para que se note que son criterios rechazados. Una vez que fueron revisados, si fue rechazado ponle una X y si fue aprobado ponle un ticket Luego, eliminar la columna de resultado. Agregar una columna que sea revisado por, y en esa columna debe ir el nombre del revisor. Luego debemos agregar, cambiar la columna revisada él por fecha de revisión. Evitar en todas las vistas de la aplicación los batch con línea punteada y cambiarla por una línea sólida. y evitar los colores fuertes y cambiarlos por colores más pastel. Tambien agranda el logo de qubyt tanto en la vista del login como en la de las llamadas. En el login quiero que lo agrandes a 80x80 px y la letra del logo a 80x100. Luego en el navbar lateral, cambialo a 45x105 px»
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-23 | Ya decidido: columnas, nombres, `C` en vez de `M`, estados de Avance, filtros (sin Discrepancia; Criterios rechazados por Qubyt, Veredicto Qubyt, Veredicto revisor), sin versión ni «IA» en la tarjeta, formato del nombre del evaluador, «Estado de revisión de la llamada», badges pastel y sin bordes punteados en toda la app, logo más grande. Cambio menor sobre `18`/`19`/`20` (un gate) | Johannes (vía coordinador) |
| 2026-11-23 | Diagnóstico: el prompt de capa 2 no usa «M» sino «motivo N» (42 veces; cambiarlo = versión nueva + prueba pagada); el logo es una sola imagen ~5:1 y las medidas pedidas no calzan; «Criterios rechazados por Qubyt» literal (solo `fp`) deja fuera de la lista criterios por revisar (`fn`, dudosos); «revisor» en la app es el evaluador de la planilla. Cruce con el Cambio 21 (sin commitear): ya cubre «IA» → «Qubyt» y «Error de Qubyt»; falta borrar la línea de versión; conflicto: `globals.css` agrega rojo lleno en el botón No cumple | Diseñador |
| 2026-11-23 | Propuesta: Z1 columna literal + otros criterios por revisar en gris, mismo filtro en las dos listas; Z2 ✓ = Qubyt tenía razón, ✗ = Qubyt se equivocó, ? = ambiguo/falta información; Z3 «Revisado por» = evaluador de la planilla (columna `Revisor`); Z4 ahora solo la app, el prompt de capa 2 en su próxima versión; Z5 separar cubo y logotipo. Backend: filtro `fp` en criterio, filtros de veredicto en `segment_calls`/`case_comparison`, `evaluator` por llamada. Supuesto H-Z1; riesgos R-Z1 a R-Z3. Esperando Z1-Z5 | Diseñador |
| 2026-11-23 | **Z1-Z5 aprobadas, todas A** (Johannes: «Sí, todas en A»). Aclaró además que «Veredicto revisor» es la columna «Planilla» con otro nombre | Johannes |
| 2026-11-23 | Implementado sobre `develop` (con la marca del Cambio 21). Z5 resuelto con los logos nuevos de Qubyt sin deformar: login cubo 80×80 + logotipo 100×80; menú 106×44; colapsado 44×44. API: `rejected`, `ai_verdict`, `reviewer_verdict` y `evaluator`; URL del front `motivo`, `qubyt`, `revisor` | Coordinador |

---

## Resumen del verificador: tarjetas, barra contenida y métricas por criterio (pedido 2026-11-23)

- **Estado:** AA1-AA5 **aprobadas** el 2026-11-23 (ver §0 de `22-resumen-tarjetas-y-metricas-por-criterio.md`). Listo para implementar.
- **Origen (Johannes):** tarjetas para Total/Revisadas/Por revisar, gráfico menos desparramado, % aprobado/rechazado por criterio y totales (% aprobados, % no aprobados, total evaluados).
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-23 | Ya decidido: tarjetas KPI, gráfico contenido, métricas por criterio y totales. Cambio menor sobre `19` (un gate) | Johannes (vía coordinador) |
| 2026-11-23 | Diagnóstico: sin ancho máximo (P-30), cifras sin contenedor (P-31), overview sin conteos por criterio. Propuesta: contenedor ~1040 px, 3+3 tarjetas KPI, barra de 10 px con leyenda, tabla por criterio con mini barra ordenada por % rechazado. AA1 aprobado = Qubyt tenía razón; AA2 evaluados = todos los criterios de capa 2 de llamadas revisadas (acuerdo sin marcar = aprobado); AA3 «Sin definir» cuenta como no aprobado; AA4 sigue `Mí · Todas`; AA5 tabla. Supuestos H-AA1 a H-AA3; riesgos R-AA1, R-AA2. Esperando AA1-AA5 | Diseñador |
| 2026-11-23 | **Aprobado:** métricas = veredicto de Qubyt por criterio de capa 2 (`Cumple` / `No cumple`; sin «aprobado/rechazado»); evaluado = criterio que Qubyt evaluó en las llamadas del alcance (revisadas o no), `uncertain` excluido; sin «Sin definir» ni «pocos datos»; AA4 A (sigue `Mí · Todas`, sin respuesta → recomendada); AA5 A (tabla ordenada por % No cumple ↓) | Johannes (vía coordinador) |

---

## Módulo de calibración: de verificador a calibrador (pedido 2026-11-24)

- **Estado:** AB1-AB5 **aprobadas** el 2026-11-24 (§0 y §5 de `23-modulo-de-calibracion.md`). Listo para implementar. Base: `18`-`22` implementados (`develop`, `15b814e`).
- **Origen (Johannes, textual):** ver `23` (encabezado). Resumen: «Módulo de calibración», usuarios calibradores con leyenda; sin la empresa; listas Por calibrar / Calibradas; columna «Criterios rechazados» con azul (Qubyt), amarillo (revisor), verde (los dos); ✗ al rechazar y sacar al aprobar; Avance «Por calibrar»; columna con el nombre del revisor; en el caso sin «Asignada a: ti», «Veredicto revisor» y «Revisor: <nombre>»; tarjetas con «Veredicto de calibración» Cumple / No cumple (No cumple rojo pastel), se queda la nota; en los acuerdos, Cumple / No cumple.
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-24 | Ya decidido lo listado en `23` §1. Cambio menor sobre `18`-`22` (un gate) | Johannes (vía coordinador) |
| 2026-11-24 | Diagnóstico: la empresa es la línea «Empresa: …» de `AdminHeader`; «Revisor» (evaluador de la planilla) hoy solo en Revisadas; el veredicto de calibración se traduce a los `outcome` actuales sin migración (= revisor → `ai_error`/`both_right`; ≠ → `reviewer_error`/`both_wrong`); los acuerdos en que los dos rechazan no llegan a la lista (backend nuevo en `segment_calls`). Propuesta: AB1 «Módulo de calibración» en el menú + leyenda; AB2 renombrar todo lo visible sin cambiar rutas ni rol interno; AB3 azul/amarillo/verde + gris para Qubyt en duda; AB4 ✗ si No cumple, fuera si Cumple; AB5 se conservan los Ambiguo/Falta información viejos. Supuestos H-AB1, H-AB2; riesgos R-AB1 a R-AB3. Esperando AB1-AB5 | Diseñador |
| 2026-11-24 | **Aprobado:** AB1 «Módulo de calibración» en el menú, sin leyenda aún; AB2 A; AB3 azul/amarillo/verde pastel con leyenda de colores, sin «Qubyt en duda» (`undecided` con revisor No cumple → amarillo; con revisor Cumple → fuera de la columna); AB4 A; AB5 `ambiguous`/`missing_info` se leen como No cumple, sin migración (Johannes: «AB1: no pongas leyenta aún. AB2: A. AB3: No pongas eso de qubyt en duda, no queremos dar la sensación de que qubyt se equivoca. AB4: A. AB5: Si dice ambiguo o falta información, ponlo como no cumple.») | Johannes (vía coordinador) |
| 2026-11-24 | Decisión del diseñador: el `undecided` con revisor Cumple sigue obligatorio y cuenta en el Avance; en el caso se muestra sin línea de Qubyt (R-AB4). Especificación en `23` §5 | Diseñador |
| 2026-11-24 | Implementado en `feature/modulo-calibracion`. Ajuste aprobado: la llamada sigue en Por calibrar hasta calibrar todos sus criterios (un «Qubyt se equivocó» ya no la cierra) | Johannes / Coordinador |

---

## Asignar una cantidad de llamadas a un calibrador (pedido 2026-11-24)

- **Estado:** AD1-AD4 **aprobadas** (todas A) el 2026-11-24. Especificación en `24` §6. Listo para implementar. Base: `23` en `develop` (`d9136eb`), rama `feature/asignar-cantidad-calibrador`.
- **Origen (Johannes, textual):** «voy a necesitar que desde administrador pueda asignar a un calibrador la cantidad de casos que quiera.»
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-24 | Cambio menor sobre `13`/`23` (un gate) | Johannes (vía coordinador) |
| 2026-11-24 | Diagnóstico: `plan()` reparte todo lo sin asignar, sin tope por persona (P-AC1); los estratos se recorren en secuencia, así que «las N primeras» serían casi todas `promptFn` → hace falta corte proporcional por segmento × set (P-AC2); no hay devolución parcial a Sin asignar (P-AC3). Propuesta: AC1 campo por calibrador en «Repartir llamadas»; AC2 proporcional en orden fijo; AC3 validar y bloquear; AC4 «Devolver pendientes…» solo sin empezar. Supuesto H-AC1 (cantidad = adicional); riesgos R-AC1, R-AC2. Esperando AC1-AC4 | Diseñador |
| 2026-11-24 | AC1-AC4 no aprobadas. Aclaración (Johannes, textual): «la idea es que pueda asignar todas las llamadas a alguien si quiero, o repartirlas en varios o volver a asignar a otra persona llamadas ya asignadas.» | Johannes (vía coordinador) |
| 2026-11-24 | Reformulado: hoy U1 ya existe (repartir con un solo calibrador), U2 sin cantidad, U3 solo «todas las pendientes» o de a una desde el caso. Propuesta: un solo diálogo «Asignar llamadas» (Desde → A quién → cuántas) que reemplaza Repartir y Pasar pendientes; endpoint `/verification/assign`. Esperando AD1-AD4 | Diseñador |
| 2026-11-24 | **AD1-AD4 aprobadas, todas A** (Johannes: «Sí, todas en A»): un diálogo «Asignar llamadas» que reemplaza Repartir y Pasar pendientes; solo pendientes; cantidad o todas, proporcional por segmento × set; bloquear si pide más. H-AD1 confirmado (la cantidad se suma) | Johannes (vía coordinador) |
| 2026-11-24 | Especificación de implementación en `24` §6 (endpoint `/verification/assign`, `plan_assign`/`assign`, bitácora `verification_assigned_bulk`, `AssignDialog` con textos y estados) | Diseñador |

---

## Veredictos de Qubyt y del revisor en la misma línea en las tarjetas de criterio (pedido 2026-11-24)

- **Estado:** cambio menor (un gate) sobre `23`; especificado en `23` §6. Sin preguntas abiertas: listo para implementar. Sin código aún.
- **Origen (Johannes, textual):** «en la vista del calibrador, en las tarjetas de los criterios pon el resultado del veredicto de qubyt y el del revisor a la misma altura y en vez de decir Veredicto revisor, que salga el nombre del revisor y si cumple o no cumple.»
- **Legal:** omitido por instrucción de Johannes.

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-24 | Ya decidido: veredictos a la misma altura; el nombre del revisor reemplaza «Veredicto revisor» en las tarjetas de criterio | Johannes (vía coordinador) |
| 2026-11-24 | Resuelto por el diseñador sobre la propuesta del coordinador: AE1 una línea `Qubyt: <badge>` · `<Nombre>: <badge>` al inicio de la tarjeta, se borra la línea final; AE2 sin evaluador → `Revisor: <badge>`; AE3 `undecided` → solo la parte del revisor. La cabecera de la llamada no cambia. Riesgo R-AE1 (nombre largo hace wrap) | Diseñador |
| 2026-11-24 | AE4 (mismo gate). Johannes, textual: «Necesito también que borres la parte de la explicación de qubyt, no se debería mostrar eso.» Se quitan de `CriterionCard` el bloque «Según Qubyt…» / «Qubyt no agrupó este desacuerdo en un patrón», el aviso «Explicación de Qubyt: se muestra al calibrar… Mostrar explicación ahora» y el sufijo «· con la explicación a la vista»; `seenFirst` siempre `false`. Sin conflicto con decisiones previas | Johannes (vía coordinador) |
| 2026-11-24 | AE5 (mismo gate, vista Resumen, detalle en `22`). Johannes, textual: «finalmente en la vista resumen, la columna evaluados cámbiala por total y ponla al final.» Columnas: Criterio · Cumple · No cumple · [barra] · Total (derecha, ordenable, después de la barra). Mismo dato que «Evaluados» (AA2). Sin conflicto | Johannes (vía coordinador) |
| 2026-11-24 | AE6 (mismo gate, detalle en `22`). Johannes, textual: «aquí agrega el nombre del calibrador en vez de poner Mí» Selector «Asignadas a: [<nombre> \| Todas]» con `personName` del usuario logueado, fallback «Mí»; en el Resumen y, por coherencia (decisión del diseñador), en `verification-view.tsx` rama `isVerifier`. Sin conflicto | Johannes (vía coordinador) / Diseñador |
| 2026-11-24 | AE7-AE10 (mismo gate, detalle en `22`). Johannes, textual: «Abajo del logo de qubyt poner -> "Auditoria inteligente de llamadas" en el navbar. Cambiar iconos del navbar por iconos que hagan más sentido con por calibrar, y calibradas. (quizás invertir los iconos) renombrar tabla de la página resumen que se llama "Por criterio" a "Ranking de criterios según tasa de no cumplimiento" Borrar los atajos de teclado y las preferencias. Deshabilitar los atajos para todas las vistas.» Resuelto: AE7 «Auditoría inteligente de llamadas»; AE8 `ClipboardList` / `ClipboardCheck`; AE9 título nuevo y se borra el subtítulo; AE10 sin menú de atajos ni Preferencias ni `/settings`, todos los atajos fuera (`SHORTCUTS_ENABLED=false`, incl. flechas del audio), `welcome-card` eliminada, se mantiene el teclado nativo; audio 1,5x por defecto. Sin conflicto | Johannes (vía coordinador) / Diseñador |
| 2026-11-24 | AE11-AE23 (detalle en `23` §7). Aprobados por el diseñador AE11-AE21 y AE23 (`qubico_verifier` sin migración; admin ve «Supervisor 2», el usuario «Supervisor»; «Veredicto final» = No cumple si algún criterio queda No cumple tras la calibración o por acuerdo; logo quieto con reduced-motion). **Abierta AE22** (calibración compartida A vs independiente B; recomendación A). Riesgos R-AE2, R-AE3 | Johannes (vía coordinador) / Diseñador |
| 2026-11-24 | AE22 cerrada con la recomendación A (sin respuesta de Johannes; supuesto H-AE1): calibración compartida, un registro por criterio editable por cualquiera de los asignados, «Calibrado por <nombre>», «Asignadas a» con una opción por compañero, asignación a varios destinatarios | Coordinador / Diseñador |
| 2026-11-24 | AE24. Johannes, textual: «dame la opción de borrar usuarios en admin para poder después crearlos de nuevo con otro rol». Aprobado: «Eliminar» con confirmación (texto en `23` §7), soft delete, correo libre, sesiones cerradas, pendientes a Sin asignar (o al otro asignado si estaba compartida), sin eliminarse a sí mismo ni al último admin, registro en la bitácora | Johannes (vía coordinador) / Diseñador |
