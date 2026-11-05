# Historial de cambios · Call Audit

Una entrada por fecha, con lo que cambió en la app, en los datos y en los prompts, y por qué.

Cada componente tiene además su propio historial detallado:
- Prompt de la capa 2: `prompts/layer2/CHANGELOG.md` (una entrada por versión, con métricas).
- Prompt de verificación de afirmaciones: historial al final de `docs/layer2-claims-prompt.md`.
- Diseño del front: `docs/ux/call-audit/estado.md` (fases y cambios aprobados).

## 2026-11-05

- **Prompt de análisis de discrepancias v1.1.0** (`prompts/discrepancy_analysis/v1.1.0`), con los comentarios de Johannes sobre la v1.0.0:
  - el analista ya no sabe del Excel: solo que un auditor humano marcó cumple o no cumple por motivo;
  - por patrón decide qué lado tiene más razón: si es el auditor, propone el cambio a la regla del prompt de la capa 2; si es la IA, explica el problema del auditor;
  - recibe **todos los casos**, sin muestra, y cada uno con la **llamada completa** y los datos que recibió la IA evaluadora (seguros, tipificación, duración, esperas), para que un «dato faltante» se pueda mostrar en el caso;
  - cada caso trae el código del ejecutivo, y el analista avisa cuando un patrón se concentra en pocos ejecutivos o en un auditor;
  - un motivo que no cabe en un pedido (tope de 150 mil tokens) se parte en tandas y una pasada con `merge.txt` las junta en un resultado.
  - Con producción (29 motivos, 1.385 casos): 91 pedidos, ~US$20,5 y ~28 min con Sonnet 5.5, contra ~US$3,7 de la v1.0.0. Los motivos 25 y 18 van en 11 y 10 tandas.
- **Prompt de análisis v1.2.0** (Johannes, al ver la primera corrida con la v1.1.0): las propuestas son solo un cambio en la regla del prompt o calibrar al auditor. Sin preguntas a la corredora ni pedidos de datos: un patrón que no se arregla con ninguna de las dos queda con `proposal: null` y la vista lo muestra entre las observaciones. Si la pauta es ambigua y el auditor marca parejo, propone la regla que refleja su práctica; si marca disparejo, calibrarlo.
- **Calidad de la IA:** corrida «Vigente», elegida por defecto, que junta la corrida vigente de cada llamada. En producción la vigente estaba repartida entre «v2.10» (100 llamadas) y «v2.10 automático» (997), y la vista elegía la de 100: 997 salían sin resultado y el mapa quedaba vacío.
- **Procesamiento:** las pasadas iguales y seguidas que solo tienen audios «por cuota» (cuenta sin saldo) también se agrupan.
- **Análisis de discrepancias:** las llamadas cuya corrida vigente terminó con error ya no se cuentan como «sin corrida vigente».
- **Imagen de la API:** lleva el bench completo (`scripts/prompt_bench/*.py` y el extra `bench`). Sin eso, el deploy del análisis no arrancaba (`ModuleNotFoundError: real_calls`) y producción estuvo caída unos 10 minutos.

## 2026-11-04

- **Tabla de discrepancias** (`python -m call_audit.discrepancies`), paso 1 de la cuarta IA (`docs/plan-ia-discrepancias.md`). Sin IA y solo lectura:
  - cruza por llamada × motivo la corrida vigente con el Excel del cliente (C01..C33, veredicto y comentario) y con la revisión manual Qubico (revisiones, clasificaciones, notas y, opcional, `revision_capa2.csv`);
  - deja fuera del repo `discrepancies.jsonl` (fp, fn, IA dudosa y ambos No cumple, con regla vigente, citas y tramo de transcripción), `transcripts.jsonl` y un resumen por motivo, por veredicto de llamada y por evaluador del cliente;
  - Con las 100 llamadas locales (v2.10): 131 casos (54 fp, 52 fn, 12 IA dudosa, 13 ambos No cumple). Los motivos con más desacuerdo son 18, 6, 1 y 3.
- **Cuarta IA, análisis de discrepancias** (`python -m call_audit.discrepancy_analysis`), paso 2 del plan. Prompt `prompts/discrepancy_analysis/v1.0.0`:
  - un pedido por motivo con una muestra estable de casos (hasta 25 fp, 12 fn con la llamada completa, 12 dudosos y 6 de contraste) y notas sobre cómo se arman los datos (tipificación de una fila, `RETENCION` asumida);
  - devuelve patrones con causa (criterio, evaluador, transcripción, dato faltante), casos, citas y una propuesta concreta. Las citas se validan contra lo que recibió el modelo. `--dry-run` estima el costo sin llamar al modelo.
  - Piloto con producción (motivos 25, 1 y 18, Sonnet 5.5): US$0,49 y 0 citas no encontradas. Encontró las causas conocidas: el 25 es un dato faltante (la metadata trae una sola tipificación por grabación) y el 1, esperas anunciadas de 31 a 55 s que el cliente no marca. Además, en el 18 el auditor marca distinto casos casi iguales, con revisión Qubico a favor de la IA.
  - Corrida completa (28 motivos con desacuerdos, Sonnet 5.5): ~US$3,25 con el piloto. 64 patrones: 35 de criterio, 16 de evaluador, 8 de dato faltante y 5 de transcripción. Propuestas: 26 preguntas al cliente, 18 calibraciones, 10 pedidos de datos y 10 reglas del prompt. 0 citas no encontradas.
  - Pendiente para la v1.1: forzar el esquema con tool use. El 32 devolvió dos veces comillas sin escapar (se reparó a mano), un patrón vino con una causa fuera de la lista y otro sin propuesta.
- **Evaluador del cliente:** `EVALUADOR_CALIDAD` del Excel nuevo de S4P se guarda en `call_metadata.external_evaluator` al importar la metadata (no sale por la API).
- **Análisis de discrepancias en la app** (Cambio 16 de UX): sección «Análisis de discrepancias» del admin Qubico (`/admin/discrepancies`), con pestañas Análisis, Seguimiento e Historial, y el detalle de cada patrón con sus casos.
  - El análisis se lanza a mano, con motivos, modelo y costo estimado, y solo corre si el admin confirma. Lo corre el worker; no hay corrida automática por calendario (Johannes, 2026-11-04).
  - Tablas nuevas `discrepancy_analyses`, `discrepancy_patterns` y `proposal_decisions` (migración 0006). Cada motivo se guarda al terminar, así un análisis detenido o fallido conserva lo hecho y ofrece «Analizar motivos pendientes». Si la respuesta no trae JSON válido, el worker reintenta una vez y después marca el motivo como fallido.
  - Aceptar no toca el prompt: la propuesta pasa a Seguimiento. Las reglas aceptadas se marcan al subir una versión del prompt y quedan «Incluida en vX»; si ese borrador se descarta, vuelven a «Aceptada». Descartar exige motivo, y la siguiente corrida recibe lo descartado para no repetirlo.
  - Enlaces: «Ver por qué» en Calidad de la IA, una línea en Procesamiento y un banner al abrir una llamada desde un patrón.
  - Modelo por defecto: Sonnet 5.5 por la API de Anthropic (Johannes, 2026-11-05), el mismo del piloto y la corrida completa. Necesita `ANTHROPIC_API_KEY` en el entorno; sin ella, el diálogo lo muestra no disponible. El admin puede elegir Gemini 3.8 Flash, que tiene respaldo por OpenRouter igual que el pipeline.

## 2026-11-02

- **Una pasada toma todos los audios pendientes**, ya no 100 por pasada (`PIPELINE_BATCH_SIZE` queda en 0 = sin tope; se puede volver a poner un tope por variable de entorno). Las validaciones empiezan cuando termina de transcribirse todo el lote.
- **Un 402 de Gemini (cuenta prepago sin saldo) ya no gasta intentos del audio**, igual que un 429: antes 400 audios quedaron con fallas registradas mientras la cuenta estaba sin créditos.
- **Procesamiento (Cambio 14)** en el menú del admin (`/admin/processing`), solo lectura. Muestra:
  - el estado del worker: procesando, en espera, no responde (sin latido hace más de 3 min) o última pasada fallida;
  - el avance de la pasada en curso por etapa ("k de n" al transcribir y validar);
  - las últimas 20 pasadas y las fallas de transcripción.
  - Se actualiza cada 5 s con una pasada en curso y cada 30 s en espera.
- **Calidad de la IA por corrida (Cambio 15)** reemplaza la pestaña «Calidad de la IA» de Estadísticas del admin. Compara hasta 6 corridas (modelo + versión del prompt + corrida, más las pruebas del prompt hechas desde la app) contra el auditor del cliente:
  - titular con la que mejor calza, ranking (calce equilibrado, detección, falsos positivos, coincidencia; metas FP ≤ 5 % y FN ≤ 20 %) con costo por llamada y matriz 2×2 por corrida;
  - tabla por motivo contra la marca NO CUMPLE del cliente (C01..C33), mapa llamada × motivo y lista de llamadas en desacuerdo que abre la llamada con un aviso de lo que marcó esa corrida;
  - el estado (corridas, filtros) va en la URL. Endpoint `GET /api/admin/quality`, solo admin. Color fijo por modelo (`--series-1..6`) y nombre del modelo desde `label` en `models.toml`.
- **Marca del cliente por motivo:** se guarda en `cases.external_item_fails` (migración `0005`) con la misma regla que el dashboard local (las 33 columnas que siguen a RETENIBLE). Para las llamadas ya importadas: `python -m call_audit.ingestion.customer --metadata <Excel>` (solo metadata, sin IA).
- **El worker guarda su estado en la base:** cada pasada en `pipeline_runs` (contadores por audio), un latido cada 30 s en `worker_heartbeat` y las fallas de ASR en `asr_failures`, que reemplaza `work/asr_failures.json` (se importa una vez). Al arrancar, una pasada que quedó abierta se marca como interrumpida. Migración `0004`.

## 2026-10-23

- **Rol Administrador Qubico (Cambio 12)** (`qubico_admin`, menú Estadísticas · Prompt · Cuentas · Discrepancias · Seguros · Registro de actividad). No ve los dashboards del supervisor; las llamadas las abre en solo lectura.
  - **Cuentas:** invita auditores, supervisores y admins por correo con un enlace de un solo uso que vence en 72 h (`/invite/<token>`: crear contraseña de 12+ caracteres y aceptar los términos). Reenviar, revocar, restablecer contraseña, desactivar y reactivar; no se puede desactivar a sí mismo ni al último admin. Permiso extra por rol: `view_model_io` (auditor) y `manage_catalog` (supervisor). Sin verificación en dos pasos por ahora.
  - El supervisor también invita auditores por correo. En el login, «¿Olvidaste tu contraseña?» manda el enlace con respuesta neutra.
  - **Prompt:** registro de versiones en la base (borrador → en prueba → probada / falló → vigente → retirada), inmutables desde la prueba. Se sube el `prompt.yaml` completo (misma validación de `layer2_prompt.py check`, diferencias por regla) o solo el system prompt (diferencias de texto). La prueba corre el modelo elegido sobre las llamadas con veredicto del cliente, con costo estimado según las corridas anteriores de ese modelo y confirmación explícita; se puede detener. Activar o volver atrás pide un motivo; el worker usa la vigente para los lotes nuevos. Se descarga como zip para llevarla al repo.
  - **Registro de actividad** de las acciones sensibles (cuentas, prompt, catálogo, búsquedas por ejecutivo), solo lectura.
  - Migración `0003` (invitaciones, registro de prompts, pruebas y detalle del registro). Correo por `EMAIL_BACKEND` = console · smtp · ses.
- **Sin SSO:** el login queda solo con correo y contraseña (D-28).
- **Ficha del cliente (Cambio 13)** en la columna Ficha del seguro del detalle de llamada: nombre, RUT, fecha de nacimiento, email, teléfono y flujo desde la metadata del lote, sin enmascarar (D-41) y para los tres roles (D-44). Se resalta con los motivos 31 y 33.
  - Cada seguro suma compañía, tipo de seguro y fecha de venta, y en Categoría «Renunciable / Retenible según la metadata», con un aviso si contradicen la categoría de la ficha (informativo, no cambia el veredicto).
  - Estos datos no entran al modelo ni al panel del modelo (`input_data`), y no se registra quién abre la llamada (D-45).
  - Llamadas ya importadas: `python -m call_audit.ingestion.customer --metadata <Excel del lote>` relee solo la metadata, sin ASR ni LLM (D-46). Las 100 locales ya quedaron completas.
- **Logo oficial de Qubico** en el menú, el login, la página de privacidad, el ícono de la pestaña y los correos.

## 2026-10-22

- **Catálogo de seguros versionado (Cambio 11)**, sección **Seguros** del supervisor con el permiso `manage_catalog`:
  - Las fichas pasan de `data/catalog/products.json` a la base (`products`, `product_versions`). Cada guardado crea una versión; nada se sobrescribe ni se borra (se archiva). Los 66 seguros actuales entran como v1 (`python -m call_audit.catalog seed`).
  - Clave única: nombre del seguro normalizado + aseguradora. La póliza y el nombre en sistema solo avisan "posible duplicado".
  - Campos de la ficha: los de `products.json` más "Descripción para identificarlo" y "Información adicional" (lo del Excel que no calza en otro campo; se guarda y se muestra, no va al prompt). Esquema `catalog.schema` v1.0.0.
  - Subir Excel: la IA (Gemini 3.8 Flash, prompt `catalog_extraction` v1.0.0) lista los seguros y extrae sus fichas de a 8; el supervisor revisa cada una (origen hoja/fila de cada campo, comparación Actual vs Propuesto) y decide. Duplicados, datos personales y campos obligatorios los revisan reglas, sin IA.
  - Esquema v1.1.0 y prompt de extracción v1.1.0 tras revisar el Excel de apoyo: la ficha suma exclusiones (47, Protección Global MyPE HDI), tasas por plazo del crédito (4 seguros), edad máxima por plazo (6), póliza/tabla y nota en primas y plazo de cobertura en siniestros; la comparativa de mercado (300 filas) queda como dato de referencia. `extract_catalog.py` lee esas hojas; lo que ya había no cambió. No van al prompt de validación.
  - Prueba real del prompt v1.0.0 con Apoyo_Seguros_MetLife_HDI.xlsx (US$1,02, 18 min): 47 de 47 retenibles, 100 % en categoría, prima, pólizas, devolución, retracto y tablas; se le pasaron los 19 no retenibles / no renunciables (corregido en la v1.1.0, sin volver a correr).
  - El worker valida con la foto del catálogo vigente y guarda en cada validación la ficha y la versión usadas (`model_runs.catalog_refs`); el detalle de llamada muestra "Ficha v{n}".

## 2026-10-21

- **Pipeline automático** (`python -m call_audit.ingestion.pipeline`, servicio `worker` en el EC2, cada 15 min):
  - Se conecta a la cuenta SFTP de S4P con usuario y contraseña y con la llave del servidor fijada. Lee los audios `.mp3` y la metadata del lote (`.xlsx` o `.csv`, una fila por grabación) que S4P deja en su carpeta, y crea ahí `output/`.
  - Transcribe con Gemini 3.8 Flash, el mismo ASR del bench, lo que todavía no está en `output/`. Deja `output/<grabación>.json` con la transcripción y la metadata.
  - Sin `TIPIFICACION` en la metadata se asume RETENCION. Sin fila de metadata, el audio espera a la siguiente pasada.
  - Valida con el prompt vigente (v2.9) solo con Gemini 3.8 Flash, con la transcripción anonimizada, y deja la llamada en la app con la corrida "v<versión> automático".
  - Sube el audio a S3 para que la app lo reproduzca.
  - Tres fallas de ASR seguidas en el mismo audio y deja de reintentarlo.
  - Probado en local con 230244: US$0,025 de validación y ~1,5 min por llamada de 9 min.
  - Baja cada audio solo cuando lo necesita y lo borra del EC2 cuando ya está en S3.
  - El audio procesado se mueve a `output/` junto a su `.json`, y el archivo de metadata cuando todas sus grabaciones terminaron: en la carpeta quedan solo los pendientes. `--adopt` marca como hechas, sin gastar, las grabaciones que ya estaban en la app.
- Se descarta el SFTP propio en el EC2 (primer diseño, mismo día): se usa la cuenta de S4P que ya existe.

## 2026-10-20

- **Pauta v1.0.1** (decisiones de Johannes tras su auditoría manual):
  - Umbral del motivo 1 en 30 s, como dice la pauta; antes era 35 s.
  - Todos los motivos son graves; la lista de leves queda vacía.
  - El bench también cuenta las esperas que el ejecutivo anuncia ("permanezca en línea"), aunque el cliente hable con otra persona. En 230764 la espera era de 38 s y no se detectaba.
  - Con estas tres decisiones, v2.7 contra la auditoría manual sube a 72 % y 74 % en Gemini, y a 70 % y 72 % en Sonnet (antes 66–70 %).
  - Reimportado en local y en AWS.
- **Prompt v2.8, motivo 13:** una diferencia menor en el N° de seguro (cero inicial omitido) queda indeterminada para revisión. Pregunta n.º 28 al cliente.
- **Prompt capa 2 v2.8**, a partir de la auditoría manual de 50 llamadas:
  - NO_ACEPTADA más estricta: era la causa de los 24 + 26 de más de Sonnet.
  - El 7 solo aplica ante un reclamo.
  - En el 8, la escucha activa no cuenta como no responder.
  - El 2 exige citar la ficha.
  - El 3 lista las objeciones.
  - Se precisan el 5, el 12 y el 16.
  - El 11 incluye descalificar a la ejecutiva de venta.
  - En el 32 basta una coletilla.
  - En el 18, la IA sugiere de 1 a 3 motivos correctos.

  Detalle en `prompts/layer2/CHANGELOG.md`; todavía no se corre contra las 100 llamadas.

## 2026-10-19

- **Evidencias en el detalle:**
  - El resaltado amarillo marca la cita completa, o el tramo más largo que calce en palabras enteras. Antes cortaba en el carácter 40.
  - El motivo 1 ahora tiene evidencia con timestamp: el audio salta al inicio de la espera más larga y se resalta el turno con que se retoma. Usa `real_calls.executive_hold_spans`, con las mismas esperas que el bench; se verificó que no cambia ninguna de las 100 llamadas.
- **Audio real en el detalle de llamada:**
  - `useAudio` reproduce la URL firmada de S3 con un `<audio>` real, sincronizado con la transcripción, las evidencias, ±5 s y la velocidad. Hasta ahora el reproductor simulaba la reproducción en silencio.
  - En modo real, sin audio se muestra "No pudimos cargar el audio".
  - Si falla la firma de S3, la API devuelve el caso sin audio en vez de un error 500.
- **Scripts de despliegue en AWS** (`scripts/deploy/`):
  - `aws_setup.sh` crea ECR, los security groups, el rol IAM, el RDS privado y el EC2 con IP elástica.
  - `deploy.sh` construye y sube las imágenes y actualiza el EC2.
  - `docker-compose.prod.yml` ahora usa las imágenes de ECR. Dominio: `audit.qubicoenergy.com`.
- **Cambio 10 de UX (modo real), aprobado e implementado:** con `NEXT_PUBLIC_API_MODE=http` (`isRealMode`):
  - el login queda sin SSO ni atajos de demo y muestra los mensajes de la Fase 6;
  - se ocultan "Opciones de la demo", Exportar, Registrar feedback, Cambiar decisión e Invitar auditor;
  - las estadísticas que v0 no calcula muestran "todavía no están disponibles";
  - la transcripción dice "Transcripción automática; puede tener errores.";
  - el panel del modelo explica que lo enviado va anonimizado.

  En modo mock no cambia nada. La API ahora cuenta en "Motivos" solo los incumplimientos confirmados por un auditor.
- **Despliegue v0:**
  - Imágenes `Dockerfile` (API: aplica las migraciones al arrancar) y `frontend/Dockerfile` (Next standalone en modo http).
  - `docker-compose.yml` para probar en local (Postgres + API + front) y `docker-compose.prod.yml` + `Caddyfile` para un EC2 con RDS y HTTPS.
  - Pasos en `docs/deploy.md`.
- **Datos personales visibles** (decisión de Johannes; registro legal L-34):
  - `import_bench --asr-dir` muestra la transcripción original del ASR y el comentario del cliente sin enmascarar.
  - Las citas y comentarios de la IA se reconstruyen con el texto original (`Unmasker`). En v2.7 quedaron 4 marcadores de datos personales entre unos 33 mil textos.
  - Lo que se envía al LLM sigue anonimizado, y el panel del modelo lo muestra tal como salió.
- **Front conectado a la API:**
  - `NEXT_PUBLIC_API_MODE=http` usa `frontend/src/lib/api/http-api.ts`; Next reenvía `/api/*` a `API_URL`, así la cookie es del mismo origen. El modo mock sigue siendo el de por defecto.
  - Verificado en el navegador con las 100 llamadas de v2.7: login, cola, detalle con hallazgos y evidencia, panel del modelo y árbol de discrepancias.
  - La API ahora toma el caso al abrirlo, como el mock. Las estadísticas que v0 no calcula vuelven vacías y "Mis revisiones" incluye los escalados.
- **Backend v0** (`src/call_audit/`): API FastAPI sobre las corridas del bench, sin pipeline todavía.
  - Postgres o SQLite con Alembic, login por cookie firmada y contraseñas argon2; las cuentas las crea `call_audit.admin`.
  - Endpoints del contrato `frontend/src/lib/api/client.ts`: cola, caso, revisión, escalamiento, notas por motivo, aprobaciones y árbol de discrepancias. Lo que todavía no tiene datos responde 501.
  - Visibilidad en el backend: el auditor no recibe el veredicto del cliente (D-24), y el prompt y la respuesta del modelo solo van con `view_model_io` (D-22).
  - `import_bench` carga una corrida con la misma regla de veredicto del dashboard. Verificado: las 800 corridas de v2.7 (4 modelos × 2 corridas × 100 llamadas) dan el mismo veredicto que `revision_capa2.csv`.
- **Pauta como configuración:** `rubrics/bancoestado_retention/v1.0.0.yaml`, con los 33 motivos y sus bloques. Tipo y gravedad quedan en TBD; los leves son una propuesta y el umbral de espera es 35 s.
- **Integración:** nueva rama `feature/deploy-v0` desde `develop`, con `feature/real-calls-validation` (bench, prompt capa 2 v2.7 y validación con 100 llamadas reales) y `feature/frontend-mock` (front Next.js con API mock, diseño UX fases 0–8 y bench de ASR).
- **Prompt capa 2:** pasa a ser una fuente versionada en `prompts/layer2/prompt.yaml`, con el origen de cada regla. La versión sigue siendo la 2.7.
- **Bench:** `share_dashboard.py --no-audio` permite compartir el dashboard solo con las transcripciones.
- **Diseño:** el cambio 09 queda aprobado (`docs/ux/call-audit/09-cambio-auditoria-ia.md`). Incluye:
  - las notas por motivo;
  - el panel "Prompt y respuesta del modelo";
  - la vista Discrepancias para el supervisor;
  - el veredicto del cliente como dato opcional.
- **Evaluación (weekly):**
  - Gemini 3.8 Flash y Sonnet 5.5 quedan como finalistas, con un 70 % y un 68 % de acierto contra 50 llamadas auditadas a mano.
  - Haiku 5.5 y GPT-6 Luna se descartan porque rechazan de más.
  - La elección final se hará con el servicio ya desplegado.
