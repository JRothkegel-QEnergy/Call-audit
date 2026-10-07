# Llamadas sintéticas de retención

11 llamadas **inventadas** de retención de seguros para tests, prompts y pruebas del pipeline. Ningún dato es real: nombres, RUT, correos, teléfonos y pólizas son ficticios. Los RUT siguen el patrón `11.111.111-1` y no son válidos.

Cada llamada tiene dos archivos:

- `synth_NN.json`: metadatos, transcripción por canal (`agent` / `customer`) con `start_ms` / `end_ms`, y `expected` con los hallazgos esperados.
- `synth_NN.txt`: la misma transcripción en formato legible.

## Índice

| Llamada | Duración | Qué pasa | Veredicto esperado | Motivos esperados |
|---|---|---|---|---|
| synth-01 | 02:59 | Retención exitosa, llamada modelo | `compliant` | — |
| synth-02 | 02:15 | 4 objeciones y cierre sin N° de póliza | `non_compliant` | 3, 13 |
| synth-03 | 00:58 | Llamada corta: no intenta retener un seguro retenible ni valida correo/teléfono | `non_compliant` | 14, 33, 4 |
| synth-04 | 01:54 | Dice que paga 3 cuotas (son 5) y tipifica mal el motivo de renuncia | `non_compliant` | 6, 18 |
| synth-05 | 01:53 | Entrega información y cierra con la cónyuge (tercero) | `non_compliant` | 27 |
| synth-06 | 01:53 | Retiene sin intención de renuncia, pregunta predispuesta y elude la consulta | `non_compliant` | 16, 32, 8 |
| synth-07 | 07:23 | Esperas de 45 s y 210 s, y descalifica a la competencia | `non_compliant` | 11, 1 (según umbral) |
| synth-08 | 01:31 | Induce la renuncia y niega la devolución de prima | `non_compliant` | 12, 28, 6 |
| synth-09 | 03:00 | Dos seguros: gestiona y tipifica solo uno | `non_compliant` | 26, 25, 13 |
| synth-10 | 01:11 | Renuncia un seguro irrenunciable en el canal | `non_compliant` | 9, 7 |
| synth-11 | 01:03 | Audio ininteligible y llamada cortada antes del cierre | `uncertain` | 29, 24 (inciertos) |

## Cómo leer `expected`

- `findings` lista solo los motivos que **no** cumplen o quedan inciertos; el resto se asume `compliant` o `not_applicable`.
- `status` puede ser `non_compliant`, `uncertain` o `depends_on_threshold` (cuando el resultado depende de un umbral que es `TBD` con el cliente).
- `outcomes` es lo que pasó **según la grabación** (no lo tipificado), con el motivo de renuncia y el número de objeciones.
- `fixture_assumptions` marca supuestos inventados para el fixture (por ejemplo, que corresponde devolución de prima). **No son reglas del cliente.**

## Limitaciones

- Son hallazgos esperados definidos por nosotros, no por auditores del cliente: sirven para tests y desarrollo, **no reemplazan el golden set**.
- La gravedad de los motivos, el guion de cierre y el umbral de espera siguen `TBD` (ver `docs/client-open-questions.md`).
- Los tiempos se calculan con ~2,6 palabras/segundo más pausas; las llamadas reales tienden a ser más largas.

## Regenerar

Las transcripciones están definidas en `build_calls.py`. Para editar o agregar llamadas:

```bash
python tests/fixtures/calls/build_calls.py tests/fixtures/calls
```
