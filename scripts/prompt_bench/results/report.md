# Comparación de IA · prompt capa 2

- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.
- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).
- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.
- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.
- **Precisión** = TP / (TP + FP): de los motivos que la IA marcó `incumple`, qué % era correcto. 100 % − precisión = falsas alarmas.
- **Recall** (sensibilidad) = TP / (TP + FN): de los incumplimientos reales, qué % encontró la IA. 100 % − recall = incumplimientos que se le escapan.

## Resumen por IA

| IA | Plataforma | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Motivo de renuncia | Objeciones correctas | Orden de argumentos | Latencia prom. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | Anthropic API (directo) | claude-sonnet-5-5 | 13/13 | 100% | 96% | 0/1 | 0/11 | 14/14 | 14/14 | 13/14 | 2/2 | 17.3 s |
| gemini-3-5-flash-lite | Google Gemini API (directo) | gemini-3.5-flash-lite | 13/13 | 86% | 69% | 0/1 | 1/11 | 13/14 | 14/14 | 11/14 | 1/2 | 67.4 s |
| or-deepseek-v4-1-flash | OpenRouter (intermediario) | deepseek/deepseek-v4.1-flash | 13/13 | 96% | 92% | 0/1 | 0/11 | 14/14 | 14/14 | 12/14 | 2/2 | 52.1 s |
| or-gemini-3-8-flash | OpenRouter (intermediario) | google/gemini-3.8-flash | 13/13 | 100% | 85% | 0/1 | 0/11 | 14/14 | 14/14 | 12/14 | 2/2 | 51.2 s |
| or-gpt-6-luna | OpenRouter (intermediario) | openai/gpt-6-luna | 13/13 | 96% | 88% | 0/1 | 0/11 | 14/14 | 14/14 | 12/14 | 2/2 | 57.5 s |

## Detalle de precisión

Cómo leerla: la meta del proyecto es **hasta 5 % de falsos positivos y hasta 20 % de falsos negativos** (`docs/context.md`).
A nivel de motivo, eso equivale a **precisión ≥ 95 %** (falsas alarmas ≤ 5 %) y **recall ≥ 80 %** (omisiones ≤ 20 %).
La precisión es la que más pesa en costo operativo: cada falsa alarma es una llamada que un auditor revisa sin necesidad.
El recall pesa en riesgo: cada omisión es un incumplimiento real que no llega a revisión.
**F1** resume ambas en un número (media armónica); sirve para ordenar, pero la decisión se toma con la meta.
**Indeterminados** van a revisión humana: no son error, pero cuestan horas de auditor. "Sin motivo" = indeterminados en motivos que no se esperaban ni como inciertos.
Ojo con el tamaño: hay 26 incumplimientos esperados en 13 llamadas; un solo motivo de diferencia mueve la precisión o el recall en ~4 puntos.

| IA | Plataforma | TP | FP | FN | Precisión | Falsas alarmas | Recall | Omisiones | F1 | Indeterminados | Cumple meta |
|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | Anthropic API (directo) | 25 | 0 | 1 | 100% | 0% | 96% | 4% | 98% | 1 (0 sin motivo) | sí |
| gemini-3-5-flash-lite | Google Gemini API (directo) | 18 | 3 | 8 | 86% | 14% | 69% | 31% | 77% | 0 (0 sin motivo) | no |
| or-deepseek-v4-1-flash | OpenRouter (intermediario) | 24 | 1 | 2 | 96% | 4% | 92% | 8% | 94% | 5 (1 sin motivo) | sí |
| or-gemini-3-8-flash | OpenRouter (intermediario) | 22 | 0 | 4 | 100% | 0% | 85% | 15% | 92% | 0 (0 sin motivo) | sí |
| or-gpt-6-luna | OpenRouter (intermediario) | 23 | 1 | 3 | 96% | 4% | 88% | 12% | 92% | 5 (1 sin motivo) | sí |

## Costos por IA

Calculado con los tokens reales de cada respuesta y los precios de `models.toml`. La proyección usa 100.000 llamadas al mes y el costo promedio por llamada de estas pruebas. Ojo: estas llamadas duran ~2 min y las reales más de 10 (ver Notas).

| IA | Plataforma | Precio input / output (USD por M tokens) | Tokens prom. por llamada (in / out) | Costo por llamada USD | Costo de las 13 pruebas USD | Mensual USD | Mensual con batch (-50 %) USD |
|---|---|---|---|---|---|---|---|
| claude-sonnet-5-5 | Anthropic API (directo) | 2,00 / 10,00 | 14.241 / 2.994 | 0,0428 | 0,557 | 4.284 | 2.142 |
| gemini-3-5-flash-lite | Google Gemini API (directo) | 0,30 / 2,50 | 9.703 / 2.105 | 0,0082 | 0,106 | 817 | 409 |
| or-deepseek-v4-1-flash | OpenRouter (intermediario) | 0,30 / 1,20 | 9.607 / 9.528 | 0,0143 | 0,186 | 1.432 | 716 |
| or-gemini-3-8-flash | OpenRouter (intermediario) | 0,75 / 3,75 | 8.923 / 7.400 | 0,0344 | 0,448 | 3.444 | 1.722 |
| or-gpt-6-luna | OpenRouter (intermediario) | 0,10 / 0,50 | 8.537 / 5.685 | 0,0037 | 0,048 | 370 | 185 |

## Llamadas con error

Ninguna.

## Detalle por llamada

| Llamada | Esperado | claude-sonnet-5-5 | gemini-3-5-flash-lite | or-deepseek-v4-1-flash | or-gemini-3-8-flash | or-gpt-6-luna |
|---|---|---|---|---|---|---|
| synth-01 · Retención exitosa, llamada modelo | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — | incumple: — |
| synth-02 · Exceso de objeciones y cierre sin N° de seguro | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 | incumple: 3, 13 |
| synth-03 · Llamada corta sin intento de retención | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 14 | incumple: 4, 14, 33 | incumple: 4, 14, 33 | incumple: 4, 14, 33 |
| synth-04 · Información errónea del producto y tipificación incorrecta | incumple: 6, 18 | incumple: 6, 18 | incumple: 2, 6, 18 | incumple: 6, 18 | incumple: 6, 18 | incumple: 6, 18 |
| synth-05 · Información entregada a un tercero | incumple: 27 · inciertos: 14 | incumple: 27 | incumple: — | incumple: 27 | incumple: 14, 27 | incumple: 27 |
| synth-06 · Retención sin intención de renuncia y pregunta predispuesta | incumple: 8, 16, 32 · inciertos: 6, 13, 15, 25, 29 | incumple: 6, 16, 32 | incumple: 3, 16, 25, 32 | incumple: 6, 8, 13, 15, 16, 30, 32 | incumple: 6, 16, 32 | incumple: 6, 13, 15, 16, 30, 32 |
| synth-07 · Llamada larga con esperas excesivas y descalificación de la competencia | incumple: 1, 11 | incumple: 1, 11 | incumple: 1, 11 | incumple: 1, 11 | incumple: 1, 11 | incumple: 1, 11 |
| synth-08 · Inducción a la renuncia y negación de devolución de prima | incumple: 4, 6, 8, 12, 14, 28 · inciertos: 18 | incumple: 4, 6, 8, 12, 14, 28 | incumple: 4, 14, 28 | incumple: 4, 6, 12, 14, 28 | incumple: 4, 6, 12, 28 | incumple: 4, 6, 12, 14, 28 |
| synth-09 · Dos seguros: gestiona y tipifica solo uno | incumple: 25, 26 · inciertos: 13, 15, 29 | incumple: 13, 15, 25, 26 | incumple: 25 | incumple: 13, 15, 25 | incumple: 13, 15, 25 | incumple: 13, 15, 25, 29 |
| synth-10 · Renuncia de un seguro no renunciable | incumple: 7, 9 · inciertos: 4 | incumple: 7, 9 | incumple: 7, 9 | incumple: 4, 7, 9 | incumple: 4, 7, 9 | incumple: 4, 7, 9 |
| synth-11 · Llamada cortada con audio ininteligible | incumple: — · inciertos: 13, 15, 26, 29 | incumple: — | incumple: 13, 15, 29 | incumple: — · indet.: 13, 15, 26, 29, 30 | incumple: — | incumple: — · indet.: 13, 15, 26, 29 |
| synth-12 · Retiene un seguro no retenible | incumple: 17 · inciertos: 6, 8 | incumple: 8, 17 · indet.: 6 | incumple: 14, 17 | incumple: 17 | incumple: 17 | incumple: 6, 17 · indet.: 2 |
| synth-13 · Tipifica renuncia cuando fue retención y limita la permanencia | incumple: 5, 19 | incumple: 5, 19 | incumple: 5, 19 | incumple: 5, 19 | incumple: 5, 19 | incumple: 5, 19 |

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
