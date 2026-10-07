---
paths:
  - "rubricas/**"
---

# Rúbricas

- Una rúbrica por protocolo, en YAML: `rubricas/<protocolo>/v<MAJOR>.<MINOR>.<PATCH>.yaml`. Las versiones publicadas son inmutables: para cambiar algo se crea una versión nueva.
- Cada criterio define: `id` (p. ej. `M31`), `bloque`, `descripcion`, `tipo` (`compliance_duro` | `calidad_subjetiva`), `gravedad`, `capas` que lo evalúan (`capa1`, `capa2`, ...) y `regla_decision`.
- Los IDs de motivo respetan la numeración del cliente (1–33). No renumerar.
- **No inventar datos del cliente.** Gravedad, guiones de cierre/acreditación, umbrales de espera y seguros retenibles van como `PENDIENTE` hasta que el cliente los confirme (ver `docs/pendientes-cliente.md`).
- Frases obligatorias o prohibidas de capa 1 viven en la rúbrica, no en el código.
- Toda versión nueva se valida contra el golden set antes de publicarse y el reporte de métricas queda junto a la rúbrica.
