---
paths:
  - "src/call_audit/layers/**"
  - "src/call_audit/decision/**"
  - "src/call_audit/contract/**"
---

# Contrato común de capas

Toda capa implementa la interfaz `Layer` y devuelve exactamente este esquema (modelo Pydantic en `src/call_audit/contract/`):

```json
{
  "layer": "layer2_llm",
  "layer_version": "0.3.0",
  "rubric_id": "bancoestado_retention",
  "rubric_version": "1.2.0",
  "model": "claude-haiku-4-5",
  "prompt_version": "2.1.0",
  "call_id": "…",
  "verdict": "compliant | non_compliant | uncertain | not_applicable",
  "confidence": 0.0,
  "items": [
    {
      "criterion_id": "M31",
      "verdict": "compliant | non_compliant | uncertain | not_applicable",
      "confidence": 0.0,
      "evidence": [
        { "channel": "agent | customer", "quote": "texto literal", "start_ms": 0, "end_ms": 0 }
      ],
      "comment": "…"
    }
  ],
  "cost_usd": 0.0,
  "latency_ms": 0
}
```

Equivalencia con el dominio: `compliant` = cumple, `non_compliant` = no cumple / incumple, `uncertain` = dudosa / indeterminado, `not_applicable` = no aplica.

## Reglas

- Las capas son **independientes**: no leen el resultado de otra capa. Solo el motor de decisión las combina.
- Una capa que falla devuelve un resultado con error explícito; nunca un `compliant` por defecto.
- Las capas deterministas (`layer1`) usan `model: null`, `prompt_version: null` y `confidence` 1.0 o según el score de fuzzy.
- Cambiar el esquema es un cambio de contrato: requiere ADR, subir la versión del contrato y migración de datos.

## Motor de decisión

- **Sin IA, sin llamadas de red.** Función pura: `(layer_results, rubric) -> decision`.
- Toda regla de combinación y todo umbral sale de la rúbrica, no del código.
- Ante desacuerdo entre capas o confianza bajo umbral → `uncertain`.
- La comparación de tipificación (motivos 18–25) se hace acá, en código: el LLM solo extrae lo que pasó en la grabación.
- Cobertura de tests exhaustiva: cada regla de decisión de la rúbrica tiene un test.
