# Estado del proceso UX · "Segunda opinión Jev" en el dashboard de revisión

- **Tipo de cambio:** funcionalidad nueva acotada a una pantalla existente de una herramienta interna. No hay diseño aprobado previo en `docs/ux/` para el dashboard (la pestaña padre "Calce IA vs humano" sigue en Fase 0 sin aprobar), así que corresponde empezar en Fase 0; se propone un **proceso reducido con un solo gate** (decide Johannes, D-J1).
- **Ronda 2 (§9 de la especificación):** **APROBADA** el 2026-10-20 (D-J7: `main = "jev-1.13.0|es|blind|choice"`; D-J8: `lowConf = 0.5`). Siguiente: implementación y revisión rápida posterior.
- **Fase actual (ronda 1):** gate único **APROBADO** (2026-10-20). Especificación final en `07-especificacion.md` (Revisión §2–7, Dashboard §8). Siguiente: implementación (fuera del agente UX) y revisión rápida post-implementación contra la especificación.
- **Código afectado (futuro):** `scripts/prompt_bench/dashboard.py`, `scripts/prompt_bench/dashboard_template.html` (ambos con cambios sin commitear de otra sesión: no tocar hasta aprobar) y, fuera de la UI, `jev_review.py report`.

## Alcance del proceso propuesto (D-J1)

| Fase | Aplica | Motivo |
|---|---|---|
| 0 Brief | Sí, reducido | `00-brief.md` |
| 1 Investigación | No | Usuario único y conocido (Johannes); sin persona ni benchmark |
| 2 Ideación | No como fase | Las alternativas quedan en la crítica de la propuesta (`07-especificacion.md` §1) |
| 3 AI | No | No cambia la estructura del dashboard; solo un filtro y un bloque |
| 4 Flujos | Sí, comprimido | `07-especificacion.md` §3 |
| 5 Patrones y accesibilidad | Sí, comprimido | §4–5, reutiliza patrones existentes |
| 6 UX writing | Sí, comprimido | §6 |
| 7a Wireframe | Sí, en texto | §4.3 |
| 7b/7c Prototipo y test | No | Validación = Johannes usando la implementación con los 28 pares |
| 8 Alta fidelidad | No | Sin tokens ni componentes nuevos |

## Aprobaciones

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| Revisión post-implementación (ronda 1) | Aprobada con cambios menores | 2026-10-20 | Hallazgos M-1 a M-7; desviaciones aceptadas: nota del motivo 1 en el aviso de llamada, rescate estricto en la tarjeta, `--text-2` en filas atenuadas, borde `.jev` con `--axis` (verificar 3:1) |
| Ronda 2 · Choice, confianza y pregunta enviada (§9) | Aprobado | 2026-10-20 | D-J7 (a) y D-J8 (a) |
| Revisión post-implementación (ronda 2) | Aprobada con cambios menores | 2026-10-20 | Hallazgos N-1 a N-5 (menores). Desviaciones aceptadas: respuestas sí/no (`true`/`false`) visibles en "Ver la pregunta enviada"; verbo al inicio de la línea de acierto; tabla de probabilidades en `.wrap` con scroll; estado de `<details>` y variante de la pregunta conservados al re-renderizar; `low_conf` en vez de `lowConf` |
| Alcance reducido + 0 + 4–7a | Aprobado | 2026-10-20 | Johannes aprobó D-J1 a D-J5 (todas las recomendadas) y amplió el alcance con D-J6 (tarjeta en Dashboard), especificada en §8 dentro del mismo gate |

## Decisiones tomadas

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-10-20 | No escribir código en esta invocación; artefactos en `docs/ux/calce-ia-vs-humano/jev-segunda-opinion/` | Agente principal |
| 2026-10-20 | D-J1 a D-J5: todas las recomendadas (ver `07-especificacion.md` §0) | Johannes (vía agente principal) |
| 2026-10-20 | H-J6 confirmada: llamada 230188 (Excel APROBADA, manual RECHAZADA por otro motivo); Jev acertó al revertir el 16. Caso de prueba de la implementación | Johannes (vía agente principal) |
| 2026-10-20 | D-J7: variante principal Jev 1.13 · español · ciego · opciones (reemplaza a D-J2). D-J8: "decisión poco segura" si confianza < 50 % | Johannes (vía agente principal) |
| 2026-10-20 | Ronda 2: confianza por decisión volviendo a correr con Choice; pregunta enviada visible dentro del dashboard, plegable por motivo | Johannes (vía agente principal) |
| 2026-10-20 | Ronda 2 (diseño): opciones al frente y sí/no plegado; sí/no muestra solo p (sin max(p, 1−p)); probabilidades por opción plegables; `state` no se muestra, solo se describe (§9.1) | Diseñador |
| 2026-10-20 | D-J6: resumen de Jev también en la pestaña Dashboard de "Revisión capa 2 · llamadas reales" (solo v2.8, fuente Gemini 3.8 Flash) | Johannes (vía agente principal) |
