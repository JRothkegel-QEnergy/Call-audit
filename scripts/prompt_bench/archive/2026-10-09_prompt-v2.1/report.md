# Comparación de IA · prompt capa 2

- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.
- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).
- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.
- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.
- **Precisión** = TP / (TP + FP): de los motivos que la IA marcó `incumple`, qué % era correcto. 100 % − precisión = falsas alarmas.
- **Recall** (sensibilidad) = TP / (TP + FN): de los incumplimientos reales, qué % encontró la IA. 100 % − recall = incumplimientos que se le escapan.

## Resumen por IA

| IA | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Motivo de renuncia | Objeciones correctas | Orden de argumentos | Latencia prom. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | claude-haiku-4-5-20251001 | 13/13 | 63% | 85% | 0/1 | 0/11 | 14/14 | 14/14 | 8/14 | 1/2 | 35.0 s |
| claude-haiku-5-5 | claude-haiku-5-5 | 13/13 | 88% | 88% | 0/1 | 0/11 | 13/14 | 14/14 | 12/14 | 2/2 | 43.1 s |
| claude-sonnet-5-5 | claude-sonnet-5-5 | 13/13 | 100% | 85% | 0/1 | 0/11 | 14/14 | 14/14 | 12/14 | 2/2 | 17.2 s |
| gemini-3-5-flash-lite | gemini-3.5-flash-lite | 13/13 | 88% | 81% | 0/1 | 1/11 | 14/14 | 14/14 | 9/14 | 1/2 | 6.2 s |
| or-deepseek-v4-1-flash | deepseek/deepseek-v4.1-flash | 13/13 | 96% | 92% | 0/1 | 0/11 | 14/14 | 14/14 | 13/14 | 2/2 | 50.0 s |
| or-gemini-3-8-flash | google/gemini-3.8-flash | 13/13 | 100% | 88% | 0/1 | 0/11 | 14/14 | 14/14 | 13/14 | 2/2 | 37.7 s |
| or-gpt-5-4-mini | openai/gpt-5.4-mini | 13/13 | 100% | 12% | 0/1 | 6/11 | 13/14 | 12/14 | 7/14 | 2/2 | 15.5 s |
| or-gpt-6-luna | openai/gpt-6-luna | 13/13 | 79% | 88% | 0/1 | 0/11 | 14/14 | 14/14 | 11/14 | 2/2 | 42.1 s |
| or-llama-4-maverick | meta-llama/llama-4-maverick | 13/13 | 37% | 50% | 1/1 | 3/11 | 14/14 | 13/14 | 10/14 | 1/2 | 160.0 s |
| or-mistral-small-2603 | mistralai/mistral-small-2603 | 5/13 | 56% | 62% | 0/1 | 0/4 | 5/5 | 5/5 | 2/5 | 2/2 | 18.4 s |
| or-qwen3-8-flash | qwen/qwen3.8-flash | 12/13 | 87% | 83% | 0/1 | 0/10 | 13/13 | 11/13 | 11/13 | 1/1 | 322.4 s |

## Detalle de precisión

Cómo leerla: la meta del proyecto es **hasta 5 % de falsos positivos y hasta 20 % de falsos negativos** (`docs/context.md`).
A nivel de motivo, eso equivale a **precisión ≥ 95 %** (falsas alarmas ≤ 5 %) y **recall ≥ 80 %** (omisiones ≤ 20 %).
La precisión es la que más pesa en costo operativo: cada falsa alarma es una llamada que un auditor revisa sin necesidad.
El recall pesa en riesgo: cada omisión es un incumplimiento real que no llega a revisión.
**F1** resume ambas en un número (media armónica); sirve para ordenar, pero la decisión se toma con la meta.
**Indeterminados** van a revisión humana: no son error, pero cuestan horas de auditor. "Sin motivo" = indeterminados en motivos que no se esperaban ni como inciertos.
Ojo con el tamaño: hay 26 incumplimientos esperados en 13 llamadas; un solo motivo de diferencia mueve la precisión o el recall en ~4 puntos.

| IA | TP | FP | FN | Precisión | Falsas alarmas | Recall | Omisiones | F1 | Indeterminados | Cumple meta |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | 22 | 13 | 4 | 63% | 37% | 85% | 15% | 72% | 11 (9 sin motivo) | no |
| claude-haiku-5-5 | 23 | 3 | 3 | 88% | 12% | 88% | 12% | 88% | 7 (3 sin motivo) | no |
| claude-sonnet-5-5 | 22 | 0 | 4 | 100% | 0% | 85% | 15% | 92% | 3 (1 sin motivo) | sí |
| gemini-3-5-flash-lite | 21 | 3 | 5 | 88% | 12% | 81% | 19% | 84% | 0 (0 sin motivo) | no |
| or-deepseek-v4-1-flash | 24 | 1 | 2 | 96% | 4% | 92% | 8% | 94% | 4 (0 sin motivo) | sí |
| or-gemini-3-8-flash | 23 | 0 | 3 | 100% | 0% | 88% | 12% | 94% | 0 (0 sin motivo) | sí |
| or-gpt-5-4-mini | 3 | 0 | 23 | 100% | 0% | 12% | 88% | 21% | 9 (4 sin motivo) | no |
| or-gpt-6-luna | 23 | 6 | 3 | 79% | 21% | 88% | 12% | 84% | 2 (1 sin motivo) | no |
| or-llama-4-maverick | 13 | 22 | 13 | 37% | 63% | 50% | 50% | 43% | 10 (5 sin motivo) | no |
| or-mistral-small-2603 | 5 | 4 | 3 | 56% | 44% | 62% | 38% | 59% | 0 (0 sin motivo) | no |
| or-qwen3-8-flash | 20 | 3 | 4 | 87% | 13% | 83% | 17% | 85% | 1 (1 sin motivo) | no |

## Costos por IA

Calculado con los tokens reales de cada respuesta y los precios de `models.toml`. La proyección usa 100.000 llamadas al mes y el costo promedio por llamada de estas pruebas. Ojo: estas llamadas duran ~2 min y las reales más de 10 (ver Notas).

| IA | Precio input / output (USD por M tokens) | Tokens prom. por llamada (in / out) | Costo por llamada USD | Costo de las 13 pruebas USD | Mensual USD | Mensual con batch (-50 %) USD |
|---|---|---|---|---|---|---|
| claude-haiku-4-5 | 1,00 / 5,00 | 10.655 / 3.924 | 0,0245 | 0,318 | 2.447 | 1.223 |
| claude-haiku-5-5 | 0,10 / 0,50 | 13.929 / 11.095 | 0,0062 | 0,080 | 619 | 309 |
| claude-sonnet-5-5 | 2,00 / 10,00 | 13.929 / 3.054 | 0,0433 | 0,563 | 4.332 | 2.166 |
| gemini-3-5-flash-lite | 0,30 / 2,50 | 9.501 / 2.025 | 0,0079 | 0,103 | 791 | 396 |
| or-deepseek-v4-1-flash | 0,30 / 1,20 | 9.403 / 9.829 | 0,0146 | 0,190 | 1.462 | 731 |
| or-gemini-3-8-flash | 0,75 / 3,75 | 8.721 / 6.364 | 0,0304 | 0,395 | 3.041 | 1.520 |
| or-gpt-5-4-mini | 0,75 / 4,50 | 8.809 / 3.142 | 0,0207 | 0,270 | 2.074 | 1.037 |
| or-gpt-6-luna | 0,10 / 0,50 | 8.344 / 6.096 | 0,0039 | 0,050 | 388 | 194 |
| or-llama-4-maverick | 0,19 / 0,65 | 9.280 / 2.653 | 0,0035 | 0,045 | 349 | 174 |
| or-mistral-small-2603 | 0,15 / 0,60 | 8.919 / 3.274 | 0,0033 | 0,043 | 330 | 165 |
| or-qwen3-8-flash | 0,15 / 0,47 | 8.984 / 21.073 | 0,0113 | 0,146 | 1.125 | 563 |

## Llamadas con error

- **or-mistral-small-2603**: RateLimitError: Error code: 429 - {'error': {'message': 'Provider returned error', 'code': 429, 'metadata': {'raw': 'mis en 8 llamada(s): synth_02, synth_03, synth_05, synth_06, synth_08, synth_09, synth_11, synth_12
- **or-qwen3-8-flash**: RuntimeError: finish_reason=length (respuesta cortada) en 1 llamada(s): synth_13

## Detalle por llamada

| Llamada | Esperado | claude-haiku-4-5 | claude-haiku-5-5 | claude-sonnet-5-5 | gemini-3-5-flash-lite | or-deepseek-v4-1-flash | or-gemini-3-8-flash | or-gpt-5-4-mini | or-gpt-6-luna | or-llama-4-maverick | or-mistral-small-2603 | or-qwen3-8-flash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| synth-01 · Retención exitosa, llamada modelo | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: 16 | incumple: — | incumple: — |
| synth-02 · Exceso de objeciones y cierre sin N° de seguro | incumple: 3, 13 | incumple: 3, 13, 29 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: — | incumple: 3, 13, 29 | incumple: — | (sin respuesta) | incumple: 3, 13, 28 |
| synth-03 · Llamada corta sin intento de retención | incumple: 4, 14, 33 | incumple: 4, 14, 29 · indet.: 33 | incumple: 4, 14, 33 · indet.: 28 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: — · indet.: 28, 33 | incumple: 4, 14, 29, 33 | incumple: 4, 6, 14 · indet.: 33 | (sin respuesta) | incumple: 4, 14, 33 · indet.: 28 |
| synth-04 · Información errónea del producto y tipificación incorrecta | incumple: 6, 18 | incumple: 2, 18 | incumple: 6, 18 | incumple: 6, 18 | incumple: 18 | incumple: 6, 18 | incumple: 6, 18 | incumple: — | incumple: 6, 18 | incumple: — | incumple: 4, 14 | incumple: 6, 18 |
| synth-05 · Información entregada a un tercero | incumple: 27 · inciertos: 14 | incumple: 14, 27, 29 | incumple: 27, 31 | incumple: 14, 27 | incumple: — | incumple: 27 | incumple: 27 | incumple: — | incumple: 14, 27 | incumple: — | (sin respuesta) | incumple: 14, 27 |
| synth-06 · Retención sin intención de renuncia y pregunta predispuesta | incumple: 8, 16, 32 · inciertos: 6, 13, 15, 25, 29 | incumple: 16, 32 · indet.: 18, 19, 20, 21, 22, 23, 24, 25 | incumple: 4, 6, 13, 15, 16, 29, 32 · indet.: 31 | incumple: 6, 16, 32 | incumple: 16, 25, 32 | incumple: 6, 8, 13, 15, 16, 29, 30, 32 | incumple: 6, 16, 32 | incumple: 6 | incumple: 6, 8, 13, 15, 16, 29, 30, 32 | incumple: 18 | (sin respuesta) | incumple: 6, 13, 15, 16, 25, 29, 30, 32 |
| synth-07 · Llamada larga con esperas excesivas y descalificación de la competencia | incumple: 1, 11 | incumple: 1, 10, 11, 29 | incumple: 1, 11 | incumple: 1, 11 | incumple: 11 | incumple: 1, 11 | incumple: 1, 11 | incumple: — | incumple: 1, 11 | incumple: 1, 2, 6, 9, 10, 11, 14 | incumple: 1, 11, 28, 29 | incumple: 1, 11 |
| synth-08 · Inducción a la renuncia y negación de devolución de prima | incumple: 4, 6, 8, 12, 14, 28 · inciertos: 18 | incumple: 4, 6, 8, 12, 14, 28, 29, 32 | incumple: 4, 6, 12, 14, 28 | incumple: 4, 6, 12, 28 | incumple: 4, 6, 12, 14, 16, 28 | incumple: 4, 6, 12, 14, 28 | incumple: 4, 6, 12, 14, 28 | incumple: 8 · indet.: 6 | incumple: 4, 6, 12, 28, 29 | incumple: 2, 4, 5, 6, 12, 14, 28, 29 | (sin respuesta) | incumple: 4, 6, 12, 14, 28 |
| synth-09 · Dos seguros: gestiona y tipifica solo uno | incumple: 25, 26 · inciertos: 13, 15, 29 | incumple: 13, 15, 22, 25, 29 · indet.: 28 | incumple: 26, 29 | incumple: 13, 15, 25 | incumple: 25, 26, 29 | incumple: 13, 15, 25, 29 | incumple: 25, 29 | incumple: 13, 15, 29 | incumple: 13, 15, 25, 29 | incumple: 4, 13, 15, 18, 19, 25 · indet.: 28 | (sin respuesta) | incumple: 25, 29 |
| synth-10 · Renuncia de un seguro no renunciable | incumple: 7, 9 · inciertos: 4 | incumple: 7, 9, 19, 29 · indet.: 2 | incumple: 4, 7, 9 | incumple: 4, 7, 9 | incumple: 7, 9 | incumple: 4, 7, 9 | incumple: 4, 7, 9 | incumple: 9 · indet.: 28 | incumple: 4, 7, 9 | incumple: 9, 18 · indet.: 2, 7 | incumple: 4, 7, 9 | incumple: 9 |
| synth-11 · Llamada cortada con audio ininteligible | incumple: — · inciertos: 13, 15, 26, 29 | incumple: 19, 29 | incumple: — · indet.: 13, 15, 26, 29 | incumple: — · indet.: 26 | incumple: 19, 29 | incumple: — · indet.: 13, 15, 26, 29 | incumple: — | incumple: 29 · indet.: 13, 15, 25, 26 | incumple: 26 · indet.: 29 | incumple: 3, 32 · indet.: 13, 15, 28, 29, 30 | (sin respuesta) | incumple: 13, 15, 18, 26, 29 |
| synth-12 · Retiene un seguro no retenible | incumple: 17 · inciertos: 6, 8 | incumple: 17 | incumple: 6, 17 · indet.: 2 | incumple: 8, 17 · indet.: 2, 6 | incumple: 17 | incumple: 6, 17 | incumple: 17 | incumple: — · indet.: 28 | incumple: 6, 17, 29 · indet.: 2 | incumple: 4, 17 · indet.: 2 | (sin respuesta) | incumple: 6, 17 |
| synth-13 · Tipifica renuncia cuando fue retención y limita la permanencia | incumple: 5, 19 | incumple: 5, 19, 24 | incumple: 5, 19, 32 | incumple: 5, 19 | incumple: 5, 18, 19 | incumple: 5, 19 | incumple: 5, 19 | incumple: 5 | incumple: 5, 19, 29 | incumple: 7, 15, 16, 19, 29 | incumple: 19 | (sin respuesta) |

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
