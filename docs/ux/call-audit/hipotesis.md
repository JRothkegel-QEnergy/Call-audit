# Hipótesis y supuestos a validar

> Todo lo que no viene de datos entregados por el usuario o la corredora. Se valida con entrevistas, tests o confirmación de la corredora. Última actualización: 2026-10-13.

| ID | Supuesto | Origen | Cómo validarlo | Estado |
|---|---|---|---|---|
| H-01 | Los auditores trabajan en escritorio (≥ 1366 × 768), Chrome/Edge corporativo, con audífonos. | Fase 0 | Preguntar a la corredora / entrevista | **Parcial (2026-10-14)**: Chrome/Edge con audífonos confirmado (D-06). La resolución mínima sigue abierta |
| H-02 | El auditor prefiere teclado sobre mouse para revisar en serie; los atajos (HU-AUD-04) aumentan los casos por hora. | HU-AUD-04 | Test de usabilidad con y sin atajos | Abierto |
| H-03 | Hoy los auditores registran sus auditorías en una planilla o sistema de la corredora (formato desconocido). | Fase 0 | Pedir un ejemplo de la herramienta actual | **Confirmada en parte (D-11)**: usan una herramienta interna de la corredora, escuchan el audio completo y anotan observaciones minuto a minuto solo cuando algo no cumple. Falta ver la herramienta y su formato de registro |
| H-04 | Revisar un caso con evidencia y timestamps toma menos del 50 % de la duración de la llamada. | KPI propuesto | Medir en test con llamadas sintéticas | Abierto |
| H-05 | Los ejecutivos no usan la app; solo reciben feedback del supervisor por fuera. | Fase 0 | Confirmar con la corredora | Abierto |
| H-06 | Los auditores y supervisores son personal de la corredora o de su contact center, no de Qubico. | Fase 0 | Confirmar con Jean Paul / cliente | **Confirmada para los auditores (D-11)**. Los supervisores se asumen de la corredora **[SUPUESTO]** |
| H-07 | Ver el nombre del ejecutivo en la cola puede sesgar la revisión del auditor; podría bastar con un ID o mostrarlo solo en el detalle. | Fase 0 (minimización, L-03/L-06) | — | **Descartada por decisión del usuario (D-07, 2026-10-14)**: el nombre se ve y se filtra. El riesgo queda en L-18 |
| H-08 | Admin de calidad y Operación Qubico pueden quedar fuera del MVP del front (rúbrica como YAML en el repo; operación en CloudWatch/Langfuse). | Fase 0 | Decisión del usuario (pregunta 1) | **Confirmada (D-01)** para admin y operación; el supervisor primero quedó fuera (D-01) y luego entró al MVP (D-08) |
| H-09 | La meta de SUS ≥ 75, éxito en tareas ≥ 90 % y ≥ 90 % de correcciones con motivo distinto de "Otro" son razonables para el piloto. | KPI propuesto | Acordar con el equipo | Abierto |
| H-10 | Dashboard y alertas del supervisor deben leerse en notebook pequeño o tablet; cola y detalle solo en escritorio. | Fase 0 | Entrevista a supervisores | Abierto |
| H-11 | No hay usuarios en la UE ni en otros mercados (GDPR no aplica). | Fase 0 | Confirmar | Abierto |
| H-12 | Las llamadas de retención duran más de lo que asume `context.md` (~4 min): en la muestra de 100 transcripciones del benchmark de ASR, la mediana es de ~10 min (rango 4–29 min), con ~83 turnos por llamada (hasta 314). El auditor no puede escuchar la llamada completa: depende de saltar a la evidencia. | Fase 1 (forma de los datos, sin contenido) | Confirmar con la duración media real del lote de la corredora; la muestra del benchmark puede estar sesgada | Abierto |
| H-13 | Además de EJECUTIVO y CLIENTE aparece un tercer hablante (OTRO: tercero, IVR o transferencia). La transcripción debe soportar más de 2 hablantes aunque el audio sea estéreo. | Fase 1 (forma de los datos) | Revisar con `asr-specialist` | Abierto |
| H-14 | Con 66 productos en el catálogo (47 retenibles), el auditor no recuerda las condiciones de cada seguro; consultar la ficha durante la revisión es parte del trabajo, no una excepción. | Fase 1, D-02 | Entrevista / observación | Abierto |
| H-15 | Una llamada trae 1 o más seguros; el auditor necesita ver primero los datos de la llamada (N° de seguro, póliza, vigencia, medio de pago, categoría) y luego, a pedido, coberturas, primas y devolución. | Fase 1 | Test de usabilidad | Abierto |
| H-16 | El auditor tiende a confirmar lo que propone la IA (sesgo de automatización), sobre todo con cansancio; la interfaz debe obligar a mirar la evidencia en los ítems `uncertain` y en los críticos. | Fase 1 (literatura de human-in-the-loop) | Medir % de acuerdo vs golden set en el piloto | Abierto |
| H-17 | Los auditores buscan por ejecutivo para revisar patrones de una persona (ej. un ejecutivo nuevo o con reclamos). | D-07 | Entrevista | Abierto |
| H-18 | Las altas de usuarios las hace Qubico a pedido de la corredora durante el piloto (no hay pantalla de administración de usuarios en el MVP). | D-05 | Decisión del usuario | **Descartada (D-12)**: el supervisor crea auditores desde la app; Qubico crea supervisores |
| H-19 | El supervisor revisa escalamientos y revisiones de auditores varias veces al día, en bloques cortos entre otras tareas (reuniones, feedback, gestión del equipo); usa escritorio y a veces un notebook pequeño. | D-08 | Entrevista a supervisores | Abierto |
| H-20 | Un supervisor tiene a cargo entre 5 y 15 auditores y decenas de ejecutivos. | D-08 | Confirmar con la corredora | Sin dato (D-16): la corredora no sabe la cantidad. El diseño debe escalar a equipos grandes |
| H-21 | Si todas las revisiones requieren aprobación del supervisor (#22), la bandeja de revisiones se vuelve un cuello de botella; una muestra más los casos críticos y escalados es más viable. | D-08, HU-SUP-07 | Calcular con el volumen real y confirmar con la corredora | **Pasa a riesgo (D-15)**: el supervisor aprueba todas las revisiones. Se mitiga con diseño (aprobación eficiente, atajos, lotes con control) y con el muestreo configurable `Post` |
| H-22 | Hoy el supervisor da feedback a los ejecutivos en reuniones uno a uno con planillas o notas propias, sin registro centralizado. | D-08, HU-SUP-04 | Entrevista | Abierto |
| H-23 | El supervisor quiere llegar a la evidencia en el mismo punto que la vio el auditor (minuto y hallazgo), sin reescuchar la llamada. | D-08 | Test de usabilidad | Abierto |
| H-24 | Como hoy el auditor solo anota cuando algo no cumple, el cambio a "confirmar o corregir cada hallazgo de la IA" puede sentirse como más trabajo, sobre todo en los ítems que cumplen. El diseño debe pedir acción explícita solo en lo `non_compliant` y `uncertain`, y dejar el resto revisable sin obligar. | D-11 | Test de usabilidad; comparar el tiempo contra la herramienta actual | Abierto |
| H-25 | Los auditores están acostumbrados a anotar con referencia de minuto; la marca de tiempo de cada hallazgo (y agregar un hallazgo "en el minuto actual") les resultará natural. | D-11 | Test de usabilidad | Abierto |
| H-26 | El supervisor da de alta auditores con poca frecuencia (al incorporar personas o al rotar equipos); basta un formulario simple (nombre, correo, método de acceso) y desactivar en vez de borrar. | D-12 | Entrevista a supervisores | Abierto |
| H-27 | Qubico crea a los supervisores con un script o consola, sin pantalla interna en el MVP. | Default sin respuesta | Confirmar antes de la Fase 4 | Supuesto por defecto |
| H-28 | El logo se puede adaptar desde el PNG (vectorizado y versión para fondo oscuro) sin perder la marca. | D-14, default sin respuesta | Revisión en la Fase 8 | **Cerrada (D-38, 2026-10-23)**: se usa el logo oficial PNG (negro y blanco) |
| H-29 | Si tampoco hay acceso a usuarios reales para el test de la Fase 7, un test con usuarios proxy (personas con experiencia en QA de contact center o en auditoría) más una evaluación heurística detecta la mayoría de los problemas graves del CUJ-1 y del CUJ-5. | D-16 | Se decide en la Fase 7 | Abierto |
| H-30 | Un tope de 50 revisiones por aprobación en lote, con un resumen previo, mantiene la aprobación como un acto consciente sin frenar al supervisor. | Fase 2 (O-08) | Test de usabilidad; revisar la tasa de reaperturas posteriores | **Aprobada como diseño (D-19, 2026-10-15)**; validar en el test |
| H-31 | Abrir el caso en el primer hallazgo `non_compliant`/`uncertain`, con el audio 3–5 s antes de la cita, reduce el tiempo por caso frente a abrir al inicio de la llamada. | Fase 2 (O-01) | Test de usabilidad (Fase 7) | Abierto |
| H-32 | Destacar en la ficha del seguro la sección relevante para el motivo en foco requiere un mapeo motivo → sección de la ficha (ej. 28 → devolución, 17 → categoría, 2/6 → coberturas); el mapeo es configuración, no código. | Fase 2 (O-03) | Validar con `rubric-engineer` | Abierto |
| H-33 | En el MVP el supervisor ve la cola completa en solo lectura; reasignar o liberar casos bloqueados es `Post` (HU-SUP-10). | Fase 3 | Confirmar en la Fase 4 (flujo de casos bloqueados) | Abierto |
| H-34 | Con D-15 hace falta un estado de caso `awaiting_approval`; `confirmed`/`corrected` pasan a ser el tipo de revisión. | Fase 3 | Validar con `pipeline-architect` | Abierto · **pendiente de validar con `pipeline-architect`; no bloquea el diseño** (usado en la Fase 4) |
| H-35 | La app usa solo cookies técnicas de sesión; no requiere banner de consentimiento de cookies. | Fase 3 | Confirmar al implementar (sin analítica de terceros) | Abierto |
| H-36 | 30 min de inactividad para cerrar sesión y liberar casos `in_review` (HU-AUD-01 lo deja `TBD`). | Fase 4 (F-00, F-01) | Confirmar con la corredora o con las políticas de seguridad de la corredora (L-10) | **Aceptado como valor por defecto (Fase 4 aprobada, 2026-10-15)**; ajustable |
| H-37 | Umbral de "revisión sospechosamente rápida" = 60 s mientras la corredora no lo defina (HU-SUP-06 `TBD`). | Fase 4 (F-06) | Ajustar con los tiempos reales del piloto | **Aceptado como valor por defecto (Fase 4 aprobada, 2026-10-15)**; ajustable |
| H-38 | "Deshacer" de la aprobación en lote disponible por 10 s; después solo se reabre caso a caso. | Fase 4 (F-06) | Test de usabilidad | **Aceptado como valor por defecto (Fase 4 aprobada, 2026-10-15)**; ajustable |
| H-39 | La auditora puede editar su revisión hasta que el supervisor la apruebe (reemplaza la ventana `TBD` de HU-AUD-06). | Fase 4 (F-04) | Confirmar con el usuario si molesta en el test | **Aceptado como valor por defecto (Fase 4 aprobada, 2026-10-15)**; ajustable |
| H-40 | Sidebar de 232 px expandida y 64 px colapsada; en el detalle de llamada se colapsa sola. | Fase 5 | Test de usabilidad | Abierto |
| H-41 | Columnas del detalle ~40 % transcripción / ~35 % checklist / ~25 % ficha, redimensionables y con alternativa sin arrastrar. | Fase 5 | Test de usabilidad a 1366 y 1920 px | Abierto |
| H-42 | Librería: shadcn/ui + Radix UI + Tailwind, TanStack Table/Virtual, wavesurfer.js, cmdk y Lucide; versiones verificadas al implementar. | Fase 5 | Decisión técnica de Johannes | **Aprobada (Fase 5, 2026-10-15)** |
| H-43 | Onboarding mínimo: tarjeta de bienvenida descartable con 3 atajos, sin tour guiado. | Fase 5 | Test de usabilidad | Abierto |
| H-44 | Tratamiento de "tú" en toda la app (como el prototipo); fórmulas sin género cuando no se conoce el género. | Fase 6 | Confirmar con la cultura del contact center de la corredora | **Aprobada (Fase 6, 2026-10-15)** |
| H-45 | Los textos de motivos de corrección y de escalamiento usan la propuesta de HU-AUD-03/05 hasta que la corredora cierre la #21. | Fase 6 | Pregunta abierta #21 | Abierto |
| H-46 | Los motivos de la pauta, redactados en negativo, combinados con el veredicto "Cumple / No cumple" por ítem se leen al revés; "Incumplimiento detectado / Sin incumplimiento" se entiende mejor. | Fase 7 (HE-01) | Tarea T10 del test | Abierto |
| H-47 | Con proxies (QA o calidad de contact center) se detectan la mayoría de los problemas de interacción de los CUJ; los de dominio se validan después con la corredora. | Fase 7 (D-16) | Comparar con el feedback de la corredora en el piloto | Abierto |
| H-48 | El contrato de capas y el prompt de la capa 2 tienen `not_applicable` / "no_aplica". Con D-20 la UI lo muestra como Cumple. Falta decidir si el motor y el contrato lo mantienen (útil para métricas) o lo colapsan a `compliant`. | Fase 8 (D-20) | **Pendiente técnico para `pipeline-architect` y `rubric-engineer`; no bloquea** | Abierto |
| H-49 | La línea de apoyo bajo cada motivo ("Se detectó en la llamada" / "No se detectó") y el veredicto antes del nombre resuelven la lectura invertida de HE-01 sin reescribir los motivos. | Fase 8 | Test de usabilidad (T10) cuando se ejecute | Abierto |
| H-50 | Mantener "No cumple" para la llamada e "Incumple" para el motivo ayuda a distinguir los dos niveles. | Fase 8 | Test de usabilidad | Abierto |
| H-51 | Solo modo claro en el MVP (herramienta de oficina en escritorio); el modo oscuro queda para después. | Fase 8 | Preguntar si hay un pedido de los usuarios | Abierto |
| H-52 | El panel "Prompt y respuesta del modelo" reemplaza "Capas y motor" aunque el backend vuelva a tener varias capas (cada una sería una corrida más). | Cambio 09 | ADR del prompt único (`pipeline-architect`) | Abierto |
| H-53 | La clasificación "La IA acertó / se equivocó" se hace por llamada, con los motivos involucrados en multiselección. | Cambio 09 | Uso real con Vero en la calibración | Abierto |
| H-54 | "Por presentar / Presentado" basta para la revisión uno a uno con la contraparte; el resultado va en notas. | Cambio 09 | Primera sesión con la corredora | Abierto |
| H-55 | El auditor de la app revisa a ciegas respecto del veredicto de la corredora (lo ve después de guardar), para no anclarse y no invalidar la medición. | Cambio 09 | — | **Reemplazada por D-24**: el auditor no lo ve nunca |
| H-56 | Un aviso heurístico de RUT en las notas (sin bloquear) reduce la PII en texto libre. | Cambio 09 | Revisar las notas del piloto | Abierto |
| H-57 | Para la calibración basta con el rol Supervisor (cuentas de Qubico) y `view_model_io` para auditores; el rol "Calidad de la IA" no hace falta en el MVP. | Cambio 09 (D-23) | Si alguien necesita clasificar discrepancias sin ver dashboards de ejecutivos, se agrega el rol | Abierto |
| H-58 | El backend no envía el veredicto ni el comentario de la corredora en las respuestas al rol auditor (no basta con ocultarlos en el front). | Cambio 09 (D-24) | Validar con `pipeline-architect` al definir la API | Abierto |
| H-59 | La corredora cambia o agrega seguros con una frecuencia que justifica que el supervisor mantenga el catálogo en la app (hoy se hace por script). | Cambio 11 | Preguntar a la corredora cada cuánto cambian las condiciones | Abierto |
| H-60 | El Excel de seguros no trae datos personales de clientes ni de ejecutivos (solo condiciones comerciales y teléfonos de empresas). | Cambio 11 (L-35) | Revisar el Excel original y los próximos que entregue la corredora | Abierto |
| H-61 | "Seguros" se entiende mejor que "Pautas" o "Catálogo" para la sección; "pauta" ya significa la pauta de 33 motivos. | Cambio 11 | Uso real con supervisores | **Aceptado como default (D-31, 2026-10-22)**; validar en uso |
| H-62 | El auditor no necesita la sección Seguros; le basta la ficha en el detalle de llamada con su versión. | Cambio 11 | Preguntar a Vero / auditores en la calibración | **Aceptado como default (D-31, 2026-10-22)**; validar en uso |
| H-63 | Un borrador de carga sin actividad por 30 días puede cerrarse como "Vencida" sin tocar el catálogo. | Cambio 11 | Revisar el uso real de las cargas | **Aceptado como default (D-31, 2026-10-22)**; validar en uso |
| H-64 | Guardar en lote los seguros "Nuevo sin advertencias", con resumen y marca, mantiene la confirmación humana sin obligar a abrir decenas de seguros (patrón D-19). | Cambio 11 | Medir el % de seguros guardados en lote que luego se editan | **Aceptado como default (D-31, 2026-10-22)**; validar en uso |
| H-65 | Antes de enviar el Excel al LLM se anonimizan RUT, correos y tarjetas, pero no los teléfonos de asistencia (datos legítimos de la ficha). | Cambio 11 (L-35) | Validar con `privacy-reviewer` | Abierto |
| H-66 | El enlace de invitación vence en 72 h; reenviar genera uno nuevo e invalida el anterior. | Cambio 12 (D-37) | Uso real | Abierto |
| H-67 | El admin tiene la sección Seguros y gestiona `manage_catalog` y `view_model_io` por cuenta. | Cambio 12 (D-40) | Uso real | Abierto |
| H-68 | Sesión de 15 min de inactividad para el admin, aunque no haya MFA. | Cambio 12 | Uso real | Abierto |
| H-69 | Restablecer contraseña por correo con enlace de un solo uso, cuando el backend lo soporte. | Cambio 12 | Backend | Abierto |
| H-70 | Una versión "Solo system prompt" no tiene historial ni origen por regla; se avisa y se recomienda el prompt.yaml. | Cambio 12 (D-34) | Uso real | Abierto |
| H-71 | Contraseña de mínimo 12 caracteres, sin reglas de composición. | Cambio 12 | — | Abierto |
| H-72 | Un solo campo de contraseña con "Mostrar", sin "repetir contraseña". | Cambio 12 | — | Abierto |
| H-73 | Remitente "Call Audit · Qubico" desde una dirección no-responder del dominio de Qubico. | Cambio 12 | Configuración del correo | Abierto |
| H-74 | RENUNCIABLE/RETENIBLE de la metadata traen SI/NO o equivalentes. | Cambio 13 | Valores del Excel | Abierto |
| H-75 | Los campos por seguro de la metadata vienen en la fila de cada póliza. | Cambio 13 | Excel de metadata | Abierto |
| H-76 | La columna MATENRO puede venir como MATERNO en otros lotes; se aceptan ambas. | Cambio 13 | Lotes nuevos | Abierto |
| H-77 | Correspondencia categoría del catálogo ↔ renunciable/retenible (13 §1.2). | Cambio 13 | Cliente / rubric-engineer | Abierto |
| H-78 | El mapeo M31/M33 → sección `customer` llega por rúbrica v1.0.2 o por mapeo de presentación. | Cambio 13 | rubric-engineer / pipeline-architect | Abierto |
| H-79 | "Cron" = el bucle del worker (`pipeline --loop 900`); no hay otro proceso programado que mostrar. | Cambio 14 | Confirmar con Johannes | Abierto |
| H-80 | Se considera "Sin señal" si el último latido tiene más de 3 min. | Cambio 14 | Uso real | Abierto |
| H-81 | El latido lo escribe un hilo cada ~30 s, también durante una transcripción larga. | Cambio 14 | pipeline-architect | Abierto |
| H-82 | El historial muestra las últimas 20 pasadas. | Cambio 14 | Uso real | Abierto |
| H-83 | La vista consulta cada 5 s con pasada en curso y cada 30 s en espera, y se pausa con la pestaña oculta. | Cambio 14 | Uso real | Abierto |
| H-84 | Solo `qubico_admin` ve el estado del worker (403 para otros roles). | Cambio 14 | Johannes | Abierto |
| H-85 | Una pasada que quedó `running` al reiniciarse el worker se cierra como fallida. | Cambio 14 | pipeline-architect | Abierto |
| H-86 | Las fallas de ASR muestran el nombre del archivo tal como viene del SFTP. | Cambio 14 | Johannes | Abierto |
| H-87 | Una llamada Dudosa de la IA cuenta como rechazo en el calce (como el dashboard local), sin interruptor. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-88 | Vocabulario del calce: Solo la IA detectó = falso positivo, Omitidos por la IA = falso negativo, "motivo"; se elimina "más de TBD puntos". | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-89 | Cada porcentaje con su conteo k de n; se avisa si una corrida tiene llamadas sin resultado. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-90 | Solo `qubico_admin` ve el calce por corrida; sin nombres de ejecutivos en agregados. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-91 | Escritorio ≥ 1280 px; tablas de 6 corridas con scroll horizontal en pantallas angostas. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-92 | Sin librería de gráficos nueva: barras y tablas con los tokens existentes. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-93 | Selección por defecto: corrida vigente + la más reciente de cada otro modelo, hasta 6. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-94 | La marca de la corredora por motivo se toma como verdad; la vista declara que puede tener omisiones. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-95 | Consenso k de N, Jev y "Mi revisión" quedan en el dashboard local. | Cambio 15 | Johannes | Sin objeción (2026-11-02) |
| H-96 | El estado de la vista de calidad (corridas, filtros, mapa) va en la URL, no en localStorage. | Cambio 15 §7 | Johannes | Sin objeción (2026-11-02) |
| H-97 | La referencia "auditores de la app" sale de Calidad de la IA y queda solo en la prueba del prompt. | Cambio 15 §7 | Johannes | Sin objeción (2026-11-02) |
| H-98 | El color identifica al modelo; dos corridas del mismo modelo se distinguen por nombre y relleno rayado. | Cambio 15 §7 | Johannes | Sin objeción (2026-11-02) |
| H-99 | El front calcula las métricas de calce desde los datos por llamada (volumen chico). | Cambio 15 §7 | Johannes | Sin objeción (2026-11-02) |
| H-100 | Etiquetas y orden de color de los modelos salen de `models.toml` vía backend. | Cambio 15 §7 | Johannes | Sin objeción (2026-11-02) |
| H-101 | Meta de detección = 80 % (equivale a FN ≤ 20 %). | Cambio 15 §7 | Johannes | Sin objeción (2026-11-02) |
| H-102 | En el mapa, mantener la página al cambiar de corrida (mismas 100 llamadas) sirve más que volver a la página 1. | Cambio 15 §7.10 | Johannes | Pendiente (2026-11-03) |
| H-103 | Agrupar también rachas idénticas de errores (no solo las sin trabajo) reduce el ruido sin esconder un error nuevo, porque cualquier cambio de números o mensaje abre fila aparte. | Cambio 14 §7 | Johannes | Pendiente (2026-11-04) |
| H-104 | 20 filas (grupos) sobre las últimas 200 pasadas (~50 h) bastan para el historial; reemplaza a H-82. | Cambio 14 §7 | Uso real | Pendiente (2026-11-04) |
| H-105 | Una pasada con audios pero sin nada procesado se lee mejor como "Sin trabajo" que como "Completa". | Cambio 14 §7 | Johannes | Pendiente (2026-11-04) |
| H-106 | Solo `qubico_admin` ve la vista de análisis de discrepancias; escritorio ≥ 1280 px. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-107 | El resumen por evaluador de la corredora muestra el nombre de `EVALUADOR_CALIDAD`; excepción acotada a "sin indicadores por persona" (ejecutivos siguen sin aparecer). | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-108 | Patrones ordenados por impacto de la síntesis; los de menos de 3 casos van al final como observaciones. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-109 | Causas: Criterio del prompt · Evaluador del cliente · Transcripción · Dato faltante. Motivo 1 entra como Criterio con propuesta de pregunta al cliente. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-110 | Excel vs revisión manual en contra: "Desacuerdo entre revisores", va a calibración, no al prompt. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-111 | El análisis se marca desactualizado si cambió la corrida vigente o entraron revisiones nuevas. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-112 | Se ve la última corrida de análisis; anteriores en solo lectura; las decisiones sobre propuestas persisten. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-113 | La vista declara cuántos casos tienen revisión manual Qubico (hoy casi ninguno por motivo). | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-114 | Confianza del patrón como Alta / Media / Baja, no como número. | Cambio 16 §5 | Johannes | Sin objeción (2026-11-04) |
| H-115 | Tres pestañas (Análisis · Seguimiento · Historial) bastan; Seguimiento muestra el contador de pendientes. | Cambio 16 §7 | Johannes | Sin objeción (2026-11-04) |
| H-116 | La matriz de veredicto de llamada no se repite: basta la línea "Calce de llamada" con enlace a Calidad de la IA. | Cambio 16 §7 | Johannes | Sin objeción (2026-11-04) |
| H-117 | Motivos de descarte en lista cerrada + "Otro", para que la IA de análisis los lea de forma consistente. | Cambio 16 §7 | Johannes | Sin objeción (2026-11-04) |
| H-118 | Las decisiones viven aparte del patrón y se ven en análisis posteriores; un análisis nuevo no reabre lo descartado salvo evidencia distinta. | Cambio 16 §7 | Johannes | Sin objeción (2026-11-04) |
| H-119 | Aceptar, descartar y cambiar seguimiento quedan en el Registro de actividad; aceptar no pide motivo. | Cambio 16 §7 | Johannes | Sin objeción (2026-11-04) |
| H-120 | Escritorio ≥ 1280 px; la tabla por motivo hace scroll horizontal dentro de su tarjeta en pantallas angostas. | Cambio 16 §7 | Johannes | Sin objeción (2026-11-04) |
| H-121 | El supervisor reconoce "la planilla" como la planilla de aprobado/rechazado de su equipo de calidad. | Cambio 17 | 1–2 supervisores | Pendiente (2026-11-05) |
| H-122 | El veredicto de calidad seguirá llegando en planilla durante el MVP; si llega por API, se revisa D-71 (barato por D-74). | Cambio 17 | Johannes / `pipeline-architect` | Pendiente (2026-11-05) |
| H-123 | "Datos del cliente" en el aviso del panel del modelo (L-29) cubría a la empresa y a las personas que llaman; confirmado por Johannes. | Cambio 17 | Johannes | Validada (2026-11-05) |
| H-132 | La vista la usan todos los `qubico_admin` en escritorio ≥ 1280 px; sin modo presentación ni exportación de imágenes. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-133 | Los gráficos se hacen con HTML/CSS o SVG simple, sin librería de gráficos nueva. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-134 | Auditor e IA se distinguen con `--series-*`, nunca verde/rojo; el texto y el relleno los distinguen sin color. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-135 | Las cifras cuentan casos (llamada × motivo), no patrones. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-136 | "Sin patrón" junta observaciones aparte y casos sin explicar, para no inflar lo explicado. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-137 | El resumen visual es del análisis mostrado; si está desactualizado, el aviso se repite junto a las cifras. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-138 | Cada gráfico lleva al detalle filtrado; ninguno lo reemplaza. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-139 | El corte "muchos casos" del mapa de prioridad es 10 casos. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-140 | Un caso en dos patrones cuenta para el de mejor prioridad. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-141 | "Explicado por patrones" usa como base fp + fn + IA dudosa de los motivos analizados; "Casos en desacuerdo" es fp + fn. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
| H-142 | Pregunta y pedido de datos se juntan como "Depende de la empresa" solo en la barra. | Cambio 19 | Johannes al ver la vista con datos reales | Pendiente (2026-11-06) |
