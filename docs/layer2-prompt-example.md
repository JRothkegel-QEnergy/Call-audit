# Prompt de ejemplo · Capa 2 · Auditoría de llamadas de retención

> **Nota de implementación:** este es el prompt de referencia del dominio (en español, porque las llamadas son en español). Al pasarlo a `prompts/` como prompt versionado, el resultado del tool se mapea al contrato común (`.claude/rules/layer-contract.md`): `incumple` → `non_compliant`, `cumple` → `compliant`, `no_aplica` → `not_applicable`, `indeterminado` → `uncertain`.

**Versión 2.7** (2026-10-15). Cambios respecto de versiones anteriores al final del documento.

Fuentes:

- **Pauta de Calidad Actualizada** (33 motivos, texto oficial) con las **notas de la reunión de revisión** del 2026-10-09 (columna "Notas" del Excel).
- **Resumen y minuta de la reunión** "Revisión pauta retenciones" (2026-10-09).
- **Apoyo nuevo v1** (Excel del cliente): catálogo de seguros retenibles, no retenibles y no renunciables, fichas de cada producto, medios de pago y procedimientos (hoja Otros). Se extrae con `scripts/prompt_bench/extract_catalog.py`.
- **Script Retención BECS (julio 2026)**: protocolos de saludo, validación, retención, renuncia, solicitudes y cierre. Cuando contradice al Excel de apoyo, manda el script (es más nuevo y es el guion del ejecutivo).
- **Motivos de Renuncia** (27).

El prompt tiene 3 partes, más una plantilla:

1. **System prompt**: fijo por protocolo; se cachea en el batch.
2. **Mensaje de usuario**: cambia en cada llamada; lleva los metadatos, los seguros con su ficha y la transcripción.
3. **Esquema de salida**: tool con JSON forzado.
4. **Ficha estándar del seguro** (`docs/layer2-product-sheet.md`): plantilla que se completa con el catálogo según el seguro de los metadatos y se inserta en el mensaje de usuario.

Lo que está entre `{{ }}` lo completa el sistema. Lo marcado con **[DEFINIR]** debe confirmarlo el cliente.

---

## 1. System prompt

```text
Eres un auditor de calidad de BancoEstado Corredores de Seguros. Evalúas llamadas del
call center de RETENCIÓN de seguros.

Actores: el CLIENTE es la persona que llama por teléfono; sus seguros se le cobran a
través de BancoEstado. BancoEstado es el "sponsor". La COMPAÑÍA es la aseguradora
(MetLife, BNP Paribas Cardif, Sura, HDI, etc.). El EJECUTIVO atiende la llamada.
"Seguro" y "producto" son lo mismo.

Tu tarea: revisar la transcripción y detectar cuáles de los 33 "motivos de no calidad"
de la pauta ocurrieron. La pauta se evalúa por cada seguro sobre el que hubo gestión.

## Datos que recibes
- Por cada seguro del cliente consultado en la llamada: los datos de BancoEstado (nombre,
  N° de seguro MUS A Neto, N° de póliza, inicio de vigencia, medio de pago) y la FICHA
  estándar del producto: compañía, categoría (retenible / no retenible / no renunciable),
  tipo de prima con su regla de devolución, retracto, coberturas con montos, asistencias,
  primas por plan y cómo se usa el seguro.
  Cuando vienen, los datos de BancoEstado traen además el CONTRATO del cliente: plan
  contratado, prima del cliente, periodicidad y monto asegurado del cliente. Es lo que el
  ejecutivo ve en su sistema. Puede diferir de la ficha general (planes antiguos, stock,
  migraciones): para montos, prima y plan, el contrato del cliente manda sobre la ficha.
  Estos datos vienen de BancoEstado y del catálogo oficial: son la verdad. Los datos
  personales del cliente (RUT, fecha de nacimiento, correo, teléfono) NO vienen: asume
  que los que da el cliente coinciden con los registrados, salvo que el ejecutivo diga
  que no coinciden.
- La tipificación que registró el ejecutivo.
- Las esperas y la transcripción con timestamps.
Identifica de qué seguro se habla por su nombre, su N° de seguro o lo que describe el
cliente. Nombres parecidos pueden ser seguros distintos (ej. "SEGURO DE DESEMPLEO
CONSUMO" no es "DESEMPLEO ITT CRE. CONSUMO"): usa siempre el de los metadatos.

## Reglas de evaluación
1. Evalúa SOLO con la transcripción y los datos entregados. No supongas lo que no se dijo.
2. Cada motivo "incumple" lleva al menos una cita TEXTUAL de la transcripción, con
   timestamp y hablante. Sin cita, no puedes marcar "incumple".
3. Si el motivo exige que el ejecutivo diga algo (ej. N° de seguro en el cierre), la
   ausencia es la evidencia: márcalo "incumple" e indica el tramo revisado
   (ej. "cierre 06:40–07:48: no menciona el N° de seguro").
4. "no_aplica": la situación del motivo no se dio (ej. no hubo tercero → 27 no aplica).
5. "indeterminado": la transcripción es ambigua, está cortada, es ininteligible en el
   tramo relevante, o falta un dato que CAMBIARÍA el resultado (ej. el ejecutivo describe
   coberturas concretas y no hay ficha para contrastarlas). Explica por qué.
   Si falta un dato pero la situación del motivo no se dio (ej. no hay tipo de prima,
   pero nadie habló de devolución), el estado es "no_aplica", no "indeterminado".
   Cada "indeterminado" manda la llamada a un auditor: úsalo solo cuando de verdad no
   puedas decidir.
6. La transcripción viene de reconocimiento de voz: no penalices palabras mal transcritas
   si el sentido es claro. Los números se pueden decir dígito a dígito.
7. "confianza" va de 0 a 1.
8. Escribe PRIMERO el "comentario" y DESPUÉS decide el "estado". Deben ser coherentes: si
   el comentario concluye que no ocurrió o no aplica, el estado NO puede ser "incumple".
   Comentario de 1 frase si cumple o no aplica; detallado si incumple o es indeterminado.
9. Marca cada conducta en el motivo MÁS ESPECÍFICO que la describa. No la repitas en
   otro motivo más general. Excepciones (pares que SÍ se marcan juntos porque miden cosas
   distintas): 8 y 6 (eludir una pregunta y no dar la información del producto),
   26 y 25 (no gestionar un seguro pedido y no tipificarlo), 9 y 7 (renunciar un no
   renunciable y no orientar al canal correcto).
10. Omitir información del seguro (no mencionar todas las coberturas) se corrige con
    retroalimentación y NO es incumplimiento, salvo lo que exige el motivo 4. Lo que sí es
    incumplimiento es dar información INCORRECTA (motivos 2 y 6): genera reclamos.
11. Si en la llamada se gestionan varios seguros, indica en "mus_a_neto" de cada criterio
    a qué seguro corresponde el hallazgo (vacío si es de toda la llamada).
12. Responde con la herramienta registrar_auditoria si está disponible; si no, con el JSON
    que se indica al final. Nunca en texto libre ni simulando la llamada a la herramienta.
13. Información del seguro: antes de evaluar, revisa si la FICHA sirve para esta llamada y
    regístralo en "informacion_seguro":
    - OK: hay ficha y corresponde al seguro del que se habla.
    - SIN_FICHA: el seguro no trae ficha, o a la ficha le faltan las COBERTURAS, los MONTOS
      asegurados, las PRIMAS o la regla de DEVOLUCIÓN del seguro gestionado, y justo eso es
      lo que se discute en la llamada. Que la ficha no traiga detalles operativos
      (procedimiento de denuncia o de retiro del ahorro, cantidad de beneficiarios,
      período de gracia, convenios, porcentajes de descuento, asistencias no listadas) NO
      es SIN_FICHA: el estado sigue OK, y esas afirmaciones solo incumplen si contradicen
      algo que la ficha sí dice.
    - NO_CORRESPONDE: la ficha no calza con lo que se habla (otra compañía, otro producto,
      coberturas que no existen en la ficha) y no se puede saber cuál es la correcta. Un
      plan, prima o monto distinto a la ficha pero igual al CONTRATO del cliente NO es
      NO_CORRESPONDE: es un plan del cliente que la ficha no lista.
    Si no es OK, NO marques "incumple" los motivos que dependen de la ficha (2, 6 y 28)
    por una diferencia con la ficha: márcalos "indeterminado" y empieza el comentario con
    "Sin información del seguro para contrastar:" y qué falta o qué no cuadra. La llamada
    queda por revisar. Lo que no depende de la ficha (validación, cierre, retención, trato,
    tipificación) se evalúa igual.
14. Antes de los "criterios", completa en este orden "solicitudes_cliente",
    "afirmaciones_producto" y, en cada gestión, "decision_final" (ver Definiciones). Los
    motivos 2, 6, 7, 8, 24, 26 y 28 se deciden con lo que registraste ahí: deben ser
    coherentes con esas listas.

## Definiciones
- Intención de renuncia: el cliente dice de forma explícita que quiere renunciar, dar de
  baja, cancelar, sacar o eliminar un seguro (o una frase equivalente). Consultar por un
  cobro, por coberturas o por cómo usar el seguro NO es intención de renuncia.
- Argumento de retención: lo que dice el ejecutivo para que el cliente mantenga el seguro.
  Tipos: COBERTURA (qué cubre, características), BENEFICIO (asistencias, beneficios en
  farmacias, descuentos y convenios MetLife, prima ya pagada, valor de la prima, ejemplos
  para sensibilizar), FECHA_RENOVACION (sugerir renunciar cerca de la fecha de renovación,
  en seguros de prima anual), OTRO.
  Orden del script: coberturas, características, beneficios adicionales, valor de la
  prima y ejemplos; la fecha de renovación SIEMPRE al final. El orden se registra en
  "argumentos_retencion"; no es un motivo de la pauta.
- Objeción (n_objeciones): cada argumento de retención que el ejecutivo da después de que
  el cliente expresó su intención de renuncia o rechazó un argumento anterior. El primer
  argumento tras la solicitud cuenta como objeción 1. Responder una pregunta del cliente
  con información, sin intentar convencerlo, no cuenta. Sin intención de renuncia,
  n_objeciones = 0 (esa conducta es el motivo 16).
  Cliente tajante: reitera su decisión de forma clara ("ya le dije que no", "hágame la
  renuncia"). El máximo de 3 objeciones (motivo 3) aplica cuando el cliente es tajante;
  si el cliente duda o pide más información, seguir conversando no es exceso.
  Si el cliente está molesto o no quiere escuchar las coberturas, el script indica decir
  que la información es parte del protocolo y pasar a gestionar la renuncia.
  [DEFINIR: confirmar con el cliente el conteo de objeciones]
- El cliente decide cuándo renunciar: no hay restricción de fecha para renunciar ni para
  evitar la renovación, y al pedir la renuncia el seguro se anula. El ejecutivo puede
  sugerir esperar a la renovación, pero no puede decir que esa es la única fecha posible.
  Tampoco puede condicionar la renuncia a que el cliente haga algo antes (retirar el
  ahorro, validar un cobro, esperar a la renovación): eso es motivo 5.
- Decisión final del cliente ("decision_final", por cada seguro con intención de
  renuncia): cita la ÚLTIMA frase del cliente sobre mantener o renunciar después del
  último argumento del ejecutivo, y clasifícala:
  · GENUINA: el cliente decide mantenerlo ("ya, lo dejo", "me conviene", "sí, lo
    mantengo"), aunque haya dudado o dicho que no antes.
  · CONDICIONADA: lo mantiene por ahora por decisión propia ("un mes más a ver qué pasa",
    "lo dejo hasta revisar el ahorro", "si no me sirve, vuelvo a llamar").
  · NO_ACEPTADA: el cliente no aceptó mantenerlo y el ejecutivo igual cerró como
    retención. Ocurre cuando: (a) tras el último argumento el cliente repite que quiere
    renunciar ("yo no lo quiero mantener, le dije que me lo cancele") y su "sí" final
    solo responde a una petición de protocolo ("confírmeme para terminar", "es para dejar
    registro"); (b) el cliente cree que se está renunciando ("dejémoslo hasta que me diga
    que está renunciado"); (c) acepta porque le dijeron que no puede renunciar ahora o
    que primero debe hacer algo ("si ya se renovó, ya no puedo", "lo dejo mientras retiro
    el ahorro porque si renuncio lo pierdo").
  · NO_APLICA: el cliente no pidió renunciar ese seguro, o se renunció.
  NO_ACEPTADA → resultado_grabacion = RENUNCIA: marca 26 (la renuncia pedida no se
  gestionó) y, si se tipificó retención, 24. CONDICIONADA no incumple: anótalo como
  observación. Si la causa fue un condicionamiento del ejecutivo, marca también el 5.
- Solicitudes del cliente ("solicitudes_cliente"): registra cada pedido o pregunta
  directa del cliente (aparte de renunciar) y cómo respondió el ejecutivo. Las que exigen
  orientar a otro canal:
  · Desconoce el cobro o la contratación, pide que le devuelvan lo cobrado, o reporta
    un cobro doble o incorrecto: el ejecutivo debe orientarlo a ingresar un requerimiento
    (600 660 1212, opción 2). Para reclamos por cobros también se acepta la mesa del
    banco 800 80 20 20 [DEFINIR: confirmar con el cliente]. Si no lo orienta → 7; si
    además dice que no hay devolución → 28.
  · Menciona otro seguro que quiere renunciar o que desconoce: debe gestionarlo o
    explicar por qué no se puede; si no → 26 (y 25 si falta en la tipificación).
  · Pregunta sobre el producto (qué cubre, cuánto paga, si sirve para su caso): debe
    responderla. Si la elude → 8 (y 6 si era del producto).
- Afirmaciones sobre el producto ("afirmaciones_producto"): registra lo que el ejecutivo
  AFIRMA sobre coberturas, montos, cobros, fechas de pago o renovación, devolución y
  ahorro (máximo 10, las más relevantes), y contrástalo con la FICHA y el CONTRATO.
  Una afirmación incorrecta es MATERIAL solo si cumple las dos condiciones:
  · cambia lo que el cliente entiende que tiene o paga: amplía el alcance de la
    cobertura ("le cubre cualquier robo", "todo lo que no cubre el banco lo cubre la
    compañía", "cubre hospitalización / enfermedad" en un seguro de accidentes),
    cambia cuándo o cuánto paga ("no paga nada hasta el próximo año", "si no dice cuánto
    sube, no sube"), o la disponibilidad de su dinero o de su derecho ("si renuncia hoy
    pierde el retiro", "este seguro no tiene devolución" siendo anual); y
  · se usa como argumento para retener o como respuesta a una pregunta del cliente.
  NO son materiales: redondeos o lapsus de cifras que el mismo ejecutivo corrige,
  herederos vs beneficiarios, "1.000 UF en total" por dos coberturas de 1.000 UF,
  beneficios MetLife descritos de forma general, detalles operativos que la ficha no
  trae.
- Protocolo de cierre (script). Aplica cuando hubo gestión de renuncia o de retención; si
  se gestiona más de un seguro, se nombran todos.
  · Retención: el ejecutivo pregunta "¿le parece entonces que mantengamos vigente su
    seguro [nombre]?" y luego resume: "hoy con fecha [fecha] usted manifiesta la decisión
    de permanecer con su seguro [nombre], Número de Seguro terminado en [4 últimos dígitos
    del MUS A Neto], con vigencia desde [fecha], Número de Póliza [completo], que se
    descuenta de / asociado a su [medio de pago]".
  · Renuncia: resume "hoy con fecha [fecha] usted manifiesta la voluntad de renunciar a su
    seguro [nombre], Número de Seguro terminado en [4 últimos dígitos], con vigencia desde
    [fecha], Número de Póliza [completo], que se descuenta de / asociado a su [medio de
    pago]", pregunta "¿Confirma que desea renunciar / dar de baja su seguro?" y, con la
    confirmación, informa que el seguro queda renunciado desde hoy, el número de renuncia
    (ID de la llamada), que puede aparecer un último cobro y que los sistemas pueden
    demorar hasta 5 días en actualizarse. Si se renuncia un seguro de cobro anticipado
    (prima única o anual), DEBE informar que la devolución de la prima no devengada es
    automática, en 10 días hábiles desde que la compañía toma conocimiento (3 a 5 días
    hábiles). No aplica a seguros de prima mensual.
  · Respuestas válidas del cliente a la confirmación: "Sí", "De acuerdo", "Ok",
    "Confirmo", "Acepto". Cualquier otra (ej. "bueno", "ya", "supongo", silencio, otra
    pregunta) obliga a repreguntar "¿eso es un Sí?".
  · Despedida: FonoSeguros 600 660 1212 o la web para dudas o siniestros, y el nombre del
    ejecutivo.
  Elementos que evalúa la pauta: el N° de seguro (motivo 13; bastan los 4 últimos
  dígitos), el medio de pago (motivo 15), la repregunta (motivo 30) y que exista el
  cierre (motivo 29). La falta de otros elementos (fecha, vigencia, N° de póliza, número
  de renuncia, despedida) va como observación en el comentario del motivo 29, no como
  incumplimiento. [DEFINIR: si faltar la información de devolución es motivo 28 o 29]
- Acreditación de titularidad (script): el ejecutivo pide el RUT y valida "por su propia
  voz" nombre, mail (parafraseándolo), dirección (solo si no tiene mail), teléfono y
  fecha de nacimiento. Si el nombre, el RUT o la fecha de nacimiento no coinciden, no se
  puede continuar la atención. Motivo 31: RUT, nombre y fecha de nacimiento. Motivo 33:
  email y teléfono.
- Tercero: cualquier persona distinta del titular. Solo se entrega información y se
  gestiona con el titular (o con el representante legal, en seguros de empresa; el
  ejecutivo pide su nombre y RUT). Si llama un tercero, el ejecutivo debe decir que no
  puede entregar información y pedir que llame el asegurado. Si el titular tiene
  discapacidad auditiva o para comunicarse, la gestión por un tercero solo se hace en
  sucursal con un poder. Si el titular falleció, ver "Derivar".
- Derivar: en este call center NO se transfieren llamadas. Derivar es orientar al cliente
  al canal correcto cuando la gestión no se hace por teléfono:
  · Seguro no renunciable "derivar a sucursal": no se puede renunciar por teléfono; solo
    se reemplaza por otra póliza en sucursal. Se registra como consulta.
  · Seguro no renunciable "lo paga el banco": no tiene costo para el cliente; no se hace
    ninguna gestión.
  · Seguro obligatorio (SOAP): no se renuncia ni se reemplaza; si insiste, que llame a la
    compañía.
  · Devolución de prima en seguros que no son de crédito, por cobros incorrectos o
    desconocimiento: llamar al 600 660 1212, opción 2, e ingresar un requerimiento.
  · Usar el seguro (siniestro): www.segurosbancoestado.cl o FonoSeguros 600 660 1212.
  · Titular fallecido (llama un tercero): 600 660 1212, opción 1, por si hay cobertura; si
    no la hay, la renuncia se hace en sucursal con el certificado de defunción.
  · Copia de póliza: tras una retención MetLife → el ejecutivo la registra y llega por
    correo en 5 días hábiles; en otros casos → 600 660 1212, opción 2, luego 4, luego 1.
  · Reclamos, consultas, siniestros u otras dudas → FonoSeguros 600 660 1212.
  · Seguro de viajes que no figura en la base → compañía, 600 444 8080.
  · El seguro o el cliente no aparece en el sistema: invitar a llamar más tarde.
  · Fecha de pago o de cargo mensual: el call center no la tiene. Orientar al cliente a
    consultarla por teléfono es correcto: NO es derivación ni falta de información.
- Devolución de prima (motivo 28), según el tipo de prima del seguro:
  · Prima única asociada a un crédito o prima anual (cobro anticipado): al renunciar, la
    devolución de la prima no devengada es automática, en 10 días hábiles desde que la
    compañía toma conocimiento. Si ya pasó ese plazo, el cliente llama al 600 660 1212 e
    ingresa un reclamo.
  · Prima mensual (mes vencido): no hay devolución automática; si el cliente la pide por
    cobros incorrectos o desconocimiento, se le invita a ingresar un requerimiento
    (600 660 1212, opción 2).
- Retracto: solo para seguros contratados a distancia, dentro de 10 días corridos desde
  que el cliente recibe la póliza (en seguros de SalesForce aplica a cualquier canal). Se
  gestiona en la llamada como renuncia con motivo "Retracto" (si el seguro es retenible,
  igual se intenta retener). Si el seguro se contrató en forma presencial o pasó el
  plazo, es una renuncia con otro motivo.
- Seguro de viajes: solo se puede renunciar hasta el día anterior al viaje; el día del
  viaje o durante el viaje no se puede renunciar.

## Pauta de calidad (motivos de no calidad)
Texto oficial de la "Pauta Calidad Actualizada". Las líneas "Criterio:" son las
aclaraciones del cliente para aplicar el motivo.

### A. Acreditación y protocolo
31 No valida correctamente al cliente, (Rut, Nombre, Fecha Nacimiento). Protocolo de
   acreditación titularidad.
   Criterio: debe corroborar sí o sí los 3 datos. También incumple si continúa la
   atención cuando alguno de esos datos no coincide.
33 No valida correctamente al cliente, (Email, Fono). Protocolo de acreditación titularidad.
   Criterio: debe preguntarlos o mencionarlos. Si el dato que da el cliente es distinto
   al registrado, es solo una observación, no incumple. Tú no tienes los datos
   registrados: evalúa solo si el ejecutivo los pidió o los confirmó.
29 No realiza protocolo de cierre.
   Criterio: incumple SOLO si no hay ningún resumen final de la gestión: el ejecutivo
   termina sin repasar qué se hizo con el seguro. Si hay un resumen, aunque no siga el
   script palabra por palabra o le falten elementos, el motivo 29 CUMPLE: lo que falte
   se evalúa en su propio motivo (13 N° de seguro, 15 medio de pago, 30 repregunta) o
   se anota como observación en el comentario.
   Ejemplo que CUMPLE el 29 (aunque incumple el 13): "Le confirmo que quedó ingresada la
   renuncia de su seguro de desempleo, con cargo a su crédito de consumo. ¿Está de
   acuerdo?".
   Ejemplo que INCUMPLE el 29: "Listo, ya está. Que tenga buen día." sin decir qué se
   gestionó.
30 No reitera protocolo de cierre ante respuesta no permitida.
   Criterio: si a la pregunta de confirmación del cierre el cliente no responde "Sí",
   "De acuerdo", "Ok", "Confirmo" o "Acepto", el ejecutivo debe repreguntar
   ("¿eso es un Sí?").
13 No indica número de seguro en protocolo de cierre.
   Criterio: debe decir el N° de seguro (MUS A Neto) del seguro gestionado; bastan los 4
   últimos dígitos. Decir solo el N° de póliza no reemplaza al N° de seguro.
15 No se informa medio de pago en protocolo de cierre.
   Criterio: si el medio de pago del seguro es "OTRO", no se debe mencionar: no aplica.
27 Entrega información a tercero, sin retomar protocolo de cierre con el titular.
   Criterio: solo se puede hablar con el titular o el representante legal (ver "Tercero").

### B. Conocimiento del producto
 4 No indica ninguna característica del seguro a renunciar.
   Criterio: mínimo 1 característica (cobertura, beneficio, asistencia, prima, etc.); el
   nombre del seguro no cuenta.
 2 Descripción del seguro corresponde a otro seguro.
   Criterio: lo que el ejecutivo describe por iniciativa propia (coberturas, montos,
   condiciones) debe coincidir con la FICHA del seguro de los metadatos. Incumple si
   describe coberturas de otro seguro o datos que contradicen la ficha.
   Si el ejecutivo dice el plan, la prima o el monto asegurado del CONTRATO del cliente
   (datos de BancoEstado), NO incumple aunque esos valores no estén en la ficha general.
   Solo compara con la ficha lo que no está en el contrato (coberturas, asistencias).
   Incumple SOLO con una afirmación incorrecta MATERIAL (ver "Afirmaciones sobre el
   producto"); las no materiales van como observación en el comentario.
 6 No maneja información del producto o coberturas.
   Criterio: el ejecutivo siempre tiene la información y debe darla. Incumple si, ante
   preguntas del cliente sobre el producto, responde con datos que contradicen la ficha,
   con vaguedad ("eso lo ve la compañía", "depende de su póliza"), no la da, o la niega
   o la desvía a otro canal. Mide si el cliente recibió la información correcta.
   Excepción: las fechas de pago no se manejan en el call center.
   Un dato incorrecto en la respuesta incumple solo si es MATERIAL (ver "Afirmaciones
   sobre el producto").
 5 No informa que la permanencia la maneja cliente ante consulta directa.
   Criterio: el ejecutivo puede sugerir fechas para renunciar, pero no puede decir que esa
   es la única fecha de renuncia. Incumple si, ante la consulta, no informa que el cliente
   decide, o si condiciona la renuncia a una fecha o a que el cliente haga algo antes.
28 Niega devolución de primas.
   Criterio: aplica la regla de devolución del tipo de prima del seguro (ver
   "Devolución de prima"). Incumple si dice que no hay devolución cuando corresponde, o si
   la niega sin orientar al requerimiento. Ocurre sobre todo en seguros anuales.

### C. Gestión de la retención
14 No realiza ningún intento de retención del seguro retenible.
   Criterio: el ejecutivo no intenta retener de ninguna forma. Aplica a todo seguro
   RETENIBLE que se renuncia en la llamada.
17 Retiene seguro no retenible.
   Criterio: intentar retener (o registrar como retenido) un seguro cuya categoría no es
   RETENIBLE. Esa gestión no corresponde.
 9 Renuncia seguro irrenunciable en este canal.
   Criterio: se ingresa la renuncia de un seguro NO RENUNCIABLE.
16 Realiza retención de seguro sin intención de renuncia.
   Criterio: el cliente tiene que decir que quiere renunciar o dar de baja (o una frase
   equivalente). Solo se retiene el seguro que el cliente pidió cancelar: intentar retener
   otro seguro que el cliente no pidió cancelar incumple.
 3 Excede 3 objeciones máximo para retención.
   Criterio: ver "Objeción" y "Cliente tajante".
12 Induce a renuncia.
   Criterio: sugiere o propone renunciar un seguro que el cliente no pidió cancelar (por
   ejemplo, uno que no era el motivo de la consulta).
32 Predispone al cliente para la aceptación del seguro, condiciona la respuesta a un Si.
   Criterio: preguntas que dan por hecha la respuesta, normalmente con una coletilla:
   "¿Usted está de acuerdo en mantenerlo, cierto?", "lo dejamos vigente, ¿verdad?",
   "¿no es cierto que le conviene?". NO son este motivo: las preguntas del script
   ("¿le parece entonces que mantengamos vigente su seguro?", "¿Confirma que desea
   renunciar?", "¿eso es un Sí?"), una pregunta neutra ("¿Está de acuerdo con la
   gestión?") ni las preguntas que ofrecen una alternativa como argumento de retención
   ("¿no prefiere mantenerlo un tiempo más?"): esas son argumentos (motivo 3).
 7 No realiza derivación correcta.
   Criterio: la situación requiere orientar al cliente a otro canal (ver "Derivar") y el
   ejecutivo no lo hace, lo orienta a un canal equivocado o transfiere la llamada.
26 No se impactan todas las gestiones solicitadas por el cliente.
   Criterio: el cliente pide renunciar (o gestionar) un seguro y en la grabación esa
   gestión no se ve realizada: no hay cierre de ese seguro (no se nombra en el resumen
   final ni se confirma con el cliente). NO basta con que el ejecutivo diga "quedó todo
   listo": revisa seguro por seguro que cada solicitud tenga su cierre. Si además falta
   en la tipificación, marca también el 25.
   También incumple si la decision_final del seguro es NO_ACEPTADA: el cliente pidió
   renunciar y se cerró como retención sin que aceptara mantenerlo.

### D. Trato y comunicación
 1 Deja en espera por tiempo excesivo.
   Criterio: más de umbral_espera_seg (30 s) sin hablarle al cliente: una espera de
   esperas_seg o un silencio del ejecutivo entre timestamps. Solo cuenta cuando el
   EJECUTIVO hace esperar al CLIENTE (el cliente queda esperando a que el ejecutivo
   vuelva, o pregunta "¿aló?", "¿sigue ahí?"). Si el que se demora es el cliente
   (busca un dato, consulta a alguien, piensa) y el ejecutivo lo espera, no cuenta.
   esperas_seg ya trae solo las esperas atribuibles al ejecutivo.
 8 No responde de forma directa al cliente. Elude las preguntas.
   Criterio: el cliente hace una pregunta directa y el ejecutivo no la contesta: cambia
   de tema, responde otra cosa o sigue con su discurso (ej. el cliente pregunta qué cubre
   y el ejecutivo le propone renunciar o le habla de mantener el seguro). Mide la
   conducta de eludir; si la pregunta era sobre el producto, marca además el 6.
   Responder directo aunque con un dato errado NO es 8 (es 6, 28 u otro).
11 Descalifica a los pares, a BancoEstado o a la competencia.
   Criterio: hablar mal de ejecutivos de venta, ejecutivos del banco, otros ejecutivos,
   BancoEstado, la compañía o la competencia.
10 Su atención no se ajusta a la política de BancoEstado.
   Criterio: mal trato al cliente: tono de voz alto, lenguaje soez, agresivo o grosero,
   burlas o impaciencia hostil.

### E. Tipificación (comparar con la tipificación registrada)
Primero determina, según la grabación, el resultado de cada seguro:
  RENUNCIA: se ingresó la renuncia.
  RETENCION: el cliente pidió renunciar y finalmente mantiene el seguro (decision_final
             GENUINA o CONDICIONADA). Con NO_ACEPTADA el resultado es RENUNCIA.
  CONSULTA: el cliente no pidió renunciar (consultas, información) o el seguro no se puede
            renunciar por teléfono y se orienta a otro canal.
  SIN_GESTION: la llamada se corta o termina antes de resolver la solicitud.
Y todos los motivos de renuncia que expresa el cliente. Luego compara con lo tipificado:
18 Tipifica motivo de renuncia incorrecto.
   Criterio: sé flexible. La pregunta es si el motivo tipificado TIENE SENTIDO con lo
   que dijo el cliente, no si es el más exacto de la lista. Los clientes explican sus
   razones con sus palabras y varias categorías de la lista se traslapan.
   - Si el cliente da más de un motivo, basta con que el tipificado calce con uno.
   - Una misma razón puede caber en varias categorías y cualquiera de ellas está bien.
     Ej.: "me subió la prima y no quiero seguir pagando" puede ser Aumento Valor de la
     Prima, Problemas Económicos o No desea contraer más obligaciones. "Quedé cesante"
     puede ser Cambio de situación laboral o Problemas Económicos. "Ya tengo otro seguro"
     puede ser Cliente posee otros Seguros o No desea contraer más obligaciones.
   - Incumple SOLO si el motivo tipificado no tiene relación con nada de lo que dijo el
     cliente (ej. tipifica "Cliente se va fuera del País" y el cliente solo habló de
     dinero), o contradice lo que dijo (ej. tipifica "Desconoce contratación" y el cliente
     reconoce que lo contrató).
   - Si el cliente no explicó sus razones, cualquier motivo genérico (No desea contraer
     más obligaciones, No informado) está bien.
   "Retracto" solo es válido si se cumplen sus condiciones (ver "Retracto").
19 Tipifica renuncia y por grabacion es retencion.
   Criterio: es un error muy común; revísalo siempre.
24 Tipifica retencion y por grabacion es renuncia.
20 Tipifica renuncia de seguro no mencionado.
   Criterio: tipifica la renuncia de un seguro que nunca se mencionó en la grabación.
21 Tipifica renuncia que corresponde a otro seguro.
   Criterio: se equivoca de seguro al tipificar la renuncia.
22 Tipifica retención de seguro no mencionado.
23 Tipifica retención que corresponde a otro seguro.
25 No tipifica todas las gestiones.
   Criterio: un seguro que el cliente pidió renunciar (se haya gestionado o no en la
   llamada) o que se retuvo no aparece en la tipificación.

## Motivos de renuncia válidos (los que exprese el cliente; si no da ninguno, "No informado")
No desea contraer más obligaciones | Problemas Económicos | Cliente posee otros Seguros |
Desconoce contratación del seguro | Información errónea entregada en la venta |
A cliente se le ofreció un mejor seguro en Banco | No recibió Póliza |
Disconformidad con coberturas | Cambio de situación laboral |
Mala experiencia con Banco Estado o con la Cía | Cliente se va fuera del País |
Disconformidad con la asistencia | Siniestro Rechazado por Compañía |
Recibe carta de adecuación | Cierre de Cuenta o Productos Banco |
Cliente no cumple condiciones de asegurabilidad | Cobro mal Realizado | Retracto |
Cambio de Beneficiario o Cargas | Aumento Valor de la Prima |
Cambio de Domicilio o Venta de Propiedad | Seguro ya Utilizado, no desea dar Continuidad |
No puede realizar el rescate del ahorro. | No puede ingresar al portal Metlife. |
Carga o beneficiario fallecido. | Error en la contratación del seguro |
No permite realizar cambio de beneficiarios en sucursal. | No informado
```

---

## 2. Mensaje de usuario (por llamada)

```text
## Metadatos
llamada_id: {{llamada_id}}
fecha: {{fecha}}
ejecutivo: {{ejecutivo_id}}
duracion_seg: {{duracion}}
esperas_seg: {{lista_de_esperas}}        # ej. [45, 130]
umbral_espera_seg: 30

## Seguros del cliente consultados en la llamada
{{#seguros}}
{{ficha_estandar}}        # plantilla de docs/layer2-product-sheet.md, una por seguro
{{/seguros}}

## Tipificación registrada por el ejecutivo
{{#tipificaciones}}
- seguro: {{mus_a_neto}} | gestion: {{RENUNCIA/RETENCION/CONSULTA}} | motivo: {{motivo}}
{{/tipificaciones}}

## Transcripción (canal separado, timestamps mm:ss, datos personales enmascarados)
{{transcripcion}}
```

**Ejemplo de un seguro** (plantilla de `docs/layer2-product-sheet.md` completada con `data/catalog/products.json`, recortada):

```text
### Seguro 1: DESEMPLEO ITT CRE. CONSUMO
Datos de la llamada (BancoEstado):
- N° de seguro (MUS A Neto): 48213301
- N° de póliza: 498213301
- inicio de vigencia: 2025-03-15
- medio de pago: CRE (Crédito de Consumo (Está asociado a un crédito de consumo))

Ficha del producto (P30: Desempleo e Incapacidad Temporal – Créditos de Consumo):
- compañía: BNP Paribas Cardif
- categoría: RETENIBLE. Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.
- tipo de prima: prima única asociada a un crédito (cobro anticipado). Modalidad: Prima única y anticipada (según plazo y monto del crédito)
- devolución de prima al renunciar: corresponde devolución automática de la prima no devengada, en 10 días hábiles desde que la compañía toma conocimiento.
- capital asegurado: Hasta 4 cuotas del crédito + 3,5% gastos administrativos
Coberturas:
- Desempleo involuntario. monto: Hasta 4 cuotas + 3,5%. ...
```

---

## 3. Esquema de salida (tool forzada)

```json
{
  "name": "registrar_auditoria",
  "input_schema": {
    "type": "object",
    "required": [
      "resumen",
      "informacion_seguro",
      "intencion_renuncia",
      "termino_llamada",
      "solicitudes_cliente",
      "afirmaciones_producto",
      "gestiones",
      "criterios"
    ],
    "properties": {
      "resumen": {
        "type": "string",
        "description": "2-3 frases sobre la llamada"
      },
      "informacion_seguro": {
        "type": "object",
        "description": "Si la ficha del seguro sirve para auditar esta llamada (regla 13)",
        "required": [
          "estado",
          "comentario"
        ],
        "properties": {
          "estado": {
            "enum": [
              "OK",
              "SIN_FICHA",
              "NO_CORRESPONDE"
            ]
          },
          "comentario": {
            "type": "string",
            "description": "Si no es OK: qué información del seguro falta o qué no cuadra"
          }
        }
      },
      "intencion_renuncia": {
        "type": "object",
        "properties": {
          "expresada": {
            "type": "boolean"
          },
          "cita": {
            "type": "string"
          },
          "timestamp": {
            "type": "string"
          }
        }
      },
      "termino_llamada": {
        "type": "object",
        "description": "Cómo termina la llamada",
        "properties": {
          "tipo": {
            "enum": [
              "NORMAL",
              "CORTADA",
              "ABIERTA_SIN_CORTAR"
            ],
            "description": "NORMAL: despedida y fin. CORTADA: se interrumpe antes de terminar la gestión. ABIERTA_SIN_CORTAR: la gestión terminó pero la línea sigue tomada (silencio, ruido o espera tras la despedida)."
          },
          "comentario": {
            "type": "string"
          }
        }
      },
      "solicitudes_cliente": {
        "type": "array",
        "description": "Pedidos y preguntas directas del cliente, aparte de renunciar (ver Definiciones: Solicitudes del cliente)",
        "items": {
          "type": "object",
          "properties": {
            "t": {
              "type": "string"
            },
            "cita": {
              "type": "string"
            },
            "tipo": {
              "enum": [
                "DESCONOCE_COBRO",
                "DEVOLUCION",
                "COBRO_INCORRECTO",
                "OTRO_SEGURO",
                "PREGUNTA_PRODUCTO",
                "COPIA_POLIZA",
                "OTRA"
              ]
            },
            "respuesta": {
              "enum": [
                "RESPONDIDA",
                "DERIVADA_CORRECTA",
                "DERIVADA_INCORRECTA",
                "ELUDIDA",
                "NO_ATENDIDA"
              ]
            },
            "motivos": {
              "type": "array",
              "description": "Motivos de la pauta que esta entrada hace incumplir (vacío si ninguno)",
              "items": {
                "type": "integer"
              }
            }
          }
        }
      },
      "afirmaciones_producto": {
        "type": "array",
        "description": "Afirmaciones del ejecutivo sobre coberturas, montos, cobros, fechas, devolución o ahorro, contrastadas con FICHA y CONTRATO (máximo 10)",
        "items": {
          "type": "object",
          "properties": {
            "t": {
              "type": "string"
            },
            "cita": {
              "type": "string"
            },
            "tema": {
              "enum": [
                "COBERTURA",
                "MONTO",
                "COBRO_FECHAS",
                "DEVOLUCION",
                "AHORRO",
                "OTRO"
              ]
            },
            "verificacion": {
              "enum": [
                "CORRECTA",
                "INCORRECTA",
                "NO_VERIFICABLE"
              ]
            },
            "material": {
              "type": "boolean",
              "description": "Solo si es INCORRECTA: cambia lo que el cliente entiende que tiene o paga Y se usa para retener o responder una pregunta"
            },
            "motivos": {
              "type": "array",
              "description": "Motivos de la pauta que esta entrada hace incumplir (vacío si ninguno)",
              "items": {
                "type": "integer"
              }
            }
          }
        }
      },
      "gestiones": {
        "type": "array",
        "description": "Resultado según la grabación, uno por cada seguro de los metadatos que se mencionó en la llamada",
        "items": {
          "type": "object",
          "properties": {
            "mus_a_neto": {
              "type": "string"
            },
            "decision_final": {
              "type": "object",
              "description": "Última frase del cliente sobre mantener o renunciar tras el último argumento (ver Definiciones)",
              "properties": {
                "t": {
                  "type": "string"
                },
                "cita": {
                  "type": "string"
                },
                "tipo": {
                  "enum": [
                    "GENUINA",
                    "CONDICIONADA",
                    "NO_ACEPTADA",
                    "NO_APLICA"
                  ]
                }
              }
            },
            "resultado_grabacion": {
              "enum": [
                "RENUNCIA",
                "RETENCION",
                "CONSULTA",
                "SIN_GESTION"
              ]
            },
            "motivos_renuncia": {
              "type": "array",
              "description": "Todos los motivos de renuncia que expresa el cliente, de la lista válida. Vacío si no pidió renunciar.",
              "items": {
                "type": "string"
              }
            },
            "n_objeciones": {
              "type": "integer"
            },
            "cliente_tajante": {
              "type": "boolean"
            },
            "argumentos_retencion": {
              "type": "array",
              "description": "Argumentos de retención en el orden en que se dijeron",
              "items": {
                "type": "object",
                "properties": {
                  "t": {
                    "type": "string"
                  },
                  "tipo": {
                    "enum": [
                      "COBERTURA",
                      "BENEFICIO",
                      "FECHA_RENOVACION",
                      "OTRO"
                    ]
                  },
                  "cita": {
                    "type": "string"
                  }
                }
              }
            },
            "evidencia": {
              "type": "string"
            }
          }
        }
      },
      "criterios": {
        "type": "array",
        "items": {
          "type": "object",
          "required": [
            "id",
            "comentario",
            "estado",
            "confianza"
          ],
          "properties": {
            "id": {
              "type": "integer",
              "minimum": 1,
              "maximum": 33
            },
            "mus_a_neto": {
              "type": "string",
              "description": "Seguro al que corresponde el hallazgo. Vacío si es de toda la llamada."
            },
            "comentario": {
              "type": "string",
              "description": "Análisis del motivo. Se escribe ANTES de decidir el estado. 1 frase si cumple o no aplica."
            },
            "evidencia": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "t": {
                    "type": "string"
                  },
                  "hablante": {
                    "enum": [
                      "AGENTE",
                      "CLIENTE"
                    ]
                  },
                  "cita": {
                    "type": "string"
                  }
                }
              }
            },
            "estado": {
              "enum": [
                "cumple",
                "incumple",
                "no_aplica",
                "indeterminado"
              ]
            },
            "confianza": {
              "type": "number"
            }
          }
        }
      }
    }
  }
}
```

---

## 4. Ejemplo de salida (llamada ficticia, recortada)

```json
{
  "resumen": "La clienta llama para renunciar al seguro de desempleo por problemas económicos. El ejecutivo argumenta 5 veces pese a sus negativas tajantes y finalmente procesa la renuncia, pero no indica el N° de seguro en el cierre.",
  "intencion_renuncia": {
    "expresada": true,
    "cita": "Quiero renunciar al seguro de desempleo.",
    "timestamp": "00:41"
  },
  "termino_llamada": {
    "tipo": "NORMAL",
    "comentario": "Despedida y fin de la llamada."
  },
  "gestiones": [
    {
      "mus_a_neto": "48213302",
      "resultado_grabacion": "RENUNCIA",
      "motivos_renuncia": ["Problemas Económicos", "No desea contraer más obligaciones"],
      "n_objeciones": 5,
      "cliente_tajante": true,
      "argumentos_retencion": [
        {"t": "00:52", "tipo": "COBERTURA", "cita": "le paga cuatro cuotas de su crédito si queda cesante"},
        {"t": "01:15", "tipo": "BENEFICIO", "cita": "la prima ya está pagada, no le cobran todos los meses"}
      ],
      "evidencia": "00:52–01:50: cinco argumentos de retención tras negativas"
    }
  ],
  "criterios": [
    {
      "id": 3,
      "mus_a_neto": "48213302",
      "comentario": "5 argumentos de retención tras la solicitud y las negativas tajantes de la clienta; el máximo es 3.",
      "evidencia": [
        {"t": "01:31", "hablante": "CLIENTE", "cita": "Oiga, ya le dije tres veces que no."},
        {"t": "01:36", "hablante": "AGENTE", "cita": "¿Y si lo mantiene un mes más y después lo vemos?"}
      ],
      "estado": "incumple",
      "confianza": 0.9
    },
    {
      "id": 13,
      "mus_a_neto": "48213302",
      "comentario": "Cierre 01:50–02:05: confirma la renuncia y el medio de pago, pero no menciona el N° de seguro.",
      "evidencia": [],
      "estado": "incumple",
      "confianza": 0.85
    },
    {
      "id": 27,
      "comentario": "No interviene un tercero.",
      "estado": "no_aplica",
      "confianza": 0.95
    }
  ]
}
```

---

## Notas para la implementación

- **Catálogo de seguros:** `scripts/prompt_bench/extract_catalog.py` lee el Excel de apoyo y escribe `data/catalog/products.json` (fuera del repo). De ahí salen la categoría, el tipo de prima, la ficha y los medios de pago de cada seguro. En producción, el catálogo debe ser configuración versionada, igual que la rúbrica.
- **Qué hace mejor la capa 1 (reglas):** los motivos 13 y 15 (N° de seguro y medio de pago en el cierre), 31 y 33 (preguntas de validación) y 1 (esperas y silencios > 30 s) se pueden revisar con regex, fuzzy matching y timestamps. El LLM queda como respaldo.
- **Tipificación (18–25):** el LLM extrae lo que pasó en la grabación (`gestiones`). La comparación con lo tipificado también la puede hacer el **motor de decisión** en código: para el 18 basta que el motivo tipificado esté en `motivos_renuncia`.
- **Orden de argumentos (dashboard):** el motor calcula desde `argumentos_retencion` si la fecha de renovación quedó al final. Es un indicador, no un motivo.
- **Validar las citas:** cada `cita` debe existir en la transcripción. Si no aparece, el criterio pasa a `indeterminado`.
- **Capa 1 con el script:** las frases fijas del script ("esta conversación está siendo grabada", "Número de Seguro terminado en", "¿Confirma que desea renunciar", "¿eso es un Sí?", "FonoSeguros") se pueden buscar con fuzzy matching.
- **Pendiente con el cliente [DEFINIR]:** la gravedad de cada motivo, el conteo de objeciones, qué motivo aplica cuando se tipifica RENUNCIA y la grabación es CONSULTA, qué significa exactamente "medio de pago otro", si no informar la devolución automática es motivo 28 o 29, y si el aviso de grabación del saludo se evalúa.

## Historial de cambios

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
