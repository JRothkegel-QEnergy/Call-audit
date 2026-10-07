---
paths:
  - "src/call_audit/layers/**"
  - "src/call_audit/llm/**"
  - "src/call_audit/asr/**"
  - "prompts/**"
---

# LLM y ASR

- **Adaptadores**: todo proveedor va detrás de `Transcriber` o `Layer`. El proveedor y el modelo se eligen por configuración; el resto del código no importa SDKs de proveedores.
- **Prompts versionados** en `prompts/` con versión semántica. El `prompt_version` viaja en cada resultado. El prompt de referencia de la capa 2 está en `docs/layer2-prompt-example.md`.
- **Salida estructurada**: se fuerza JSON con tool use (`tool_choice`) y se valida con Pydantic. Si no valida, el resultado es `uncertain`; no se reintenta en silencio indefinidamente.
- **Validación de citas**: toda cita del LLM se busca en la transcripción (match exacto normalizado o fuzzy con umbral configurable). Si no aparece, el ítem pasa a `uncertain`.
- **Batches**: el volumen va por Message Batches API. La rúbrica va en `system` con `cache_control`. Solo lo urgente usa la API síncrona.
- **Costo y latencia** se registran por llamada y por lote. Alertas si el costo por llamada se desvía del esperado.
- **No escribir precios ni IDs de modelo de memoria**: verifica la documentación vigente antes de fijarlos en código o docs.
- Temperatura 0 (o la mínima que permita el modelo) para evaluación.
