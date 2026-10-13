# Comparación de IA · prompt capa 2

- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.
- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).
- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.
- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.

## Resumen por IA

| IA | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Motivo de renuncia | Objeciones correctas | Orden de argumentos | Latencia prom. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | claude-haiku-4-5-20251001 | 13/13 | 70% | 88% | 0/1 | 0/11 | 14/14 | 14/14 | 8/14 | 2/2 | 33.1 s |
| claude-haiku-5-5 | claude-haiku-5-5 | 12/13 | 88% | 92% | 0/1 | 0/10 | 11/12 | 12/12 | 10/12 | 2/2 | 34.5 s |
| claude-sonnet-5-5 | claude-sonnet-5-5 | 13/13 | 96% | 88% | 0/1 | 0/11 | 14/14 | 14/14 | 11/14 | 2/2 | 16.1 s |
| gemini-3-5-flash-lite | gemini-3.5-flash-lite | 13/13 | 91% | 77% | 0/1 | 1/11 | 14/14 | 14/14 | 13/14 | 2/2 | 7.0 s |
| or-deepseek-v4-1-flash | deepseek/deepseek-v4.1-flash | 13/13 | 88% | 88% | 0/1 | 0/11 | 14/14 | 14/14 | 12/14 | 2/2 | 48.0 s |
| or-gemini-3-8-flash | google/gemini-3.8-flash | 13/13 | 96% | 92% | 0/1 | 0/11 | 14/14 | 14/14 | 12/14 | 2/2 | 47.9 s |
| or-gpt-5-4-mini | openai/gpt-5.4-mini | 13/13 | 50% | 12% | 0/1 | 6/11 | 14/14 | 14/14 | 8/14 | 2/2 | 11.3 s |
| or-gpt-6-luna | openai/gpt-6-luna | 13/13 | 88% | 85% | 0/1 | 0/11 | 14/14 | 14/14 | 10/14 | 2/2 | 43.0 s |
| or-llama-4-maverick | meta-llama/llama-4-maverick | 12/13 | 43% | 65% | 0/1 | 1/10 | 12/13 | 11/13 | 6/13 | 1/2 | 396.9 s |
| or-mistral-small-2603 | mistralai/mistral-small-2603 | 7/13 | 61% | 73% | 0/0 | 1/6 | 7/7 | 6/7 | 3/7 | 0/0 | 18.5 s |
| or-qwen3-8-flash | qwen/qwen3.8-flash | 10/13 | 82% | 78% | 0/0 | 0/9 | 9/10 | 9/10 | 8/10 | 1/1 | 211.0 s |

## Costos por IA

Calculado con los tokens reales de cada respuesta y los precios de `models.toml`. La proyección usa 100.000 llamadas al mes y el costo promedio por llamada de estas pruebas. Ojo: estas llamadas duran ~2 min y las reales más de 10 (ver Notas).

| IA | Precio input / output (USD por M tokens) | Tokens prom. por llamada (in / out) | Costo por llamada USD | Costo de las 13 pruebas USD | Mensual USD | Mensual con batch (-50 %) USD |
|---|---|---|---|---|---|---|
| claude-haiku-4-5 | 1,00 / 5,00 | 9.371 / 3.987 | 0,0245 | 0,319 | 2.450 | 1.225 |
| claude-haiku-5-5 | 0,10 / 0,50 | 11.778 / 8.929 | 0,0050 | 0,065 | 502 | 251 |
| claude-sonnet-5-5 | 2,00 / 10,00 | 12.295 / 3.043 | 0,0425 | 0,553 | 4.250 | 2.125 |
| gemini-3-5-flash-lite | 0,30 / 2,50 | 8.414 / 2.334 | 0,0084 | 0,109 | 836 | 418 |
| or-deepseek-v4-1-flash | 0,30 / 1,20 | 8.246 / 9.521 | 0,0139 | 0,181 | 1.390 | 695 |
| or-gemini-3-8-flash | 0,75 / 3,75 | 7.634 / 7.427 | 0,0336 | 0,436 | 3.358 | 1.679 |
| or-gpt-5-4-mini | 0,75 / 4,50 | 7.771 / 3.134 | 0,0199 | 0,259 | 1.993 | 997 |
| or-gpt-6-luna | 0,10 / 0,50 | 7.306 / 5.666 | 0,0036 | 0,046 | 356 | 178 |
| or-llama-4-maverick | 0,19 / 0,65 | 8.398 / 2.760 | 0,0034 | 0,044 | 339 | 169 |
| or-mistral-small-2603 | 0,15 / 0,60 | 7.542 / 3.256 | 0,0031 | 0,040 | 309 | 154 |
| or-qwen3-8-flash | 0,15 / 0,47 | 7.425 / 16.936 | 0,0091 | 0,118 | 907 | 454 |

## Llamadas con error

- **claude-haiku-5-5**: RuntimeError: stop_reason=max_tokens en 1 llamada(s): synth_09
- **or-mistral-small-2603**: RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': 429, 'metadata': {'raw': 'mis en 6 llamada(s): synth_01, synth_04, synth_06, synth_09, synth_10, synth_13
- **or-qwen3-8-flash**: RuntimeError: finish_reason=length (respuesta cortada) en 1 llamada(s): synth_09

## Detalle por llamada

| Llamada | Esperado | claude-haiku-4-5 | claude-haiku-5-5 | claude-sonnet-5-5 | gemini-3-5-flash-lite | or-deepseek-v4-1-flash | or-gemini-3-8-flash | or-gpt-5-4-mini | or-gpt-6-luna | or-llama-4-maverick | or-mistral-small-2603 | or-qwen3-8-flash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| synth-01 · Retención exitosa, llamada modelo | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | (sin respuesta) | respuesta inválida: la respuesta no trae una auditoría con 'criterios' (¿devolvió el esquema?) |
| synth-02 · Exceso de objeciones y cierre sin N° de seguro | incumple: 3, 13 | incumple: 3, 13, 29 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: — | incumple: 3, 13 | incumple: 13 | incumple: 3, 5 | incumple: 3, 13 |
| synth-03 · Llamada corta sin intento de retención | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 4, 14 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 33 · indet.: 28 | incumple: 4, 14, 33 | incumple: 4, 5, 6, 14 · indet.: 28 | incumple: 4, 9, 14 | incumple: 20, 33 |
| synth-04 · Información errónea del producto y tipificación incorrecta | incumple: 6, 18 | incumple: 2, 18 | incumple: 6, 18 | incumple: 6, 18 | incumple: 2, 18 | incumple: 6, 18 | incumple: 6, 18 | incumple: — | incumple: 6, 18 | incumple: 18 | (sin respuesta) | incumple: 6, 18 |
| synth-05 · Información entregada a un tercero | incumple: 27 | incumple: 14 · indet.: 27 | incumple: 14, 27 | incumple: 14, 27 | incumple: — | incumple: 14, 27 | incumple: 14, 27 | incumple: — | incumple: 14, 27 | incumple: — | incumple: — | incumple: 14, 27 |
| synth-06 · Retención sin intención de renuncia y pregunta predispuesta | incumple: 8, 16, 32 · inciertos: 6, 13, 15, 25, 29 | incumple: 4, 6, 8, 16, 29, 32 | incumple: 4, 6, 13, 15, 16, 29, 30, 32 | incumple: 6, 8, 16, 32 | incumple: 16, 32 | incumple: 4, 6, 13, 15, 16, 29, 32 · indet.: 18, 19, 20, 21, 22, 23, 24, 25 | incumple: 6, 8, 16, 32 | incumple: 13, 29 | incumple: 6, 13, 15, 16, 29, 30, 32 | incumple: 4, 13, 14, 15, 16, 29, 32 · indet.: 18, 19, 20, 21, 22, 23, 24, 25 | (sin respuesta) | incumple: 6, 13, 15, 16, 29, 30, 32 |
| synth-07 · Llamada larga con esperas excesivas y descalificación de la competencia | incumple: 1, 11 | incumple: 1, 10, 11 | incumple: 1, 11 | incumple: 1, 11 | incumple: 1 | incumple: 1, 11 | incumple: 1, 11 | incumple: — | incumple: 1, 11 | incumple: 1, 11, 12 | incumple: 1, 11 | incumple: 1, 11 |
| synth-08 · Inducción a la renuncia y negación de devolución de prima | incumple: 4, 6, 8, 12, 14, 28 · inciertos: 18 | incumple: 4, 6, 8, 12, 14, 26, 28 | incumple: 4, 6, 12, 14, 28 | incumple: 4, 6, 12, 28 | incumple: 4, 6, 8, 12, 14, 28 | incumple: 4, 6, 12, 28 | incumple: 4, 6, 12, 14, 28 | incumple: — | incumple: 4, 6, 12, 28 | respuesta inválida: la respuesta no trae una auditoría con 'criterios' (¿devolvió el esquema?) | incumple: 2, 4, 5, 6, 12, 14, 16, 28 | incumple: 4, 6, 12, 28 |
| synth-09 · Dos seguros: gestiona y tipifica solo uno | incumple: 25, 26 · inciertos: 13, 15, 29 | incumple: 13, 15, 25, 29, 30 · indet.: 28 | (sin respuesta) | incumple: 13, 15, 25, 29 | incumple: 25, 29 | incumple: 13, 15, 25, 26, 29, 30 | incumple: 13, 15, 25, 29 | incumple: 13, 14, 15 | incumple: 3, 13, 15, 25, 29 | incumple: 13, 15, 18, 25, 29 · indet.: 28 | (sin respuesta) | (sin respuesta) |
| synth-10 · Renuncia de un seguro no renunciable | incumple: 7, 9 · inciertos: 4 | incumple: 7, 9 | incumple: 4, 7, 9 | incumple: 7, 9 | incumple: 7, 9 | incumple: 4, 7, 9 | incumple: 4, 7, 9 | incumple: 7, 14, 15 · indet.: 28 | incumple: 4, 7, 9 · indet.: 2 | incumple: 7, 9, 18, 19, 24 | (sin respuesta) | incumple: 7, 9 |
| synth-11 · Llamada cortada con audio ininteligible | incumple: — · inciertos: 13, 15, 26, 29 | incumple: 13, 15, 19, 29 | incumple: 29 · indet.: 13, 15, 26 | incumple: — · indet.: 26 | incumple: — | incumple: 13, 15, 29 | incumple: — | incumple: — · indet.: 13, 15, 25, 29 | incumple: 26 | incumple: 5, 29 · indet.: 26 | incumple: — | incumple: 13, 15, 18, 26, 29 |
| synth-12 · Retiene un seguro no retenible | incumple: 17 · inciertos: 6, 8 | incumple: 9, 17 · indet.: 2, 28 | incumple: 8, 17 · indet.: 2, 6 | incumple: 8, 17 · indet.: 2, 6 | incumple: 17 | incumple: 17 | incumple: 17 | incumple: — · indet.: 28 | incumple: 6, 17 · indet.: 2 | incumple: 9, 14, 16, 17, 26, 32 · indet.: 2, 28 | incumple: 9, 17, 29 | respuesta inválida: la respuesta no trae una auditoría con 'criterios' (¿devolvió el esquema?) |
| synth-13 · Tipifica renuncia cuando fue retención y limita la permanencia | incumple: 5, 19 | incumple: 5, 19, 24 | incumple: 5, 19 | incumple: 5, 19 | incumple: 5, 19, 24 | incumple: 5, 19 | incumple: 5, 19 | incumple: 5 | incumple: 5, 19 | incumple: 19, 24, 32 | (sin respuesta) | incumple: 5, 19 |

Ojo: los esperados los definimos nosotros, no auditores del cliente. Esto mide consistencia entre IA, no precisión real.

## Notas

**Errores por plan gratuito.** Un 429 con "quota" o "credits" significa que se acabó la cuota del plan gratuito o el crédito
de la cuenta: no se arregla reintentando (hay que esperar que se renueve o pasar a un plan pagado). Un 503 ("high demand")
o un 413/429 por tokens por minuto son temporales: `run.py` los reintenta solo y basta con volver a correrlo.

**Cómo leer los costos.**
- **Duración de las llamadas:** las sintéticas duran en promedio ~2 minutos (entre 1 y 7), mientras que las reales
  duran más de 10. La transcripción real es unas 5 veces más larga, así que el input por llamada va a ser bastante
  mayor (el system prompt, de ~5.000 tokens, es fijo; la ficha del seguro suma entre 0 y ~4.000 tokens según el
  producto) y el output probablemente también, por las citas y comentarios.
  Los costos de esta tabla subestiman el costo por llamada real.
- **Volumen:** la proyección usa 100.000 llamadas al mes, que sale de ~400.000 minutos con llamadas de ~4 min. Si las
  llamadas duran más de 10 minutos, esos mismos minutos son ~40.000 llamadas: menos llamadas, pero más caras cada una.
- En producción el system prompt se cachea (en Claude, la lectura de caché cuesta el 10 % del input), lo que baja el costo.
- Los modelos con razonamiento (Haiku 5.5, Gemini 3.8 Flash, gpt-oss) cobran el razonamiento como output. Bajar el
  esfuerzo (`effort`) o pedir comentario solo para los motivos que incumplen o quedan dudosos reduce el output.
- `docs/context.md` estimaba ~225 USD/mes para la capa 2 con Haiku 4.5 en batch. Con tokens reales la cifra es varias
  veces mayor: la estimación subestimaba el output (cada auditoría de 33 motivos genera miles de tokens).
- El descuento de batch (-50 %) aplica a Anthropic, Gemini y OpenAI. En Groq no está confirmado.

**Fuentes de precios (al 2026-10-08).** Anthropic: referencia oficial de la API. Gemini, OpenAI y Groq: agregadores de
precios, no las páginas oficiales; confirmar antes de presupuestar. Gemini 3.8 Flash tiene precio introductorio hasta el
2026-12-31 y desde 2027 sube a 1,50 / 7,50.
- Gemini 3.5 Flash-Lite: https://www.eesel.ai/blog/gemini-3-5-flash-lite-pricing · https://openrouter.ai/google/gemini-3.5-flash-lite
- Gemini 3.8 Flash: https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/ · https://www.mindstudio.ai/blog/gemini-3-8-flash-pricing
- gpt-oss-120b (Groq): https://pricepertoken.com/pricing-page/model/openai-gpt-oss-120b · https://www.cloudzero.com/blog/groq-pricing/
- GPT-6 Luna: https://venturebeat.com/technology/openai-releases-gpt-6-sol-and-luna-models-slashing-api-costs-50-or-more · https://openrouter.ai/openai/gpt-6-luna
- GPT-5.4 mini: https://pricepertoken.com/pricing-page/model/openai-gpt-5.4-mini
