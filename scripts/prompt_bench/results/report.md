# Comparación de IA · prompt capa 2

- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.
- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).
- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.
- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.

## Resumen por IA

| IA | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Objeciones correctas | Latencia prom. |
|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | claude-haiku-4-5-20251001 | 11/11 | 67% | 75% | 0/1 | 1/9 | 12/12 | 8/12 | 33.3 s |
| claude-haiku-5-5 | claude-haiku-5-5 | 11/11 | 81% | 71% | 0/1 | 0/9 | 11/12 | 10/12 | 35.7 s |
| claude-sonnet-5-5 | claude-sonnet-5-5 | 11/11 | 92% | 92% | 0/1 | 0/9 | 12/12 | 10/12 | 17.6 s |
| gemini-3-5-flash-lite | gemini-3.5-flash-lite | 11/11 | 88% | 62% | 0/1 | 2/9 | 10/12 | 8/12 | 34.1 s |
| gemini-3-8-flash | gemini-3.8-flash | 1/11 | 100% | 100% | 0/0 | 0/1 | 1/1 | 1/1 | 39.9 s |
| groq-gpt-oss-120b | openai/gpt-oss-120b | 10/11 | 83% | 71% | 0/1 | 0/8 | 11/11 | 8/11 | 33.2 s |

## Costos por IA

Calculado con los tokens reales de cada respuesta y los precios de `models.toml`. La proyección usa 100.000 llamadas al mes y el costo promedio por llamada de estas pruebas. Ojo: estas llamadas duran ~2 min y las reales más de 10 (ver Notas).

| IA | Precio input / output (USD por M tokens) | Tokens prom. por llamada (in / out) | Costo por llamada USD | Costo de las 11 pruebas USD | Mensual USD | Mensual con batch (-50 %) USD |
|---|---|---|---|---|---|---|
| claude-haiku-4-5 | 1,00 / 5,00 | 4.247 / 4.376 | 0,0261 | 0,287 | 2.613 | 1.306 |
| claude-haiku-5-5 | 0,10 / 0,50 | 5.585 / 8.985 | 0,0047 | 0,052 | 472 | 236 |
| claude-sonnet-5-5 | 2,00 / 10,00 | 5.585 / 3.228 | 0,0368 | 0,405 | 3.680 | 1.840 |
| gemini-3-5-flash-lite | 0,30 / 2,50 | 3.509 / 2.744 | 0,0079 | 0,087 | 791 | 396 |
| gemini-3-8-flash | 0,75 / 3,75 | 3.704 / 3.759 | 0,0169 | 0,186 | 1.687 | 844 |
| groq-gpt-oss-120b | 0,15 / 0,60 | 3.647 / 4.387 | 0,0032 | 0,035 | 318 | 159 |

## Llamadas con error

- **gemini-3-8-flash**: 429 cuota del plan agotada (no se arregla reintentando) en 10 llamada(s): synth_01, synth_03, synth_04, synth_05, synth_06, synth_07, synth_08, synth_09, synth_10, synth_11
- **groq-gpt-oss-120b**: JSON que no cumple el esquema en 1 llamada(s): synth_06

## Detalle por llamada

| Llamada | Esperado | claude-haiku-4-5 | claude-haiku-5-5 | claude-sonnet-5-5 | gemini-3-5-flash-lite | gemini-3-8-flash | groq-gpt-oss-120b |
|---|---|---|---|---|---|---|---|
| synth-01 · Retención exitosa, llamada modelo | incumple: — | incumple: — · indet.: 28 | incumple: — · indet.: 28 | incumple: — | incumple: — · indet.: 28 | (sin respuesta) | incumple: — · indet.: 28 |
| synth-02 · Exceso de objeciones y cierre sin N° de póliza | incumple: 3, 13 | incumple: 3, 13 · indet.: 28 | incumple: 3, 13 · indet.: 28 | incumple: 3, 13 · indet.: 28 | incumple: 3 · indet.: 28 | incumple: 3, 13 | incumple: 3, 13 · indet.: 28 |
| synth-03 · Llamada corta sin intento de retención | incumple: 4, 14, 33 | incumple: 14, 33 · indet.: 2, 28 | incumple: 14, 33 · indet.: 2, 28 | incumple: 4, 14, 33 · indet.: 28 | incumple: 14, 33 · indet.: 28 | (sin respuesta) | incumple: 4, 14, 33 |
| synth-04 · Información errónea del producto y tipificación incorrecta | incumple: 6, 18 | incumple: 6, 18 · indet.: 28 | incumple: 6, 18 · indet.: 28 | incumple: 6, 18 | incumple: 6, 18 | (sin respuesta) | incumple: 18 |
| synth-05 · Información entregada a un tercero | incumple: 27 | incumple: — | incumple: 27 · indet.: 2, 28 | incumple: 27 · indet.: 2, 28 | incumple: — · indet.: 28 | (sin respuesta) | incumple: 27 · indet.: 2, 28 |
| synth-06 · Retención sin intención de renuncia y pregunta predispuesta | incumple: 8, 16, 32 · inciertos: 13, 15, 25, 29 | incumple: 13, 15, 16, 29, 32 | incumple: 6, 13, 15, 16, 29, 30, 32 · indet.: 2, 25 | incumple: 6, 8, 16, 32 · indet.: 2, 25, 29 | incumple: 16, 25, 32 | (sin respuesta) | (sin respuesta) |
| synth-07 · Llamada larga con esperas excesivas y descalificación de la competencia | incumple: 11 · inciertos: 1 | incumple: 1, 11 | incumple: 1, 11 · indet.: 2, 28 | incumple: 1, 11 · indet.: 2 | incumple: 1, 11 · indet.: 28 | (sin respuesta) | incumple: 1, 10, 11 · indet.: 28 |
| synth-08 · Inducción a la renuncia y negación de devolución de prima | incumple: 4, 6, 8, 12, 14, 28 | incumple: 4, 5, 6, 8, 12, 18, 26, 28 · indet.: 2 | incumple: 6, 12, 14, 28 | incumple: 4, 6, 12, 14, 28 · indet.: 2, 18 | incumple: 4, 6, 12, 14, 16, 28 · indet.: 2 | (sin respuesta) | incumple: 4, 8, 12, 14, 26, 28 |
| synth-09 · Dos seguros: gestiona y tipifica solo uno | incumple: 13, 25, 26 | incumple: 13, 15, 22, 25, 29, 30 · indet.: 2 | incumple: 13, 15, 25, 32 · indet.: 2, 26, 28 | incumple: 25, 26, 29 · indet.: 28 | incumple: 13, 15, 25 | (sin respuesta) | incumple: 25 · indet.: 28 |
| synth-10 · Renuncia de un seguro irrenunciable en el canal | incumple: 4, 7, 9 | incumple: 7, 9 · indet.: 2 | incumple: 9 · indet.: 2, 28 | incumple: 4, 7, 9 · indet.: 2, 28 | incumple: — · indet.: 28 | (sin respuesta) | incumple: 9 · indet.: 28 |
| synth-11 · Llamada cortada con audio ininteligible | incumple: — · inciertos: 13, 15, 26, 29 | incumple: 13, 15, 19, 24, 29 · indet.: 28 | incumple: 13, 15, 29 · indet.: 6, 26, 28 | incumple: — · indet.: 19, 26, 28, 29 | incumple: 13, 15, 29 · indet.: 28 | (sin respuesta) | incumple: 13, 14, 15, 26, 29 · indet.: 28 |

Ojo: los esperados los definimos nosotros, no auditores del cliente. Esto mide consistencia entre IA, no precisión real.

## Notas

**Errores por plan gratuito.** Un 429 con "quota" o "credits" significa que se acabó la cuota del plan gratuito o el crédito
de la cuenta: no se arregla reintentando (hay que esperar que se renueve o pasar a un plan pagado). Un 503 ("high demand")
o un 413/429 por tokens por minuto son temporales: `run.py` los reintenta solo y basta con volver a correrlo.

**Cómo leer los costos.**
- **Duración de las llamadas:** las sintéticas duran en promedio ~2 minutos (entre 1 y 7), mientras que las reales
  duran más de 10. La transcripción real es unas 5 veces más larga, así que el input por llamada va a ser bastante
  mayor (el system prompt, de ~3.500 tokens, es fijo) y el output probablemente también, por las citas y comentarios.
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
