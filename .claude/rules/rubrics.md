---
paths:
  - "rubrics/**"
---

# Rúbricas

- Una rúbrica por protocolo, en YAML: `rubrics/<protocol>/v<MAJOR>.<MINOR>.<PATCH>.yaml`. Las versiones publicadas son inmutables: para cambiar algo se crea una versión nueva.
- Claves en inglés. Cada criterio define: `id` (p. ej. `M31`), `block`, `description`, `type` (`hard_compliance` | `subjective_quality`), `severity`, `layers` que lo evalúan (`layer1`, `layer2`, ...) y `decision_rule`.
- Los valores del dominio (descripción del motivo, motivos de renuncia, frases del guion) se mantienen en español, tal como los define el cliente.
- Los IDs de motivo respetan la numeración del cliente (1–33). No renumerar.
- **No inventar datos del cliente.** Gravedad, guiones de cierre/acreditación, umbrales de espera y seguros retenibles van como `TBD` hasta que el cliente los confirme (ver `docs/client-open-questions.md`).
- Frases obligatorias o prohibidas de capa 1 viven en la rúbrica, no en el código.
- Toda versión nueva se valida contra el golden set antes de publicarse y el reporte de métricas queda junto a la rúbrica.
- Referencia del dominio: `docs/layer2-prompt-example.md` tiene los 33 motivos con su gravedad sugerida (no confirmada) y los 27 motivos de renuncia.
