# Fase 6 · UX Writing · Front de Call Audit

> Estado: **entregada para aprobación** (2026-10-15). Idioma: español de Chile, neutro, sin modismos. Base: glosario aprobado (`03` §4.2), flujos (`04`) y patrones (`05`).
> Los textos entre `{llaves}` son variables. Los textos legales completos los redacta o valida un abogado (L-27); aquí van solo los resúmenes en lenguaje claro.

---

## 1. Voz y tono

### 1.1 Voz (constante)

| Principio | Qué significa | Sí | No |
|---|---|---|---|
| **Clara** | Una idea por frase; verbos concretos; términos del glosario | "Te queda 1 hallazgo dudoso por resolver." | "Existen ítems pendientes de validación en el presente caso." |
| **Directa** | Primero lo que importa; sin relleno | "No se pudo guardar. Tus cambios siguen aquí." | "Lo sentimos mucho, ha ocurrido un inconveniente inesperado…" |
| **Respetuosa** | Tutea (herramienta interna de uso diario), sin infantilizar ni culpar; nunca lenguaje sancionatorio | "Este hallazgo lo propuso la IA. Tú decides." | "Error del usuario", "falta del ejecutivo" |
| **Honesta sobre la IA** | La IA "propone" y "detecta"; las personas "confirman" y "deciden" | "La IA propone: No cumple." | "La IA determinó el incumplimiento." |
| **Sobria** | Sin exclamaciones, emojis ni celebraciones; no gamifica | "Revisaste 58 casos hoy." | "¡Genial! ¡Eres un crack!" |

**Tratamiento:** "tú" en toda la app (el prototipo ya lo usa: "Revisaste…"). **[SUPUESTO: es una herramienta interna del contact center del cliente; si su cultura exige "usted", se cambia de forma global]** (H-44).

### 1.2 Tono según el contexto

| Contexto | Tono | Ejemplo |
|---|---|---|
| Trabajo en serie (cola, detalle) | Mínimo, funcional: etiquetas cortas | "Tomar siguiente" · "Guardar y siguiente" |
| Éxito | Breve, informativo, sin celebrar | "Caso guardado. Abriendo el siguiente." |
| Advertencia | Calmo, con la consecuencia y la salida | "Lo está revisando Ana Pérez. Puedes verlo en solo lectura." |
| Error | Qué pasó + qué hacer; sin culpar; sin códigos técnicos a la vista | "No pudimos cargar el audio. Puedes revisar con la transcripción o escalar el caso." |
| Acción con consecuencia | Explícito sobre lo que pasará | "Vas a aprobar 50 revisiones. Quedarán marcadas como aprobadas en lote con tu nombre." |
| Legal y privacidad | Llano, concreto, sin jerga; enlaza al texto completo | "Guardamos un registro de las búsquedas por ejecutivo." |
| Sobre personas evaluadas (ejecutivos, auditores) | Neutro y descriptivo; se habla de hallazgos, no de culpas | "3 hallazgos confirmados en el motivo 28" (no "3 faltas") |

---

## 2. Guía de microcopy

### 2.1 Botones y acciones

- **Verbo en infinitivo + objeto cuando hace falta:** "Tomar siguiente", "Escalar caso", "Aprobar 50 revisiones", "Invitar auditor", "Desactivar cuenta".
- **El botón principal de un diálogo repite la acción del título.** Nunca "Aceptar" ni "Sí" a secas.
- **Cancelar siempre se llama "Cancelar".** No se usa "No, gracias" ni ninguna fórmula de confirmshaming.
- **Etiqueta y atajo separados**: "Guardar y siguiente" + la pista `↵` como elemento aparte. El atajo no forma parte del nombre accesible.
- **Largo**: hasta 3 palabras en las barras de acciones; se permite más en diálogos ("Aprobar 50 revisiones").

### 2.2 Títulos y encabezados

- Sustantivo y concreto: "Cola de casos", "Mis revisiones", "Revisiones por aprobar".
- El subtítulo explica el criterio o el contexto: "Ordenada por gravedad y antigüedad."
- Sin signos de exclamación ni dos puntos finales.

### 2.3 Mensajes de error (fórmula)

**Qué pasó (sin culpar) + qué puedes hacer + (opcional) qué se conserva.**

| Malo | Bueno |
|---|---|
| "Error 500" | "No pudimos guardar el caso. Tus cambios siguen aquí. Intenta de nuevo." |
| "Campo inválido" | "Escribe un comentario: es obligatorio cuando el motivo es «Otro»." |
| "Acceso denegado" | "Tu cuenta no tiene acceso a Call Audit. Pide acceso a tu supervisor." |

- Junto al campo, en texto y con ícono; nunca solo en rojo.
- Sin datos personales en el mensaje: el ID de la llamada sí, el RUT o el nombre del cliente nunca (L-03).

### 2.4 Estados vacíos (fórmula)

**Qué significa + una acción útil.** Sin humor.

### 2.5 Confirmaciones

- Solo para acciones con consecuencia (`05` §2). Título = la acción como pregunta; cuerpo = la consecuencia; botón = la acción.

### 2.6 Tooltips y texto de ayuda

- Para explicar términos, no para información crítica (la información crítica va visible).
- Máximo una frase. Ejemplo: tooltip de "Muestra cumple": "Llamada que la IA marcó como Cumple, incluida al azar para controlar la calidad de la IA."

### 2.7 Números, fechas y unidades

- Fechas `15 oct 2026` · horas `09:14` · duración `11:03` (mm:ss) o `1 h 05 min`.
- Porcentajes con coma decimal y espacio: `92,4 %`. Miles con punto: `1.240`.
- Minuto de la llamada: `07:42`, siempre con dos dígitos.

### 2.8 Nombres de motivos

- Formato: `Motivo {n} · {nombre en la pauta}`. El nombre del motivo es un término del dominio del cliente: se respeta tal como viene en la rúbrica (CLAUDE.md), sin reescribirlo.

### 2.9 PII en textos

- Enmascarado: `RUT ••••••-K`, `Tarjeta •••• 1234`, `N° de seguro •••• 5678`, `[nombre del cliente]` en la transcripción.
- Nunca en títulos de pestaña, toasts, mensajes de error ni URLs.

---

## 3. Textos clave de los flujos (listos para usar)

### 3.1 Acceso (F-00)

| Elemento | Texto |
|---|---|
| Título | Auditoría de llamadas |
| Subtítulo | La IA propone hallazgos; las personas deciden. |
| Botón SSO | Ingresar con la cuenta de tu empresa |
| Separador | o ingresa con tu correo |
| Campos | Correo · Contraseña |
| Botón | Ingresar |
| Enlace | ¿Olvidaste tu contraseña? |
| Pie | Privacidad · Términos de uso · Cookies |
| Error de credenciales | El correo o la contraseña no son correctos. |
| Cuenta bloqueada | Por seguridad bloqueamos tu cuenta por {n} minutos tras varios intentos. Puedes recuperar tu contraseña. |
| Sin acceso | Tu cuenta no tiene acceso a Call Audit. Pide acceso a tu supervisor. |
| Cuenta desactivada | Tu cuenta está desactivada. Si crees que es un error, contacta a tu supervisor. |
| MFA | Escribe el código de 6 dígitos de tu app de verificación. |
| Invitación · título | Activa tu cuenta |
| Invitación · cuerpo | {nombre_supervisor} te invitó a Call Audit como {rol}. |
| Invitación vencida | Esta invitación venció. Pide una nueva a tu supervisor. |
| Primer ingreso · casilla (sin marcar) | Leí y acepto los Términos de uso. |
| Primer ingreso · texto | Revisa cómo tratamos tus datos en el Aviso de privacidad. |
| Primer ingreso · botón | Continuar |
| Aviso de inactividad | Tu sesión se cerrará en 1 minuto por inactividad. · Botón: Seguir conectado |
| Sesión cerrada | Cerramos tu sesión por inactividad. Guardamos tu avance en el caso abierto. |

### 3.2 Cola de casos (F-01, F-03)

| Elemento | Texto |
|---|---|
| Título | Cola de casos |
| Subtítulo | Ordenada por gravedad y luego por antigüedad. |
| Botón principal | Tomar siguiente |
| Contadores | {n} pendientes · {n} revisados hoy |
| Columnas | Fecha · Llamada · Ejecutivo · Seguros · Decisión del motor · No cumple · Dudosos · Duración · En cola |
| Etiqueta | Muestra cumple |
| Caso bloqueado | En revisión por {nombre} |
| Buscador | Buscar ejecutivo |
| Ayuda del buscador | Las búsquedas por ejecutivo quedan registradas. |
| Chip de filtro | Ejecutivo: {nombre} ✕ |
| Limpiar | Limpiar filtros |
| Sin resultados de filtro | No hay casos con estos filtros. · Limpiar filtros |
| Filtro de ejecutivo agotado | Terminaste los casos pendientes de {nombre}. · Botones: Ver toda la cola · Mantener filtro |
| Caso tomado por otra persona | Otra persona tomó este caso. Te abrimos el siguiente. |
| Fin de jornada · título | No quedan casos pendientes |
| Fin de jornada · cuerpo | Revisaste {n} casos hoy: {c} sin correcciones y {k} con correcciones. Tu tiempo de revisión fue de {t} para {d} de audio. |
| Fin de jornada · acciones | Ver mis revisiones · Cerrar sesión |

### 3.3 Detalle de llamada · auditor (F-01)

| Elemento | Texto |
|---|---|
| Volver | ← Volver a {origen} |
| Banner fijo | Hallazgos generados por IA, pendientes de revisión humana. No constituyen una sanción. |
| Encabezado | Llamada {id} · {fecha} · Ejecutivo {nombre} |
| Decisión del motor | Decisión del motor: {veredicto} · Regla aplicada: {regla} |
| Reproductor | Reproducir · Pausar · Retroceder 5 s · Avanzar 5 s · Velocidad |
| Transcripción · título | Transcripción |
| Transcripción · subtítulo | Datos personales enmascarados |
| Hablantes | Ejecutivo · Cliente · Otro |
| Volver al audio | Ir al minuto actual |
| Marcar turno | Marcar como mal transcrito |
| Checklist · título | Pauta de calidad |
| Bloque con contador | {bloque} · {n} no cumple · {m} dudosos |
| Ítem · propuesta | La IA propone: {Cumple / Incumple / Dudoso} · Confianza {pct} |
| Ítem · evidencia | Ir a la evidencia · {mm:ss} |
| Ítem · comentario plegado | Ver comentario de la IA |
| Cita no validada | Esta cita no aparece tal cual en la transcripción. Verifícala en el audio. |
| Crítico | Crítico |
| Acciones del ítem | Confirmar · Cumple · Incumple (sin "No aplica", D-20) |
| Motivo de corrección | Motivo de la corrección |
| Opciones (propuesta de HU-AUD-03, #21) | Evidencia mal interpretada · Error de transcripción · Criterio ambiguo en la pauta · Evidencia fuera del fragmento · La situación no se dio en la llamada · La IA no detectó el incumplimiento · Otro |
| Comentario | Comentario (obligatorio si eliges «Otro») |
| Agregar hallazgo | Agregar hallazgo que la IA no detectó |
| Agregar · ayuda | Se registra en el minuto actual del audio ({mm:ss}). Puedes cambiarlo. |
| Aceptado sin cambios (tooltip en los «cumple») | Si no lo cambias, queda como aceptado sin cambios al guardar. |
| Progreso | Te queda {n} hallazgo dudoso por resolver. / Te quedan {n} hallazgos dudosos por resolver. / Todo listo para guardar. |
| Veredicto resultante | Veredicto resultante: {veredicto} |
| Barra de acciones | Escalar · Guardar y siguiente |
| Guardado | Caso enviado a aprobación. Abriendo el siguiente. |
| Error al guardar | No pudimos guardar el caso. Tus cambios siguen aquí. · Reintentar |
| Audio no disponible | No pudimos cargar el audio. Puedes revisar con la transcripción o escalar el caso con el motivo «Audio inaudible». |
| Audio eliminado | El audio de esta llamada ya no está disponible por la política de retención. |
| Solo lectura (bloqueo) | Lo está revisando {nombre}. Lo ves en solo lectura. |

### 3.4 Ficha del seguro (O-03)

| Elemento | Texto |
|---|---|
| Título | Ficha del seguro |
| Pestañas | Seguro {n}: {nombre_sistema} |
| Datos de la llamada | N° de seguro •••• {4} · Póliza •••• {4} · Inicio de vigencia {fecha} · Medio de pago {texto} |
| Campos clave | Compañía · Categoría · Tipo de prima · Devolución de prima al renunciar · Retracto |
| Regla de la categoría | Textos de `docs/layer2-product-sheet.md` (ej. RETENIBLE: «Si el cliente pide renunciar, el ejecutivo debe intentar retenerlo.») |
| Secciones plegables | Coberturas · Asistencias y beneficios · Primas · Siniestros · Observaciones |
| Destacado contextual | Relevante para el motivo {n} |
| Sin dato | Sin dato en el catálogo. |
| Sin ficha | Este seguro no tiene ficha en el catálogo. Se muestran solo sus datos básicos. |

### 3.5 Escalar (F-02)

| Elemento | Texto |
|---|---|
| Título del diálogo | Escalar al supervisor |
| Cuerpo | El caso sale de tu cola y llega a la bandeja del supervisor. Verás su respuesta en Mis revisiones. |
| Anclaje | Sobre: Motivo {n} · {mm:ss} |
| Motivo | Duda de criterio · Posible incumplimiento crítico · Audio inaudible · Otro |
| Comentario | ¿Qué necesitas que revise el supervisor? |
| Botones | Cancelar · Escalar caso |
| Confirmación | Caso escalado. Abriendo el siguiente. |

### 3.6 Mis revisiones (F-04)

| Elemento | Texto |
|---|---|
| Título | Mis revisiones |
| Subtítulo | Los casos reabiertos aparecen primero. Puedes editar una revisión mientras el supervisor no la apruebe. |
| Estados | Esperando aprobación · Reabierto · Escalado · Cambiado por el supervisor · Cerrado |
| Reabierto | {supervisor} reabrió este caso: «{comentario}» |
| Comparación | Tu decisión · Decisión del supervisor |
| Vacío | Aún no tienes revisiones. Empieza desde la Cola. |

### 3.7 Supervisor · Alertas (F-05)

| Elemento | Texto |
|---|---|
| Título | Alertas |
| Subtítulo | Casos escalados por auditores e incumplimientos críticos confirmados. |
| Tipos | Escalamiento · Crítico confirmado |
| Estados | Nueva · Vista · Gestionada |
| Acciones | Aprobar y cerrar · Reabrir · Cambiar decisión · Marcar como gestionada |
| Reabrir · diálogo | Reabrir caso · Devolver a: {auditor} · Comentario para el auditor · Botones: Cancelar · Reabrir caso |
| Cambiar · motivo | Motivo del cambio (obligatorio). La decisión del auditor se conserva. |
| Gestionar | Comentario de gestión (opcional) |
| Vacío | No hay alertas nuevas. |

### 3.8 Supervisor · Revisiones y aprobación en lote (F-06)

| Elemento | Texto |
|---|---|
| Título | Revisiones por aprobar |
| Subtítulo | Aprueba, reabre o cambia las revisiones antes de que cuenten en los indicadores. |
| Pestañas | Sin señales ({n}) · Con señales ({m}) |
| Ayuda «Sin señales» | Coinciden con la IA, no tienen correcciones ni escalamientos, y su tiempo de revisión es normal. |
| Señales (etiquetas) | Corrigió a la IA · Contradijo en un crítico · Revisión rápida (menos de 60 s) · Escalado |
| Selección | {n} seleccionadas · máximo 50 por lote |
| Botón | Aprobar seleccionadas |
| Diálogo · título | ¿Aprobar {n} revisiones? |
| Diálogo · resumen | {n} casos de {k} auditores · del {fecha} al {fecha} · {a} No cumple · {b} Cumple |
| Diálogo · aviso | Quedarán marcadas como aprobadas en lote con tu nombre. |
| Diálogo · botones | Cancelar · Aprobar {n} revisiones |
| Cambió un caso | {n} casos cambiaron mientras armabas el lote y los quitamos. |
| Toast | {n} revisiones aprobadas. · Deshacer |
| Vista de diferencias | IA → Auditor · Motivo de la corrección |
| Vacío | Estás al día. No hay revisiones por aprobar. |

### 3.9 Supervisor · Ejecutivos y feedback (F-07)

| Elemento | Texto |
|---|---|
| Título | Ejecutivos |
| Subtítulo | Solo cuentan los hallazgos confirmados por un auditor. |
| Ayuda del buscador | Las búsquedas por ejecutivo quedan registradas. |
| Sección aparte | Según IA · aún sin revisión humana (no cuentan en los indicadores) |
| Seguimiento | Pendiente · Con feedback · Gestionada |
| Panel · título | Registrar feedback a {nombre} |
| Aviso | Es un registro tuyo de la conversación; no propone ni registra sanciones. No incluyas datos de clientes ni de salud. |
| Campos | Feedback entregado · Compromiso · Fecha de seguimiento (opcional) · Llamadas o motivos asociados |
| Error | Agrega al menos una llamada o un motivo. |
| Botón | Guardar feedback |
| Confirmación | Feedback guardado. Las llamadas asociadas quedaron «Con feedback». |
| Vacío del historial | Todavía no hay feedback registrado. |

### 3.10 Supervisor · Cuentas de auditores (F-08)

| Elemento | Texto |
|---|---|
| Pestaña | Cuentas |
| Botón | Invitar auditor |
| Campos | Nombre · Correo corporativo · Forma de ingreso: Cuenta de la empresa (SSO) / Correo y contraseña |
| Ayuda | Solo puedes crear cuentas de auditor. Las de supervisor las crea Qubico. |
| Error | Ya existe una cuenta con este correo. |
| Confirmación | Enviamos la invitación a {correo}. |
| Estados | Invitado · Activo · Desactivado |
| Desactivar · título | ¿Desactivar la cuenta de {nombre}? |
| Desactivar · cuerpo | No podrá ingresar. Sus revisiones se conservan y sus casos en revisión vuelven a la cola. |
| Desactivar · botones | Cancelar · Desactivar cuenta |
| Reactivar | Reactivar cuenta |

### 3.11 Exportar (F-09)

| Elemento | Texto |
|---|---|
| Título | Exportar lo filtrado |
| Contexto | {n} llamadas · {filtros} |
| Formato | CSV · Excel |
| Casilla (sin marcar) | Incluir datos personales |
| Ayuda | Requiere permiso. Debes indicar el motivo y quedará en el registro de accesos. |
| Botón | Exportar {n} llamadas |
| Asíncrono | Estamos preparando el archivo. Te avisaremos cuando esté listo. |

### 3.12 Atajos y preferencias

| Elemento | Texto |
|---|---|
| Diálogo | Atajos de teclado |
| Lista | Espacio Reproducir o pausar · ← → Retroceder o avanzar 5 s · J K Hallazgo anterior o siguiente · C Confirmar · X Corregir · E Escalar · Enter Guardar y siguiente · ? Esta ayuda · Ctrl+K Comandos |
| Nota | Los atajos no funcionan mientras escribes en un campo. |
| Preferencia | Usar atajos de una sola tecla (puedes desactivarlos si usas lector de pantalla o control por voz) |
| Bienvenida | Bienvenida a Call Audit. Tres atajos para empezar: J/K para moverte entre hallazgos, C para confirmar y Enter para guardar y pasar al siguiente. «?» muestra todos. · Entendido |

> «Bienvenida» o «Bienvenido» se elige según el usuario registrado; si no hay dato, se usa «Te damos la bienvenida a Call Audit» (H-44).

### 3.13 Supervisor · Seguros (Cambio 11)

Textos completos en `11-catalogo-seguros.md` §7.2 (fuente de verdad). Los principales:

| Elemento | Texto |
|---|---|
| Nav · ayuda del título | Seguros · Fichas que usa la IA para validar las llamadas. |
| Botón | Subir Excel |
| Diálogo · avisos | Excel .xlsx de hasta 10 MB. · Sube solo condiciones de seguros. No incluyas datos de clientes ni de ejecutivos. · La IA lee el archivo y propone las fichas. Nada se guarda en el catálogo hasta que lo revises. |
| Progreso | Leyendo el Excel · Extrayendo los seguros con IA · Buscando seguros que ya existen · Listo para revisar |
| Origen / sin dato | Hoja {hoja} · fila {fila} · No viene en el Excel |
| Ya existe | Ya existe «{nombre}» de {aseguradora} (v{n}). · Comparar |
| Posible duplicado | Posible duplicado: comparte {la póliza {n°} / el nombre en sistema «{x}»} con «{nombre}» de {aseguradora}. Si son seguros distintos, puedes guardarlo; revisa los nombres en sistema para que la IA los distinga. · Ver ese seguro |
| Clave existente | Ya existe un seguro llamado «{nombre}» en {aseguradora}. · Ver ese seguro |
| Acciones | Actualizar el existente · Es otro seguro · Descartar · Guardar como nuevo · Guardar {n} seguros nuevos |
| Éxito | Guardamos la versión {n} de «{nombre}». Las llamadas ya validadas mantienen la versión con que se validaron. |
| Archivar | ¿Archivar «{nombre}»? La IA deja de usarlo en validaciones nuevas. Las llamadas ya validadas lo siguen mostrando. Puedes reactivarlo cuando quieras. · Archivar · Cancelar |
| Detalle de llamada | Ficha v{n} · Hay una versión más nueva de esta ficha (v{m}). Esta llamada se validó con la v{n}. |

> En la UI no se usa "pauta" para el Excel de seguros: "pauta" son los 33 motivos (glosario `03` §4.2).

---

## 4. Textos legales en lenguaje claro (resúmenes)

> No reemplazan el texto legal completo, que debe validar un abogado (L-27). Cada resumen enlaza a su texto completo.

### 4.1 Aviso de privacidad para usuarios (auditores y supervisores) · L-24

> **Cómo tratamos tus datos en Call Audit**
> - **Qué datos:** tu nombre, correo, rol y tu actividad en la app (qué casos revisas, tus decisiones, tiempos de revisión y un registro de accesos que incluye las búsquedas por ejecutivo).
> - **Para qué:** darte acceso, dejar trazabilidad de cada decisión y permitir que tu supervisor apruebe y controle la calidad de las revisiones.
> - **Quién los ve:** tu supervisor y el equipo de Qubico que opera la plataforma.
> - **Cuánto tiempo:** `TBD` (lo define {empresa cliente}).
> - **Tus derechos:** puedes pedir acceso, rectificación o eliminación de tus datos a `TBD`.
>
> Leer el aviso completo.

### 4.2 Términos de uso · L-27

> **Al usar Call Audit te comprometes a:**
> - usar las llamadas y sus datos solo para auditar la calidad;
> - no copiar, descargar ni compartir audios, transcripciones o datos de clientes fuera de los canales autorizados;
> - mantener tu cuenta personal e intransferible.
>
> Los hallazgos de la IA son propuestas: las decisiones las toman las personas.
>
> Leer los términos completos.

### 4.3 Cookies · H-35

> Call Audit usa solo cookies necesarias para mantener tu sesión iniciada. No usamos cookies de publicidad ni de analítica.

### 4.4 Banner de IA · L-07, L-15

> Hallazgos generados por IA, pendientes de revisión humana. No constituyen una sanción.

### 4.5 Ver datos personales sin enmascarar · L-04

> **Ver datos personales**
> Vas a ver los datos personales del cliente en esta llamada. Hazlo solo si es necesario para la auditoría. Quedará en el registro de accesos.
> Motivo (obligatorio): ____
> Botones: Cancelar · Ver datos personales

### 4.6 Aviso de búsquedas por ejecutivo · L-18

> Las búsquedas por ejecutivo quedan registradas.

### 4.7 Aviso en el feedback · L-06, L-21

> Es un registro tuyo de la conversación; no propone ni registra sanciones. No incluyas datos de clientes ni de salud.

---

## 5. Glosario

El glosario aprobado en `03-arquitectura-informacion.md` §4.2 es la fuente única. Esta fase agrega:

| Término en la UI | Uso | Código |
|---|---|---|
| **Pauta de calidad** | Título del checklist en el detalle | `rubric` |
| **La IA propone** | Prefijo de toda propuesta de veredicto de la IA | — |
| **Esperando aprobación** | Estado de la revisión enviada (H-34) | `awaiting_approval` |
| **Revisión rápida** | Señal: revisión de menos de 60 s (H-37) | `review_flags.fast` |
| **Mal transcrito** | Marca de un turno con error de ASR | `turn_flags.transcription_error` |
| **Registro de accesos** | Log de acceso (búsquedas, PII, exportaciones) | `access_log` |
| **Cuenta de la empresa** | Ingreso por SSO, sin nombrar al proveedor (#25) | `auth_method = sso` |

**Palabras prohibidas en la UI:** sanción, falta, infracción, castigo, amonestación, puntaje, nota, agente (para referirse al ejecutivo), alucinación, error del usuario.

---

## 6. Supuestos de esta fase

| ID | Supuesto |
|---|---|
| H-44 | Tratamiento de "tú" en toda la app; fórmulas sin género ("Te damos la bienvenida") cuando no se sabe el género |
| H-45 | Los motivos de corrección y de escalamiento usados son la propuesta de HU-AUD-03/05, hasta que el cliente cierre la #21 |

---

## 7. Ajuste 2026-10-16 · Resultado por motivo (D-20)

- **Por motivo:** **Cumple / Incumple / Dudoso.** No existe "No aplica": si la situación del motivo no se dio en la llamada, el motivo **Cumple**.
- **Por llamada:** se mantiene **Cumple / No cumple / Dudosa** (decisión del motor y veredicto final).
- **Cómo se evita la lectura invertida (HE-01)** con motivos redactados en negativo ("Niega devolución de primas"):
  1. El veredicto va **antes** del nombre del motivo y separado de él: `[Incumple] Motivo 28 · Niega devolución de primas`.
  2. Bajo el nombre, una **línea de apoyo** que dice en positivo qué pasó:
     - Incumple → "Se detectó en la llamada · 07:50";
     - Cumple → "No se detectó en la llamada";
     - Dudoso → "No está claro si ocurrió · revisa la evidencia".
  3. El encabezado de la sección dice **"Pauta de calidad · motivos de no calidad"** y el tooltip explica: "Cada motivo describe algo que no debe ocurrir. Incumple = ocurrió."
  4. El nombre del motivo se mantiene **tal como está en la pauta** (no se reescribe; CLAUDE.md).
- **Por qué no se unifica "No cumple" (llamada) con "Incumple" (motivo):** son dos niveles distintos. Usar la misma palabra haría pensar que un motivo que incumple es lo mismo que una llamada que no cumple, y la decisión de la llamada la toma el motor con reglas propias. **[SUPUESTO del diseñador: mantener la diferencia]**
