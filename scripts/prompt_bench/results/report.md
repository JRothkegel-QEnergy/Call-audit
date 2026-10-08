# Comparación de IA · prompt capa 2

- **TP**: motivo esperado como incumplido que la IA marcó `incumple`.
- **FP**: la IA marcó `incumple` un motivo que no se esperaba (excluye los esperados inciertos).
- **FN**: motivo esperado como incumplido que la IA no marcó `incumple`.
- **Veredicto de llamada**: `no cumple` si hay al menos un `incumple`. Las llamadas esperadas `uncertain` no cuentan.

## Resumen por IA

| IA | Modelo (según API) | Llamadas respondidas | Precisión motivos | Recall motivos | FP llamadas | FN llamadas | Gestiones correctas | Objeciones correctas | Costo total USD | Latencia prom. |
|---|---|---|---|---|---|---|---|---|---|---|
| claude-haiku-4-5 | claude-haiku-4-5-20251001 | 11/11 | 43% | 60% | 1/1 | 1/9 | 12/12 | 9/12 | 0.2523 | 26.2 s |
| claude-haiku-5-5 | claude-haiku-5-5 | 11/11 | 63% | 85% | 0/1 | 0/9 | 12/12 | 6/12 | 0.0519 | 35.1 s |
| claude-sonnet-5-5 | claude-sonnet-5-5 | 11/11 | 40% | 85% | 0/1 | 0/9 | 12/12 | 10/12 | 0.4172 | 18.3 s |

## Detalle por llamada

| Llamada | Esperado | claude-haiku-4-5 | claude-haiku-5-5 | claude-sonnet-5-5 |
|---|---|---|---|---|
| synth-01 · Retención exitosa, llamada modelo | incumple: — | incumple: 15 | incumple: — | incumple: — |
| synth-02 · Exceso de objeciones y cierre sin N° de póliza | incumple: 3, 13 | incumple: 3, 13, 15, 29 | incumple: 3, 10, 13 | incumple: 3, 10, 13, 32 |
| synth-03 · Llamada corta sin intento de retención | incumple: 4, 14, 33 | incumple: — · indet.: 2, 6 | incumple: 14, 33 · indet.: 2, 6, 10 | incumple: 4, 10, 14, 33 · indet.: 2, 6 |
| synth-04 · Información errónea del producto y tipificación incorrecta | incumple: 6, 18 | incumple: 15, 18 | incumple: 6, 18 | incumple: 2, 6, 18 |
| synth-05 · Información entregada a un tercero | incumple: 27 | incumple: 27 · indet.: 2, 6 | incumple: 27 · indet.: 2, 6 | incumple: 8, 10, 27, 32 · indet.: 2, 6 |
| synth-06 · Retención sin intención de renuncia y pregunta predispuesta | incumple: 8, 16, 32 | incumple: 13, 15, 16, 29, 32 · indet.: 2, 6 | incumple: 8, 10, 13, 15, 16, 25, 29, 32 · indet.: 2, 6, 26, 30 | incumple: 8, 10, 16, 32 · indet.: 2, 6 |
| synth-07 · Llamada larga con esperas excesivas y descalificación de la competencia | incumple: 11 · inciertos: 1 | incumple: 1, 11, 15 · indet.: 2, 6 | incumple: 1, 11, 18 · indet.: 2, 6, 10 | incumple: 1, 4, 10, 11, 32 · indet.: 2, 6 |
| synth-08 · Inducción a la renuncia y negación de devolución de prima | incumple: 6, 12, 28 | incumple: 4, 12, 15, 16, 28, 32 · indet.: 2, 6 | incumple: 6, 8, 12, 14 · indet.: 2, 10, 28 | incumple: 4, 8, 10, 12, 14, 15, 16, 18, 30, 32 · indet.: 2, 6, 28 |
| synth-09 · Dos seguros: gestiona y tipifica solo uno | incumple: 13, 25, 26 | incumple: 15, 25, 26, 29 · indet.: 2, 6 | incumple: 13, 15, 25, 26 · indet.: 2, 6, 10, 30 | incumple: 8, 10, 13, 15, 25, 26 · indet.: 6 |
| synth-10 · Renuncia de un seguro irrenunciable en el canal | incumple: 7, 9 | incumple: 9 · indet.: 2, 6 | incumple: 9 · indet.: 2, 6, 10 | incumple: 4, 9, 10 · indet.: 2, 6, 7 |
| synth-11 · Llamada cortada con audio ininteligible | incumple: — · inciertos: 24, 29 | incumple: 13, 15, 29 · indet.: 6 | incumple: — · indet.: 13, 15, 26, 29 | incumple: 19 · indet.: 13, 15, 18, 26, 29 |

Ojo: los esperados los definimos nosotros, no auditores del cliente. Esto mide consistencia entre IA, no precisión real.
