# Estado del proceso UX · Métricas de la prueba del prompt

- **Estado:** aprobado e implementado el 2026-11-10 (falta desplegar a prod).
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

- **Estado:** Fase 0 **aprobada** el 2026-11-12 (G1-G13). Primera entrega (verificación del 27 %, `04-verificacion-propuesta.md`) **aprobada (V1-V5) e implementada** el 2026-11-12, sin commitear ni desplegar. Segunda entrega (G6-G12) pendiente.
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
