"""Plantilla de los correos transaccionales (Cambio 22). Datos sintéticos; no se envía nada."""

from datetime import UTC, datetime

from call_audit.accounts import expires_text
from call_audit.config import Settings
from call_audit.notify import email as mail

SETTINGS = Settings(app_base_url="https://audit.example.cl/")
URL = "https://audit.example.cl/invite/tok-123?a=1&b=2"


def reset() -> mail.Email:
    return mail.password_reset(
        to="ana@ejemplo.cl", name="Ana <Pérez>", url=URL, expires="26-11-2026 a las 14:30", settings=SETTINGS
    )


def invite() -> mail.Email:
    return mail.invitation(
        to="ana@ejemplo.cl",
        name="Ana",
        inviter="Martín",
        role="auditor",
        url=URL,
        expires="26-11-2026 a las 14:30",
        settings=SETTINGS,
    )


def test_password_reset_has_title_button_fallback_and_expiry() -> None:
    email = reset()
    assert email.subject == "Restablece tu contraseña de Call Audit"
    html = email.html
    assert html.startswith("<!doctype html>") and 'lang="es"' in html
    assert "<h1" in html and "Restablece tu contraseña</h1>" in html
    assert "Crear contraseña nueva" in html
    assert "¿El botón no funciona?" in html
    assert "26-11-2026 a las 14:30" in html
    assert "ana@ejemplo.cl" in html
    assert "https://audit.example.cl/brand/qubyt-logo-email.png" in html
    assert "Este correo es automático; las respuestas no se leen." in html


def test_password_reset_escapes_user_values() -> None:
    html = reset().html
    assert "Ana &lt;Pérez&gt;" in html and "<Pérez>" not in html
    assert 'href="https://audit.example.cl/invite/tok-123?a=1&amp;b=2"' in html


def test_password_reset_plain_text_mirrors_html() -> None:
    text = reset().text
    assert text.startswith("Restablece tu contraseña\n\nHola, Ana <Pérez>:")
    assert URL in text and "26-11-2026 a las 14:30" in text
    assert "¿No lo pediste?" in text
    assert text.endswith("Call Audit · Qubico\nEste correo es automático; las respuestas no se leen.\n")


def test_invitation_uses_same_template_with_details() -> None:
    email = invite()
    assert email.subject == "Te invitaron a Qubyt"
    assert "Empresa" not in email.html and "Empresa" not in email.text
    for value in ("Te invitaron a Qubyt</h1>", "Auditor", "ana@ejemplo.cl", "Crear contraseña"):
        assert value in email.html
    # La frase ya no se repite en el cuerpo (error del copy anterior).
    assert email.text.count("Te invitaron a Qubyt") == 1
    assert "Rol: Auditor" in email.text and "Vence: 26-11-2026 a las 14:30 (72 horas)" in email.text


def test_expires_text_is_chile_time() -> None:
    # Noviembre: Chile continental en horario de verano (UTC-3).
    assert expires_text(datetime(2026, 11, 26, 17, 30, tzinfo=UTC)) == "26-11-2026 a las 14:30"
    # Julio: horario de invierno (UTC-4). Un datetime sin zona se toma como UTC.
    assert expires_text(datetime(2026, 7, 10, 12, 0)) == "10-07-2026 a las 08:00"
