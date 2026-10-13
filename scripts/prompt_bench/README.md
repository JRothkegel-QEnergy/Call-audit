# Prompt bench · comparar IA con el prompt de la capa 2

Prueba el prompt de `docs/layer2-prompt-example.md` con distintas IA sobre las llamadas sintéticas de `tests/fixtures/calls/` y compara los resultados.

## 0. Armar el catálogo de seguros (una vez, o cuando cambie el Excel de apoyo)

```bash
pip install pyxlsb
python scripts/prompt_bench/extract_catalog.py "<ruta>/Apoyo nuevo v1.xlsb"
```

Deja `data/catalog/products.json` (fuera del repo, por ser material del cliente): categoría, tipo de prima, ficha y medios de pago de cada seguro.

## 1. Generar los prompts

```bash
python scripts/prompt_bench/render.py
```

En `prompts/` quedan:

- `system.txt`: el system prompt (igual para todas las llamadas). Incluye el esquema JSON para responder sin herramientas.
- `synth_NN.txt`: el mensaje de usuario de cada llamada.
- `synth_NN_full.txt`: los dos juntos, para chats que no tienen campo de system prompt.

## 2. Correr las IA

### Automático (recomendado): `run.py`

1. Instala los SDKs: `pip install -r scripts/prompt_bench/requirements.txt`
2. Completa las keys en `.env` (ver `.env.example`). Los proveedores sin key se saltan.
3. Completa el `model` de cada proveedor en `models.toml`. Para ver los IDs disponibles:
   `python scripts/prompt_bench/run.py --list-models gemini` (o `openai`, `openrouter`, `groq`, `ollama`, `anthropic`).
4. Corre: `python scripts/prompt_bench/run.py`. Opciones: `--models a,b`, `--calls synth_01,synth_02`, `--force`.

Junto a cada respuesta guarda `synth_NN.meta.json` con el **modelo que devolvió la API** (no el que dice la IA), tokens, costo y latencia. Si algo falla queda `synth_NN.error.txt` y sigue con lo demás.

### Manual (chats)

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
- Umbral de espera: 30 s (nota del cliente en el motivo 1).
- Las fichas salen del Excel de apoyo. Algunos seguros no tienen ficha (no retenibles, no renunciables, SONAP): la IA recibe "No disponible".
- Las transcripciones no están anonimizadas (son datos inventados). En producción, el texto se anonimiza antes del LLM.
- Corridas anteriores en `archive/` (cada una con su `report.md`). Las de v1.x usan las 11 llamadas antiguas y otro esquema: no son directamente comparables con v2.0.
