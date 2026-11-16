# Estado del proceso UX · Leer el prompt

- **Pedido:** 2026-11-15. Johannes quiere leer el prompt (YAML) de forma ordenada desde el detalle de la versión, también en la vigente.
- **Tipo:** cambio menor (una pestaña nueva en una pantalla interna de admin). Proceso comprimido: brief, propuesta y wireframe en un solo gate.
- **Fase actual:** propuesta aprobada e implementada (2026-11-15).
- **Código afectado (una vez aprobado):** `frontend/src/app/(app)/admin/prompts/[version]/prompt-version.tsx` (pestaña), nuevo `frontend/src/components/admin/prompt-reader.tsx` y, posiblemente, el endpoint de detalle para que entregue el YAML parseado.

## Aprobaciones

| Paso | Estado | Fecha | Notas |
|---|---|---|---|
| Propuesta (00) | Aprobada | 2026-11-15 | L1-L5 con las opciones recomendadas |

## Decisiones tomadas

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-11-15 | Sin revisión legal (pantalla interna; indicación vigente de Johannes) | Johannes (memoria) |
| 2026-11-15 | L1: «Leer» por defecto en la vigente, «Diferencias» en las demás · L2: «Criterio Qubico» · L3: badge «Cambió en vX», sin filtro · L4: historial plegado con «Expandir historiales» · L5: sin buscador en v1 | Johannes |
| 2026-11-15 | El endpoint de detalle entrega `spec` (yaml ya leído, `prompt_registry.reader`); el front no parsea YAML | Dev |
