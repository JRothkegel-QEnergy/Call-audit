---
paths:
  - "src/auditoria/capas/**"
  - "src/auditoria/decision/**"
  - "src/auditoria/contrato/**"
---

# Contrato común de capas

Toda capa implementa la interfaz `Capa` y devuelve exactamente este esquema (modelo Pydantic en `src/auditoria/contrato/`):

```json
{
  "capa": "capa2_llm",
  "version_capa": "0.3.0",
  "rubrica_id": "retencion_bancoestado",
  "rubrica_version": "1.2.0",
  "modelo": "claude-haiku-4-5",
  "prompt_version": "2.1.0",
  "llamada_id": "…",
  "veredicto": "cumple | no_cumple | dudosa | no_aplica",
  "confianza": 0.0,
  "items": [
    {
      "criterio_id": "M31",
      "veredicto": "cumple | no_cumple | dudosa | no_aplica",
      "confianza": 0.0,
      "evidencia": [
        { "canal": "agente | cliente", "cita": "texto literal", "inicio_ms": 0, "fin_ms": 0 }
      ],
      "comentario": "…"
    }
  ],
  "costo_usd": 0.0,
  "latencia_ms": 0
}
```

## Reglas

- Las capas son **independientes**: no leen el resultado de otra capa. Solo el motor de decisión las combina.
- Una capa que falla devuelve un resultado con error explícito; nunca un `cumple` por defecto.
- Las capas deterministas (`capa1`) usan `modelo: null`, `prompt_version: null` y `confianza` 1.0 o según el score de fuzzy.
- Cambiar el esquema es un cambio de contrato: requiere ADR, subir la versión del contrato y migración de datos.

## Motor de decisión

- **Sin IA, sin llamadas de red.** Función pura: `(resultados_capas, rubrica) -> decision`.
- Toda regla de combinación y todo umbral sale de la rúbrica, no del código.
- Ante desacuerdo entre capas o confianza bajo umbral → `dudosa`.
- Cobertura de tests exhaustiva: cada regla de decisión de la rúbrica tiene un test.
