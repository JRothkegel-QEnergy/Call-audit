# Historial de cambios · Call Audit

Una entrada por fecha, con lo que cambió en la app, en los datos y en los prompts, y por qué.

Cada componente tiene además su propio historial detallado:
- Prompt de la capa 2: `prompts/layer2/CHANGELOG.md` (una entrada por versión, con métricas).
- Prompt de verificación de afirmaciones: historial al final de `docs/layer2-claims-prompt.md`.
- Diseño del front: `docs/ux/call-audit/estado.md` (fases y cambios aprobados).

## 2026-10-20

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
