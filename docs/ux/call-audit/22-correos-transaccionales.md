# Cambio 22 · Correos transaccionales (restablecer contraseña e invitación)

- Fecha: 2026-11-23 · Estado: **aprobado e implementado** (D-103 a D-107; rama `feature/email-template`)
- Tipo: revisión rápida sobre una pieza existente (Cambio 12 §3.1 y §3.2, Cambio 21 §8). No cambia flujos, AI ni CUJ: el enlace sigue llevando a `/invite/[token]` (modo restablecer o activar).
- Origen: Johannes, «el correo para restablecer contraseña le falta un buen diseño». Captura de Gmail: logo chico, una línea, botón, línea gris y firma; sin contenedor, sin título, sin enlace alternativo.
- Vista previa: `22-correos-preview.html` (mismo directorio), generada con el HTML real de `email.py` y datos ficticios.
- Decisiones desde **D-103** al aprobar. Supuestos desde **H-157**. Registro Legal omitido por instrucción de Johannes (nada bloqueante).

## 1. Diagnóstico del correo actual

| # | Problema | Efecto |
|---|---|---|
| 1 | Sin título: la primera línea es «Recibimos una solicitud…» | En la vista previa del inbox y al abrir no se entiende de un vistazo qué hay que hacer |
| 2 | Sin contenedor ni fondo: el texto flota a ancho completo en Gmail | Se ve como spam o como correo roto; poca confianza para un correo que pide hacer clic |
| 3 | Sin enlace alternativo (la invitación sí lo tiene) | Si el botón no carga (Outlook, imágenes bloqueadas, proxy corporativo) no hay salida: callejón sin salida |
| 4 | No dice para qué cuenta es | El usuario no sabe si es su cuenta ni si es legítimo |
| 5 | «72 horas» sin fecha | Obliga a calcular; la invitación ya da la fecha |
| 6 | El «si no lo pediste» no dice qué pasa con la contraseña actual | Genera duda («¿me la cambiaron?») |
| 7 | Botón `<a>` con padding: en Outlook de escritorio el área clicable es solo el texto | Objetivo chico (WCAG 2.5.8) |
| 8 | Sin preheader | Gmail muestra como resumen el texto del alt del logo + la primera línea |
| 9 | Invitación: la frase «Te invitaron a Call Audit» se repite dos veces en el cuerpo | Error de copy |

## 2. Estructura propuesta (plantilla común)

```
fondo #F4F6F9 (ancho 100 %, padding 32 px 16 px)
└─ tarjeta 560 px, blanca, borde 1 px #E5E9EF, radio 8 px, franja superior 4 px #3A6491
   ├─ Encabezado: logo Qubyt 32 px de alto (padding 32/40/0)
   ├─ Título h1 (22/28, negrita, tinta #1F2A37)
   ├─ Saludo + párrafo de contexto (15/24, tinta)
   ├─ Botón principal (bulletproof: <td> con fondo + VML para Outlook), 48 px de alto
   ├─ Caja de datos (#F4F6F9, radio 6, 14/20): vencimiento con fecha y «sirve una sola vez»
   ├─ Enlace alternativo (13/20, slate, URL en #3A6491 subrayada, word-break)
   ├─ Separador 1 px #E5E9EF
   └─ Nota de seguridad / «si no lo pediste» (13/20, slate)
└─ Pie fuera de la tarjeta (12/18, slate, centrado):
   «Call Audit · Qubico» / «Este correo es automático; las respuestas no se leen.»
```

Preheader oculto (primeros ~90 caracteres que muestra el inbox), distinto por correo.

## 3. Correo de restablecer contraseña

- **Asunto:** Restablece tu contraseña de Call Audit (sin cambio)
- **Remitente:** Call Audit · Qubico <donotreply@audit.qubicoenergy.com> (sin cambio)
- **Preheader:** Crea una contraseña nueva. El enlace vence en 72 horas y sirve una sola vez.

| Bloque | Texto |
|---|---|
| Título | **Restablece tu contraseña** |
| Saludo | Hola, {nombre}: |
| Contexto | Recibimos una solicitud para restablecer la contraseña de tu cuenta de Call Audit (**{correo}**). Para crear una nueva, usa este botón: |
| Botón | **Crear contraseña nueva** |
| Caja | El enlace vence el **{dd-mm-aaaa} a las {hh:mm}** (72 horas) y sirve una sola vez. |
| Alternativo | ¿El botón no funciona? Copia este enlace en tu navegador: {url} |
| Seguridad | **¿No lo pediste?** Ignora este correo: tu contraseña actual sigue funcionando y nadie puede cambiarla sin este enlace. |

Por qué «Recibimos una solicitud» y no «Pediste…»: el correo sale por dos caminos (el usuario en «¿Olvidaste tu contraseña?» y el admin con «Restablecer contraseña», Cambio 12 §2), y la frase sirve para ambos sin acusar a nadie.

Texto plano:

```
Restablece tu contraseña

Hola, {nombre}:

Recibimos una solicitud para restablecer la contraseña de tu cuenta de Call Audit ({correo}).

Crea una contraseña nueva en este enlace:
{url}

El enlace vence el {fecha} (72 horas) y sirve una sola vez.

¿No lo pediste? Ignora este correo: tu contraseña actual sigue funcionando y nadie puede cambiarla sin este enlace.

—
Call Audit · Qubico
Este correo es automático; las respuestas no se leen.
```

## 4. Correo de invitación (misma plantilla)

Recomiendo aplicarla también aquí: es el primer contacto del usuario con el producto y hoy tiene el mismo problema, más la frase repetida.

- **Asunto:** Te invitaron a Call Audit (sin cambio)
- **Preheader:** {invitador} te invitó a Call Audit. Crea tu contraseña para activar tu cuenta.

| Bloque | Texto |
|---|---|
| Título | **Te invitaron a Call Audit** |
| Saludo | Hola, {nombre}: |
| Contexto | {invitador} te invitó a Call Audit, la herramienta de auditoría de llamadas de {empresa}. Crea tu contraseña para activar tu cuenta. |
| Caja de datos (tabla 2 columnas) | **Empresa** {empresa} · **Rol** {rol} · **Tu usuario** {correo} · **Vence** {fecha} (72 horas) |
| Botón | **Crear contraseña** |
| Alternativo | ¿El botón no funciona? Copia este enlace en tu navegador: {url} |
| Seguridad | ¿No esperabas esta invitación? Ignora este correo: tu cuenta no se activará. |

Nota de copy: «empresa» (Cambio 17), nunca «cliente» para la corredora. El rol usa las etiquetas de `ROLE_LABEL`.

## 5. Estilos

| Elemento | Valor | Contraste |
|---|---|---|
| Fuente | `Arial, Helvetica, sans-serif` (sin fuente web) | — |
| Fondo exterior | #F4F6F9 | — |
| Tarjeta | #FFFFFF, borde #E5E9EF, radio 8 (Outlook lo ignora: queda recto, aceptable) | — |
| Franja superior | 4 px #3A6491 | decorativa |
| Título | 22/28, bold, #1F2A37 | 14,54 |
| Cuerpo | 15/24, #1F2A37 | 14,54 |
| Secundario | 13/20, #5B6B7B | 5,48 blanco · 5,06 sobre #F4F6F9 |
| Botón | fondo #3A6491, texto #FFFFFF 16 bold, 48 px alto, padding 0 28, radio 6 | 6,16 |
| Enlaces | #3A6491 subrayado | 6,16 |
| Caja de datos | fondo #F4F6F9, radio 6, padding 16; etiqueta slate, valor tinta bold | ≥ 5,06 |
| Ancho | 560 px de tarjeta; en móvil `width:100%` + padding lateral 24 px (media query; Gmail app la respeta; si no, la tabla fluida ya no desborda) | — |

**Accesibilidad:** `lang="es"`, tablas con `role="presentation"`, título como `<h1>` real, alt «Qubyt» en el logo, botón ≥ 44 px de alto y toda la celda clicable, la información nunca solo en color, el texto plano tiene el mismo contenido.

**Modo oscuro de los clientes:** `<meta name="color-scheme" content="light only">` y `supported-color-schemes` (Apple Mail y Outlook nuevo respetan el modo claro). Gmail app y Outlook.com igual pueden invertir colores: por eso el botón tiene texto blanco sobre azul medio (sobrevive a la inversión parcial) y nada depende de un fondo exacto. El punto débil es el logo: el PNG actual es transparente con el texto «Qubyt» en marino; sobre fondo invertido oscuro el texto se pierde (ver Q3).

**Compatibilidad:** solo tablas y estilos inline (más un `<style>` mínimo en `<head>` para la media query móvil y el modo oscuro, que los clientes que lo ignoran no necesitan). Sin imágenes de fondo, sin SVG, sin webm, sin fuentes web. Peso < 20 KB (Gmail recorta sobre 102 KB).

## 6. Revisión rápida contra lo aprobado

| Ítem | Resultado |
|---|---|
| Trazabilidad | Cambio 12 §3.1/§3.2 (copy base), H-69, H-66 (72 h, un uso), Cambio 21 §8 (logo y colores Qubyt) |
| Patrones | Correo transaccional estándar: una acción principal, enlace alternativo, aviso de seguridad |
| WCAG 2.2 AA | Contrastes en §5; objetivo del botón 48 px; orden de lectura lineal |
| Microcopy y glosario | Verbos de acción en botones; «empresa» (Cambio 17); Qubyt solo como marca del logo; firma Qubico |
| Dark patterns | Ninguno |
| Hallazgo técnico | `accounts.expires_text` usa la zona horaria del servidor (`astimezone()` sin zona): en EC2 suele ser UTC y la fecha del correo saldría 3 h corrida para Chile (ver Q4) |

## 7. Supuestos

- H-157 · `password_reset` puede recibir el nombre y la fecha de vencimiento (ya están en `accounts.send_reset`: `user.name` y el segundo valor de `issue_link`). Cambio de firma de función, sin cambio de API.
- H-158 · Mostrar el correo de la cuenta en el cuerpo no agrega riesgo: va al mismo buzón.
- H-159 · La franja azul y el logo sobre blanco se leen como «Call Audit»; no hace falta un encabezado marino (pesa más y pide otro PNG del logo en blanco).

## 8. Preguntas (resueltas 2026-11-23: Q1 sí · Q2 sí · Q3 A · Q4 sí · Q5 sin casilla)

- **Q1** · ¿Aplicamos la misma plantilla al correo de invitación? Recomiendo **sí**.
- **Q2** · ¿Mostramos fecha y hora exactas de vencimiento en el restablecimiento (como la invitación) además de «72 horas»? Recomiendo **sí**.
- **Q3** · Logo para modo oscuro: (A) PNG nuevo `qubyt-logo-email.png` con fondo blanco sólido y bordes redondeados, que se ve bien aunque el cliente invierta colores; (B) dejar el PNG transparente actual. Recomiendo **A** (lo genero desde el logo actual, 2× para retina).
- **Q4** · ¿Fijamos la hora del correo en hora de Chile (`America/Santiago`) en vez de la del servidor? Recomiendo **sí**.
- **Q5** · Pie: ¿basta con «Este correo es automático; las respuestas no se leen.» o agregamos un correo de contacto de Qubico para soporte? Recomiendo **agregar contacto** si existe una casilla monitoreada (¿cuál?); si no, dejar solo el aviso.

## 9. Decisiones e implementación

- D-103 · Plantilla común para los dos correos. D-104 · Fecha y hora exactas en restablecer. D-105 · Logo `qubyt-logo-email.png`. D-106 · Hora de Chile. D-107 · Pie sin casilla de soporte.
- `src/call_audit/notify/email.py`: helpers `_layout`, `_button` (VML para Outlook), `_box`, `_fallback`, `_note`, `_plain`; `password_reset` recibe `name` y `expires`.
- `src/call_audit/accounts.py`: `expires_text` en `America/Santiago` (`tzdata` ya es dependencia); `send_reset` pasa nombre y vencimiento.
- Logo: `frontend/public/brand/qubyt-logo-email.png`, 178×88 px, generado desde `qubyt-logo.png` (154×64) con 12 px de fondo blanco y radio 12 px (a 2×); se muestra a 89×44. El padding del encabezado (26/34 px) compensa los 6 px de fondo para alinear el logo con el texto.
- Tests: `tests/test_email.py`.
