# Origen de las reglas · prompt capa 2 v2.10 (2026-10-22)

> Generado por `python scripts/prompt_bench/layer2_prompt.py build` desde `prompt.yaml`. No editar a mano.
> `base` = la regla ya estaba antes del historial detallado (v2.0 o anterior).

## Resumen por origen

Un ítem cuenta en cada origen que aparece en su historial.

| Origen | Ítems | Qué es |
|---|---:|---|
| Texto oficial | 35 | Texto oficial del cliente sin cambios (Pauta Calidad Actualizada, lista de Motivos de Renuncia). |
| Feedback del cliente | 20 | Aclaraciones del cliente (notas de la pauta, reuniones de revisión). Indica quién y cuándo en la nota. |
| Script del cliente | 13 | Script Retención BECS (julio 2026). Si contradice al Excel de apoyo, manda el script. |
| Catálogo del cliente | 8 | Excel Apoyo nuevo v1 (catálogo de seguros, fichas, medios de pago, hoja Otros). |
| Feedback de validación | 28 | Ajuste nuestro tras revisar errores de las IA en una corrida (sintéticas o llamadas reales). La nota dice qué fallaba. |
| Diseño Qubico | 25 | Decisión nuestra de formato o de método de evaluación, sin un error concreto detrás. |

## Reglas que vienen de feedback

### Feedback del cliente

| Versión | Ítem | Qué cambió |
|---|---|---|
| base | `def_renunciation_intent` - Intención de renuncia: el cliente dice de forma explícita que quiere… | Origen inferido al migrar a YAML; confirmar. |
| base | `m16` 16 Realiza retención de seguro sin intención de renuncia. | Origen inferido al migrar a YAML; confirmar. |
| base | `m19` 19 Tipifica renuncia y por grabacion es retencion. | Origen inferido al migrar a YAML; confirmar. |
| 2.0 | `def_client_decides` - El cliente decide cuándo renunciar: no hay restricción de fecha para… | No condicionar la renuncia a una fecha (motivo 5). |
| 2.0 | `def_objection` - Objeción (n_objeciones): cada argumento de retención que el ejecutivo da… | Límite de objeciones condicionado a que el cliente sea tajante. |
| 2.0 | `def_routing` - Derivar: en este call center NO se transfieren llamadas. Derivar es… | En este call center no se transfieren llamadas. |
| 2.0 | `m1` 1 Deja en espera por tiempo excesivo. | Espera de más de 30 s. |
| 2.0 | `m10` 10 Su atención no se ajusta a la política de BancoEstado. | Motivo 10 = mal trato (ya no es residual). |
| 2.0 | `m11` 11 Descalifica a los pares, a BancoEstado o a la competencia. | Incluye a otros ejecutivos. |
| 2.0 | `m13` 13 No indica número de seguro en protocolo de cierre. | N° de seguro MUS A Neto. |
| 2.0 | `m15` 15 No se informa medio de pago en protocolo de cierre. | No aplica con medio de pago OTRO. |
| 2.0 | `m18` 18 Tipifica motivo de renuncia incorrecto. | Basta con uno de los motivos. |
| 2.0 | `m3` 3 Excede 3 objeciones máximo para retención. | Máximo de objeciones condicionado a cliente tajante. |
| 2.0 | `m31` 31 No valida correctamente al cliente, (Rut, Nombre, Fecha Nacimiento).… | Criterio del cliente (notas de la pauta, reunión del 2026-10-09). |
| 2.0 | `m33` 33 No valida correctamente al cliente, (Email, Fono). Protocolo de… | Un dato distinto al registrado es solo observación. |
| 2.0 | `m4` 4 No indica ninguna característica del seguro a renunciar. | Mínimo 1 característica; el nombre no cuenta. |
| 2.0 | `m5` 5 No informa que la permanencia la maneja cliente ante consulta directa. | No condicionar la renuncia a una fecha. |
| 2.0 | `m6` 6 No maneja información del producto o coberturas. | No negar ni desviar información, salvo fechas de pago. |
| 2.0 | `m7` 7 No realiza derivación correcta. | No se transfieren llamadas. |
| 2.0 | `r10` 10. Omitir información del seguro (no mencionar todas las coberturas) se… | Omitir información no es incumplimiento (salvo el 4); dar información incorrecta sí. |
| 2.6 | `m16` 16 Realiza retención de seguro sin intención de renuncia. | Solo se retiene el seguro cuya cancelación pidió el cliente (reunión con Verónica). |
| 2.6 | `m18` 18 Tipifica motivo de renuncia incorrecto. | Más flexible: basta con que tenga sentido (reunión con Verónica). En v2.4 se marcaba en 29 a 34 de 100. |

### Feedback de validación

| Versión | Ítem | Qué cambió |
|---|---|---|
| 1.1 | `m10` 10 Su atención no se ajusta a la política de BancoEstado. | Los modelos lo marcaban casi siempre. |
| 1.1 | `m32` 32 Predispone al cliente para la aceptación del seguro, condiciona la… | Excluye la confirmación neutra del cierre. |
| 1.1 | `r8` 8. Escribe PRIMERO el "comentario" y DESPUÉS decide el "estado". Deben ser… | Comentario antes que estado, con regla de coherencia: los modelos marcaban incumple y en el comentario se corregían. |
| 1.1 | `r9` 9. Marca cada conducta en el motivo MÁS ESPECÍFICO que la describa. No la… | Regla del motivo más específico: los modelos marcaban el 10 casi siempre. |
| 2.0 | `r12` 12. Responde con la herramienta registrar_auditoria si está disponible; si… | Sonnet 5.5 simulaba la llamada a la herramienta en texto. |
| 2.2 | `m29` 29 No realiza protocolo de cierre. | Solo incumple sin ningún resumen; ejemplos. Haiku 4.5 y GPT-6 Luna marcaban cierres que no seguían el guion al pie de la letra. |
| 2.3 | `d_policies` - Por cada seguro del cliente consultado en la llamada: los datos de… | Ficha estándar (docs/layer2-product-sheet.md). Datos personales registrados no vienen y se asumen correctos: Haiku marcaba indeterminados de más. |
| 2.3 | `m26` 26 No se impactan todas las gestiones solicitadas por el cliente. | No basta con "quedó todo listo": los modelos le creían. |
| 2.3 | `m32` 32 Predispone al cliente para la aceptación del seguro, condiciona la… | Las preguntas que ofrecen una alternativa son argumentos. |
| 2.3 | `m8` 8 No responde de forma directa al cliente. Elude las preguntas. | Se marca junto con el 6 cuando elude una pregunta del producto. |
| 2.3 | `r5` 5. "indeterminado": la transcripción es ambigua, está cortada, es… | Indeterminado solo si el dato que falta cambiaría el resultado: Haiku marcaba indeterminados de más. |
| 2.3 | `r9` 9. Marca cada conducta en el motivo MÁS ESPECÍFICO que la describa. No la… | Pares que sí van juntos (8+6, 26+25, 9+7): DeepSeek, GPT-6 Luna y Haiku 5.5 dejaban solo el 6. |
| 2.4 | `r13` 13. Información del seguro: antes de evaluar, revisa si la FICHA sirve para… | informacion_seguro (OK / SIN_FICHA / NO_CORRESPONDE): con una ficha equivocada todas las IA marcaban el motivo 2. |
| 2.5 | `d_policies` - Por cada seguro del cliente consultado en la llamada: los datos de… | CONTRATO del cliente; manda sobre la ficha en plan, prima y monto. Gemini 3.8 Flash marcaba el motivo 2 en 41 de 100 llamadas reales. |
| 2.5 | `m2` 2 Descripción del seguro corresponde a otro seguro. | El CONTRATO del cliente no incumple. |
| 2.5 | `r13` 13. Información del seguro: antes de evaluar, revisa si la FICHA sirve para… | Un plan, prima o monto igual al CONTRATO no es NO_CORRESPONDE. |
| 2.7 | `def_client_decides` - El cliente decide cuándo renunciar: no hay restricción de fecha para… | Tampoco condicionarla a una acción previa (retirar el ahorro, validar un cobro). |
| 2.7 | `def_client_requests` - Solicitudes del cliente ("solicitudes_cliente"): registra cada pedido o… | Desconocimiento, devolución o cobro incorrecto exigen orientar al requerimiento; otro seguro mencionado debe gestionarse. |
| 2.7 | `def_final_decision` - Decisión final del cliente ("decision_final", por cada seguro con… | Retención NO_ACEPTADA = RENUNCIA por grabación: causa más común de llamadas rechazadas que Gemini aprobaba. |
| 2.7 | `def_product_claims` - Afirmaciones sobre el producto ("afirmaciones_producto"): registra lo que… | Materialidad en 2 y 6: GPT-6 Luna marcaba diferencias de redondeo y Gemini no contrastaba con la ficha. |
| 2.7 | `m1` 1 Deja en espera por tiempo excesivo. | Solo esperas atribuibles al ejecutivo. |
| 2.7 | `m2` 2 Descripción del seguro corresponde a otro seguro. | Solo afirmaciones incorrectas MATERIALES. |
| 2.7 | `m26` 26 No se impactan todas las gestiones solicitadas por el cliente. | decision_final NO_ACEPTADA incumple. |
| 2.7 | `m5` 5 No informa que la permanencia la maneja cliente ante consulta directa. | Ni a una acción previa del cliente. |
| 2.7 | `m6` 6 No maneja información del producto o coberturas. | Solo datos incorrectos MATERIALES. |
| 2.7 | `outcomes` Primero determina, según la grabación, el resultado de cada seguro:… | Con decision_final NO_ACEPTADA el resultado es RENUNCIA. |
| 2.7 | `r13` 13. Información del seguro: antes de evaluar, revisa si la FICHA sirve para… | SIN_FICHA solo si faltan coberturas, montos, primas o devolución: GPT-6 Luna marcaba SIN_FICHA en 60 de 100. |
| 2.7 | `r14` 14. Antes de los "criterios", completa en este orden "solicitudes_cliente",… | Completar solicitudes, afirmaciones y decisión final antes de los criterios (revisión de discrepancias v2.6 en 100 llamadas reales). |
| 2.8 | `def_client_requests` - Solicitudes del cliente ("solicitudes_cliente"): registra cada pedido o… | Auditoría manual: Sonnet marcó el 7 de más en 4 llamadas aprobadas porque el cliente 'no se acordaba' del seguro y luego decidía en la llamada. Solo un reclamo (devolución, cobro incorrecto, contratación no consentida) exige derivar. El 7 sí es real cuando no se le indica adónde ir (229668). |
| 2.8 | `def_final_decision` - Decisión final del cliente ("decision_final", por cada seguro con… | Auditoría manual de 50 llamadas (2026-10-16): Sonnet marcó 24 + 26 de más en 6 llamadas aprobadas (ej. 'Sí, sí, sí lo mantengo' como NO_ACEPTADA). Insistir antes y luego aceptar es retención; mantenerlo hasta que la compañía responda también (229669, 229898). |
| 2.8 | `m11` 11 Descalifica a los pares, a BancoEstado o a la competencia. | Auditoría manual: el ejecutivo confirmó que la ejecutiva de venta informó mal al cliente y ningún modelo lo marcó (230459). |
| 2.8 | `m12` 12 Induce a renuncia. | Auditoría manual: 12 mal aplicado; el ejecutivo gestionaba la renuncia pedida (230188). |
| 2.8 | `m13` 13 No indica número de seguro en protocolo de cierre. | Auditoría manual: rechazada solo porque omitió el 0 de '0389' (229668); Johannes pidió dejar estos casos para revisión en vez de rechazar. Pendiente confirmar con el cliente. |
| 2.8 | `m16` 16 Realiza retención de seguro sin intención de renuncia. | Auditoría manual: 16 mal aplicado; el cliente sí quería renunciar (230188). |
| 2.8 | `m18` 18 Tipifica motivo de renuncia incorrecto. | Auditoría manual: 'Disconformidad con coberturas' tipificado a una clienta que habló de su pensión baja y mencionó otro seguro de salud (230632); otras dos rechazadas por motivo mal tipificado (230196, 229864). |
| 2.8 | `m2` 2 Descripción del seguro corresponde a otro seguro. | Auditoría manual: 2 mal aplicado en 3 llamadas aprobadas (229739, 230212, 230248); Gemini lo marcó de más en 2 corridas. Exige citar la línea de la ficha o el contrato que se contradice. |
| 2.8 | `m24` 24 Tipifica retencion y por grabacion es renuncia. | Auditoría manual: 24 marcado de más cuando el cliente mantenía el seguro (229598, 229669, 229898; Sonnet en 6 llamadas aprobadas). |
| 2.8 | `m3` 3 Excede 3 objeciones máximo para retención. | Auditoría manual: para revisar el 3 hace falta ver todas las objeciones (229669); Sonnet lo marcó de más en 3 llamadas y Gemini en 2. |
| 2.8 | `m32` 32 Predispone al cliente para la aceptación del seguro, condiciona la… | Auditoría manual: rechazadas por predisponer en 3 llamadas (229975, 230530, 230642: 'lo vamos a mantener vigente, ¿verdad?'); Gemini y Sonnet aprobaron 230530 en las 2 corridas. |
| 2.8 | `m5` 5 No informa que la permanencia la maneja cliente ante consulta directa. | Auditoría manual: 5 mal aplicado cuando el ejecutivo sí informaba que el cliente decide (229668, 229669). |
| 2.8 | `m8` 8 No responde de forma directa al cliente. Elude las preguntas. | Auditoría manual: 8 mal aplicado en 3 llamadas (229668, 229669, 229739); los 'claro, claro' eran escucha activa y el ejecutivo respondía después. Sí es real cuando la respuesta no es clara (229888, 230188). |
| 2.9 | `m32` 32 Predispone al cliente para la aceptación del seguro, condiciona la… | Criterio de Johannes (2026-10-20): la coletilla no incumple si antes se informaron el precio y las condiciones y el cliente ya había aceptado mantenerlo. En v2.8 ('basta una coletilla') Sonnet marcó el 32 en 23 de 100 llamadas y en 8 que el auditor aprobó (ej. 'Mantenemos la vigencia, ¿correcto?'). |

## Personalizaciones de la pauta oficial

Motivos con aclaración (`criterion`) sobre el texto oficial, y de dónde viene.

| Motivo | Texto oficial | Origen de la aclaración |
|---:|---|---|
| 1 | Deja en espera por tiempo excesivo. | Feedback de validación, Feedback del cliente |
| 2 | Descripción del seguro corresponde a otro seguro. | Diseño Qubico, Feedback de validación |
| 3 | Excede 3 objeciones máximo para retención. | Feedback de validación, Feedback del cliente |
| 4 | No indica ninguna característica del seguro a renunciar. | Feedback del cliente |
| 5 | No informa que la permanencia la maneja cliente ante consulta directa. | Feedback de validación, Feedback del cliente |
| 6 | No maneja información del producto o coberturas. | Feedback de validación, Feedback del cliente |
| 7 | No realiza derivación correcta. | Diseño Qubico, Feedback del cliente |
| 8 | No responde de forma directa al cliente. Elude las preguntas. | Feedback de validación |
| 9 | Renuncia seguro irrenunciable en este canal. | Catálogo del cliente |
| 10 | Su atención no se ajusta a la política de BancoEstado. | Feedback de validación, Feedback del cliente |
| 11 | Descalifica a los pares, a BancoEstado o a la competencia. | Feedback de validación, Feedback del cliente |
| 12 | Induce a renuncia. | Diseño Qubico, Feedback de validación |
| 13 | No indica número de seguro en protocolo de cierre. | Feedback de validación, Feedback del cliente, Script del cliente |
| 14 | No realiza ningún intento de retención del seguro retenible. | Catálogo del cliente |
| 15 | No se informa medio de pago en protocolo de cierre. | Feedback del cliente |
| 16 | Realiza retención de seguro sin intención de renuncia. | Feedback de validación, Feedback del cliente |
| 17 | Retiene seguro no retenible. | Catálogo del cliente |
| 18 | Tipifica motivo de renuncia incorrecto. | Diseño Qubico, Feedback de validación, Feedback del cliente |
| 19 | Tipifica renuncia y por grabacion es retencion. | Feedback del cliente |
| 20 | Tipifica renuncia de seguro no mencionado. | Diseño Qubico |
| 21 | Tipifica renuncia que corresponde a otro seguro. | Diseño Qubico |
| 24 | Tipifica retencion y por grabacion es renuncia. | Feedback de validación |
| 25 | No tipifica todas las gestiones. | Diseño Qubico |
| 26 | No se impactan todas las gestiones solicitadas por el cliente. | Feedback de validación |
| 27 | Entrega información a tercero, sin retomar protocolo de cierre con el titular. | Script del cliente |
| 28 | Niega devolución de primas. | Catálogo del cliente, Diseño Qubico |
| 29 | No realiza protocolo de cierre. | Feedback de validación, Script del cliente |
| 30 | No reitera protocolo de cierre ante respuesta no permitida. | Script del cliente |
| 31 | No valida correctamente al cliente, (Rut, Nombre, Fecha Nacimiento). Protocolo de acreditación titularidad. | Feedback del cliente, Script del cliente |
| 32 | Predispone al cliente para la aceptación del seguro, condiciona la respuesta a un Si. | Feedback de validación, Script del cliente |
| 33 | No valida correctamente al cliente, (Email, Fono). Protocolo de acreditación titularidad. | Feedback del cliente |

Sin aclaración (solo texto oficial): 22, 23.

## Pendiente con el cliente

- `def_objection`: Confirmar con el cliente el conteo de objeciones.
- `def_client_requests`: Confirmar si se acepta la mesa del banco 800 80 20 20 para reclamos de cobro.
- `def_closing`: Si faltar la información de devolución es motivo 28 o 29.
- `m13`: Confirmar con el cliente si un cero inicial omitido o una diferencia menor en los 4 dígitos incumple el 13.

## Detalle por ítem

| Sección | Ítem | Historial |
|---|---|---|
| intro | `intro` Eres un auditor de calidad de BancoEstado Corredores de Seguros. Evalúas… | base · Diseño Qubico: Rol del auditor y tarea. Origen inferido al migrar a YAML; confirmar. |
| data | `d_policies` - Por cada seguro del cliente consultado en la llamada: los datos de… | 2.0 · Catálogo del cliente: Ficha real del Excel de apoyo: categoría, tipo de prima, regla de devolución y medio de pago.<br>2.1 · Script del cliente: Datos nuevos por seguro: N° de póliza e inicio de vigencia.<br>2.3 · Feedback de validación: Ficha estándar (docs/layer2-product-sheet.md). Datos personales registrados no vienen y se asumen correctos: Haiku marcaba indeterminados de más.<br>2.5 · Feedback de validación: CONTRATO del cliente; manda sobre la ficha en plan, prima y monto. Gemini 3.8 Flash marcaba el motivo 2 en 41 de 100 llamadas reales. |
| data | `d_typification` - La tipificación que registró el ejecutivo. | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| data | `d_holds` - Las esperas y la transcripción con timestamps. | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| data | `d_identify` Identifica de qué seguro se habla por su nombre, su N° de seguro o lo que… | base · Diseño Qubico: Identificar el seguro por nombre o N° de seguro. Origen inferido al migrar a YAML; confirmar. |
| rules | `r1` 1. Evalúa SOLO con la transcripción y los datos entregados. No supongas lo… | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rules | `r2` 2. Cada motivo "incumple" lleva al menos una cita TEXTUAL de la… | base · Diseño Qubico: Cita textual obligatoria para incumplir. Origen inferido al migrar a YAML; confirmar. |
| rules | `r3` 3. Si el motivo exige que el ejecutivo diga algo (ej. N° de seguro en el… | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rules | `r4` 4. "no_aplica": la situación del motivo no se dio (ej. no hubo tercero → 27… | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rules | `r5` 5. "indeterminado": la transcripción es ambigua, está cortada, es… | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar.<br>2.3 · Feedback de validación: Indeterminado solo si el dato que falta cambiaría el resultado: Haiku marcaba indeterminados de más. |
| rules | `r6` 6. La transcripción viene de reconocimiento de voz: no penalices palabras… | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rules | `r7` 7. "confianza" va de 0 a 1. | base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rules | `r8` 8. Escribe PRIMERO el "comentario" y DESPUÉS decide el "estado". Deben ser… | 1.1 · Feedback de validación: Comentario antes que estado, con regla de coherencia: los modelos marcaban incumple y en el comentario se corregían.<br>2.0 · Diseño Qubico: Comentario de 1 frase si cumple o no aplica, para bajar el output. |
| rules | `r9` 9. Marca cada conducta en el motivo MÁS ESPECÍFICO que la describa. No la… | 1.1 · Feedback de validación: Regla del motivo más específico: los modelos marcaban el 10 casi siempre.<br>2.3 · Feedback de validación: Pares que sí van juntos (8+6, 26+25, 9+7): DeepSeek, GPT-6 Luna y Haiku 5.5 dejaban solo el 6. |
| rules | `r10` 10. Omitir información del seguro (no mencionar todas las coberturas) se… | 2.0 · Feedback del cliente: Omitir información no es incumplimiento (salvo el 4); dar información incorrecta sí. |
| rules | `r11` 11. Si en la llamada se gestionan varios seguros, indica en "mus_a_neto" de… | 2.0 · Diseño Qubico: mus_a_neto por criterio, para evaluar por seguro. |
| rules | `r12` 12. Responde con la herramienta registrar_auditoria si está disponible; si… | 2.0 · Feedback de validación: Sonnet 5.5 simulaba la llamada a la herramienta en texto. |
| rules | `r13` 13. Información del seguro: antes de evaluar, revisa si la FICHA sirve para… | 2.4 · Feedback de validación: informacion_seguro (OK / SIN_FICHA / NO_CORRESPONDE): con una ficha equivocada todas las IA marcaban el motivo 2.<br>2.5 · Feedback de validación: Un plan, prima o monto igual al CONTRATO no es NO_CORRESPONDE.<br>2.7 · Feedback de validación: SIN_FICHA solo si faltan coberturas, montos, primas o devolución: GPT-6 Luna marcaba SIN_FICHA en 60 de 100. |
| rules | `r14` 14. Antes de los "criterios", completa en este orden "solicitudes_cliente",… | 2.7 · Feedback de validación: Completar solicitudes, afirmaciones y decisión final antes de los criterios (revisión de discrepancias v2.6 en 100 llamadas reales). |
| definitions | `def_renunciation_intent` - Intención de renuncia: el cliente dice de forma explícita que quiere… | base · Feedback del cliente: Origen inferido al migrar a YAML; confirmar. |
| definitions | `def_retention_argument` - Argumento de retención: lo que dice el ejecutivo para que el cliente… | 2.0 · Diseño Qubico: argumentos_retencion con tipo y orden (indicador del dashboard).<br>2.1 · Script del cliente: Orden de argumentos del script; fecha de renovación al final. |
| definitions | `def_objection` - Objeción (n_objeciones): cada argumento de retención que el ejecutivo da… | 1.1 · Diseño Qubico: Definición explícita de objeción: cuenta el primer argumento.<br>2.0 · Feedback del cliente: Límite de objeciones condicionado a que el cliente sea tajante.<br>2.1 · Script del cliente: Cliente molesto: decir que es parte del protocolo y gestionar la renuncia. Origen inferido al migrar a YAML; confirmar. |
| definitions | `def_client_decides` - El cliente decide cuándo renunciar: no hay restricción de fecha para… | 2.0 · Feedback del cliente: No condicionar la renuncia a una fecha (motivo 5).<br>2.7 · Feedback de validación: Tampoco condicionarla a una acción previa (retirar el ahorro, validar un cobro). |
| definitions | `def_final_decision` - Decisión final del cliente ("decision_final", por cada seguro con… | 2.7 · Feedback de validación: Retención NO_ACEPTADA = RENUNCIA por grabación: causa más común de llamadas rechazadas que Gemini aprobaba.<br>2.8 · Feedback de validación: Auditoría manual de 50 llamadas (2026-10-16): Sonnet marcó 24 + 26 de más en 6 llamadas aprobadas (ej. 'Sí, sí, sí lo mantengo' como NO_ACEPTADA). Insistir antes y luego aceptar es retención; mantenerlo hasta que la compañía responda también (229669, 229898). |
| definitions | `def_client_requests` - Solicitudes del cliente ("solicitudes_cliente"): registra cada pedido o… | 2.7 · Feedback de validación: Desconocimiento, devolución o cobro incorrecto exigen orientar al requerimiento; otro seguro mencionado debe gestionarse.<br>2.8 · Feedback de validación: Auditoría manual: Sonnet marcó el 7 de más en 4 llamadas aprobadas porque el cliente 'no se acordaba' del seguro y luego decidía en la llamada. Solo un reclamo (devolución, cobro incorrecto, contratación no consentida) exige derivar. El 7 sí es real cuando no se le indica adónde ir (229668). |
| definitions | `def_product_claims` - Afirmaciones sobre el producto ("afirmaciones_producto"): registra lo que… | 2.7 · Feedback de validación: Materialidad en 2 y 6: GPT-6 Luna marcaba diferencias de redondeo y Gemini no contrastaba con la ficha. |
| definitions | `def_closing` - Protocolo de cierre (script). Aplica cuando hubo gestión de renuncia o de… | 1.1 · Diseño Qubico: Cuándo aplica el protocolo de cierre.<br>2.1 · Script del cliente: Protocolo de cierre del script, separado para retención y renuncia; respuestas válidas; devolución automática en cobro anticipado. |
| definitions | `def_identity` - Acreditación de titularidad (script): el ejecutivo pide el RUT y valida… | 2.1 · Script del cliente: Acreditación de titularidad del script. |
| definitions | `def_third_party` - Tercero: cualquier persona distinta del titular. Solo se entrega… | 2.1 · Script del cliente: Terceros, discapacidad y seguros de empresa. Contradice al Excel de apoyo: manda el script. |
| definitions | `def_routing` - Derivar: en este call center NO se transfieren llamadas. Derivar es… | 2.0 · Feedback del cliente: En este call center no se transfieren llamadas.<br>2.0 · Catálogo del cliente: Procedimientos de derivación de la hoja Otros del Excel de apoyo. |
| definitions | `def_refund` - Devolución de prima (motivo 28), según el tipo de prima del seguro: ·… | 2.0 · Catálogo del cliente: Regla de devolución por tipo de prima (hoja Otros del Excel de apoyo). |
| definitions | `def_withdrawal` - Retracto: solo para seguros contratados a distancia, dentro de 10 días… | 2.1 · Script del cliente: Retracto se gestiona como renuncia. Contradice al Excel de apoyo: manda el script. |
| definitions | `def_travel` - Seguro de viajes: solo se puede renunciar hasta el día anterior al viaje;… | 2.0 · Catálogo del cliente: Origen inferido al migrar a YAML; confirmar. |
| rubric | `rubric_intro` Texto oficial de la "Pauta Calidad Actualizada". Las líneas "Criterio:" son… | 1.1 · Texto oficial: Texto oficial de la pauta; las aclaraciones van aparte como "Criterio:". |
| rubric_a | `m31` 31 No valida correctamente al cliente, (Rut, Nombre, Fecha Nacimiento).… | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Criterio del cliente (notas de la pauta, reunión del 2026-10-09).<br>2.1 · Script del cliente: También incumple si continúa con datos que no coinciden. |
| rubric_a | `m33` 33 No valida correctamente al cliente, (Email, Fono). Protocolo de… | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Un dato distinto al registrado es solo observación. |
| rubric_a | `m29` 29 No realiza protocolo de cierre. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.1 · Script del cliente: Cierre según el script.<br>2.2 · Feedback de validación: Solo incumple sin ningún resumen; ejemplos. Haiku 4.5 y GPT-6 Luna marcaban cierres que no seguían el guion al pie de la letra. |
| rubric_a | `m30` 30 No reitera protocolo de cierre ante respuesta no permitida. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.1 · Script del cliente: Respuestas válidas a la confirmación y repregunta. |
| rubric_a | `m13` 13 No indica número de seguro en protocolo de cierre. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: N° de seguro MUS A Neto.<br>2.1 · Script del cliente: Bastan los 4 últimos dígitos.<br>2.8 · Feedback de validación: Auditoría manual: rechazada solo porque omitió el 0 de '0389' (229668); Johannes pidió dejar estos casos para revisión en vez de rechazar. Pendiente confirmar con el cliente. |
| rubric_a | `m15` 15 No se informa medio de pago en protocolo de cierre. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: No aplica con medio de pago OTRO. |
| rubric_a | `m27` 27 Entrega información a tercero, sin retomar protocolo de cierre con el… | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.1 · Script del cliente: Solo con el titular o el representante legal. |
| rubric_b | `m4` 4 No indica ninguna característica del seguro a renunciar. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Mínimo 1 característica; el nombre no cuenta. |
| rubric_b | `m2` 2 Descripción del seguro corresponde a otro seguro. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Diseño Qubico: Distinción 2 vs 6: el 2 es lo que describe por iniciativa propia.<br>2.5 · Feedback de validación: El CONTRATO del cliente no incumple.<br>2.7 · Feedback de validación: Solo afirmaciones incorrectas MATERIALES.<br>2.8 · Feedback de validación: Auditoría manual: 2 mal aplicado en 3 llamadas aprobadas (229739, 230212, 230248); Gemini lo marcó de más en 2 corridas. Exige citar la línea de la ficha o el contrato que se contradice. |
| rubric_b | `m6` 6 No maneja información del producto o coberturas. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: No negar ni desviar información, salvo fechas de pago.<br>2.7 · Feedback de validación: Solo datos incorrectos MATERIALES. |
| rubric_b | `m5` 5 No informa que la permanencia la maneja cliente ante consulta directa. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: No condicionar la renuncia a una fecha.<br>2.7 · Feedback de validación: Ni a una acción previa del cliente.<br>2.8 · Feedback de validación: Auditoría manual: 5 mal aplicado cuando el ejecutivo sí informaba que el cliente decide (229668, 229669). |
| rubric_b | `m28` 28 Niega devolución de primas. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>1.1 · Diseño Qubico: Usa el tipo de prima del seguro.<br>2.0 · Catálogo del cliente: Regla de devolución por tipo de prima. |
| rubric_c | `m14` 14 No realiza ningún intento de retención del seguro retenible. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Catálogo del cliente: Aplica a seguros de categoría RETENIBLE. |
| rubric_c | `m17` 17 Retiene seguro no retenible. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Catálogo del cliente: Categoría distinta de RETENIBLE. |
| rubric_c | `m9` 9 Renuncia seguro irrenunciable en este canal. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Catálogo del cliente: Seguros NO RENUNCIABLES del catálogo. |
| rubric_c | `m16` 16 Realiza retención de seguro sin intención de renuncia. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>base · Feedback del cliente: Origen inferido al migrar a YAML; confirmar.<br>2.6 · Feedback del cliente: Solo se retiene el seguro cuya cancelación pidió el cliente (reunión con Verónica).<br>2.8 · Feedback de validación: Auditoría manual: 16 mal aplicado; el cliente sí quería renunciar (230188). |
| rubric_c | `m3` 3 Excede 3 objeciones máximo para retención. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Máximo de objeciones condicionado a cliente tajante.<br>2.8 · Feedback de validación: Auditoría manual: para revisar el 3 hace falta ver todas las objeciones (229669); Sonnet lo marcó de más en 3 llamadas y Gemini en 2. |
| rubric_c | `m12` 12 Induce a renuncia. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar.<br>2.8 · Feedback de validación: Auditoría manual: 12 mal aplicado; el ejecutivo gestionaba la renuncia pedida (230188). |
| rubric_c | `m32` 32 Predispone al cliente para la aceptación del seguro, condiciona la… | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>1.1 · Feedback de validación: Excluye la confirmación neutra del cierre.<br>2.1 · Script del cliente: Las preguntas del script no son el 32.<br>2.3 · Feedback de validación: Las preguntas que ofrecen una alternativa son argumentos.<br>2.8 · Feedback de validación: Auditoría manual: rechazadas por predisponer en 3 llamadas (229975, 230530, 230642: 'lo vamos a mantener vigente, ¿verdad?'); Gemini y Sonnet aprobaron 230530 en las 2 corridas.<br>2.9 · Feedback de validación: Criterio de Johannes (2026-10-20): la coletilla no incumple si antes se informaron el precio y las condiciones y el cliente ya había aceptado mantenerlo. En v2.8 ('basta una coletilla') Sonnet marcó el 32 en 23 de 100 llamadas y en 8 que el auditor aprobó (ej. 'Mantenemos la vigencia, ¿correcto?'). |
| rubric_c | `m7` 7 No realiza derivación correcta. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>1.1 · Diseño Qubico: Incluye seguros no renunciables en el canal.<br>2.0 · Feedback del cliente: No se transfieren llamadas. |
| rubric_c | `m26` 26 No se impactan todas las gestiones solicitadas por el cliente. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.3 · Feedback de validación: No basta con "quedó todo listo": los modelos le creían.<br>2.7 · Feedback de validación: decision_final NO_ACEPTADA incumple. |
| rubric_d | `m1` 1 Deja en espera por tiempo excesivo. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Espera de más de 30 s.<br>2.7 · Feedback de validación: Solo esperas atribuibles al ejecutivo. |
| rubric_d | `m8` 8 No responde de forma directa al cliente. Elude las preguntas. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.3 · Feedback de validación: Se marca junto con el 6 cuando elude una pregunta del producto.<br>2.8 · Feedback de validación: Auditoría manual: 8 mal aplicado en 3 llamadas (229668, 229669, 229739); los 'claro, claro' eran escucha activa y el ejecutivo respondía después. Sí es real cuando la respuesta no es clara (229888, 230188). |
| rubric_d | `m11` 11 Descalifica a los pares, a BancoEstado o a la competencia. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Incluye a otros ejecutivos.<br>2.8 · Feedback de validación: Auditoría manual: el ejecutivo confirmó que la ejecutiva de venta informó mal al cliente y ningún modelo lo marcó (230459). |
| rubric_d | `m10` 10 Su atención no se ajusta a la política de BancoEstado. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>1.1 · Feedback de validación: Los modelos lo marcaban casi siempre.<br>2.0 · Feedback del cliente: Motivo 10 = mal trato (ya no es residual). |
| rubric_e | `outcomes` Primero determina, según la grabación, el resultado de cada seguro:… | 2.0 · Diseño Qubico: Resultado CONSULTA y lista de motivos de renuncia.<br>2.7 · Feedback de validación: Con decision_final NO_ACEPTADA el resultado es RENUNCIA. |
| rubric_e | `m18` 18 Tipifica motivo de renuncia incorrecto. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.0 · Feedback del cliente: Basta con uno de los motivos.<br>2.6 · Feedback del cliente: Más flexible: basta con que tenga sentido (reunión con Verónica). En v2.4 se marcaba en 29 a 34 de 100.<br>2.8 · Diseño Qubico: Si incumple, sugiere de 1 a 3 motivos correctos, del más al menos adecuado, con la cita que los respalda (motivos_sugeridos), para que el auditor corrija la tipificación.<br>2.10 · Diseño Qubico: Pedido de Johannes (2026-10-22): si incumple, al menos 3 motivos sugeridos que calcen mejor que el tipificado, en vez de 1 a 3, para que el auditor tenga opciones al corregir la tipificación.<br>2.8 · Feedback de validación: Auditoría manual: 'Disconformidad con coberturas' tipificado a una clienta que habló de su pensión baja y mencionó otro seguro de salud (230632); otras dos rechazadas por motivo mal tipificado (230196, 229864). |
| rubric_e | `m19` 19 Tipifica renuncia y por grabacion es retencion. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>base · Feedback del cliente: Origen inferido al migrar a YAML; confirmar. |
| rubric_e | `m24` 24 Tipifica retencion y por grabacion es renuncia. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>2.8 · Feedback de validación: Auditoría manual: 24 marcado de más cuando el cliente mantenía el seguro (229598, 229669, 229898; Sonnet en 6 llamadas aprobadas). |
| rubric_e | `m20` 20 Tipifica renuncia de seguro no mencionado. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rubric_e | `m21` 21 Tipifica renuncia que corresponde a otro seguro. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rubric_e | `m22` 22 Tipifica retención de seguro no mencionado. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada. |
| rubric_e | `m23` 23 Tipifica retención que corresponde a otro seguro. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada. |
| rubric_e | `m25` 25 No tipifica todas las gestiones. | 1.1 · Texto oficial: Texto oficial de la Pauta de Calidad Actualizada.<br>base · Diseño Qubico: Origen inferido al migrar a YAML; confirmar. |
| rubric_reasons | `renunciation_reasons` No desea contraer más obligaciones | Problemas Económicos | Cliente posee… | base · Texto oficial: Lista oficial de Motivos de Renuncia. |
