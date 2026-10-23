"""Envío de correos de Call Audit (invitaciones y restablecimiento de contraseña, Cambio 12 D-36).

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


ROLE_LABEL = {"auditor": "Auditor", "supervisor": "Supervisor", "qubico_admin": "Administrador Qubico"}


def _layout(body_html: str, settings: Settings) -> str:
    logo = f"{settings.app_base_url.rstrip('/')}/brand/qubico-logo.png"
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;'
        'color:#1b1f24;max-width:560px">'
        f'<img src="{logo}" alt="Qubico" height="32" style="height:32px;margin:0 0 24px">'
        f"{body_html}"
        '<p style="color:#545b66;font-size:12px;margin-top:32px">— Qubico</p></div>'
    )


def _button(url: str, label: str) -> str:
    return (
        f'<p><a href="{escape(url)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;'
        f'padding:10px 16px;border-radius:6px;font-weight:600">{escape(label)}</a></p>'
    )


def invitation(
    *, to: str, name: str, inviter: str, client: str, role: str, url: str, expires: str, settings: Settings
) -> Email:
    """Correo de invitación (textos de 12-cambio-admin-qubico.md)."""
    role_label = ROLE_LABEL.get(role, role)
    text = (
        f"Hola, {name}:\n\n"
        f"{inviter} te invitó a Call Audit, la herramienta de auditoría de llamadas de {client}, "
        f"con el rol {role_label}.\n"
        "Te invitaron a Call Audit. Crea tu contraseña para activar tu cuenta:\n\n"
        f"{url}\n\n"
        f"El enlace vence el {expires} (72 horas) y sirve una sola vez.\n"
        "Si no esperabas esta invitación, ignora este correo: tu cuenta no se activará.\n\n— Qubico\n"
    )
    html = _layout(
        f"<p>Hola, {escape(name)}:</p>"
        f"<p>{escape(inviter)} te invitó a <b>Call Audit</b>, la herramienta de auditoría de llamadas de "
        f"{escape(client)}, con el rol <b>{escape(role_label)}</b>.</p>"
        "<p>Te invitaron a Call Audit. Crea tu contraseña para activar tu cuenta.</p>"
        f"{_button(url, 'Crear contraseña')}"
        f"<p style='color:#545b66'>El enlace vence el {escape(expires)} (72 horas) y sirve una sola vez. "
        f"Si el botón no funciona, copia este enlace en tu navegador: {escape(url)}</p>"
        "<p style='color:#545b66'>Si no esperabas esta invitación, ignora este correo: tu cuenta no se activará.</p>",
        settings,
    )
    return Email(to=to, subject="Te invitaron a Call Audit", text=text, html=html)


def password_reset(*, to: str, url: str, settings: Settings) -> Email:
    text = (
        "Recibimos una solicitud para restablecer tu contraseña de Call Audit.\n\n"
        f"Crea una contraseña nueva: {url}\n\n"
        "El enlace vence en 72 horas y sirve una sola vez. Si no lo pediste, ignora este correo.\n\n— Qubico\n"
    )
    html = _layout(
        "<p>Recibimos una solicitud para restablecer tu contraseña.</p>"
        f"{_button(url, 'Crear contraseña nueva')}"
        "<p style='color:#545b66'>El enlace vence en 72 horas y sirve una sola vez. Si no lo pediste, ignora este "
        "correo.</p>",
        settings,
    )
    return Email(to=to, subject="Restablece tu contraseña de Call Audit", text=text, html=html)
