# 12 · Motivos de renuncia sugeridos en la revisión caso a caso (pedido 2026-11-13)

Tipo: ajuste acotado a una pantalla ya aprobada e implementada (revisión caso a caso, `04-verificacion-propuesta.md` y ajustes posteriores). Reutiliza un patrón ya aprobado del detalle de llamada del auditor. Un solo gate (S1-S4). Sin código de UI hasta aprobar.

## 1. Pedido

Johannes: "Tengo una duda, porque cuando se tipifica con motivo 18, ya no me da las opciones de motivo de renuncia q podrían ser?" y luego "Sí, agrégalas".

Pantalla: `/admin/prompts/[version]/calls/[caseId]` (`case-review.tsx`, `CriterionCard`).

## 2. Lo que hay hoy (leído en el código)

| Capa | Estado |
|---|---|
| Hallazgo (`import_bench.py:277`) | Motivo 18 que no cumple guarda `suggestedReasons: [{reason, quote, quoteValidated}]` (≥3 desde v2.10, sin timestamp) |
| Auditor (`rubric-checklist.tsx:270`) | Bloque «Motivos de renuncia que sugiere la IA»: lista numerada, motivo en negrita, cita con `.quote` (caja ámbar), `QuoteWarning` si no se validó. Aprobado e implementado |
| `case_comparison` (`verification.py:343`) | **Ya envía** `ai.suggestedReasons` (cambio presente en el árbol de trabajo). Falta el campo en el tipo `CaseComparisonCriterion` del front |
| `CriterionCard` | Muestra veredicto, citas (`.quote`, comillas «», «Escuchar desde mm:ss») y «Comentario de la IA». Las sugerencias no se pintan |

Problema (P-S1): el revisor que decide «¿Quién tenía razón?» en el motivo 18 no ve qué motivo cree la IA que correspondía, que es justamente el argumento del «No cumple».

## 3. Propuesta

- **Componente compartido**: extraer el bloque del auditor a `SuggestedReasons` (en `components/call/`) y usarlo en ambas vistas, para que no diverjan. `QuoteWarning` se exporta junto.
- **Ubicación en la tarjeta**: después de las citas de evidencia y antes de «Comentario de la IA». Orden de lectura: veredicto → cita del error → qué motivo correspondía → por qué.
- **Rótulo**: «Motivos de renuncia que sugiere la IA» (mismo texto del auditor; glosario sin cambios).
- **Diferenciar de la evidencia**: las citas de la evidencia y las de las sugerencias usarían la misma caja ámbar y podrían leerse como más evidencia. Para separarlas: las citas de las sugerencias van **sin caja**, en texto gris en cursiva, con sangría bajo el motivo (la lista numerada ya las agrupa). La caja ámbar queda reservada para la evidencia del veredicto, que es la que se escucha. En el auditor se mantiene igual que hoy (ahí el bloque va solo, no compite con otras citas), salvo que se elija S3 B.
- **Comillas**: en la tarjeta del admin, «» como el resto de la tarjeta.
- **Sin «Escuchar»**: las sugerencias no traen timestamp. No se inventa uno ni se busca la cita en la transcripción en esta entrega.
- **Cuándo aparece**: solo si `suggestedReasons` no está vacío (motivo 18, IA «No cumple», prompt v2.8+). En pruebas anteriores a v2.8 no aparece nada (sin texto vacío: la ausencia es normal).
- **Pestañas**: en «Por verificar» y en «Coinciden con la planilla» (mismo componente; en «Coinciden» sirve para confirmar que el motivo sugerido calza con lo que dice el revisor).

Trazabilidad: P-S1 → R-14..R-18 (verificar con evidencia), O-04 (revisar caso a caso).

## 4. Revisión rápida

| Revisión | Resultado |
|---|---|
| Patrones | Reutiliza el bloque aprobado del auditor; sin patrón nuevo |
| Navegación y atajos | Sin cambios |
| Accesibilidad | Lista `<ol>` real; rótulo como texto visible; `QuoteWarning` con icono + texto (no solo color); contraste del gris de la cita ≥ 4.5:1 (usar `text-muted-foreground`, ya validado) |
| Microcopy | Sin textos nuevos salvo reutilizar «Motivos de renuncia que sugiere la IA» y el aviso de cita no validada |
| Densidad | +3 a 5 líneas por sugerencia solo en el motivo 18; aceptable |

## 5. Supuestos

- **H-S1 [SUPUESTO]**: quitar la caja ámbar a las citas de sugerencias basta para que no se confundan con la evidencia. Se valida mirando 2-3 casos reales con Johannes.

## 6. Decisiones (S1-S4)

| ID | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| S1 | Ubicación en la tarjeta | **A** después de las citas, antes de «Comentario de la IA» · B después del comentario · C plegado en un `<details>` «Ver motivos sugeridos» | **A** |
| S2 | En qué pestañas | **A** «Por verificar» y «Coinciden con la planilla» · B solo «Por verificar» | **A** |
| S3 | Estilo de las citas de sugerencias | **A** sin caja (gris cursiva, sangría) en la tarjeta del admin; el auditor queda igual · B igual en ambas vistas (sin caja también en el auditor) · C caja ámbar como hoy en el auditor | **A** |
| S4 | Implementación | **A** componente compartido `SuggestedReasons` con prop de estilo de cita, + `suggestedReasons` en `CaseComparisonCriterion` · B copiar el bloque en `case-review.tsx` | **A** |

Esperando aprobación de S1-S4.
