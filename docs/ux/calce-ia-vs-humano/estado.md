# Estado del proceso UX · Pestaña "Calce IA vs humano"

- **Estado:** **cerrado, absorbido por el Cambio 15 de call-audit** (D-52, 2026-11-02). La Fase 0 no se aprobó; sus decisiones del 2026-10-20 se reutilizan en `../call-audit/15-calce-ia-por-corrida.md`. El dashboard local se mantiene sin más diseño.
- **2026-11-02:** el Cambio 15 de call-audit (`../call-audit/15-calce-ia-por-corrida.md`) propone **absorber** este proceso en la vista del admin (P1). Además, el brief quedó desactualizado: el dashboard ya lee la marca de la corredora por criterio (C01..C33, `client_bad()`), así que R-02/R-03 ya no aplican tal cual. No avanzar aquí hasta que Johannes responda P1.
- **Ubicación:** `call-audit-rcv/docs/ux/calce-ia-vs-humano/`
- **Código afectado (futuro):** `scripts/prompt_bench/dashboard.py`, `scripts/prompt_bench/dashboard_template.html`.

## Aprobaciones

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| 0 · Brief | Cerrado sin aprobar (absorbido) | 2026-11-02 | D-52 de call-audit |

## Decisiones tomadas

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-10-20 | Ranking principal a nivel de llamada; tabla por criterio solo con falsas alarmas sobre aprobadas; rechazadas solo descriptivas; mapa de errores con rechazadas en color neutro | Usuario (vía agente principal) |
| 2026-10-20 | Nombres reales de modelo y color fijo por modelo | Usuario (vía agente principal) |
| 2026-10-20 | La pestaña declara qué no se mide (detección por criterio) y queda preparada para sumarlo | Usuario (vía agente principal) |
| 2026-10-20 | Preferir reordenar/reemplazar secciones que se solapan antes que duplicarlas | Usuario (vía agente principal) |
