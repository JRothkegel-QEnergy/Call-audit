# Historial de cambios · prompt capa 2

Una entrada por versión de `prompt.yaml`, con el porqué del cambio (métricas, modelos que fallaban, quién lo pidió). El origen de cada regla está en su `history` y el resumen en `PROVENANCE.md`.

El esquema de salida (`schema.json`) y la instrucción JSON se versionan junto con el prompt.

**2.7 (2026-10-15)**:

- Tras revisar una por una las discrepancias de v2.6 contra el Excel en 100 llamadas reales (`transcripts/layer2_real_100/analisis_discrepancias_v2.6.md`, fuera del repo):
  - **Decisión final del cliente** (`gestiones[].decision_final`: GENUINA / CONDICIONADA / NO_ACEPTADA). Una retención NO_ACEPTADA (el cliente repite que quiere renunciar y su "sí" solo responde al protocolo, cree que se renunció, o acepta porque le dijeron que no puede renunciar ahora) es RENUNCIA por grabación → 26 y 24. Era la causa más común de llamadas rechazadas que Gemini aprobaba.
  - **Materialidad en 2 y 6** (`afirmaciones_producto`): una afirmación incorrecta incumple solo si cambia lo que el cliente entiende que tiene o paga y se usa para retener o responder. GPT-6 Luna marcaba diferencias de redondeo ($42.150 vs $42.155) y Gemini no contrastaba las afirmaciones con la ficha.
  - **Solicitudes del cliente** (`solicitudes_cliente`): desconocimiento, devolución o cobro incorrecto exigen orientar al requerimiento (600 660 1212 op. 2; 800 80 20 20 aceptado para reclamos de cobro, [DEFINIR]); otro seguro mencionado debe gestionarse; preguntas eludidas → 8.
  - **Regla 13**: SIN_FICHA solo si faltan coberturas, montos, primas o devolución del seguro gestionado; los detalles operativos y los beneficios no listados no cambian el estado. GPT-6 Luna marcaba SIN_FICHA en 60 de 100.
  - Motivo 5 incluye condicionar la renuncia a una acción previa (retirar el ahorro, validar el cobro).
- Motivo 1: solo cuentan las esperas en que el ejecutivo hace esperar al cliente; si el que se demora es el cliente, no. `esperas_seg` se calcula así en el pre-proceso (`executive_holds` en `scripts/prompt_bench/real_calls.py`): silencios que terminan cuando vuelve a hablar el ejecutivo, o cuando el cliente pregunta si lo siguen atendiendo.

**2.6 (2026-10-14)**, según lo aclarado por el cliente (Verónica) en reunión:

- Motivo 18 más flexible: basta con que el motivo tipificado tenga sentido con lo que dijo el cliente; si dio varios, cualquiera sirve, y una misma razón puede caber en varias categorías (ej. "me subió la prima y no quiero pagar" = Aumento Valor de la Prima, Problemas Económicos o No desea contraer más obligaciones). Solo incumple si el motivo no tiene relación con lo dicho o lo contradice. En v2.4 el 18 se marcaba en 29 a 34 de 100 llamadas.
- Motivo 16: explícito que solo se retiene el seguro cuya cancelación pidió el cliente.

**2.5 (2026-10-14)**, tras validar 100 llamadas reales con v2.4:

- Los datos de BancoEstado de cada seguro traen el CONTRATO del cliente (plan contratado, prima del cliente, periodicidad, monto asegurado del cliente; placeholder `{datos_contrato}` de la ficha). Para plan, prima y monto, el contrato manda sobre la ficha general.
- Motivo 2 y regla 13: decir el plan, la prima o el monto del contrato no es incumplimiento ni NO_CORRESPONDE. En v2.4, Gemini 3.8 Flash marcaba el motivo 2 en 41 de 100 llamadas, casi siempre porque el ejecutivo leía montos de planes antiguos que la ficha no lista (ej. AP Plan Full 700 UF y 0,67 UF contra 1.000 UF y 0,63 UF de la ficha).

**2.4 (2026-10-14)**, primera corrida sobre llamadas reales:

- Regla 13 y campo `informacion_seguro` (OK / SIN_FICHA / NO_CORRESPONDE): si la ficha no sirve para la llamada, los motivos 2, 6 y 28 quedan `indeterminado` ("Sin información del seguro para contrastar: ...") en vez de `incumple`, y la llamada queda por revisar. Con una ficha equivocada (Sale Seguro de HDI contra la ficha de BNP Paribas Cardif) todas las IA marcaban el motivo 2 por error.

**2.3 (2026-10-13)**, para subir la precisión de DeepSeek, GPT-6 Luna y Haiku 5.5 (errores revisados uno a uno):

- La ficha de cada seguro sale de una plantilla aparte (`docs/layer2-product-sheet.md`) completada con el Excel estandarizado: coberturas con montos, asistencias, primas por plan, retracto y siniestros, en vez del volcado de la hoja original.
- Motivos 6 y 8: se marcan juntos cuando el ejecutivo elude una pregunta sobre el producto (los tres modelos dejaban solo el 6 por la regla del motivo más específico). La regla 9 lista los pares que sí van juntos (8+6, 26+25, 9+7).
- Motivo 26: no basta con que el ejecutivo diga "quedó todo listo"; cada seguro pedido debe tener su cierre (los tres modelos le creían).
- Motivo 32: las preguntas que ofrecen una alternativa ("¿no prefiere mantenerlo un tiempo más?") son argumentos, no predisposición.
- Indeterminado solo si el dato que falta cambiaría el resultado; los datos personales registrados no vienen y se asumen correctos (Haiku marcaba indeterminados de más).

**2.2 (2026-10-13)**, tras la corrida con la 2.1:

- Motivo 29 acotado: solo incumple si no hay ningún resumen de cierre. Con el script en el prompt, Haiku 4.5 y GPT-6 Luna marcaban 29 en cierres que existen pero no siguen el guion al pie de la letra. Se agregan un ejemplo que cumple y uno que incumple.

**2.1 (2026-10-09)**, con el Script Retención BECS (julio 2026):

- Protocolo de cierre del script, separado para retención y renuncia. El N° de seguro se dice con los 4 últimos dígitos del MUS A Neto. El resto de elementos (fecha, vigencia, N° de póliza, número de renuncia) va como observación del motivo 29.
- Respuestas válidas a la confirmación ("Sí", "De acuerdo", "Ok", "Confirmo", "Acepto"); con otra respuesta hay que repreguntar "¿eso es un Sí?" (motivo 30).
- En la renuncia de un seguro de cobro anticipado (prima única o anual) se debe informar la devolución automática en 10 días hábiles.
- Las preguntas de confirmación del script no son el motivo 32.
- Validación del script (31 incluye continuar con datos que no coinciden). Terceros: no se les entrega información; discapacidad del titular → sucursal con poder; seguros de empresa → representante legal. **Contradice al Excel de apoyo**, que permitía al tercero gestionar con RUT y N° de serie: manda el script.
- Retracto: ya no se deriva; se gestiona como renuncia con motivo "Retracto" si se contrató a distancia y está dentro de 10 días desde que recibió la póliza. **También contradice al Excel de apoyo** (que mandaba a llamar al 600 660 1212).
- Orden de argumentos del script: coberturas, características, beneficios adicionales, prima y ejemplos; fecha de renovación al final (solo prima anual).
- Datos nuevos por seguro: N° de póliza e inicio de vigencia.

**2.0 (2026-10-09)**, tras la reunión de revisión de la pauta con el cliente y el Excel de apoyo:

- Los seguros llegan con su ficha real del Excel de apoyo, su categoría (retenible / no retenible / no renunciable), tipo de prima, regla de devolución y medio de pago. Antes solo había ficha para Desempleo, de la capacitación S4P, y decía 5 cuotas; la ficha vigente dice 4 cuotas pagadas de dos en dos.
- El seguro se identifica con el N° de seguro **MUS A Neto** (motivo 13 lo exige en el cierre).
- Cada motivo tiene el criterio del cliente (notas de la pauta): espera > 30 s (motivo 1), mínimo 1 característica sin contar el nombre (4), no condicionar la renuncia a una fecha (5), no negar ni desviar información salvo fechas de pago (6), no se transfieren llamadas (7), motivo 10 = mal trato (ya no es residual), 11 incluye a otros ejecutivos, 15 no aplica con medio de pago "OTRO", 18 basta con uno de los motivos, 33 un dato distinto es solo observación.
- Distinción 2 vs 6: 2 es lo que el ejecutivo describe por iniciativa propia; 6 es cómo responde las preguntas del cliente.
- Omitir información no es incumplimiento (salvo el 4); dar información incorrecta sí.
- Procedimientos de derivación y devolución de prima de la hoja Otros del Excel de apoyo.
- Límite de objeciones condicionado a que el cliente sea tajante.
- Esquema: `n_poliza` → `mus_a_neto`; resultado `CONSULTA`; `motivos_renuncia` (lista); `cliente_tajante`; `argumentos_retencion` con tipo y orden (indicador del dashboard); `termino_llamada` (detecta línea tomada sin cortar); `mus_a_neto` por criterio para evaluar por seguro.
- Comentario de 1 frase en los motivos que cumplen o no aplican, para bajar el output.
- Regla 12: si no hay herramienta, responde con el JSON (Sonnet 5.5 simulaba la llamada a la herramienta en texto).

**1.1 (2026-10-08)**, tras la primera corrida con Haiku 4.5, Haiku 5.5 y Sonnet 5.5 y la revisión contra el Excel de la pauta:

- El texto de los 33 motivos ahora es el oficial del Excel. Las aclaraciones nuestras van aparte, como "Criterio:".
- Se quitó la gravedad sugerida (C/M/m): no viene en la pauta y no le corresponde al LLM, sino al motor de decisión.
- En el esquema, `comentario` va antes que `estado` y es obligatorio, con una regla de coherencia: los modelos marcaban `incumple` y en el comentario se corregían.
- Motivo 10 definido como residual y regla de "motivo más específico", porque los modelos lo marcaban casi siempre.
- Definición explícita de objeción (cuenta el primer argumento) y de cuándo aplica el protocolo de cierre. Ambas quedan [DEFINIR].
- Motivo 28 usa un dato nuevo por seguro, `devolucion_prima`. Motivo 7 incluye seguros no renunciables en el canal. Motivo 32 excluye la confirmación neutra del cierre.
