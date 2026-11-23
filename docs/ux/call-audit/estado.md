# Estado del proceso UX · Front de Call Audit

- **Estado:** **proceso UX cerrado** (2026-10-16) · **Cambio 09 aprobado** (2026-10-19, `09-cambio-auditoria-ia.md` §0) · **Cambio 10 aprobado e implementado** (2026-10-19) · **Cambio 11 aprobado** (2026-10-22, `11-catalogo-seguros.md` §0: sección Seguros con permiso `manage_catalog`, carga de Excel con IA y confirmación humana, clave única nombre + aseguradora, versionado de fichas). · **Cambio 12 aprobado** (2026-10-23, `12-cambio-admin-qubico.md` §0: rol Administrador Qubico, prompt versionado en BD con prompt.yaml o system prompt, prueba con costo confirmado, invitaciones por correo, sin MFA, logo oficial). Listo para implementar. · **Cambio 14 aprobado** (2026-11-02, `14-estado-worker.md` §0: sección Procesamiento del admin con estado del worker, avance por etapa, historial y fallas de ASR; requiere backend nuevo). · **Cambio 15 aprobado** (2026-11-02, `15-calce-ia-por-corrida.md`: calce de la IA por corrida y por motivo para `qubico_admin`, D-52 a D-58; requiere backend nuevo). Implementable. · **Cambio 17 aprobado** (2026-11-05, `17-termino-auditoria-corredora.md`: "Planilla de calidad" y "la empresa" reemplazan "cliente" cuando no es la persona que llama; solo copy, sin cambios de API). · **Cambio 21 aprobado e implementado** (2026-11-23, `21-marca-qubyt.md`: marca Qubyt, tokens y logo; falta verificación visual) · **Cambio 20 aprobado e implementable** (2026-11-09, `20-analisis-pestanas-por-motivo.md`: Análisis de discrepancias en cinco pestañas, revisión por motivo, paginación, observaciones que se deciden y tabla por evaluador; D-92 a D-97; requiere un ajuste chico de backend). Fases 0 a 8 aprobadas por Johannes. El diseño está listo para implementar en `frontend/`; los cambios posteriores pasan por la revisión rápida contra lo aprobado.
- **Ubicación de los artefactos:** `call-audit/docs/ux/call-audit/` (dentro del repo, junto al resto de `docs/`).
- **Aprueba los gates:** Johannes (D-04).

## Aprobaciones

| Fase | Estado | Fecha | Notas |
|---|---|---|---|
| 0 · Brief | **Aprobada con cambios** | 2026-10-14 | Decisiones D-01 a D-17 en `00-brief.md` §0 |
| 1 · Investigación | **Aprobada** | 2026-10-14 | Johannes: "sí, apruebo la fase 1, todo bien entendido". Confirma la lectura de D-09, D-10 y D-12 |
| 2 · Ideación | **Aprobada** | 2026-10-15 | Johannes: "apruebo todo" (incluye D-18 y D-19) |
| 3 · Arquitectura de información | **Aprobada** | 2026-10-15 | Johannes: "apruebo". Navegación por rol y glosario sin cambios |
| 4 · User flows | **Aprobada** | 2026-10-15 | Johannes: "ok, avísame cuando termine". Valores por defecto aceptados (H-36 a H-39) |
| 5 · Patrones y navegación | **Aprobada** | 2026-10-15 | Johannes: "apruebo". Incluye la librería (H-42) |
| 6 · UX writing | **Aprobada** | 2026-10-15 | Johannes: "apruebo". Trato de "tú" (H-44) |
| 7 · Prototipado | **Aprobada** | 2026-10-16 | Johannes: "apruebo fase 7". Incluye C-02 a C-13. Test con usuarios: no por ahora (D-21) |
| 8 · Alta fidelidad | **Aprobada** | 2026-10-16 | Johannes: "apruebo". Cierra el proceso UX · `08-prototipo-alta-fidelidad.html`, `08-design-system.html`, `08-tokens.css/.json`, `08-alta-fidelidad.md` |

## Decisiones tomadas

| Fecha | Decisión | Origen |
|---|---|---|
| 2026-10-13 | Artefactos UX dentro del repo `call-audit` en `docs/ux/call-audit/` | Diseñador |
| 2026-10-13 | Para BancoEstado manda la pauta de 33 motivos sin puntaje ni pesos | `docs/user-stories-auditor-supervisor.md` |
| 2026-10-13 | El prototipo v2 y el diagrama del zip son una solución candidata, no un diseño aprobado | Diseñador |
| 2026-10-14 | D-01 · MVP del front: solo el rol auditor | Johannes |
| 2026-10-14 | D-02 · Detalle de llamada y ficha del seguro a mano durante la revisión | Johannes |
| 2026-10-14 | D-03 · Base visual `app.css` (teal, radios suaves) con marca Qubico; solo existe el logo | Johannes |
| 2026-10-14 | D-04 · Johannes aprueba todos los gates | Johannes |
| 2026-10-14 | D-05 · SSO y cuentas propias, solo con autorización (sin auto-registro) | Johannes |
| 2026-10-14 | D-06 · Chrome o Edge, con audífonos | Johannes |
| 2026-10-14 | D-07 · El auditor ve el nombre del ejecutivo en la cola y puede filtrar y buscar por él (revierte H-07; riesgo en L-18) | Johannes |
| 2026-10-14 | D-08 · El supervisor entra al MVP para cerrar el hueco de escalamientos y reaperturas (alcance exacto por confirmar; se recomiendan dos olas) | Johannes |
| 2026-10-14 | D-09 · Proceso UX completo | Johannes |
| 2026-10-14 | D-10 · Supervisor con todas sus HU MVP de una vez (opción c) | Johannes |
| 2026-10-14 | D-11 · Auditores = personal de la corredora; hoy escuchan el audio completo en una herramienta interna y anotan por minuto solo los incumplimientos | Johannes |
| 2026-10-14 | D-12 · Autorizan cuentas Qubico o la corredora; el supervisor crea auditores; solo Qubico crea supervisores | Johannes |
| 2026-10-14 | D-13 · Log de acceso para búsquedas y filtros por ejecutivo | Johannes |
| 2026-10-14 | D-14 · Logo Qubico disponible (PNG), referencia para la Fase 8 | Johannes |
| 2026-10-14 | D-15 · El supervisor aprueba todas las revisiones; el % de muestreo configurable queda como `Post` (resuelve #22) | Johannes |
| 2026-10-14 | D-16 · Sin entrevistas y sin cantidad conocida de usuarios: proto-personas definitivas, validación en la Fase 7 | Johannes |
| 2026-10-14 | D-17 · SSO desconocido: login agnóstico; registrado como #25 | Johannes |
| 2026-10-14 | Por defecto: Qubico crea supervisores por script (H-27); el logo se adapta desde el PNG (H-28) | Diseñador |
| 2026-10-14 | Fase 1 aprobada; confirmadas las lecturas: proceso completo, supervisor con todas sus HU MVP, gestión de auditores en la app | Johannes |
| 2026-10-15 | D-18 · Los hallazgos "cumple" quedan como "aceptados sin cambios" al guardar, sin confirmación explícita; el registro distingue revisado con acción de aceptado sin cambios (O-02) | Johannes |
| 2026-10-15 | D-19 · Aprobación en lote del supervisor: solo el carril sin señales, resumen previo, tope de 50, marca "aprobado en lote" (O-08) | Johannes |
| 2026-10-15 | Fase 2 aprobada | Johannes |
| 2026-10-15 | Fase 3 aprobada sin cambios (navegación y glosario) | Johannes |
| 2026-10-15 | H-34 (estado `awaiting_approval`) se usa en el diseño; queda pendiente de validar con `pipeline-architect`, sin bloquear | Coordinador / Johannes |
| 2026-10-15 | Fase 4 aprobada con valores por defecto: 30 min de inactividad, 60 s de revisión rápida, 10 s para deshacer el lote, edición hasta la aprobación del supervisor | Johannes |
| 2026-10-15 | Fase 5 aprobada; librería: shadcn/ui + Radix + Tailwind, TanStack Table/Virtual, wavesurfer.js, cmdk, Lucide | Johannes |
| 2026-10-15 | Fase 6 aprobada, con trato de "tú" | Johannes |
| 2026-10-16 | Fase 7 aprobada con C-02 a C-13 | Johannes |
| 2026-10-16 | D-20 · Por motivo: Cumple / Incumple / Dudoso, sin "No aplica" (si la situación no se dio, Cumple). Por llamada se mantiene Cumple / No cumple / Dudosa | Johannes (llamada: diseñador) |
| 2026-10-16 | D-21 · Sin test con usuarios por ahora; el plan queda documentado en `07-prototipado.md` | Johannes |
| 2026-10-16 | Fase 8 aprobada; proceso UX cerrado | Johannes |
| 2026-10-19 | Cambio 09 (revisión rápida): se aprueban con ajustes los puntos 1–4 para esta semana y 5–7 para después; rol nuevo Calidad de la IA; sección Discrepancias; prompt visible anonimizado; notas; revisión a ciegas del auditor frente al veredicto de la corredora | Diseñador; confirmado por Johannes (D-22 a D-25) |
| 2026-10-19 | Vocabulario: el veredicto de la corredora se muestra como Cumple / No cumple (no aprobado / rechazado); ramas: Coinciden · Solo la IA detectó · Omitidos por la IA · IA dudosa | Diseñador |
| 2026-10-19 | D-22 · Vero y el equipo externo entran como Auditor con `view_model_io`; no ven Discrepancias | Johannes |
| 2026-10-19 | D-23 · Sin rol "Calidad de la IA" en el MVP; Discrepancias y su clasificación quedan en Supervisor | Diseñador (supuesto, H-57) |
| 2026-10-19 | D-24 · El auditor nunca ve el veredicto ni el comentario de la corredora | Diseñador |
| 2026-10-19 | D-25 · El veredicto de la corredora es opcional: no viene / por llamada / por llamada + motivo; más un comentario opcional; el backend lo pasa si viene | Johannes |
| 2026-10-19 | Cambio 10 (revisión rápida, `10-modo-real.md`): modo real aprobado con cambios; acciones sin backend se ocultan en vez de fallar; L-28 condiciona el uso con datos reales; nuevo L-33; adenda por L-34 (ayuda de la transcripción y nota del panel del modelo) | Diseñador; aprobado por Johannes (2026-10-19) e implementado |
| 2026-10-22 | Cambio 11 (revisión rápida, `11-catalogo-seguros.md`): **aprobado**. Sección **Seguros** (supervisor), carga de Excel con extracción por IA y confirmación humana por seguro, clave única nombre + aseguradora (D-27), versionado de fichas y L-35 a L-39 | Diseñador; aprobado por Johannes (2026-10-22) |
| 2026-10-22 | D-26 · Excel de formato variable con varios seguros por archivo: el flujo sirve para el estandarizado, uno por archivo y el formato de cada aseguradora | Johannes |
| 2026-10-22 | D-27 · Clave única de un seguro: nombre normalizado (sin tildes, mayúsculas, espacios colapsados) + aseguradora. Coincide → "Ya existe" (sin cambios / con cambios / archivado) con comparación y decisión del supervisor (actualizar campo a campo o descartar). Póliza y nombres en sistema compartidos con otro seguro → solo advertencia "Posible duplicado", no bloquea. Ajusta la propuesta del diseñador (que usaba póliza + nombre en sistema como clave), porque el nombre solo se repite entre aseguradoras | Johannes; clave con aseguradora: diseñador |
| 2026-10-22 | D-28 · Permiso `manage_catalog` por cuenta, lo activa Qubico; sin él no se ve "Seguros" (403 en la API). Sin rol nuevo | Johannes |
| 2026-10-22 | D-29 · Una ficha nueva o editada aplica solo a validaciones futuras; cada validación guarda `productId` + versión de la ficha | Recomendación del diseñador aplicada (Johannes no respondió explícitamente) |
| 2026-10-22 | D-30 · Toda la ficha es editable, con Identificación primero; cada guardado crea versión | Johannes |
| 2026-10-22 | D-31 · Defaults D1–D8 del Cambio 11 aprobados; los 66 productos actuales se cargan como versión 1 y el worker lee el catálogo desde la base | Johannes |
| 2026-10-22 | Cambio 12 (revisión rápida): el ítem Cumple sin foco muestra el motivo de la IA. Bajo "No se detectó en la llamada" va "Por qué: {comment}" (texto secundario, 2 líneas con recorte visual; el texto completo queda en el DOM y se ve al enfocar con "Revisar"). Sin evidencia ni confianza sin foco. Igual en auditor, supervisor y solo lectura. Sin comentario, no se muestra la línea. Mantiene D-18 y HE-01 (H-49) | Diseñador; pedido de Johannes |
| 2026-10-14 | En los artefactos solo se usan métricas agregadas de las transcripciones reales; los prototipos usan contenido sintético (L-19) | Diseñador |
| 2026-10-23 | D-32 · Rol Administrador Qubico (`qubico_admin`), adaptado de call-audit 10 | Johannes |
| 2026-10-23 | D-33 · Versiones del prompt en un registro inmutable en la BD, exportables al repo | Johannes |
| 2026-10-23 | D-34 · Publicar con prompt.yaml (validado como `layer2_prompt.py check`, genera `system.txt`) o solo con el system prompt | Johannes |
| 2026-10-23 | D-35 · La prueba contra la referencia corre el modelo real; muestra *n* y costo estimado y solo corre si el admin confirma | Johannes |
| 2026-10-23 | D-36 · Sin verificación en dos pasos: confirmaciones con motivo obligatorio en activar y volver atrás | Johannes |
| 2026-10-23 | D-37 · Invitación por correo con enlace de un solo uso (72 h; reenviar invalida el anterior) y pantalla `/invite/[token]` | Johannes / coordinador |
| 2026-10-23 | D-38 · Logo oficial PNG (negro y blanco; cubo solo en la sidebar colapsada); H-28 cerrada | Johannes |
| 2026-10-23 | D-39 · Sin SSO: sin "Forma de ingreso"; `LoginMethod = password` | Johannes |
| 2026-10-23 | D-40 · El admin tiene la sección Seguros y gestiona `manage_catalog` y `view_model_io` | Diseñador (supuesto H-67) |
| 2026-10-23 | D-41 · Cambio 13: los datos del cliente desde la metadata se muestran completos, sin enmascarar y sin botón "Mostrar" (incluida la cuenta de cargo) | Johannes |
| 2026-10-23 | Cambio 13 (revisión rápida, `13-datos-cliente-ficha.md`): **aprobado** e implementable. Bloque "Ficha del cliente" con datos de la metadata en la sección Ficha del seguro | Johannes |
| 2026-10-23 | D-42 · "Ficha del cliente" arriba de las pestañas de seguros, plegable, resaltado con los motivos 31 y 33 | Johannes; ubicación: diseñador |
| 2026-10-23 | D-43 · Campos: nombre, RUT, fecha de nacimiento, email, teléfono y flujo; por seguro, compañía, tipo, fecha de venta, cuenta de cargo y renunciable/retenible con aviso de discrepancia. Sin ID de gestión | Johannes |
| 2026-10-23 | D-44 · Lo ven auditor, supervisor y admin Qubico (solo lectura) | Johannes |
| 2026-10-23 | D-45 · No se registra el acceso | Johannes |
| 2026-10-23 | D-46 · Se guardan solo esos campos; reimportar solo la metadata de las llamadas actuales, sin IA | Johannes |

| 2026-11-02 | Cambio 14 (revisión rápida, `14-estado-worker.md`): propuesta de estado del worker y avance de la pasada para `qubico_admin`. Requiere backend nuevo (pasadas + latido en BD). Pendientes 5 decisiones | Diseñador; pedido de Johannes |
| 2026-11-02 | Cambio 14 **aprobado** e implementable (Johannes: "Todas las recomendadas"); H-79 a H-86 sin objeción | Johannes |
| 2026-11-02 | D-47 · Sección "Procesamiento" en el admin, `/admin/processing` | Johannes |
| 2026-11-02 | D-48 · Avance completo solo de la pasada del pipeline; cargas de Excel y pruebas del prompt como una línea con enlace | Johannes |
| 2026-11-02 | D-49 · Historial de las últimas 20 pasadas + fallas de transcripción (pasan a BD) | Johannes |
| 2026-11-02 | D-50 · Solo lectura, sin "Correr pasada ahora" | Johannes |
| 2026-11-02 | D-51 · Avance por etapa con "k de n", contadores actualizados por audio | Johannes |
| 2026-11-02 | Cambio 15 (revisión rápida, `15-calce-ia-por-corrida.md`): brief y propuesta de alcance para comparar corridas (modelo × versión × corrida) contra la corredora por llamada y por motivo (C01..C33). Requiere importar la marca de la corredora por motivo (sin IA) y un endpoint nuevo. Pendientes P1–P5; supuestos H-87 a H-95 | Diseñador; pedido de Johannes |
| 2026-11-02 | Cambio 15: alcance aprobado (Johannes: "1. A / 2. A / 3. A / 4. A / 5. B"); H-87 a H-95 sin objeción | Johannes |
| 2026-11-02 | D-52 · El Cambio 15 absorbe "Calce IA vs humano" (proceso cerrado); el dashboard local se mantiene para exploración | Johannes |
| 2026-11-02 | D-53 · La vista reemplaza el contenido de la pestaña "Calidad de la IA" de `/admin/stats` | Johannes |
| 2026-11-02 | D-54 · Corrida = modelo + versión + `run_label`, más las pruebas del prompt terminadas, en un selector | Johannes |
| 2026-11-02 | D-55 · Se importan las marcas de la corredora por motivo (C01..C33) sin IA ni costo; solo las usa el admin | Johannes |
| 2026-11-02 | D-56 · Primera entrega: ranking + matriz + tabla por motivo + mapa llamada × motivo + lista de desacuerdos | Johannes |
| 2026-11-02 | Cambio 15 §7 entregado (flujo, estructura, wireframe, estados, textos, accesibilidad, impacto en tipos). Pendientes Q1 y Q2; supuestos H-96 a H-101 | Diseñador |
| 2026-11-02 | Cambio 15 **aprobado** e implementable (Johannes: "Sí, las recomendadas"); H-96 a H-101 sin objeción | Johannes |
| 2026-11-02 | D-57 · §7 aprobado; tokens `--series-1..6` en `08-tokens.css/.json` | Johannes |
| 2026-11-02 | D-58 · Banner en `/calls/[id]?serie=…` con lo que marcó la corrida; el panel muestra la vigente | Johannes |
| 2026-11-03 | D-59 · Paginador del mapa llamada por llamada: 100 columnas por página sobre la lista Cumple→No cumple, encabezados con el total del grupo, "Llamadas a–b de n", atajo "Ir a {grupo}", parámetro `mapPage` que se mantiene al cambiar de corrida; conteos y `aria-label` sobre el total (`15-calce-ia-por-corrida.md` §7.10). Revisión rápida, implementable | Johannes (pedido); diseñador (especificación) |
| 2026-11-03 | D-59 ajustado · Reparto del mapa por página: hasta 50 Cumple + 50 No cumple, y el otro grupo rellena si uno se agota; se quita el atajo "Ir a {grupo}"; rango "Cumple a–b · No cumple c–d" (§7.10). Pedido tras verlo en producción | Johannes (pedido); diseñador (especificación) |
| 2026-11-04 | D-60 · "Últimas pasadas" (Cambio 14 §7): resultado nuevo "Sin trabajo"; se agrupan pasadas consecutivas sin trabajo y rachas idénticas de "Con errores" (mismos números) o "Falló" (mismo mensaje), 2 o más, en una fila expandible (botón con `aria-expanded`/`aria-controls`); nunca `running` ni `interrupted`; se piden 200 pasadas y se muestran 20 filas. Revisión rápida, implementable | Johannes (pedido); diseñador (especificación) |
| 2026-11-04 | Cambio 16 (revisión rápida, `16-ia-discrepancias.md`): vista en el admin para la IA de discrepancias (plan `docs/plan-ia-discrepancias.md`). Pendientes P1–P5; supuestos H-106 a H-114 | Diseñador; pedido de Johannes |
| 2026-11-04 | Cambio 16: alcance aprobado (Johannes: "apruebo", tras ver P1–P5 con sus recomendadas y H-106 a H-114) = P1 A, P2 A, P3 A, P4 A, P5 A; H-106 a H-114 sin objeción | Johannes |
| 2026-11-04 | D-61 · Sección "Análisis de discrepancias" en la sidebar del admin, `/admin/discrepancies`, entre Estadísticas y Prompt | Johannes |
| 2026-11-04 | D-62 · Convive con Calidad de la IA sin duplicarla: tabla del paso 1 (vigente, con revisión manual, dudosas y evaluador) + patrones; enlaces cruzados "Ver por qué" / "Ver en Calidad de la IA" | Johannes |
| 2026-11-04 | D-63 · Se analiza siempre la corrida vigente; el admin elige motivos (preseleccionados ≥ 3 desacuerdos) y confirma con costo | Johannes |
| 2026-11-04 | D-64 · Aceptar no toca el prompt: seguimiento por tipo (Incluida en vX / Preguntada / Calibrada); descartar exige motivo y se pasa al próximo análisis | Johannes |
| 2026-11-04 | D-65 · Casos del patrón con las tres miradas; "Abrir" a `/calls/[id]` con banner (patrón D-58) y volver conserva el patrón | Johannes |
| 2026-11-04 | Cambio 16 §7 entregado (flujo, estructura, wireframe, estados, textos, accesibilidad, tipos/ApiClient, backend). Pendientes Q1–Q5; supuestos H-115 a H-120 | Diseñador |
| 2026-11-04 | Cambio 16 **aprobado** e implementable (Johannes: "Sí, todas A"); H-115 a H-120 sin objeción. Glosario de §7.5 sumado a `06-ux-writing.md` §5 | Johannes |
| 2026-11-04 | D-66 · El admin elige el modelo de la IA de análisis en el diálogo (por defecto el de la configuración) | Johannes |
| 2026-11-04 | D-67 · Texto de la propuesta editable al aceptar; se guardan original y editado | Johannes |
| 2026-11-04 | D-68 · "Incluida en v{X}" al guardar la versión con la propuesta marcada; vuelve a "Aceptada" si la versión se retira sin activarse | Johannes |
| 2026-11-04 | D-69 · Detalle del patrón en `/admin/discrepancies/patterns/[id]` | Johannes |
| 2026-11-04 | D-70 · Preguntas a la corredora aceptadas solo en Seguimiento; no pasan a "Por presentar" del supervisor | Johannes |
| 2026-11-04 | Cambio 14 §8–§10 (revisión rápida): audios bloqueados (estado "Bloqueado · 3 de 3 intentos" / "Se reintentará" / "Reintento pedido", aviso que corrige la nota falsa de §3.6, agrupación por error, aviso en la tarjeta de Estado, "Reintentar" con confirmación, costo estimado y Registro de actividad) y detalle de pasada (página `/admin/processing/runs/{id}`, tiempo y costo por etapa, respaldo OpenRouter, costo por llamada, "Sin registro" en pasadas antiguas). D-61 a D-66 propuestas; pendientes P1–P5 de §10; supuestos H-115 a H-119 | Diseñador; pedido de Johannes |
| 2026-11-05 | Cambio 17 (revisión rápida, `17-termino-auditoria-corredora.md`): "cliente" deja de nombrar a la corredora o a su planilla en la UI, por la decisión de actores de Johannes (`CLAUDE.md`, `docs/context.md` § Actores). **Aprobado** (Johannes: "Aprobar todo"); H-121 a H-123 sin objeción | Johannes; diseñador |
| 2026-11-05 | D-71 · El veredicto, la marca por motivo y el comentario que llegan con el lote se llaman **Planilla de calidad** (corto: **la planilla**); reemplaza "Veredicto / Auditoría / Comentario del cliente" y "Excel del cliente" | Johannes |
| 2026-11-05 | D-72 · La empresa como contraparte se llama **la empresa**; `{clientName}` se interpola solo en el encabezado del admin, Cuentas y la invitación ("Preguntas a la empresa", no "a {clientName}") | Johannes |
| 2026-11-05 | D-73 · "Por presentar al cliente" pasa a **"Por presentar"** | Johannes |
| 2026-11-05 | D-74 · Las etiquetas de la fuente se centralizan en una constante del front (`SOURCE_LABEL`). Alcance: copy visible y mocks de la demo; comentarios y JSDoc no se tocan. Aviso del panel del modelo: "Contenido técnico confidencial de Qubico y de la empresa, con datos de clientes. …" (el original se refería a ambas) | Johannes |
| 2026-11-06 | Cambio 18 (revisión rápida, `18-version-desde-seguimiento.md`): crear una versión del prompt desde Seguimiento con las reglas aceptadas aplicadas al «Criterio:» de cada motivo, comparación por motivo y borrador + prueba. Alcance **aprobado** (Johannes: «Sí, todas A») = P1–P5 A; H-124 a H-131 sin objeción (pasadas a `hipotesis.md`). §8 entregada; pendientes Q1–Q3 y supuestos H-139 a H-143 | Johannes; diseñador |
| 2026-11-06 | D-75 · Cambio 18: las reglas se aplican sin IA; prompt del análisis v1.3.0 con `prompt_rule = {acción agregar/reemplazar, frase exacta, texto}`; las de texto libre se agregan al final con marca. Sin re-corridas | Johannes |
| 2026-11-06 | D-76 · Cambio 18: «Crear borrador y probar» encadena borrador + diálogo de costo (D-35); activar sigue aparte con motivo (D-36); existe «Solo crear borrador» | Johannes |
| 2026-11-06 | D-77 · Cambio 18: comparación por motivo (antes/después) con el texto final editable, estado por regla, historial que se agrega y «Quitar esta regla» | Johannes |
| 2026-11-06 | D-78 · Cambio 18: se mantiene la subida manual del prompt.yaml y se quitan las casillas «Propuestas incluidas»; aviso con enlace a Seguimiento | Johannes |
| 2026-11-06 | D-79 · Cambio 18: origen nuevo del historial «Análisis de discrepancias» (`discrepancy_analysis`), nota con patrón, quién aceptó y su nota | Johannes |
| 2026-11-06 | Cambio 19 (revisión rápida, `19-discrepancias-visual.md`): capa visual sobre Análisis de discrepancias (cifras clave, «¿Quién tiene más razón?», barras divergentes por motivo, mapa de prioridad). Hallazgo: `who_is_right`, `concentration`, `side_effects` y `expected_fix` del prompt v1.1/v1.2 no llegan a la API ni a la vista. Pendientes P1–P5; supuestos H-132 a H-138; decisiones desde D-80 | Diseñador; pedido de Johannes |
| 2026-11-06 | Cambio 19: alcance aprobado (Johannes: todas las recomendadas, P1–P5 = A); H-132 a H-138 sin objeción (H-132 ajustado: todos los admin) | Johannes |
| 2026-11-06 | D-80 · Arriba: cifras clave + «¿Dónde se arregla?» + barras por motivo (cuánto es del prompt y cuánto del auditor, y en qué motivos) | Johannes |
| 2026-11-06 | D-81 · Se exponen `who_is_right`, `concentration`, `side_effects`, `expected_fix`, `tentative`, `unexplained_cases` | Johannes |
| 2026-11-06 | D-82 · Mapa de prioridad de patrones plegado y usable como filtro | Johannes |
| 2026-11-06 | D-83 · Barras por motivo por defecto + «Ver como tabla» | Johannes |
| 2026-11-06 | D-84 · Lo de v1.0.0 se oculta solo cuando el análisis mostrado no lo tiene | Johannes |
| 2026-11-06 | D-85 · Se diseña sobre el análisis v1.0.0 existente, sin re-correr (~20 USD); lo de v1.1+ con estado «sin dato en este análisis» | Johannes (vía PM) |
| 2026-11-06 | D-86 · «Quién tiene más razón» se grafica rotulado «según el análisis», no como medición | Johannes (vía PM) |
| 2026-11-06 | D-87 · Lo ven todos los `qubico_admin` | Johannes (vía PM) |
| 2026-11-06 | Cambio 19 §7 entregado (qué se puede mostrar por versión, estructura, wireframe v1.0.0 y v1.1+, detalle y Seguimiento, estados, textos, accesibilidad, impacto en tipos y API). Supuestos H-139 a H-142. Esperando aprobación | Diseñador |
| 2026-11-06 | Cambio 19 §7 **aprobado e implementado** (Johannes: «Sí, implementa», todas las recomendadas): corte del mapa de prioridad en 10 casos fijos (H-139) y «Depende de la empresa» como un solo segmento (H-142). Backend (`pattern_out`, `summary`, `followUp`, `capabilities`) y front (`discrepancy-charts.tsx`). Revisado en el modo demo; falta verlo con el análisis real de producción | Johannes; implementación |
| 2026-11-06 | Cambio 15 §7.11 (revisión rápida): el mapa llamada por llamada no mostraba las llamadas nuevas. **Aprobado** (Johannes: Q1 A ya resuelta en prod con `283faef`; Q2 B; Q3 A; Q4 A). D-88 nombre de la serie "Vigente" + `promptVersions`; D-89 cobertura "n de total" en chips, "Agregar corrida" y ranking (errores aparte, texto neutro a la cantidad); D-90 mapa con todas las llamadas, primero las con resultado de la corrida del mapa, luego con error, luego sin correr (`callId` asc), estado de celda `error` en la fila de veredicto, `mapPage` vuelve a 1 al cambiar la corrida del mapa (revisa H-102); D-91 nota del titular con coberturas distintas. Supuestos H-144 a H-148. Implementable | Johannes; diseñador |
| 2026-11-09 | Cambio 20 (revisión rápida, `20-analisis-pestanas-por-motivo.md`): propuesta para separar Análisis de discrepancias en pestañas (Resumen, Patrones, Evaluadores, Seguimiento, Historial), revisar patrones y observaciones por motivo, paginar las listas transversales y aclarar la tabla por evaluador. **Pendiente de aprobación** (Q1–Q5); supuestos H-149 a H-156; decisiones desde D-92 al aprobar. Registro Legal omitido por instrucción de Johannes | Diseñador; pedido de Johannes |
| 2026-11-09 | Cambio 20 **aprobado e implementable** (Johannes, vía coordinador: «Apruebo todas» = Q1–Q5 A). §13 cierra el contrato de backend, las URLs y el estado del front. H-154 validada con la reimportación; R-16.3 ajustado | Johannes |
| 2026-11-09 | D-92 · Cinco pestañas en una fila: Resumen (por defecto), Patrones, Evaluadores, Seguimiento e Historial; reemplaza H-115 | Johannes (vía coordinador) |
| 2026-11-09 | D-93 · Patrones se revisa con panel lateral de motivos, avance por motivo y «Siguiente motivo»; «Todos los motivos» conserva la lista por impacto, de a 10 | Johannes (vía coordinador) |
| 2026-11-09 | D-94 · Aceptar una observación la deja en Seguimiento, en «Para calibrar con el auditor», con texto editable; descartar exige motivo; nunca puede volverse regla del prompt. Ajusta R-16.3 | Johannes (vía coordinador) |
| 2026-11-09 | D-95 · En bloque solo se descartan observaciones de un motivo, con un único motivo de descarte; los patrones se deciden uno a uno | Johannes (vía coordinador) |
| 2026-11-09 | D-96 · Tabla por evaluador con los nombres de §7, total y tasa («23 · 1,5 por llamada») y fila fija «Todos los evaluadores» | Johannes (vía coordinador) |
| 2026-11-09 | D-97 · La fila «Sin evaluador en la planilla» se muestra atenuada, al final y fuera de «Todos los evaluadores». Tras la reimportación quedan 100 de 1.100 llamadas sin evaluador: las de octubre, cuya planilla no trae la columna | Johannes (dato); diseñador (especificación) |
| 2026-11-23 | Cambio 21 (revisión rápida sobre Fase 8, `21-marca-qubyt.md`): marca Qubyt; paleta de la presentación a S4P y logo Qubyt. Aprobado 2026-11-20 en `feature/frontend-mock` (allí "Cambio 11", D-29 a D-32) y portado a este frontend | Diseñador, a pedido de Johannes |
| 2026-11-23 | D-98 · Paleta Qubyt: primary #3a6491, fondo #f4f6f9, tinta #1f2a37; rojo/ámbar sin cambios; "Confirmado" en tinta; gráficos: series 1 y 3, secuencial, divergente y «revisor» a la rampa azul (§7) | Johannes |
| 2026-11-23 | D-99 · Login: panel marino #133b64, logo A (cian → lila), símbolo animado una vez; estático con prefers-reduced-motion | Johannes |
| 2026-11-23 | D-100 · Rampa `teal-*` → `blue-*` (tono de StatusBadge `teal` → `blue`) | Johannes |
| 2026-11-23 | D-101 · Copy del login: "Qubyt propone hallazgos sobre el 100 % de las llamadas." (solo el login) | Johannes |
| 2026-11-23 | D-102 · Favicon con el símbolo Qubyt | Johannes |

## Preguntas abiertas

Ninguna bloqueante.

## Pendientes no bloqueantes

- Cambio 21: verificación visual en el navegador (login animado, sidebar, invitación, heatmap, Calidad de la IA, Calidad del servicio, mosaico de acuerdo). En Safari el webm con alfa no se reproduce; queda el poster estático.
- Cambio 21: correo de invitación (`src/call_audit/notify/email.py`) sigue con logo Qubico y colores viejos; propuesta en `21-marca-qubyt.md` §8. No borrar `frontend/public/brand/qubico-logo.png` mientras el correo lo use.
- Cambio 21: decidir si se borran los PNG `qubico-*` de `frontend/src/assets/brand/` (ya no se importan). Reflejar D-101 en `06-ux-writing.md`.
- H-34: validar `awaiting_approval` con `pipeline-architect`.
- H-48: `not_applicable` en el contrato y en el prompt de la capa 2 vs D-20 (`pipeline-architect`, `rubric-engineer`).
- H-32: mapeo motivo → sección de la ficha como configuración (`rubric-engineer`).
- Actualizar HU-AUD-03 en `docs/user-stories-auditor-supervisor.md` (sin "No aplica").
- Verificar la licencia del design system "Modernist" del zip (L-13).
- ADR del prompt único vs las capas de `CLAUDE.md` (`pipeline-architect`, H-52).
- L-28: no desplegar datos reales a externos sin enmascarado ni DPA.
- L-36: confirmar contrato/NDA para enviar las condiciones comerciales de la corredora al proveedor del LLM (Cambio 11).
- H-65: anonimización del Excel antes del LLM sin enmascarar teléfonos de empresas (`privacy-reviewer`).
- Cambio 11: antes de la carga inicial, verificar que los 66 productos no tengan claves nombre + aseguradora repetidas (§9.3).
- Cambio 12: ADR del registro de versiones del prompt (validación del yaml en el servidor, versión vigente por lote, conjunto de calibración, evaluación que se puede detener, costo por corrida y exportación al repo) con `pipeline-architect` y `llm-engineer`.
- Cambio 12: ajustar la regla no negociable 2 de `CLAUDE.md` (fuente de verdad del prompt = registro versionado en la BD). Lo hace Johannes o el ADR.
- Cambio 12: invitaciones y restablecimiento por correo en el backend; mientras no existan, sigue `10-modo-real.md` 1d y 3b.
- Cambio 13: H-78 (cómo llega `product_sheet_section: customer` a M31/M33: rúbrica v1.0.2 o mapeo de presentación) con `rubric-engineer` / `pipeline-architect`; H-77 (categoría ↔ renunciable/retenible) a confirmar.
- Cambio 14: diseño del backend (tablas `pipeline_runs`, `worker_heartbeat`, `asr_failures`, hilo de latido, endpoint) con `pipeline-architect` (§5). Agregar "pasada" y "latido" al glosario de `06-ux-writing.md`.
- Cambio 15: backend (`Case.external_item_fails`, reimportación de metadata sin IA, `GET /api/admin/quality`) con `pipeline-architect` (§3, §7.7). Agregar el glosario de §7.5 a `06-ux-writing.md`. Revisión rápida post-implementación contra §7.
- Cambio 16: backend (§7.8: `discrepancy_analyses`, `discrepancy_patterns`, `proposal_decisions`, paso 1 como servicio, jobs por motivo, endpoints `/api/admin/discrepancies`) con `pipeline-architect` y `llm-engineer`. Revisión rápida post-implementación contra §7.
- Cambio 20: implementar según §13 (incluye el ajuste de backend de observaciones) y hacer la revisión rápida post-implementación en el navegador, con datos reales.
- Cambio 17: copy de §6 implementado en `frontend/` (2026-11-06); falta la revisión rápida post-implementación. Ojo: IDs duplicados de antes (H-115 a H-119 los usan C14 §8–§10 y C16; D-61 a D-66 propuestos en C14 §10 chocan con C16) — renumerar los de C14 cuando se aprueben.
