# Comparación de IA · prompt capa 2

- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.
- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).
- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.
- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.

## Resumen por IA

| IA | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Objeciones correctas | Costo total USD | Latencia prom. |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | claude-haiku-4-5-20251001 | 11/11 | 67% | 75% | 0/1 | 1/9 | 12/12 | 8/12 | 0.2874 | 33.3 s |
| claude-haiku-5-5 | claude-haiku-5-5 | 11/11 | 81% | 71% | 0/1 | 0/9 | 11/12 | 10/12 | 0.0519 | 35.7 s |
| claude-sonnet-5-5 | claude-sonnet-5-5 | 11/11 | 92% | 92% | 0/1 | 0/9 | 12/12 | 10/12 | 0.4048 | 17.6 s |

## Detalle por llamada

| Llamada | Esperado | claude-haiku-4-5 | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|---|---|
| synth-01 · Retención exitosa, llamada modelo | incumple: — | incumple: — · indet.: 28 | incumple: — · indet.: 28 | incumple: — |
| synth-02 · Exceso de objeciones y cierre sin N° de póliza | incumple: 3, 13 | incumple: 3, 13 · indet.: 28 | incumple: 3, 13 · indet.: 28 | incumple: 3, 13 · indet.: 28 |
| synth-03 · Llamada corta sin intento de retención | incumple: 4, 14, 33 | incumple: 14, 33 · indet.: 2, 28 | incumple: 14, 33 · indet.: 2, 28 | incumple: 4, 14, 33 · indet.: 28 |
| synth-04 · Información errónea del producto y tipificación incorrecta | incumple: 6, 18 | incumple: 6, 18 · indet.: 28 | incumple: 6, 18 · indet.: 28 | incumple: 6, 18 |
| synth-05 · Información entregada a un tercero | incumple: 27 | incumple: — | incumple: 27 · indet.: 2, 28 | incumple: 27 · indet.: 2, 28 |
| synth-06 · Retención sin intención de renuncia y pregunta predispuesta | incumple: 8, 16, 32 · inciertos: 13, 15, 25, 29 | incumple: 13, 15, 16, 29, 32 | incumple: 6, 13, 15, 16, 29, 30, 32 · indet.: 2, 25 | incumple: 6, 8, 16, 32 · indet.: 2, 25, 29 |
| synth-07 · Llamada larga con esperas excesivas y descalificación de la competencia | incumple: 11 · inciertos: 1 | incumple: 1, 11 | incumple: 1, 11 · indet.: 2, 28 | incumple: 1, 11 · indet.: 2 |
| synth-08 · Inducción a la renuncia y negación de devolución de prima | incumple: 4, 6, 8, 12, 14, 28 | incumple: 4, 5, 6, 8, 12, 18, 26, 28 · indet.: 2 | incumple: 6, 12, 14, 28 | incumple: 4, 6, 12, 14, 28 · indet.: 2, 18 |
| synth-09 · Dos seguros: gestiona y tipifica solo uno | incumple: 13, 25, 26 | incumple: 13, 15, 22, 25, 29, 30 · indet.: 2 | incumple: 13, 15, 25, 32 · indet.: 2, 26, 28 | incumple: 25, 26, 29 · indet.: 28 |
| synth-10 · Renuncia de un seguro irrenunciable en el canal | incumple: 4, 7, 9 | incumple: 7, 9 · indet.: 2 | incumple: 9 · indet.: 2, 28 | incumple: 4, 7, 9 · indet.: 2, 28 |
| synth-11 · Llamada cortada con audio ininteligible | incumple: — · inciertos: 13, 15, 26, 29 | incumple: 13, 15, 19, 24, 29 · indet.: 28 | incumple: 13, 15, 29 · indet.: 6, 26, 28 | incumple: — · indet.: 19, 26, 28, 29 |

Ojo: los esperados los definimos nosotros, no auditores del cliente. Esto mide consistencia entre IA, no precisión real.
