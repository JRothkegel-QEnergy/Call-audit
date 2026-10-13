# Llamadas sintéticas de retención

13 llamadas **inventadas** de retención de seguros para tests, prompts y pruebas del pipeline. Ningún dato es real: nombres, RUT, correos, teléfonos y N° de seguro (MUS A Neto) son ficticios. Los RUT siguen el patrón `11.111.111-1` y no son válidos.

Los nombres de los seguros sí son los del catálogo del cliente (hoja RESUMEN del Excel de apoyo), porque así llegan en los metadatos de BancoEstado. La categoría, el tipo de prima y la ficha de cada seguro no van en el fixture: los agrega `scripts/prompt_bench/render.py` desde `data/catalog/products.json`. Lo que dice el ejecutivo sobre coberturas está alineado con esas fichas.

Cada llamada tiene dos archivos:

- `synth_NN.json`: metadatos (seguros con `mus_a_neto` y `payment_method`, tipificación), transcripción por canal (`agent` / `customer`) con `start_ms` / `end_ms`, y `expected` con los hallazgos esperados.
- `synth_NN.txt`: la misma transcripción en formato legible.

## Índice

| Llamada | Duración | Seguro | Qué pasa | Veredicto esperado | Motivos esperados |
|---|---|---|---|---|---|
| synth-01 | 03:31 | DESEMPLEO ITT CRE. CONSUMO | Retención exitosa, llamada modelo (cobertura → beneficio) | `compliant` | — |
| synth-02 | 02:27 | DESEMPLEO ITT CRE. CONSUMO | 5 objeciones ante clienta tajante y cierre sin N° de seguro | `non_compliant` | 3, 13 |
| synth-03 | 01:00 | Incendio Hogar | No intenta retener, no da características ni valida correo/teléfono | `non_compliant` | 4, 14, 33 |
| synth-04 | 02:08 | DESEMPLEO ITT CRE. CONSUMO | Dice 3 cuotas contra finiquito (son 4, de dos en dos) y tipifica mal el motivo | `non_compliant` | 6, 18 |
| synth-05 | 01:58 | HOSPITALIZACION TLMK | Entrega información y cierra con la cónyuge (tercero) | `non_compliant` | 27 (14 incierto) |
| synth-06 | 01:42 | SALE SEGURO PLUS (Sucursales) | Retiene sin intención de renuncia, pregunta predispuesta y elude la consulta | `non_compliant` | 8, 16, 32 (6, 13, 15, 25, 29 inciertos) |
| synth-07 | 07:29 | PROTECCION GLOBAL MYPE | Esperas de 45 s y 210 s (> 30 s) y descalifica a la competencia | `non_compliant` | 1, 11 |
| synth-08 | 01:35 | AP INDIVIDUAL MEDIO DE PAGO | Induce la renuncia, no explica el seguro y niega la devolución (anual) | `non_compliant` | 4, 6, 8, 12, 14, 28 (18 incierto) |
| synth-09 | 03:14 | Desempleo + Incendio Hogar | Dos seguros: gestiona y tipifica solo uno | `non_compliant` | 25, 26 (13, 15, 29 inciertos) |
| synth-10 | 01:12 | DESGRAVAMEN NOMINAL | Renuncia un seguro no renunciable (debía orientar a sucursal) | `non_compliant` | 7, 9 (4 incierto) |
| synth-11 | 01:03 | DESEMPLEO ITT CRE. CONSUMO | Audio ininteligible y llamada cortada antes del cierre | `uncertain` | 13, 15, 26, 29 (inciertos) |
| synth-12 | 01:43 | SEGURO DE DESEMPLEO CONSUMO | Retiene un seguro no retenible | `non_compliant` | 17 (6, 8 inciertos) |
| synth-13 | 01:36 | AP PLUS MEDIO DE PAGO | Fecha de renovación como primer argumento, condiciona la renuncia a esa fecha y tipifica RENUNCIA cuando fue retención | `non_compliant` | 5, 19 |

Los esperados se revisaron el 2026-10-09 contra la pauta con las notas del cliente y el Excel de apoyo (ver historial en `docs/layer2-prompt-example.md`).

## Cómo leer `expected`

- `findings` lista solo los motivos que **no** cumplen o quedan inciertos; el resto se asume `compliant` o `not_applicable`.
- `status` puede ser `non_compliant` o `uncertain`.
- `outcomes` es lo que pasó **según la grabación** (no lo tipificado): resultado (`RENUNCIA`, `RETENCION`, `CONSULTA`, `SIN_GESTION`), todos los motivos de renuncia que expresa el cliente, el número de objeciones y, cuando importa, `renewal_last` (si la fecha de renovación quedó como último argumento).

## Limitaciones

- Son hallazgos esperados definidos por nosotros, no por auditores del cliente: sirven para tests y desarrollo, **no reemplazan el golden set**.
- La gravedad de los motivos y el guion de cierre siguen `TBD` (ver `docs/client-open-questions.md`).
- Los tiempos se calculan con ~2,6 palabras/segundo más pausas; las llamadas reales tienden a ser más largas.

## Regenerar

Las transcripciones están definidas en `build_calls.py`. Para editar o agregar llamadas:

```bash
python tests/fixtures/calls/build_calls.py tests/fixtures/calls
```
