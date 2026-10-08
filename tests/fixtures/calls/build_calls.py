"""Genera llamadas sintéticas de retención con timestamps consistentes."""

import json
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
WORDS_PER_SEC = 2.6
GAPS = [0.6, 0.9, 0.5, 1.2, 0.7, 1.0, 0.8]

DESEMPLEO = "Seguro de Desempleo - Créditos de consumo"
INCAPACIDAD = "Seguro de Incapacidad Temporal - Créditos de consumo"
MYPE = "Seguro de Salud Incapacidad MYPE"
INCENDIO = "Seguro Incendio Hogar"
SALE = "Sale Seguro"
PROTECCION = "Protección Global"


def policy(name, number, retainable=True, cancellable=True, premium_refund=None):
    # premium_refund: True/False si en el fixture se asume que corresponde devolución de prima; None = sin dato.
    return {
        "name": name,
        "policy_number": number,
        "retainable": retainable,
        "cancellable_in_channel": cancellable,
        "premium_refund": premium_refund,
    }


CALLS = []


def call(**kw):
    CALLS.append(kw)


# ---------------------------------------------------------------- 01
call(
    call_id="synth-01",
    title="Retención exitosa, llamada modelo",
    description="El cliente quiere renunciar al seguro de desempleo por problemas económicos. "
    "Acreditación completa, 2 objeciones, responde sobre la permanencia y el cliente decide mantenerlo. "
    "Cierre completo con N° de póliza y medio de pago.",
    agent_id="EJ-0101",
    date="2026-09-01",
    policies=[policy(DESEMPLEO, "DES-CONS-0001")],
    typification=[{"policy_number": "DES-CONS-0001", "outcome": "RETENCION", "reason": "Problemas Económicos"}],
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
        ("A", "Entiendo, don Pedro. Veo que tiene el seguro de desempleo asociado a su crédito de consumo. Antes de gestionarlo, ¿me permite contarle brevemente qué cubre?"),
        ("C", "Ya, dale."),
        ("A", "Este seguro es de prima única, o sea, se pagó una sola vez por todo el período del crédito; no le genera un cobro mensual. Si queda desempleado por necesidades de la empresa o por mutuo acuerdo con indemnización, le paga hasta cinco cuotas de su crédito: dos de una vez contra el finiquito y tres más después de acreditar sesenta días de desempleo."),
        ("C", "Ah, pero yo pensé que me lo cobraban todos los meses."),
        ("A", "No, don Pedro, es prima única, ya está pagado junto con su crédito."),
        ("C", "Mmm, igual prefiero no tener nada extra, la verdad."),
        ("A", "Lo entiendo. Considere que si su situación laboral se complica, son hasta cinco cuotas que no tendría que pagar usted. Justo cuando me cuenta que está apretado, es cuando más le sirve."),
        ("C", "Ya, pero si lo dejo, ¿después lo puedo sacar igual?"),
        ("A", "Sí, don Pedro. La permanencia en el seguro la decide usted; puede renunciar cuando quiera."),
        ("C", "Ah, ya. Entonces lo mantengo no más po, si no me están cobrando nada aparte."),
        ("A", "Perfecto. Le resumo la gestión: hoy mantenemos vigente su seguro de desempleo de crédito de consumo, póliza número DES-CONS-0001. El medio de pago es el cargo único que se hizo en su crédito de consumo, así que no tiene cargos mensuales en su cuenta. No se realiza ninguna renuncia. ¿Está conforme con la gestión realizada?"),
        ("C", "Sí, conforme."),
        ("A", "Muchas gracias por su tiempo, don Pedro. Que tenga muy buena tarde."),
        ("C", "Gracias, igualmente. Chao."),
    ],
    expected={
        "call_verdict": "compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "DES-CONS-0001", "outcome": "RETENCION", "cancellation_reason": "Problemas Económicos", "objections": 2}],
        "findings": [],
        "notes": "Llamada de referencia: todos los motivos cumplen o no aplican.",
    },
)

# ---------------------------------------------------------------- 02
call(
    call_id="synth-02",
    title="Exceso de objeciones y cierre sin N° de póliza",
    description="El cliente insiste en renunciar; el ejecutivo da 5 argumentos de retención (1 tras la solicitud y 4 tras negativas). "
    "Procesa la renuncia, pero en el cierre no menciona el número de seguro.",
    agent_id="EJ-0102",
    date="2026-09-02",
    policies=[policy(DESEMPLEO, "DES-CONS-0002")],
    typification=[{"policy_number": "DES-CONS-0002", "outcome": "RENUNCIA", "reason": "Problemas Económicos"}],
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
        ("A", "Entiendo, señora Carolina. Le comento que este seguro le cubre hasta cinco cuotas de su crédito si queda cesante por necesidades de la empresa."),
        ("C", "Sí, sé lo que cubre, pero igual no lo quiero."),
        ("A", "Pero piense que le cubre hasta cinco cuotas. Hoy el trabajo está difícil, nunca se sabe."),
        ("C", "No, de verdad, quiero darlo de baja."),
        ("A", "Mire, la prima ya está pagada, no le cobran todos los meses. Mantenerlo no le cuesta nada extra."),
        ("C", "Ya le dije que no. Quiero renunciarlo."),
        ("A", "Le entiendo, pero imagínese si la despiden el próximo mes. Son cinco cuotas que no va a tener que pagar."),
        ("C", "Oiga, ya le dije tres veces que no."),
        ("A", "¿Y si lo mantiene un mes más y después lo vemos? Así no queda desprotegida."),
        ("C", "No, por favor, hágame la renuncia no más."),
        ("A", "Está bien, señora Carolina, procedo con la renuncia."),
        ("A", "Listo. Le confirmo que quedó ingresada la renuncia de su seguro de desempleo. El cargo se hacía a su crédito de consumo, así que no tendrá más movimientos asociados. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo, gracias."),
        ("A", "Que tenga un buen día."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "DES-CONS-0002", "outcome": "RENUNCIA", "cancellation_reason": "Problemas Económicos", "objections": 5}],
        "findings": [
            {"criterion_id": 3, "status": "non_compliant", "note": "5 argumentos de retención (el primero tras la solicitud y 4 tras negativas explícitas); el máximo es 3."},
            {"criterion_id": 13, "status": "non_compliant", "note": "El cierre confirma la renuncia pero no menciona el N° de póliza DES-CONS-0002."},
        ],
    },
)

# ---------------------------------------------------------------- 03
call(
    call_id="synth-03",
    title="Llamada corta sin intento de retención",
    description="El cliente vendió su departamento y quiere renunciar al seguro Incendio Hogar, que es retenible. "
    "El ejecutivo no intenta retener y tampoco valida correo ni teléfono.",
    agent_id="EJ-0103",
    date="2026-09-03",
    policies=[policy(INCENDIO, "INC-HOG-0003", retainable=True)],
    typification=[{"policy_number": "INC-HOG-0003", "outcome": "RENUNCIA", "reason": "Cambio de Domicilio o Venta de Propiedad"}],
    turns=[
        ("A", "BancoEstado Corredores de Seguros, buenas tardes, habla Javiera Morales."),
        ("C", "Hola, buenas, habla Luis Contreras."),
        ("A", "Don Luis, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Trece millones trescientos treinta y tres mil trescientos treinta y tres guion tres. Luis Alberto Contreras Vega, nueve de enero del setenta y ocho."),
        ("A", "Gracias. ¿Qué necesita?"),
        ("C", "Vendí el departamento y quiero dar de baja el seguro de incendio, porque ya no tiene sentido."),
        ("A", "Ya, perfecto, se lo doy de baja al tiro."),
        ("C", "Ya, gracias."),
        ("A", "Listo, don Luis. Quedó ingresada la renuncia de su seguro Incendio Hogar, póliza número INC-HOG-0003, que se cargaba mensualmente a su cuenta corriente terminada en cuatro cinco. ¿Está de acuerdo con la gestión?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Gracias por llamar, que esté bien."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "INC-HOG-0003", "outcome": "RENUNCIA", "cancellation_reason": "Cambio de Domicilio o Venta de Propiedad", "objections": 0}],
        "findings": [
            {"criterion_id": 14, "status": "non_compliant", "note": "Seguro retenible y no hay ningún intento de retención."},
            {"criterion_id": 33, "status": "non_compliant", "note": "No valida correo ni teléfono."},
            {"criterion_id": 4, "status": "non_compliant", "note": "No indica ninguna característica del seguro a renunciar."},
        ],
    },
)

# ---------------------------------------------------------------- 04
call(
    call_id="synth-04",
    title="Información errónea del producto y tipificación incorrecta",
    description="El ejecutivo dice que el seguro paga tres cuotas (la ficha dice hasta cinco). "
    "El cliente renuncia por problemas económicos, pero el ejecutivo tipifica 'Cambio de situación laboral'.",
    agent_id="EJ-0104",
    date="2026-09-04",
    policies=[policy(DESEMPLEO, "DES-CONS-0004")],
    typification=[{"policy_number": "DES-CONS-0004", "outcome": "RENUNCIA", "reason": "Cambio de situación laboral"}],
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
        ("A", "Le paga tres cuotas, y se pagan apenas presenta el finiquito."),
        ("C", "Pucha, no es tanto. Igual prefiero sacarlo."),
        ("A", "Piense que la prima ya está pagada, no es un cobro mensual."),
        ("C", "Ya, pero lo quiero sacar igual. Quiero tener menos cosas."),
        ("A", "Bueno, señora Andrea, procedo con la renuncia."),
        ("A", "Le resumo: se ingresó la renuncia de su seguro de desempleo, póliza número DES-CONS-0004, asociado a su crédito de consumo con cargo único en el crédito. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Muchas gracias, que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "DES-CONS-0004", "outcome": "RENUNCIA", "cancellation_reason": "Problemas Económicos", "objections": 2}],
        "findings": [
            {"criterion_id": 6, "status": "non_compliant", "note": "Dice que paga tres cuotas y que se pagan contra finiquito; la ficha indica hasta cinco cuotas (dos contra finiquito y tres tras 60 días)."},
            {"criterion_id": 18, "status": "non_compliant", "note": "Tipificado 'Cambio de situación laboral'; la clienta dice que sigue en el mismo trabajo y que no le alcanza: Problemas Económicos. Lo detecta el motor de decisión."},
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
    policies=[policy(MYPE, "MYPE-0005")],
    typification=[{"policy_number": "MYPE-0005", "outcome": "RENUNCIA", "reason": "No desea contraer más obligaciones"}],
    turns=[
        ("A", "Buenas tardes, le habla Fernanda Castro de BancoEstado Corredores de Seguros. ¿Con quién tengo el gusto?"),
        ("C", "Sí, buenas, habla Jorge Ramírez."),
        ("A", "Don Jorge, ¿me indica su RUT, nombre completo y fecha de nacimiento para validar?"),
        ("C", "Quince millones quinientos cincuenta y cinco mil quinientos cincuenta y cinco guion cinco. Jorge Esteban Ramírez Silva, tres de mayo del setenta y dos."),
        ("A", "¿Y su correo y teléfono?"),
        ("C", "jorge punto ramirez arroba correo ejemplo punto cl, nueve cuatro cuatro cuatro cuatro cinco cinco cinco cinco."),
        ("A", "Gracias, don Jorge, quedó validado. ¿En qué lo ayudo?"),
        ("C", "Quiero renunciar al seguro de salud de la pyme, no quiero más compromisos. Pero mire, mi señora es la que ve estas cosas, le paso con ella."),
        ("C", "Hola, buenas, habla Marcela, la señora de Jorge. ¿Cuánto es lo que estamos pagando por ese seguro y desde cuándo?"),
        ("A", "Hola, señora Marcela. El seguro de Salud Incapacidad MYPE tiene una prima mensual de doce mil cuatrocientos pesos, que se carga a la cuenta vista de don Jorge, y está vigente desde marzo del año pasado."),
        ("C", "Ya, ¿y qué pasa si lo sacamos? ¿Pierde algo?"),
        ("A", "Perdería la cobertura de incapacidad para su negocio: si don Jorge queda incapacitado temporalmente, el seguro le paga una renta diaria. Es una buena protección para un emprendedor."),
        ("C", "No, igual lo queremos sacar. Ya tenemos muchas cuentas."),
        ("A", "Perfecto, señora Marcela. Entonces le confirmo: queda ingresada la renuncia del seguro Salud Incapacidad MYPE, póliza número MYPE-0005, con cargo a la cuenta vista de don Jorge. ¿Están de acuerdo?"),
        ("C", "Sí, de acuerdo. Gracias, señorita."),
        ("A", "A usted, que tengan buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "MYPE-0005", "outcome": "RENUNCIA", "cancellation_reason": "No desea contraer más obligaciones", "objections": 1}],
        "findings": [
            {"criterion_id": 27, "status": "non_compliant", "note": "Entrega información y cierra la gestión con la cónyuge (tercero) sin retomar el protocolo de cierre con el titular."},
        ],
        "notes": "En el canal del cliente hablan dos personas distintas; útil para probar detección de terceros.",
    },
)

# ---------------------------------------------------------------- 06
call(
    call_id="synth-06",
    title="Retención sin intención de renuncia y pregunta predispuesta",
    description="El cliente solo consulta cómo usar su seguro Protección Global. El ejecutivo igual hace un discurso de retención "
    "y le pide un 'sí' condicionado.",
    agent_id="EJ-0106",
    date="2026-09-08",
    policies=[policy(PROTECCION, "PROT-GLB-0006")],
    typification=[],
    turns=[
        ("A", "Buenos días, BancoEstado Corredores de Seguros, le habla Ignacio Vargas. ¿Con quién hablo?"),
        ("C", "Hola, buenos días, con Sofía Tapia."),
        ("A", "Señora Sofía, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Dieciséis millones seiscientos sesenta y seis mil seiscientos sesenta y seis guion seis. Sofía Ignacia Tapia Rojas, once de agosto del noventa y dos."),
        ("A", "¿Su correo y un teléfono de contacto?"),
        ("C", "sofia punto tapia arroba correo ejemplo punto cl, nueve tres tres tres dos dos dos uno uno."),
        ("A", "Gracias, quedó validada. ¿En qué la puedo ayudar?"),
        ("C", "Tengo el seguro Protección Global y me robaron la billetera el fin de semana. Quería saber si eso lo cubre y cómo hago el reclamo."),
        ("A", "Señora Sofía, antes de eso le quiero recordar lo importante que es mantener este seguro. Mucha gente lo da de baja y después se arrepiente, porque es una protección muy completa para usted y su familia."),
        ("C", "Ya, pero yo no lo quiero dar de baja, solo quiero saber del robo."),
        ("A", "Sí, claro, pero es importante que lo mantenga. Usted está de acuerdo en mantenerlo, ¿cierto?"),
        ("C", "Eh... sí, supongo. Pero ¿me cubre el robo o no?"),
        ("A", "Perfecto, entonces queda vigente. Para el robo de la billetera, la cobertura depende de las condiciones de su póliza; tiene que hacer la denuncia en Carabineros y llamar al número de siniestros que le voy a dar."),
        ("C", "Ya, ¿cuál es el número?"),
        ("A", "Es el seiscientos, cero, cero, cero, cero, cero, cero. Ahí le van a pedir la denuncia."),
        ("C", "Ya, gracias."),
        ("A", "Que tenga buen día, señora Sofía."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": False,
        "outcomes": [{"policy_number": "PROT-GLB-0006", "outcome": "SIN_GESTION", "cancellation_reason": "No informado", "objections": 0}],
        "findings": [
            {"criterion_id": 16, "status": "non_compliant", "note": "Argumenta para retener sin que la clienta haya expresado intención de renuncia."},
            {"criterion_id": 32, "status": "non_compliant", "note": "'Usted está de acuerdo en mantenerlo, ¿cierto?': condiciona la respuesta a un sí."},
            {"criterion_id": 8, "status": "non_compliant", "note": "Elude la pregunta sobre la cobertura de robo para insistir en la retención."},
            {"criterion_id": 29, "status": "uncertain", "note": "El ejecutivo da el seguro por retenido sin solicitud. Si eso cuenta como gestión, falta el protocolo de cierre (TBD con el cliente)."},
            {"criterion_id": 13, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 15, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 25, "status": "uncertain", "note": "Igual que 29: si la retención cuenta como gestión, no está tipificada."},
        ],
        "notes": "No hay tipificación porque no hubo gestión de renuncia ni de retención solicitada por la clienta.",
    },
)

# ---------------------------------------------------------------- 07
call(
    call_id="synth-07",
    title="Llamada larga con esperas excesivas y descalificación de la competencia",
    description="El cliente ya contrató un seguro en otra compañía. El ejecutivo lo deja dos veces en espera (45 s y 210 s) "
    "y descalifica a la competencia. El cliente termina renunciando.",
    agent_id="EJ-0107",
    date="2026-09-09",
    policies=[policy(MYPE, "MYPE-0007")],
    typification=[{"policy_number": "MYPE-0007", "outcome": "RENUNCIA", "reason": "Cliente posee otros Seguros"}],
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
        ("C", "Mire, tengo una ferretería chica y tengo el seguro de salud incapacidad MYPE con ustedes. Ya contraté uno en otra compañía que cubre más y es más barato, así que quiero renunciar a este."),
        ("A", "Entiendo, don Cristián. Permítame revisar el detalle de su póliza. Lo dejo un momento en espera."),
        ("HOLD", 45),
        ("A", "Gracias por esperar. Veo su seguro Salud Incapacidad MYPE, con prima mensual cargada a su cuenta corriente. ¿Me puede contar qué contrató en la otra compañía?"),
        ("C", "Una renta diaria más alta por incapacidad y además cubre hospitalización. Y sale como cuatro lucas menos al mes."),
        ("A", "Mire, don Cristián, le soy honesta: esa otra compañía es una estafa. Siempre ponen letra chica y después no pagan nada. Los que se cambian a ellos después vuelven llorando."),
        ("C", "Bueno, pero yo leí las condiciones y me parecen bien."),
        ("A", "Nuestro seguro tiene el respaldo de BancoEstado. Si usted queda incapacitado, le pagamos la renta diaria sin tantos trámites, y el cargo es automático, no se tiene que preocupar."),
        ("C", "Ya, pero el otro igual cubre más, la verdad. Quiero sacar este."),
        ("A", "Déjeme consultar con mi supervisor si hay alguna alternativa para usted. Lo dejo en espera nuevamente."),
        ("HOLD", 210),
        ("A", "Disculpe la demora, don Cristián. Mi supervisor me indica que no tenemos un plan alternativo con más cobertura en este momento."),
        ("C", "Oiga, me tuvo harto rato esperando. Ya, entonces hágame la renuncia, por favor."),
        ("A", "Le pido disculpas por la espera. Procedo con la renuncia."),
        ("C", "Y una consulta, ¿me van a cobrar este mes igual?"),
        ("A", "Si la renuncia queda ingresada hoy, el cargo de este mes ya no se debería realizar. Si llegara a verlo, nos llama y lo revisamos."),
        ("C", "Ya, perfecto."),
        ("A", "Le resumo la gestión, don Cristián: se ingresó la renuncia de su seguro Salud Incapacidad MYPE, póliza número MYPE-0007, que se cargaba mensualmente a su cuenta corriente. ¿Está de acuerdo con la gestión realizada?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Muchas gracias por su paciencia. Que tenga buena tarde."),
        ("C", "Igualmente, chao."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "MYPE-0007", "outcome": "RENUNCIA", "cancellation_reason": "Cliente posee otros Seguros", "objections": 3}],
        "findings": [
            {"criterion_id": 11, "status": "non_compliant", "note": "'Esa otra compañía es una estafa': descalifica a la competencia."},
            {"criterion_id": 1, "status": "depends_on_threshold", "note": "Esperas de 45 s y 210 s. El umbral es TBD con el cliente; con un umbral de ejemplo de 120 s, la segunda espera incumple."},
        ],
        "notes": "Llamada más larga del set; útil para probar esperas y costo por llamada.",
    },
)

# ---------------------------------------------------------------- 08
call(
    call_id="synth-08",
    title="Inducción a la renuncia y negación de devolución de prima",
    description="El cliente llama a consultar por un cobro de Sale Seguro. El ejecutivo le sugiere renunciar sin que lo haya pedido "
    "y le niega la devolución de la prima, que en este caso sí corresponde (supuesto sintético del fixture).",
    agent_id="EJ-0108",
    date="2026-09-10",
    policies=[policy(SALE, "SALE-0008", premium_refund=True)],
    typification=[{"policy_number": "SALE-0008", "outcome": "RENUNCIA", "reason": "No informado"}],
    turns=[
        ("A", "BancoEstado Corredores de Seguros, buenas tardes, le atiende Sebastián Lagos."),
        ("C", "Hola, buenas tardes, habla Valentina Reyes."),
        ("A", "Señora Valentina, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Dieciocho millones ochocientos ochenta y ocho mil ochocientos ochenta y ocho guion ocho. Valentina Paz Reyes Ortiz, cinco de diciembre del noventa y cinco."),
        ("A", "¿Su correo y teléfono?"),
        ("C", "valentina punto reyes arroba correo ejemplo punto cl, nueve dos dos dos tres tres tres cuatro cuatro."),
        ("A", "Gracias, datos validados. ¿En qué la ayudo?"),
        ("C", "Me apareció un cobro en la cuenta que dice Sale Seguro y no me acuerdo bien qué es. Quería saber qué cubre."),
        ("A", "Ah, sí, es un seguro que se contrató con su crédito. La verdad, si no se acuerda de él, seguramente no lo usa. Mejor se lo doy de baja altiro y se ahorra la plata, ¿le parece?"),
        ("C", "Eh... bueno, ya, si usted dice."),
        ("A", "Perfecto, procedo."),
        ("C", "Y lo que ya me cobraron, ¿me lo devuelven?"),
        ("A", "No, eso no se devuelve. Lo pagado, pagado."),
        ("C", "Ah, ya. Bueno."),
        ("A", "Listo, señora Valentina. Quedó ingresada la renuncia de su Sale Seguro, póliza número SALE-0008, con cargo a su cuenta RUT. ¿Está de acuerdo?"),
        ("C", "Sí."),
        ("A", "Que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": False,
        "outcomes": [{"policy_number": "SALE-0008", "outcome": "RENUNCIA", "cancellation_reason": "No informado", "objections": 0}],
        "findings": [
            {"criterion_id": 12, "status": "non_compliant", "note": "La clienta solo consulta qué cubre; el ejecutivo le sugiere renunciar."},
            {"criterion_id": 28, "status": "non_compliant", "note": "Niega la devolución de prima y en los metadatos devolucion_prima = corresponde."},
            {"criterion_id": 6, "status": "non_compliant", "note": "No explica qué cubre el seguro ante la consulta directa."},
            {"criterion_id": 4, "status": "non_compliant", "note": "No indica ninguna característica del seguro que se renuncia."},
            {"criterion_id": 8, "status": "non_compliant", "note": "La clienta pregunta qué cubre y el ejecutivo no responde."},
            {"criterion_id": 14, "status": "non_compliant", "note": "Seguro retenible renunciado sin ningún intento de retención."},
        ],
        "notes": "Que corresponda devolución de prima es un supuesto del fixture (premium_refund=True); la regla real es TBD con el cliente.",
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
    policies=[policy(DESEMPLEO, "DES-CONS-0009"), policy(INCENDIO, "INC-HOG-0009")],
    typification=[{"policy_number": "DES-CONS-0009", "outcome": "RENUNCIA", "reason": "Cambio de situación laboral"}],
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
        ("A", "Claro. Le comento que este seguro le cubriría si a futuro vuelve a tener contrato y lo despiden por necesidades de la empresa. Como la prima ya está pagada, no le cuesta nada mantenerlo."),
        ("C", "Sí, pero voy a ser independiente, entonces no me va a cubrir. Lo quiero sacar."),
        ("A", "Perfecto, entonces gestiono la renuncia del seguro de desempleo."),
        ("C", "Ya. Y el de incendio también."),
        ("A", "Sobre el de Incendio Hogar, don Felipe: ese seguro protege su vivienda y sus contenidos ante incendio y otros eventos de la naturaleza. Ahora que va a trabajar desde la casa, puede ser todavía más importante tenerlo."),
        ("C", "Mmm, puede ser, pero la verdad es un gasto mensual que ahora no puedo tener. Lo quiero sacar igual."),
        ("A", "Entiendo. Mientras se acomoda con su nuevo trabajo, ¿no prefiere mantenerlo un tiempo más?"),
        ("C", "No, no. Los dos, por favor. Quiero ordenarme."),
        ("A", "Muy bien. Deme un segundo que estoy ingresando la gestión."),
        ("C", "Ya, dale."),
        ("A", "Mientras carga el sistema, don Felipe, ¿quiere que le actualice su dirección o algún dato de contacto?"),
        ("C", "No, está todo bien, gracias."),
        ("A", "Perfecto. Le resumo: queda ingresada la renuncia de su seguro de desempleo de crédito de consumo, póliza número DES-CONS-0009, cuyo medio de pago fue el cargo único en su crédito de consumo. ¿Está de acuerdo con la gestión?"),
        ("C", "Sí. ¿Y el de incendio quedó listo también?"),
        ("A", "Sí, don Felipe, quedó todo listo."),
        ("C", "Ya, perfecto. Muchas gracias."),
        ("A", "A usted, que le vaya muy bien con su nuevo trabajo."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [
            {"policy_number": "DES-CONS-0009", "outcome": "RENUNCIA", "cancellation_reason": "Cambio de situación laboral", "objections": 1},
            {"policy_number": "INC-HOG-0009", "outcome": "RENUNCIA", "cancellation_reason": "Problemas Económicos", "objections": 2},
        ],
        "findings": [
            {"criterion_id": 26, "status": "non_compliant", "note": "El cliente pidió renunciar a dos seguros y el cierre solo procesa el de desempleo; responde 'quedó todo listo' sin gestionar Incendio Hogar."},
            {"criterion_id": 25, "status": "non_compliant", "note": "Solo tipifica DES-CONS-0009; falta la gestión de INC-HOG-0009."},
            {"criterion_id": 13, "status": "non_compliant", "note": "No indica el N° de póliza del seguro Incendio Hogar en el cierre."},
        ],
        "notes": "El motivo de renuncia de Incendio Hogar es interpretable (gasto mensual → Problemas Económicos); buen caso para medir acuerdo con auditores.",
    },
)

# ---------------------------------------------------------------- 10
call(
    call_id="synth-10",
    title="Renuncia de un seguro irrenunciable en el canal",
    description="El seguro de Incapacidad Temporal no se puede renunciar por este canal (debe derivarse). "
    "El ejecutivo igual ingresa la renuncia.",
    agent_id="EJ-0110",
    date="2026-09-12",
    policies=[policy(INCAPACIDAD, "INC-TMP-0010", retainable=False, cancellable=False)],
    typification=[{"policy_number": "INC-TMP-0010", "outcome": "RENUNCIA", "reason": "Desconoce contratación del seguro"}],
    fixture_assumptions={"cancellable_in_channel_note": "Supuesto sintético: el cliente aún no define qué seguros son irrenunciables por canal."},
    turns=[
        ("A", "Buenas tardes, BancoEstado Corredores de Seguros, le habla Tomás Silva. ¿Con quién hablo?"),
        ("C", "Hola, con Gloria Fernández."),
        ("A", "Señora Gloria, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Diez millones cien mil cien guion cero. Gloria Inés Fernández Soto, treinta de septiembre del sesenta y cinco."),
        ("A", "¿Y su correo y teléfono?"),
        ("C", "gloria punto fernandez arroba correo ejemplo punto cl, nueve uno uno uno dos dos dos tres tres."),
        ("A", "Gracias, quedó validada. ¿En qué la ayudo?"),
        ("C", "Me sale un seguro de incapacidad temporal en el crédito y yo no me acuerdo de haberlo contratado. Lo quiero sacar."),
        ("A", "Entiendo, señora Gloria. Es el seguro de Incapacidad Temporal asociado a su crédito de consumo. Se lo doy de baja."),
        ("C", "Ya, gracias."),
        ("A", "Listo. Quedó ingresada la renuncia de su seguro de Incapacidad Temporal, póliza número INC-TMP-0010, con prima única cargada en su crédito de consumo. ¿Está de acuerdo?"),
        ("C", "Sí, de acuerdo."),
        ("A", "Que tenga buena tarde."),
    ],
    expected={
        "call_verdict": "non_compliant",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "INC-TMP-0010", "outcome": "RENUNCIA", "cancellation_reason": "Desconoce contratación del seguro", "objections": 0}],
        "findings": [
            {"criterion_id": 9, "status": "non_compliant", "note": "Renuncia un seguro marcado como irrenunciable en este canal (metadato cancellable_in_channel=false)."},
            {"criterion_id": 7, "status": "non_compliant", "note": "Debió derivar la solicitud al área correspondiente."},
            {"criterion_id": 4, "status": "non_compliant", "note": "Solo nombra el seguro; no indica ninguna característica."},
        ],
        "notes": "Seguro no retenible: el motivo 14 no aplica.",
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
    policies=[policy(DESEMPLEO, "DES-CONS-0011")],
    typification=[{"policy_number": "DES-CONS-0011", "outcome": "RENUNCIA", "reason": "No desea contraer más obligaciones"}],
    turns=[
        ("A", "Buenas tardes, BancoEstado Corredores de Seguros, le habla Paula Rivas. ¿Con quién hablo?"),
        ("C", "Hola, habla Manuel Torres."),
        ("A", "Don Manuel, ¿me indica su RUT, nombre completo y fecha de nacimiento?"),
        ("C", "Doce millones doscientos doce mil doscientos doce guion k. Manuel Antonio Torres Díaz, primero de abril del setenta y nueve."),
        ("A", "¿Su correo y teléfono?"),
        ("C", "manuel punto torres arroba correo ejemplo punto cl, nueve cero cero cero uno uno uno dos dos."),
        ("A", "Gracias, don Manuel. ¿En qué lo ayudo?"),
        ("C", "Quiero dar de baja el seguro de desempleo, no quiero más compromisos."),
        ("A", "Entiendo. Le cuento que este seguro le cubre hasta cinco cuotas de su crédito si queda sin trabajo por necesidades de la..."),
        ("C", "[inaudible] ...no, si igual... [inaudible] ...el otro..."),
        ("A", "¿Aló? Don Manuel, se está cortando. ¿Me escucha?"),
        ("C", "[inaudible] ...renuncia... [ruido]"),
        ("A", "¿Aló? Don Manuel..."),
    ],
    expected={
        "call_verdict": "uncertain",
        "cancellation_intent": True,
        "outcomes": [{"policy_number": "DES-CONS-0011", "outcome": "SIN_GESTION", "cancellation_reason": "No desea contraer más obligaciones", "objections": 1}],
        "findings": [
            {"criterion_id": 29, "status": "uncertain", "note": "La llamada se corta antes del cierre; no se puede evaluar el protocolo de cierre."},
            {"criterion_id": 13, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 15, "status": "uncertain", "note": "Igual que 29."},
            {"criterion_id": 26, "status": "uncertain", "note": "No se ve si la renuncia se alcanzó a gestionar."},
        ],
        "notes": "Debe ir a revisión humana. La tipificación RENUNCIA no se puede verificar: ningún motivo 18 a 25 describe una gestión inconclusa.",
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
