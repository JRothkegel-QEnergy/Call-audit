"""Envío de correos de Call Audit (invitaciones y restablecimiento de contraseña, Cambio 12 D-36; diseño Cambio 22).

El backend se elige con EMAIL_BACKEND:
    console  no envía: deja en el log que hubo un correo, sin el enlace (desarrollo y tests). Por defecto.
    smtp     SMTP con STARTTLS (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD).
    ses      Amazon SES en AWS_REGION, con el rol del EC2 o las credenciales del entorno.
El remitente es EMAIL_FROM. Los enlaces se arman con APP_BASE_URL.
"""

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from html import escape

from call_audit.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class Email:
    to: str
    subject: str
    text: str
    html: str


# Lo "enviado" con EMAIL_BACKEND=console: lo leen los tests y el desarrollo local.
OUTBOX: list[Email] = []


def send(email: Email, settings: Settings) -> None:
    backend = settings.email_backend
    if backend == "console":
        OUTBOX.append(email)
        # Sin el enlace ni el destinatario completo: el log no debe tener datos personales ni tokens.
        logger.info("Correo «%s» registrado (EMAIL_BACKEND=console, no se envió)", email.subject)
        return
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = email.to
    message["Subject"] = email.subject
    message.set_content(email.text)
    message.add_alternative(email.html, subtype="html")
    if backend == "smtp":
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return
    if backend == "ses":
        import boto3

        boto3.client("ses", region_name=settings.aws_region).send_raw_email(
            Source=settings.email_from, Destinations=[email.to], RawMessage={"Data": message.as_bytes()}
        )
        return
    raise ValueError(f"EMAIL_BACKEND desconocido: {backend}")


ROLE_LABEL = {
    "auditor": "Auditor",
    "supervisor": "Supervisor",
    "qubico_admin": "Administrador Qubico",
    "qubico_viewer": "Lectura Qubico",
    "qubico_verifier": "Verificador",
}

# Plantilla común (Cambio 22, docs/ux/call-audit/22-correos-transaccionales.md): tablas y estilos inline para Gmail
# y Outlook, Arial sin fuentes web, tarjeta de 560 px, colores Qubyt (D-98) y modo claro pedido al cliente.
FONT = "Arial,Helvetica,sans-serif"
INK = "#1F2A37"
MUTED = "#5B6B7B"
PRIMARY = "#3A6491"
SURFACE = "#F4F6F9"
BORDER = "#E5E9EF"
FOOTER = "Este correo es automático; las respuestas no se leen."

# Media query móvil y modo claro: los clientes que ignoran <style> igual ven la versión de escritorio.
_HEAD_STYLE = (
    ":root{color-scheme:light only;supported-color-schemes:light only}"
    "@media (max-width:600px){.ca-card{width:100%!important}"
    ".ca-px{padding-left:24px!important;padding-right:24px!important}}"
)


def _row(content: str, padding: str, style: str = "") -> str:
    return f'<tr><td class="ca-px" style="padding:{padding};font-family:{FONT};{style}">{content}</td></tr>'


def _layout(*, title: str, preheader: str, body: str, settings: Settings) -> str:
    """Documento completo: preheader oculto, fondo, tarjeta con logo y título, cuerpo y pie."""
    logo = f"{settings.app_base_url.rstrip('/')}/brand/qubyt-logo-email.png"
    # El PNG trae 6 px de fondo blanco redondeado alrededor del logo (para el modo oscuro); el padding lo compensa.
    header = _row(
        f'<img src="{escape(logo)}" width="89" height="44" alt="Qubyt" '
        'style="display:block;border:0;width:89px;height:44px">',
        "26px 40px 0 34px",
    )
    heading = _row(
        f'<h1 style="margin:0;font-family:{FONT};font-size:22px;line-height:28px;font-weight:bold;color:{INK}">'
        f"{escape(title)}</h1>",
        "22px 40px 0",
    )
    card = (
        '<table role="presentation" class="ca-card" width="560" cellpadding="0" cellspacing="0" border="0" '
        f'style="width:560px;max-width:560px;background:#FFFFFF;border:1px solid {BORDER};'
        f'border-top:4px solid {PRIMARY};border-radius:8px">{header}{heading}{body}</table>'
    )
    footer = (
        '<table role="presentation" class="ca-card" width="560" cellpadding="0" cellspacing="0" border="0" '
        'style="width:560px;max-width:560px"><tr><td align="center" '
        f'style="padding:20px 16px 0;font-family:{FONT};font-size:12px;line-height:18px;color:{MUTED}">'
        f"Call Audit · Qubico<br>{FOOTER}</td></tr></table>"
    )
    return (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">'
        f"<title>{escape(title)}</title><style>{_HEAD_STYLE}</style></head>"
        f'<body style="margin:0;padding:0;background:{SURFACE}">'
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">{escape(preheader)}</div>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background:{SURFACE}"><tr><td align="center" style="padding:32px 16px">{card}{footer}</td></tr>'
        "</table></body></html>"
    )


def _paragraphs(*items: str) -> str:
    """Párrafos del cuerpo (ya escapados por quien llama)."""
    last = len(items) - 1
    return "".join(
        f'<p style="margin:0 0 {0 if i == last else 12}px;font-size:15px;line-height:24px;color:{INK}">{item}</p>'
        for i, item in enumerate(items)
    )


def _button(url: str, label: str) -> str:
    """Botón a prueba de Outlook: celda con fondo (toda clicable) y VML para Outlook de escritorio."""
    href, text = escape(url), escape(label)
    width = 56 + 10 * len(label)
    vml = (
        '<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" '
        f'href="{href}" style="height:48px;v-text-anchor:middle;width:{width}px" arcsize="12%" stroke="f" '
        f'fillcolor="{PRIMARY}"><center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:16px;'
        f'font-weight:bold">{text}</center></v:roundrect><![endif]-->'
    )
    link = (
        f'<!--[if !mso]><!--><a href="{href}" style="display:inline-block;padding:0 28px;line-height:48px;'
        f"font-family:{FONT};font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;"
        f'border-radius:6px">{text}</a><!--<![endif]-->'
    )
    return _row(
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td align="center" bgcolor="{PRIMARY}" style="border-radius:6px;background:{PRIMARY}">{vml}{link}</td>'
        "</tr></table>",
        "24px 40px 0",
    )


def _box(content: str | list[tuple[str, str]]) -> str:
    """Caja gris con un texto o con filas etiqueta / valor (ya escapados por quien llama)."""
    if isinstance(content, str):
        inner = f'<tr><td style="padding:14px 16px;color:{INK}">{content}</td></tr>'
    else:
        last = len(content) - 1
        cells = []
        for i, (label, value) in enumerate(content):
            top, bottom = (14 if i == 0 else 4), (14 if i == last else 4)
            cells.append(
                f'<tr><td style="padding:{top}px 16px {bottom}px;color:{MUTED};width:96px;vertical-align:top">'
                f"{label}</td>"
                f'<td style="padding:{top}px 16px {bottom}px 0;color:{INK};font-weight:bold">{value}</td></tr>'
            )
        inner = "".join(cells)
    return _row(
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background:{SURFACE};border-radius:6px;font-family:{FONT};font-size:14px;line-height:20px">'
        f"{inner}</table>",
        "20px 40px 0",
    )


def _fallback(url: str, lead: str = "") -> str:
    """Enlace alternativo por si el botón no carga."""
    return _row(
        f"{lead}¿El botón no funciona? Copia este enlace en tu navegador:<br>"
        f'<a href="{escape(url)}" style="color:{PRIMARY};text-decoration:underline;word-break:break-all">'
        f"{escape(url)}</a>",
        "20px 40px 0",
        f"font-size:13px;line-height:20px;color:{MUTED}",
    )


def _note(question: str, answer: str) -> str:
    """Separador y aviso de seguridad al pie de la tarjeta."""
    divider = _row(f'<div style="border-top:1px solid {BORDER};font-size:0;line-height:0">&nbsp;</div>', "24px 40px 0")
    note = _row(
        f'<b style="color:{INK}">{escape(question)}</b> {escape(answer)}',
        "16px 40px 32px",
        f"font-size:13px;line-height:20px;color:{MUTED}",
    )
    return divider + note


def _plain(*blocks: str) -> str:
    return "\n\n".join(blocks) + f"\n\n—\nCall Audit · Qubico\n{FOOTER}\n"


def invitation(
    *, to: str, name: str, inviter: str, client: str, role: str, url: str, expires: str, settings: Settings
) -> Email:
    """Correo de invitación (Cambio 12 §3.1, rediseñado en el Cambio 22). `expires` ya viene en hora de Chile."""
    role_label = ROLE_LABEL.get(role, role)
    title = "Te invitaron a Qubyt"
    note_q, note_a = "¿No esperabas esta invitación?", "Ignora este correo: tu cuenta no se activará."
    intro = f"{inviter} te invitó a Qubyt, la herramienta de auditoría de llamadas de {client}."
    text = _plain(
        title,
        f"Hola, {name}:",
        f"{intro} Crea tu contraseña para activar tu cuenta:\n{url}",
        f"Empresa: {client}\nRol: {role_label}\nTu usuario: {to}\nVence: {expires} (72 horas)",
        "El enlace sirve una sola vez.",
        f"{note_q} {note_a}",
    )
    body = (
        _row(
            _paragraphs(
                f"Hola, {escape(name)}:",
                f"{escape(inviter)} te invitó a Qubyt, la herramienta de auditoría de llamadas de "
                f"{escape(client)}. Crea tu contraseña para activar tu cuenta.",
            ),
            "16px 40px 0",
        )
        + _box(
            [
                ("Empresa", escape(client)),
                ("Rol", escape(role_label)),
                ("Tu usuario", escape(to)),
                ("Vence", f'{escape(expires)} <span style="font-weight:normal;color:{MUTED}">(72 horas)</span>'),
            ]
        )
        + _button(url, "Crear contraseña")
        + _fallback(url, "El enlace sirve una sola vez. ")
        + _note(note_q, note_a)
    )
    preheader = f"{inviter} te invitó a Qubyt. Crea tu contraseña para activar tu cuenta."
    html = _layout(title=title, preheader=preheader, body=body, settings=settings)
    return Email(to=to, subject=title, text=text, html=html)


def password_reset(*, to: str, name: str, url: str, expires: str, settings: Settings) -> Email:
    """Correo de restablecimiento (Cambio 12 §3.2, rediseñado en el Cambio 22). `expires` ya viene en hora de Chile.

    Lo dispara el usuario desde el login o un admin: por eso dice «Recibimos una solicitud», sin decir quién.
    """
    title = "Restablece tu contraseña"
    note_q = "¿No lo pediste?"
    note_a = "Ignora este correo: tu contraseña actual sigue funcionando y nadie puede cambiarla sin este enlace."
    expiry = "(72 horas) y sirve una sola vez."
    text = _plain(
        title,
        f"Hola, {name}:",
        f"Recibimos una solicitud para restablecer la contraseña de tu cuenta de Call Audit ({to}).",
        f"Crea una contraseña nueva en este enlace:\n{url}",
        f"El enlace vence el {expires} {expiry}",
        f"{note_q} {note_a}",
    )
    body = (
        _row(
            _paragraphs(
                f"Hola, {escape(name)}:",
                "Recibimos una solicitud para restablecer la contraseña de tu cuenta de Call Audit "
                f"(<b>{escape(to)}</b>). Para crear una nueva, usa este botón:",
            ),
            "16px 40px 0",
        )
        + _button(url, "Crear contraseña nueva")
        + _box(f"El enlace vence el <b>{escape(expires)}</b> {expiry}")
        + _fallback(url)
        + _note(note_q, note_a)
    )
    preheader = "Crea una contraseña nueva. El enlace vence en 72 horas y sirve una sola vez."
    html = _layout(title=title, preheader=preheader, body=body, settings=settings)
    return Email(to=to, subject="Restablece tu contraseña de Call Audit", text=text, html=html)
