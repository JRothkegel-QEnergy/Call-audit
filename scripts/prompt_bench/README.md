# Prompt bench · comparar IA con el prompt de la capa 2

Prueba el prompt de `docs/layer2-prompt-example.md` con distintas IA sobre las llamadas sintéticas de `tests/fixtures/calls/` y compara los resultados.

## 1. Generar los prompts

```bash
python scripts/prompt_bench/render.py
```

En `prompts/` quedan:

- `system.txt`: el system prompt (igual para todas las llamadas). Incluye el esquema JSON para responder sin herramientas.
- `synth_NN.txt`: el mensaje de usuario de cada llamada.
- `synth_NN_full.txt`: los dos juntos, para chats que no tienen campo de system prompt.

## 2. Correr cada IA

- **Con API o playground** (Anthropic Console, OpenAI Playground, Google AI Studio): `system.txt` en el system prompt y `synth_NN.txt` como mensaje.
- **En un chat normal** (ChatGPT, Gemini, Claude.ai): pega `synth_NN_full.txt` en una **conversación nueva por llamada**, para que no se contaminen entre sí.
- Usa temperatura 0 cuando se pueda y anota el modelo exacto que usaste.

Guarda la respuesta tal cual en `results/<nombre-ia>/synth_NN.json`, por ejemplo `results/gpt-x/synth_03.json` (se toleran bloques ```json y texto alrededor).

## 3. Comparar

```bash
python scripts/prompt_bench/compare.py
```

Deja `results/report.md` con:

- precisión y recall por motivo;
- falsos positivos y falsos negativos a nivel de llamada;
- aciertos en el resultado de cada gestión y en el número de objeciones;
- una grilla por llamada con lo que marcó cada IA, al lado de lo esperado.

## Ojo

- Los esperados los definimos nosotros, no auditores del cliente: esto mide **consistencia entre IA**, no precisión real. Eso lo da el golden set.
- El umbral de espera (120 s) es un ejemplo; el real es TBD.
- Solo hay ficha de producto para Desempleo. Para el resto se le indica a la IA que no la tiene.
- Las transcripciones no están anonimizadas (son datos inventados). En producción, el texto se anonimiza antes del LLM.
