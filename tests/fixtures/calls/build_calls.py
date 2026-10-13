"""Genera llamadas sintéticas de retención con timestamps consistentes.

Los nombres de seguro son los del catálogo del cliente (hoja RESUMEN del Excel de apoyo), que son los mismos que
llegan en los metadatos de BancoEstado. La categoría (retenible, no retenible, no renunciable), el tipo de prima y la
ficha NO van acá: los agrega scripts/prompt_bench/render.py desde data/catalog/products.json.
Los N° de seguro (MUS A Neto) son inventados.
"""

import json
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
WORDS_PER_SEC = 2.6
GAPS = [0.6, 0.9, 0.5, 1.2, 0.7, 1.0, 0.8]

DESEMPLEO = "DESEMPLEO ITT CRE. CONSUMO"  # Cardif, retenible, prima única
DESEMPLEO_NO_RET = "SEGURO DE DESEMPLEO CONSUMO"  # Cardif, no retenible
INCENDIO = "Incendio Hogar"  # Sura, retenible
HOSPITALIZACION = "HOSPITALIZACION TLMK"  # MetLife, retenible, mensual
SALE = "SALE SEGURO PLUS (Sucursales)"  # Cardif, retenible, mensual
PROTECCION = "PROTECCION GLOBAL MYPE"  # Cardif, retenible, mensual
AP_INDIVIDUAL = "AP INDIVIDUAL MEDIO DE PAGO"  # MetLife, retenible, anual
AP_PLUS = "AP PLUS MEDIO DE PAGO"  # MetLife, retenible, anual
DESGRAVAMEN_NOMINAL = "DESGRAVAMEN NOMINAL"  # no renunciable, se deriva a sucursal


def policy(name, mus_a_neto, payment_method, start_date="2025-03-15"):
    # payment_method: código de la base de BancoEstado (CRE, CCT, CTV, HIP, TCR, ...) u "OTRO".
    # N° de póliza inventado a partir del MUS A Neto.
    return {
        "name": name,
        "mus_a_neto": mus_a_neto,
        "policy_number": "49" + mus_a_neto[-7:],
        "start_date": start_date,
        "payment_method": payment_method,
    }


CALLS = []


def call(**kw):
    CALLS.append(kw)


# ---------------------------------------------------------------- 01
call(
    call_id="synth-01",
    title="Retención exitosa, llamada modelo",
    description="El cliente quiere renunciar al seguro de desempleo por problemas económicos. "
    "Acreditación completa, 2 objeciones (cobertura y luego beneficio), responde sobre la permanencia y el cliente decide mantenerlo. "
    "Cierre completo con N° de seguro y medio de pago.",
    agent_id="EJ-0101",
    date="2026-09-01",
    policies=[policy(DESEMPLEO, "48213301", "CRE")],
    typification=[{"mus_a_neto": "48213301", "outcome": "RETENCION", "reason": "Problemas Económicos"}],
    turns=[
        ("A", "Buenas tardes, le saluda Camila Rojas de BancoEstado Corredores de Seguros. ¿Con quién tengo el gusto?"),
        ("C", "Hola, buenas tardes, habla Pedro Soto."),
        ("A", "Don Pedro, para resguardar su información necesito validar algunos datos. ¿Me puede indicar su RUT?"),
        ("C", "Sí, once millones ciento once mil ciento once guion uno."),
        ("A", "Gracias. ¿Me indica su nombre completo?"),
        ("C", "Pedro Andrés Soto Muñoz."),
        ("A", "¿Y su fecha de nacimiento?"),
        ("C", "El catorce de marzo del ochenta y cinco."),
        ("A", "Perfecto. ¿Me confirma su correo electrónico y un teléfono de contacto?"),
        ("C", "pedro punto soto arroba correo ejemplo punto cl, y el teléfono es el nueve uno dos tres cuatro cinco seis siete ocho."),
        ("A", "Muchas gracias, don Pedro, sus datos están validados. ¿En qué lo puedo ayudar?"),
        ("C", "Mire, quiero dar de baja el seguro de desempleo que tengo con el crédito de consumo. La verdad ando medio apretado con las lucas."),
        ("A", "Entiendo, don Pedro. Veo que tiene el seguro de Desempleo e Incapacidad Temporal asociado a su crédito de consumo. Antes de gestionarlo, ¿me permite contarle brevemente qué cubre?"),
        ("C", "Ya, dale."),
        ("A", "Si queda desempleado de forma involuntaria, el seguro le paga cuatro cuotas de su crédito, de dos en dos, más un tres coma cinco por ciento. Y si tiene una incapacidad temporal por accidente o enfermedad infecciosa, le paga hasta cuatro cuotas, una por cada treinta días de incapacidad. Además, es de prima única: se pagó una sola vez junto con el crédito."),
        ("C", "Ah, pero yo pensé que me lo cobraban todos los meses."),
        ("A", "No, don Pedro, es prima única, ya está pagado junto con su crédito."),
        ("C", "Mmm, igual prefiero no tener nada extra, la verdad."),
        ("A", "Lo entiendo. Considere también que, si queda desempleado, el seguro le da asistencia laboral personalizada para volver a encontrar trabajo: le analizan su perfil y lo capacitan en la búsqueda. Justo cuando me cuenta que está apretado, es cuando más le sirve."),
        ("C", "Ya, pero si lo dejo, ¿después lo puedo sacar igual?"),
        ("A", "Sí, don Pedro. La permanencia en el seguro la decide usted; puede renunciar cuando quiera."),
        ("C", "Ah, ya. Entonces lo mantengo no más po, si no me están cobrando nada aparte."),
        ("A", "Don Pedro, ¿le parece entonces que mantengamos vigente su seguro de Desempleo e Incapacidad Temporal?"),
        ("C", "Ya po."),
        ("A", "Don Pedro, ¿eso es un sí?"),
        ("C", "Sí, sí."),
        ("A", "Don Pedro, hoy con fecha primero de septiembre usted manifiesta la decisión de permanecer con su seguro de Desempleo e Incapacidad Temporal crédito de consumo, número de seguro terminado en tres tres cero uno, con vigencia desde el quince de marzo de dos mil veinticinco, número de póliza cuatro nueve ocho dos uno tres tres cero uno, asociado a su crédito de consumo."),
        ("A", "Lo felicito por su decisión. Ante cualquier duda o para denunciar un siniestro, puede visitar nuestra página web o llamar al FonoSeguros, seiscientos seiscientos sesenta, doce doce. Muchas gracias por su tiempo, recuerde que habló con Camila Rojas. Que tenga muy buena tarde."),
        ("C", "Gracias, igualmente. Chao."),
    ],
    expected={
        "call_verdict": "compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213301", "outcome": "RETENCION", "cancellation_reasons": ["Problemas Económicos"], "objections": 2, "renewal_last": True},
        ],
        "findings": [],
        "notes": "Llamada de referencia: todos los motivos cumplen o no aplican. Argumentos en orden: cobertura y luego beneficio.",
    },
)

# ---------------------------------------------------------------- 02
call(
    call_id="synth-02",
    title="Exceso de objeciones y cierre sin N° de seguro",
    description="La clienta insiste en renunciar de forma tajante; el ejecutivo da 5 argumentos de retención (1 tras la solicitud y 4 tras negativas). "
    "Procesa la renuncia, pero en el cierre no menciona el número de seguro.",
    agent_id="EJ-0102",
    date="2026-09-02",
    policies=[policy(DESEMPLEO, "48213302", "CRE")],
    typification=[{"mus_a_neto": "48213302", "outcome": "RENUNCIA", "reason": "Problemas Económicos"}],
    turns=[
        ("A", "Buenos días, mi nombre es Rodrigo Fuentes, de BancoEstado Corredores de Seguros. ¿Con quién hablo?"),
        ("C", "Buenos días, con Carolina Paredes."),
        ("A", "Señora Carolina, para validar su identidad, ¿me indica su RUT, por favor?"),
        ("C", "Veintidós millones doscientos veintidós mil doscientos veintidós guion dos."),
        ("A", "¿Su nombre completo y fecha de nacimiento?"),
        ("C", "Carolina Andrea Paredes Lagos, nacida el dos de julio del noventa."),
        ("A", "Gracias. ¿Me confirma su correo y teléfono registrados?"),
        ("C", "carolina punto paredes arroba correo ejemplo punto cl, y el nueve ocho siete seis cinco cuatro tres dos uno."),
        ("A", "Perfecto, datos validados. Cuénteme, ¿en qué la puedo ayudar?"),
        ("C", "Quiero renunciar al seguro de desempleo. Es que no me alcanza, tengo muchas deudas y no quiero nada más."),
        ("A", "Entiendo, señora Carolina. Le comento que este seguro le paga cuatro cuotas de su crédito si queda cesante de forma involuntaria."),
        ("C", "Sí, sé lo que cubre, pero igual no lo quiero."),
        ("A", "Pero piense que son cuatro cuotas. Hoy el trabajo está difícil, nunca se sabe."),
        ("C", "No, de verdad, quiero darlo de baja."),
        ("A", "Mire, la prima ya está pagada, no le cobran todos los meses. Mantenerlo no le cuesta nada extra."),
        ("C", "Ya le dije que no. Quiero renunciarlo."),
        ("A", "Le entiendo, pero imagínese si la despiden el próximo mes. Son cuatro cuotas que no va a tener que pagar."),
        ("C", "Oiga, ya le dije tres veces que no."),
        ("A", "¿Y si lo mantiene un mes más y después lo vemos? Así no queda desprotegida."),
        ("C", "No, por favor, hágame la renuncia no más."),
        ("A", "Está bien, señora Carolina, procedo con la renuncia."),
        ("A", "Listo. Le confirmo que quedó ingresada la renuncia de su seguro de desempleo. El medio de pago es su crédito de consumo, así que no tendrá más movimientos asociados. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo, gracias."),
        ("A", "Su seguro queda renunciado desde hoy. Como es de prima única, la devolución de la prima no devengada es automática y la hace la compañía dentro de diez días hábiles desde que toma conocimiento de la renuncia. Que tenga un buen día."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213302", "outcome": "RENUNCIA", "cancellation_reasons": ["Problemas Económicos"], "objections": 5},
        ],
        "findings": [
            {"criterion_id": 3, "status": "non_compliant", "note": "5 argumentos de retención (el primero tras la solicitud y 4 tras negativas tajantes); el máximo es 3."},
            {"criterion_id": 13, "status": "non_compliant", "note": "El cierre confirma la renuncia pero no menciona el N° de seguro (MUS A Neto 48213302)."},
        ],
    },
)

# ---------------------------------------------------------------- 03
call(
    call_id="synth-03",
    title="Llamada corta sin intento de retención",
    description="El cliente vendió su departamento y quiere renunciar al seguro Incendio Hogar, que es retenible. "
    "El ejecutivo no intenta retener, no da ninguna característica y tampoco valida correo ni teléfono.",
    agent_id="EJ-0103",
    date="2026-09-03",
    policies=[policy(INCENDIO, "48213303", "CCT")],
    typification=[{"mus_a_neto": "48213303", "outcome": "RENUNCIA", "reason": "Cambio de Domicilio o Venta de Propiedad"}],
    turns=[
        ("A", "BancoEstado Corredores de Seguros, buenas tardes, habla Javiera Morales."),
        ("C", "Hola, buenas, habla Luis Contreras."),
        ("A", "Don Luis, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Trece millones trescientos treinta y tres mil trescientos treinta y tres guion tres. Luis Alberto Contreras Vega, nueve de enero del setenta y ocho."),
        ("A", "Gracias. ¿Qué necesita?"),
        ("C", "Vendí el departamento y quiero dar de baja el seguro de incendio, porque ya no tiene sentido."),
        ("A", "Ya, perfecto, se lo doy de baja al tiro."),
        ("C", "Ya, gracias."),
        ("A", "Listo, don Luis. Quedó ingresada la renuncia de su seguro Incendio Hogar, número de seguro cuatro ocho dos uno tres tres cero tres, que se cargaba a su cuenta corriente. ¿Está de acuerdo con la gestión?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Gracias por llamar, que esté bien."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213303", "outcome": "RENUNCIA", "cancellation_reasons": ["Cambio de Domicilio o Venta de Propiedad"], "objections": 0},
        ],
        "findings": [
            {"criterion_id": 14, "status": "non_compliant", "note": "Seguro retenible y no hay ningún intento de retención."},
            {"criterion_id": 33, "status": "non_compliant", "note": "No valida correo ni teléfono."},
            {"criterion_id": 4, "status": "non_compliant", "note": "No indica ninguna característica del seguro a renunciar (solo el nombre)."},
        ],
    },
)

# ---------------------------------------------------------------- 04
call(
    call_id="synth-04",
    title="Información errónea del producto y tipificación incorrecta",
    description="Ante la pregunta de la clienta, el ejecutivo dice que el seguro paga tres cuotas, todas contra el finiquito "
    "(la ficha dice cuatro cuotas, de dos en dos). La clienta renuncia por problemas económicos, pero el ejecutivo tipifica 'Cambio de situación laboral'.",
    agent_id="EJ-0104",
    date="2026-09-04",
    policies=[policy(DESEMPLEO, "48213304", "CRE")],
    typification=[{"mus_a_neto": "48213304", "outcome": "RENUNCIA", "reason": "Cambio de situación laboral"}],
    turns=[
        ("A", "Buenas tardes, BancoEstado Corredores de Seguros, le atiende Matías Herrera. ¿Con quién hablo?"),
        ("C", "Hola, habla Andrea Núñez."),
        ("A", "Señora Andrea, para comenzar necesito validar su identidad. ¿Me indica su RUT?"),
        ("C", "Catorce millones cuatrocientos cuarenta y cuatro mil cuatrocientos cuarenta y cuatro guion cuatro."),
        ("A", "¿Su nombre completo y fecha de nacimiento?"),
        ("C", "Andrea Soledad Núñez Pizarro, veinte de octubre del ochenta y ocho."),
        ("A", "¿Y su correo y teléfono de contacto?"),
        ("C", "andrea punto nunez arroba correo ejemplo punto cl, nueve cinco cinco cinco uno dos tres cuatro cinco."),
        ("A", "Muchas gracias, quedó validada. ¿En qué la ayudo?"),
        ("C", "Quiero sacar el seguro de desempleo del crédito. Es que ahora no me alcanza, ando corta de plata con todo lo que está subiendo."),
        ("A", "Entiendo. ¿Sigue trabajando en el mismo lugar?"),
        ("C", "Sí, sigo en la misma pega, no es eso. Es que los gastos me tienen ahogada."),
        ("A", "Le cuento que este seguro le sirve justamente si pierde la pega, porque le paga cuotas de su crédito."),
        ("C", "¿Y cuántas cuotas me paga?"),
        ("A", "Le paga tres cuotas, y se pagan todas de una vez apenas presenta el finiquito."),
        ("C", "Pucha, no es tanto. Igual prefiero sacarlo."),
        ("A", "Piense que la prima ya está pagada, no es un cobro mensual."),
        ("C", "Ya, pero lo quiero sacar igual. Quiero tener menos cosas."),
        ("A", "Bueno, señora Andrea, procedo con la renuncia."),
        ("A", "Le resumo: se ingresó la renuncia de su seguro de desempleo, número de seguro cuatro ocho dos uno tres tres cero cuatro, cuyo medio de pago es su crédito de consumo. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo."),
        ("A", "El seguro queda renunciado desde hoy, y la devolución de la prima no devengada es automática: la compañía la hace dentro de diez días hábiles. Muchas gracias, que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213304", "outcome": "RENUNCIA", "cancellation_reasons": ["Problemas Económicos"], "objections": 2},
        ],
        "findings": [
            {"criterion_id": 6, "status": "non_compliant", "note": "Ante la pregunta, dice tres cuotas pagadas de una vez contra finiquito; la ficha dice cuatro cuotas pagadas de dos en dos."},
            {"criterion_id": 18, "status": "non_compliant", "note": "Tipificado 'Cambio de situación laboral'; la clienta dice que sigue en el mismo trabajo y que no le alcanza: Problemas Económicos."},
        ],
    },
)

# ---------------------------------------------------------------- 05
call(
    call_id="synth-05",
    title="Información entregada a un tercero",
    description="El titular se valida y pasa el teléfono a su señora. El ejecutivo le entrega el detalle y cierra con ella, "
    "sin retomar el protocolo de cierre con el titular.",
    agent_id="EJ-0105",
    date="2026-09-05",
    policies=[policy(HOSPITALIZACION, "48213305", "CTV")],
    typification=[{"mus_a_neto": "48213305", "outcome": "RENUNCIA", "reason": "No desea contraer más obligaciones"}],
    turns=[
        ("A", "Buenas tardes, le habla Fernanda Castro de BancoEstado Corredores de Seguros. ¿Con quién tengo el gusto?"),
        ("C", "Sí, buenas, habla Jorge Ramírez."),
        ("A", "Don Jorge, ¿me indica su RUT, nombre completo y fecha de nacimiento para validar?"),
        ("C", "Quince millones quinientos cincuenta y cinco mil quinientos cincuenta y cinco guion cinco. Jorge Esteban Ramírez Silva, tres de mayo del setenta y dos."),
        ("A", "¿Y su correo y teléfono?"),
        ("C", "jorge punto ramirez arroba correo ejemplo punto cl, nueve cuatro cuatro cuatro cuatro cinco cinco cinco cinco."),
        ("A", "Gracias, don Jorge, quedó validado. ¿En qué lo ayudo?"),
        ("C", "Quiero renunciar al seguro de hospitalización, no quiero más compromisos. Pero mire, mi señora es la que ve estas cosas, le paso con ella."),
        ("C", "Hola, buenas, habla Marcela, la señora de Jorge. ¿Cuánto es lo que estamos pagando por ese seguro y desde cuándo?"),
        ("A", "Hola, señora Marcela. El seguro de Hospitalización tiene una prima mensual de seis mil trescientos pesos, que se carga a la cuenta vista de don Jorge, y está vigente desde marzo del año pasado."),
        ("C", "Ya, ¿y qué pasa si lo sacamos? ¿Pierde algo?"),
        ("A", "Perdería la cobertura de hospitalización: si don Jorge queda hospitalizado por enfermedad o accidente, en sala común, UTI o UCI, el seguro le paga dos UF por día, de libre disposición, hasta por ciento ochenta días."),
        ("C", "No, igual lo queremos sacar. Ya tenemos muchas cuentas."),
        ("A", "Perfecto, señora Marcela. Entonces le confirmo: queda ingresada la renuncia del seguro de Hospitalización, número de seguro cuatro ocho dos uno tres tres cero cinco, con cargo a la cuenta vista de don Jorge. ¿Están de acuerdo?"),
        ("C", "Sí, de acuerdo. Gracias, señorita."),
        ("A", "A usted, que tengan buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213305", "outcome": "RENUNCIA", "cancellation_reasons": ["No desea contraer más obligaciones"], "objections": 1},
        ],
        "findings": [
            {"criterion_id": 27, "status": "non_compliant", "note": "Entrega información y cierra la gestión con la cónyuge (tercero) sin retomar el protocolo de cierre con el titular."},
            {"criterion_id": 14, "status": "uncertain", "note": "El único argumento de retención se le da a la cónyuge (tercero), no al titular: se puede leer como que no hubo intento de retención válido."},
        ],
        "notes": "En el canal del cliente hablan dos personas distintas; útil para probar detección de terceros.",
    },
)

# ---------------------------------------------------------------- 06
call(
    call_id="synth-06",
    title="Retención sin intención de renuncia y pregunta predispuesta",
    description="La clienta solo consulta si su Sale Seguro cubre un robo. El ejecutivo igual hace un discurso de retención, "
    "le pide un 'sí' condicionado y no responde si el robo está cubierto.",
    agent_id="EJ-0106",
    date="2026-09-08",
    policies=[policy(SALE, "48213306", "CTV")],
    typification=[],
    turns=[
        ("A", "Buenos días, BancoEstado Corredores de Seguros, le habla Ignacio Vargas. ¿Con quién hablo?"),
        ("C", "Hola, buenos días, con Sofía Tapia."),
        ("A", "Señora Sofía, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Dieciséis millones seiscientos sesenta y seis mil seiscientos sesenta y seis guion seis. Sofía Ignacia Tapia Rojas, once de agosto del noventa y dos."),
        ("A", "¿Su correo y un teléfono de contacto?"),
        ("C", "sofia punto tapia arroba correo ejemplo punto cl, nueve tres tres tres dos dos dos uno uno."),
        ("A", "Gracias, quedó validada. ¿En qué la puedo ayudar?"),
        ("C", "Tengo el Sale Seguro y el fin de semana me asaltaron y me robaron la cartera con la tarjeta. Quería saber si eso lo cubre y cómo hago el reclamo."),
        ("A", "Señora Sofía, antes de eso le quiero recordar lo importante que es mantener este seguro. Mucha gente lo da de baja y después se arrepiente, porque es una protección muy completa para usted y su familia."),
        ("C", "Ya, pero yo no lo quiero dar de baja, solo quiero saber del robo."),
        ("A", "Sí, claro, pero es importante que lo mantenga. Usted está de acuerdo en mantenerlo, ¿cierto?"),
        ("C", "Eh... sí, supongo. Pero ¿me cubre el robo o no?"),
        ("A", "Perfecto, entonces queda vigente. Para el robo, eso lo ve la compañía; usted haga la denuncia en Carabineros y llame al FonoSeguros, seiscientos seiscientos sesenta, doce doce."),
        ("C", "Ya, gracias."),
        ("A", "Que tenga buen día, señora Sofía."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": False,
        "outcomes": [
            {"mus_a_neto": "48213306", "outcome": "CONSULTA", "cancellation_reasons": [], "objections": 0},
        ],
        "findings": [
            {"criterion_id": 16, "status": "non_compliant", "note": "Argumenta para retener sin que la clienta haya expresado intención de renuncia."},
            {"criterion_id": 32, "status": "non_compliant", "note": "'Usted está de acuerdo en mantenerlo, ¿cierto?': condiciona la respuesta a un sí."},
            {"criterion_id": 8, "status": "non_compliant", "note": "La clienta pregunta dos veces si el robo está cubierto y el ejecutivo no responde."},
            {"criterion_id": 6, "status": "uncertain", "note": "La ficha dice que cubre robo con violencia o intimidación; el ejecutivo no lo informa ('eso lo ve la compañía'). Se superpone con el motivo 8."},
            {"criterion_id": 29, "status": "uncertain", "note": "El ejecutivo da el seguro por retenido sin solicitud. Si eso cuenta como gestión, falta el protocolo de cierre (TBD con el cliente)."},
            {"criterion_id": 13, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 15, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 25, "status": "uncertain", "note": "No hay tipificación. Si la consulta (o la 'retención') debía tipificarse, falta."},
        ],
        "notes": "No hubo solicitud de renuncia: por grabación es una consulta.",
    },
)

# ---------------------------------------------------------------- 07
call(
    call_id="synth-07",
    title="Llamada larga con esperas excesivas y descalificación de la competencia",
    description="El cliente ya contrató un seguro en otra compañía. El ejecutivo lo deja dos veces en espera (45 s y 210 s, ambas sobre 30 s) "
    "y descalifica a la competencia. El cliente termina renunciando.",
    agent_id="EJ-0107",
    date="2026-09-09",
    policies=[policy(PROTECCION, "48213307", "CCT")],
    typification=[{"mus_a_neto": "48213307", "outcome": "RENUNCIA", "reason": "Cliente posee otros Seguros"}],
    turns=[
        ("A", "Buenas tardes, le saluda Daniela Espinoza de BancoEstado Corredores de Seguros. ¿Con quién tengo el gusto?"),
        ("C", "Buenas tardes, habla Cristián Molina."),
        ("A", "Don Cristián, para validar su identidad, ¿me puede indicar su RUT?"),
        ("C", "Diecisiete millones setecientos setenta y siete mil setecientos setenta y siete guion siete."),
        ("A", "¿Nombre completo?"),
        ("C", "Cristián Felipe Molina Araya."),
        ("A", "¿Fecha de nacimiento?"),
        ("C", "Veintiocho de febrero del ochenta y uno."),
        ("A", "¿Me confirma su correo y teléfono?"),
        ("C", "cristian punto molina arroba correo ejemplo punto cl, y el nueve siete siete siete uno uno uno dos dos."),
        ("A", "Gracias, don Cristián, quedó validado. ¿En qué lo puedo ayudar?"),
        ("C", "Mire, tengo una ferretería chica y tengo el seguro Protección Global MYPE con ustedes. Ya contraté uno en otra compañía que cubre más y es más barato, así que quiero renunciar a este."),
        ("A", "Entiendo, don Cristián. Permítame revisar el detalle de su póliza. Lo dejo un momento en espera."),
        ("HOLD", 45),
        ("A", "Gracias por esperar. Veo su seguro Protección Global MYPE, con prima mensual cargada a su cuenta corriente. ¿Me puede contar qué contrató en la otra compañía?"),
        ("C", "Uno que cubre incendio, sismo y robo del local, y además responsabilidad civil. Y sale como cuatro lucas menos al mes."),
        ("A", "Mire, don Cristián, le soy honesta: esa otra compañía es una estafa. Siempre ponen letra chica y después no pagan nada. Los que se cambian a ellos después vuelven llorando."),
        ("C", "Bueno, pero yo leí las condiciones y me parecen bien."),
        ("A", "Nuestro seguro le cubre el local y también sus mercaderías, maquinarias y equipos ante incendio, sismo, robo y daños materiales, y el cargo es automático, no se tiene que preocupar."),
        ("C", "Ya, pero el otro igual cubre más, la verdad. Quiero sacar este."),
        ("A", "Déjeme consultar con mi supervisor si hay alguna alternativa para usted. Lo dejo en espera nuevamente."),
        ("HOLD", 210),
        ("A", "Disculpe la demora, don Cristián. Mi supervisor me indica que no tenemos un plan alternativo con más cobertura en este momento."),
        ("C", "Oiga, me tuvo harto rato esperando. Ya, entonces hágame la renuncia, por favor."),
        ("A", "Le pido disculpas por la espera. Procedo con la renuncia."),
        ("C", "Y una consulta, ¿me van a cobrar este mes igual?"),
        ("A", "La fecha del cargo mensual no la veo en mi sistema; para confirmarla puede llamar al seiscientos seiscientos sesenta, doce doce. Si la renuncia queda ingresada hoy, no deberían seguir los cargos."),
        ("C", "Ya, perfecto."),
        ("A", "Le resumo la gestión, don Cristián: se ingresó la renuncia de su seguro Protección Global MYPE, número de seguro cuatro ocho dos uno tres tres cero siete, que se cargaba mensualmente a su cuenta corriente. ¿Está de acuerdo con la gestión realizada?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Muchas gracias por su paciencia. Que tenga buena tarde."),
        ("C", "Igualmente, chao."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213307", "outcome": "RENUNCIA", "cancellation_reasons": ["Cliente posee otros Seguros"], "objections": 3},
        ],
        "findings": [
            {"criterion_id": 11, "status": "non_compliant", "note": "'Esa otra compañía es una estafa': descalifica a la competencia."},
            {"criterion_id": 1, "status": "non_compliant", "note": "Esperas de 45 s y 210 s; el máximo es 30 s sin hablarle al cliente."},
        ],
        "notes": "Llamada más larga del set. Orientar a llamar por la fecha de cargo no es derivación ni falta de información (no hay fechas de pago en el sistema).",
    },
)

# ---------------------------------------------------------------- 08
call(
    call_id="synth-08",
    title="Inducción a la renuncia y negación de devolución de prima",
    description="La clienta llama a consultar por un cobro que no reconoce. El ejecutivo no le explica el seguro, le sugiere renunciar "
    "y le niega la devolución, que corresponde porque es un seguro anual.",
    agent_id="EJ-0108",
    date="2026-09-10",
    policies=[policy(AP_INDIVIDUAL, "48213308", "CTV")],
    typification=[{"mus_a_neto": "48213308", "outcome": "RENUNCIA", "reason": "No informado"}],
    turns=[
        ("A", "BancoEstado Corredores de Seguros, buenas tardes, le atiende Sebastián Lagos."),
        ("C", "Hola, buenas tardes, habla Valentina Reyes."),
        ("A", "Señora Valentina, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Dieciocho millones ochocientos ochenta y ocho mil ochocientos ochenta y ocho guion ocho. Valentina Paz Reyes Ortiz, cinco de diciembre del noventa y cinco."),
        ("A", "¿Su correo y teléfono?"),
        ("C", "valentina punto reyes arroba correo ejemplo punto cl, nueve dos dos dos tres tres tres cuatro cuatro."),
        ("A", "Gracias, datos validados. ¿En qué la ayudo?"),
        ("C", "Me apareció un cobro en la cuenta por un seguro y no me acuerdo bien qué es. Quería saber qué cubre."),
        ("A", "Ah, sí, es un seguro que se contrató con su cuenta. La verdad, si no se acuerda de él, seguramente no lo usa. Mejor se lo doy de baja altiro y se ahorra la plata, ¿le parece?"),
        ("C", "Eh... bueno, ya, si usted dice."),
        ("A", "Perfecto, procedo."),
        ("C", "Y lo que ya me cobraron, ¿me lo devuelven?"),
        ("A", "No, eso no se devuelve. Lo pagado, pagado."),
        ("C", "Ah, ya. Bueno."),
        ("A", "Listo, señora Valentina. Quedó ingresada la renuncia de su seguro de Accidentes Personales, número de seguro cuatro ocho dos uno tres tres cero ocho, con cargo a su cuenta RUT. ¿Está de acuerdo?"),
        ("C", "Sí."),
        ("A", "Que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": False,
        "outcomes": [
            {"mus_a_neto": "48213308", "outcome": "RENUNCIA", "cancellation_reasons": [], "objections": 0},
        ],
        "findings": [
            {"criterion_id": 12, "status": "non_compliant", "note": "La clienta solo consulta qué cubre; el ejecutivo le propone renunciar."},
            {"criterion_id": 28, "status": "non_compliant", "note": "Seguro de prima anual: corresponde devolución de la prima no devengada y el ejecutivo la niega."},
            {"criterion_id": 6, "status": "non_compliant", "note": "No explica qué cubre el seguro ante la consulta directa."},
            {"criterion_id": 4, "status": "non_compliant", "note": "No indica ninguna característica del seguro que se renuncia."},
            {"criterion_id": 8, "status": "non_compliant", "note": "La clienta pregunta qué cubre y el ejecutivo no responde."},
            {"criterion_id": 14, "status": "non_compliant", "note": "Seguro retenible renunciado sin ningún intento de retención."},
            {"criterion_id": 18, "status": "uncertain", "note": "Tipificado 'No informado'. La clienta no reconoce el cobro: podría ser 'Desconoce contratación del seguro'."},
        ],
    },
)

# ---------------------------------------------------------------- 09
call(
    call_id="synth-09",
    title="Dos seguros: gestiona y tipifica solo uno",
    description="El cliente quiere renunciar a dos seguros (desempleo e Incendio Hogar). El ejecutivo intenta retener ambos, "
    "el cliente insiste, pero solo se procesa y tipifica la renuncia del de desempleo.",
    agent_id="EJ-0109",
    date="2026-09-11",
    policies=[policy(DESEMPLEO, "48213309", "CRE"), policy(INCENDIO, "48213310", "CCT")],
    typification=[{"mus_a_neto": "48213309", "outcome": "RENUNCIA", "reason": "Cambio de situación laboral"}],
    turns=[
        ("A", "Buenos días, le saluda Constanza Muñoz de BancoEstado Corredores de Seguros. ¿Con quién tengo el gusto?"),
        ("C", "Buenos días, habla Felipe Gutiérrez."),
        ("A", "Don Felipe, para validar su identidad, ¿me indica su RUT?"),
        ("C", "Diecinueve millones novecientos noventa y nueve mil novecientos noventa y nueve guion nueve."),
        ("A", "¿Nombre completo y fecha de nacimiento?"),
        ("C", "Felipe Ignacio Gutiérrez Bravo, diecisiete de junio del ochenta y siete."),
        ("A", "¿Su correo y teléfono de contacto?"),
        ("C", "felipe punto gutierrez arroba correo ejemplo punto cl, nueve seis seis seis siete siete siete ocho ocho."),
        ("A", "Gracias, don Felipe, datos validados. ¿En qué lo ayudo hoy?"),
        ("C", "Mire, me quedé sin pega hace un mes, me voy a trabajar independiente, y quiero ordenar mis gastos. Quiero renunciar a dos seguros: el de desempleo del crédito y el de incendio de la casa."),
        ("A", "Entiendo, don Felipe. Partamos por el de desempleo. ¿Usted ya cobró el seguro por su despido?"),
        ("C", "No, si me fui yo, renuncié. Por eso no lo puedo cobrar, cachai, entonces no me sirve."),
        ("A", "Claro. Le comento que, como trabajador independiente, este seguro igual lo cubre por incapacidad temporal: si un accidente o una enfermedad infecciosa no lo deja trabajar, le paga hasta cuatro cuotas del crédito. Y como la prima ya está pagada, no le cuesta nada mantenerlo."),
        ("C", "Sí, pero igual lo quiero sacar."),
        ("A", "Perfecto, entonces gestiono la renuncia del seguro de desempleo."),
        ("C", "Ya. Y el de incendio también."),
        ("A", "Sobre el de Incendio Hogar, don Felipe: ese seguro protege su vivienda ante incendio, daños por agua y eventos de la naturaleza, y le da asistencias de plomería y cerrajería. Ahora que va a trabajar desde la casa, puede ser todavía más importante tenerlo."),
        ("C", "Mmm, puede ser, pero la verdad es un gasto mensual que ahora no puedo tener. Lo quiero sacar igual."),
        ("A", "Entiendo. Mientras se acomoda con su nuevo trabajo, ¿no prefiere mantenerlo un tiempo más?"),
        ("C", "No, no. Los dos, por favor. Quiero ordenarme."),
        ("A", "Muy bien. Deme un segundo que estoy ingresando la gestión."),
        ("C", "Ya, dale."),
        ("A", "Mientras carga el sistema, don Felipe, ¿quiere que le actualice su dirección o algún dato de contacto?"),
        ("C", "No, está todo bien, gracias."),
        ("A", "Perfecto. Le resumo: queda ingresada la renuncia de su seguro de desempleo de crédito de consumo, número de seguro cuatro ocho dos uno tres tres cero nueve, cuyo medio de pago es su crédito de consumo. ¿Está de acuerdo con la gestión?"),
        ("C", "Sí. ¿Y el de incendio quedó listo también?"),
        ("A", "Sí, don Felipe, quedó todo listo. Y la devolución de la prima no devengada del seguro de desempleo es automática, dentro de diez días hábiles."),
        ("C", "Ya, perfecto. Muchas gracias."),
        ("A", "A usted, que le vaya muy bien con su nuevo trabajo."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213309", "outcome": "RENUNCIA", "cancellation_reasons": ["Cambio de situación laboral", "No desea contraer más obligaciones"], "objections": 1},
            {"mus_a_neto": "48213310", "outcome": "RENUNCIA", "cancellation_reasons": ["Problemas Económicos", "Cambio de situación laboral"], "objections": 2},
        ],
        "findings": [
            {"criterion_id": 26, "status": "non_compliant", "note": "El cliente pidió renunciar a dos seguros y solo se procesa el de desempleo; responde 'quedó todo listo' sin gestionar Incendio Hogar."},
            {"criterion_id": 25, "status": "non_compliant", "note": "Solo tipifica 48213309; falta la gestión de 48213310."},
            {"criterion_id": 13, "status": "uncertain", "note": "No hay cierre para Incendio Hogar (ni N° de seguro). Es consecuencia de no haber gestionado ese seguro (26)."},
            {"criterion_id": 15, "status": "uncertain", "note": "Igual que 13: no informa el medio de pago de Incendio Hogar."},
            {"criterion_id": 29, "status": "uncertain", "note": "Igual que 13."},
        ],
        "notes": "El piloto parte con un seguro por cliente; este caso queda para probar 25 y 26. "
        "El motivo de Incendio Hogar es interpretable (gasto mensual → Problemas Económicos).",
    },
)

# ---------------------------------------------------------------- 10
call(
    call_id="synth-10",
    title="Renuncia de un seguro no renunciable",
    description="El desgravamen nominal del hipotecario es obligatorio: no se puede renunciar por teléfono y se debe derivar a sucursal. "
    "El ejecutivo igual ingresa la renuncia.",
    agent_id="EJ-0110",
    date="2026-09-12",
    policies=[policy(DESGRAVAMEN_NOMINAL, "48213311", "HIP")],
    typification=[{"mus_a_neto": "48213311", "outcome": "RENUNCIA", "reason": "Desconoce contratación del seguro"}],
    turns=[
        ("A", "Buenas tardes, BancoEstado Corredores de Seguros, le habla Tomás Silva. ¿Con quién hablo?"),
        ("C", "Hola, con Gloria Fernández."),
        ("A", "Señora Gloria, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Diez millones cien mil cien guion cero. Gloria Inés Fernández Soto, treinta de septiembre del sesenta y cinco."),
        ("A", "¿Y su correo y teléfono?"),
        ("C", "gloria punto fernandez arroba correo ejemplo punto cl, nueve uno uno uno dos dos dos tres tres."),
        ("A", "Gracias, quedó validada. ¿En qué la ayudo?"),
        ("C", "Me sale un seguro de desgravamen en el dividendo del hipotecario y yo no me acuerdo de haberlo contratado. Lo quiero sacar."),
        ("A", "Entiendo, señora Gloria. Es el seguro de desgravamen de su crédito hipotecario. Se lo doy de baja."),
        ("C", "Ya, gracias."),
        ("A", "Listo. Quedó ingresada la renuncia de su seguro de desgravamen, número de seguro cuatro ocho dos uno tres tres uno uno, con cargo en su crédito hipotecario. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213311", "outcome": "RENUNCIA", "cancellation_reasons": ["Desconoce contratación del seguro"], "objections": 0},
        ],
        "findings": [
            {"criterion_id": 9, "status": "non_compliant", "note": "Renuncia un seguro no renunciable (DESGRAVAMEN NOMINAL: obligatorio, solo se reemplaza en sucursal)."},
            {"criterion_id": 7, "status": "non_compliant", "note": "Debió explicar que no se puede renunciar por teléfono y orientar a sucursal para reemplazar la póliza."},
            {"criterion_id": 4, "status": "uncertain", "note": "Solo nombra el seguro. En un no renunciable no hay retención, así que no está claro que aplique."},
        ],
        "notes": "No renunciable: el motivo 14 no aplica. Lo correcto era tipificarlo como consulta.",
    },
)

# ---------------------------------------------------------------- 11
call(
    call_id="synth-11",
    title="Llamada cortada con audio ininteligible",
    description="Acreditación y un intento de retención; luego el audio se vuelve ininteligible y la llamada se corta antes del cierre. "
    "Caso para probar el estado uncertain.",
    agent_id="EJ-0111",
    date="2026-09-15",
    policies=[policy(DESEMPLEO, "48213312", "CRE")],
    typification=[{"mus_a_neto": "48213312", "outcome": "RENUNCIA", "reason": "No desea contraer más obligaciones"}],
    turns=[
        ("A", "Buenas tardes, BancoEstado Corredores de Seguros, le habla Paula Rivas. ¿Con quién hablo?"),
        ("C", "Hola, habla Manuel Torres."),
        ("A", "Don Manuel, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Doce millones doscientos doce mil doscientos doce guion k. Manuel Antonio Torres Díaz, primero de abril del setenta y nueve."),
        ("A", "¿Su correo y teléfono?"),
        ("C", "manuel punto torres arroba correo ejemplo punto cl, nueve cero cero cero uno uno uno dos dos."),
        ("A", "Gracias, don Manuel. ¿En qué lo ayudo?"),
        ("C", "Quiero dar de baja el seguro de desempleo, no quiero más compromisos."),
        ("A", "Entiendo. Le cuento que este seguro le paga cuatro cuotas de su crédito si queda sin trabajo de forma involuntaria, y además..."),
        ("C", "[inaudible] ...no, si igual... [inaudible] ...el otro..."),
        ("A", "¿Aló? Don Manuel, se está cortando. ¿Me escucha?"),
        ("C", "[inaudible] ...renuncia... [ruido]"),
        ("A", "¿Aló? Don Manuel..."),
    ],
    expected={
        "call_verdict": "uncertain",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213312", "outcome": "SIN_GESTION", "cancellation_reasons": ["No desea contraer más obligaciones"], "objections": 1},
        ],
        "findings": [
            {"criterion_id": 29, "status": "uncertain", "note": "La llamada se corta antes del cierre; no se puede evaluar el protocolo de cierre."},
            {"criterion_id": 13, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 15, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 26, "status": "uncertain", "note": "No se ve si la renuncia se alcanzó a gestionar."},
        ],
        "notes": "Debe ir a revisión humana. La tipificación RENUNCIA no se puede verificar.",
    },
)

# ---------------------------------------------------------------- 12
call(
    call_id="synth-12",
    title="Retiene un seguro no retenible",
    description="El cliente quiere renunciar a un seguro de desempleo que está en la lista de no retenibles. "
    "El ejecutivo argumenta dos veces y el cliente lo mantiene. Gestión que no corresponde.",
    agent_id="EJ-0112",
    date="2026-09-16",
    policies=[policy(DESEMPLEO_NO_RET, "48213313", "CRE")],
    typification=[{"mus_a_neto": "48213313", "outcome": "RETENCION", "reason": "Cambio de situación laboral"}],
    turns=[
        ("A", "Buenos días, BancoEstado Corredores de Seguros, le habla Andrés Pino. ¿Con quién tengo el gusto?"),
        ("C", "Hola, buenos días, habla Ricardo Vidal."),
        ("A", "Don Ricardo, para validar su identidad, ¿me indica su RUT, su nombre completo y su fecha de nacimiento?"),
        ("C", "Veinte millones doscientos mil doscientos guion dos. Ricardo José Vidal Campos, diez de noviembre del ochenta y tres."),
        ("A", "¿Y me confirma su correo y teléfono?"),
        ("C", "ricardo punto vidal arroba correo ejemplo punto cl, nueve ocho ocho ocho siete siete siete seis seis."),
        ("A", "Gracias, don Ricardo, datos validados. ¿En qué lo ayudo?"),
        ("C", "Quiero dar de baja el seguro de desempleo del crédito de consumo. Ahora trabajo de forma independiente, así que no lo voy a poder usar."),
        ("A", "Entiendo, don Ricardo. Antes de eso, le recomiendo pensarlo: este seguro lo protege si se queda sin ingresos y le ayuda a pagar las cuotas de su crédito."),
        ("C", "Pero si soy independiente, ¿igual me sirve?"),
        ("A", "Es una protección para su crédito, y si vuelve a trabajar con contrato le puede servir mucho. Yo que usted lo mantendría un tiempo más."),
        ("C", "Bueno, ya, lo dejo por ahora."),
        ("A", "Perfecto. Le resumo la gestión: su seguro de desempleo de crédito de consumo, número de seguro cuatro ocho dos uno tres tres uno tres, se mantiene vigente, con cargo a su crédito de consumo. ¿Está de acuerdo con la gestión?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Muchas gracias, don Ricardo, que tenga buen día."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213313", "outcome": "RETENCION", "cancellation_reasons": ["Cambio de situación laboral"], "objections": 2},
        ],
        "findings": [
            {"criterion_id": 17, "status": "non_compliant", "note": "SEGURO DE DESEMPLEO CONSUMO está en la lista de no retenibles y el ejecutivo lo retiene."},
            {"criterion_id": 8, "status": "uncertain", "note": "El cliente pregunta si le sirve siendo independiente y el ejecutivo responde de forma vaga."},
            {"criterion_id": 6, "status": "uncertain", "note": "No hay ficha de este seguro para contrastar la respuesta."},
        ],
        "notes": "Prueba que el modelo distinga SEGURO DE DESEMPLEO CONSUMO (no retenible) de DESEMPLEO ITT CRE. CONSUMO (retenible).",
    },
)

# ---------------------------------------------------------------- 13
call(
    call_id="synth-13",
    title="Tipifica renuncia cuando fue retención y limita la permanencia",
    description="La clienta quiere renunciar al AP Plus. El ejecutivo parte con la fecha de renovación y le dice que solo puede renunciar en esa fecha. "
    "La clienta decide mantenerlo hasta entonces, pero el ejecutivo tipifica RENUNCIA. Medio de pago OTRO: no se menciona en el cierre.",
    agent_id="EJ-0113",
    date="2026-09-17",
    policies=[policy(AP_PLUS, "48213314", "OTRO")],
    typification=[{"mus_a_neto": "48213314", "outcome": "RENUNCIA", "reason": "Problemas Económicos"}],
    turns=[
        ("A", "Buenas tardes, BancoEstado Corredores de Seguros, le saluda Marcela Ortiz. ¿Con quién hablo?"),
        ("C", "Buenas tardes, habla Patricia León."),
        ("A", "Señora Patricia, para validar su identidad, ¿me indica su RUT?"),
        ("C", "Nueve millones novecientos mil novecientos guion nueve."),
        ("A", "¿Su nombre completo y fecha de nacimiento?"),
        ("C", "Patricia Elena León Fuentes, veinticinco de junio del setenta."),
        ("A", "¿Y su correo y teléfono de contacto?"),
        ("C", "patricia punto leon arroba correo ejemplo punto cl, nueve siete cero cero cero uno dos tres cuatro."),
        ("A", "Gracias, señora Patricia, quedó validada. ¿En qué la puedo ayudar?"),
        ("C", "Quiero renunciar al seguro de accidentes personales. Está todo muy caro y tengo que recortar gastos."),
        ("A", "Entiendo, señora Patricia. Su seguro se renueva en marzo, y la renuncia solo se puede hacer en la fecha de renovación, así que le conviene esperar a marzo."),
        ("C", "¿Y no lo puedo sacar antes?"),
        ("A", "No, tiene que esperar a la renovación. Además, mientras tanto sigue protegida: si fallece por un accidente, en Chile o en el extranjero, sus beneficiarios reciben quinientas UF de una vez."),
        ("C", "Ya, bueno. Entonces lo dejo hasta marzo no más."),
        ("A", "Perfecto. Le resumo: su seguro de Accidentes Personales Plan Plus, número de seguro cuatro ocho dos uno tres tres uno cuatro, se mantiene vigente. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Gracias, que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"mus_a_neto": "48213314", "outcome": "RETENCION", "cancellation_reasons": ["Problemas Económicos"], "objections": 2, "renewal_last": False},
        ],
        "findings": [
            {"criterion_id": 5, "status": "non_compliant", "note": "Ante la consulta directa, dice que solo puede renunciar en la fecha de renovación; la permanencia la decide la clienta."},
            {"criterion_id": 19, "status": "non_compliant", "note": "Tipifica RENUNCIA y por grabación la clienta mantiene el seguro (retención)."},
        ],
        "notes": "Orden de argumentos incorrecto: la fecha de renovación va al final y acá es el primero (indicador del dashboard, no es motivo). "
        "Medio de pago OTRO: el motivo 15 no aplica.",
    },
)


def fmt(sec):
    return f"{int(sec // 60):02d}:{int(sec % 60):02d}"


def build(c, idx):
    t = 1.0
    segments, holds = [], []
    for i, turn in enumerate(c["turns"]):
        if turn[0] == "HOLD":
            holds.append(turn[1])
            t += turn[1]
            continue
        speaker, text = turn
        dur = max(1.2, len(text.split()) / WORDS_PER_SEC)
        segments.append({
            "channel": "agent" if speaker == "A" else "customer",
            "start_ms": int(t * 1000),
            "end_ms": int((t + dur) * 1000),
            "text": text,
        })
        t += dur + GAPS[(i + idx) % len(GAPS)]
    duration = int(t + 1)
    data = {
        "call_id": c["call_id"],
        "synthetic": True,
        "title": c["title"],
        "description": c["description"],
        "metadata": {
            "date": c["date"],
            "agent_id": c["agent_id"],
            "duration_sec": duration,
            "holds_sec": holds,
            "policies": c["policies"],
            "typification": c["typification"],
        },
        "transcript": segments,
        "expected": c["expected"],
    }
    if "fixture_assumptions" in c:
        data["fixture_assumptions"] = c["fixture_assumptions"]
    return data


OUT.mkdir(parents=True, exist_ok=True)
index = []
for idx, c in enumerate(CALLS):
    data = build(c, idx)
    slug = c["call_id"].replace("-", "_")
    (OUT / f"{slug}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [f"# {data['call_id']} · {data['title']}", "", data["description"], ""]
    for s in data["transcript"]:
        who = "AGENTE " if s["channel"] == "agent" else "CLIENTE"
        lines.append(f"[{fmt(s['start_ms'] / 1000)}] {who}: {s['text']}")
    (OUT / f"{slug}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    findings = ", ".join(f"{f['criterion_id']}" + ("?" if f["status"] != "non_compliant" else "") for f in data["expected"]["findings"]) or "—"
    index.append((data["call_id"], fmt(data["metadata"]["duration_sec"]), data["title"], data["expected"]["call_verdict"], findings))

for row in index:
    print(" | ".join(row))
