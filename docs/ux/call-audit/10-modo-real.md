# Cambio 10 — Modo real (`NEXT_PUBLIC_API_MODE=http`)

**Tipo:** revisión rápida contra lo aprobado (fases 0–8 + Cambio 09). No reabre fases.
**Fecha:** 2026-10-19 · **Estado:** aprobado con cambios (diseñador); pendiente de confirmación de Johannes en lo marcado.

## Contexto
El front pasa de mock a backend FastAPI real para Vero, el equipo externo (Auditor + `view_model_io`, D-22) y Qubico (Supervisor). Backend v0: sin SSO, sin invitaciones; cuentas creadas por Qubico por consola. En modo mock nada cambia.

## Veredicto por punto

| # | Delta | Veredicto | Ajuste |
|---|---|---|---|
| 1a | Ocultar botón SSO y separador | Aprobado | Coherente con D-17 (login agnóstico). |
| 1b | Ocultar links "Demo" y ayuda «sup» | Aprobado | Obligatorio: no deben existir atajos de ingreso en modo real (seguridad). |
| 1c | Ocultar "Demo con datos sintéticos" | Aprobado | No reemplazar por nada. |
| 1d | "¿Olvidaste tu contraseña?" a texto | Aprobado con cambio | Texto: **"¿Olvidaste tu contraseña? Escríbele a tu contacto en Qubico para restablecerla."** Texto plano (`help`), no link ni botón deshabilitado. |
| 1e | 401 → mensaje | Aprobado con cambio | Usar el texto ya aprobado en Fase 6: **"El correo o la contraseña no son correctos."** (no "Correo o contraseña incorrectos."). Otros errores: se mantiene "No pudimos ingresar. Revisa tu conexión e intenta de nuevo." 403 (si el backend lo emite): "Tu cuenta no tiene acceso a Call Audit. Pide acceso a Qubico." |
| 1f | Pie legal (Privacidad · Términos · Cookies) | Se mantiene | No se oculta en modo real (L-27). |
| 2 | Ocultar entrada "Demo" del sidebar | Aprobado | — |
| 3a | Estadísticas por ejecutivo / mapa de calor / por auditor con estado vacío | Aprobado con cambio | El estado vacío no debe sugerir "aún no hay revisiones" si la causa es que la función no existe en v0. Texto: **"Estas estadísticas todavía no están disponibles. Las activaremos en una próxima versión."** |
| 3b | Invitar auditor, exportar, feedback, override → error | **No aprobado así** | Fallar después de que la persona escribió (feedback, motivo de override) pierde su trabajo y es un error sin recuperación (auditoría Fase 4). Ocultar en modo real: "Invitar auditor" (reemplazar por ayuda "Por ahora las cuentas las crea Qubico."), "Exportar", "Registrar feedback" y "Cambiar decisión" (override). Si se prefiere mostrarlos: deshabilitados con texto visible "Disponible en una próxima versión", nunca un error al enviar. |

## Riesgo legal que condiciona el despliegue
- **L-28 sigue abierto (Alto):** no exponer llamadas reales a Vero ni al equipo externo sin transcripciones enmascaradas antes del front, DPA y confidencialidad por escrito. Si el backend sirve datos reales este fin de semana, Johannes debe confirmar que esas condiciones se cumplen o usar datos sintéticos/enmascarados.
- **Contraseñas por consola (L-33, nuevo):** la contraseña inicial se entrega por un canal distinto al correo de la cuenta, se exige cambiarla o se rota al cerrar la calibración; cuentas dadas de baja al terminar (L-28). Sin flujo de restablecimiento en la app, Qubico es el único canal: debe verificar identidad antes de restablecer. Requiere abogado: no.

## Adenda — datos sin enmascarar en el front (L-34, decisión de Johannes)
No se reabre la decisión de enmascarado; solo se ajusta el microcopy para que no sea falso.

| # | Elemento | Modo http | Modo mock |
|---|---|---|---|
| 4 | Ayuda junto a "Transcripción" (`components/call/transcript.tsx:68`) | Reemplazar por **"Transcripción automática; puede tener errores."** | Se mantiene "Datos personales enmascarados". |
| 5 | Panel "Prompt y respuesta del modelo" | Sí lleva nota, sobre el aviso de confidencialidad ya aprobado: **"Esto es lo que se envió al modelo. Los datos personales van anonimizados, por eso ves marcas como [NOMBRE_CLIENTE]."** Texto plano (`help`), siempre visible, sin tooltip. | Igual (el mock también muestra marcas). |

- El aviso fijo del panel ("Contenido técnico confidencial de Qubico y datos del cliente. No lo compartas fuera de la app.", L-29) se mantiene.
- Ningún otro texto de la app puede afirmar que los datos están enmascarados en modo http (revisar tooltips, ayuda de exportación y Discrepancias).
- L-03 se actualiza en el registro para remitir a L-34; L-28 y L-32 ya estaban actualizados y no se tocan.
