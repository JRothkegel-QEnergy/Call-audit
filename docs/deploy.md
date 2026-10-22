# Despliegue v0 en AWS

Objetivo: que Vero y el equipo externo revisen las llamadas de la calibración desde una URL con login. Es la API
delgada sobre las corridas del bench, sin pipeline.

## Arquitectura

```
navegador ──HTTPS──> EC2 (Caddy :443) ──> front (Next, :3000) ──/api/*──> api (FastAPI, :8000) ──> RDS Postgres
                                                                              └── URL firmadas ──> S3 (audios)
```

- **Dominio: `audit.qubicoenergy.com`.** Un solo dominio: Next reenvía `/api/*` a la API. La cookie de sesión es del mismo origen, así que no hace falta CORS y basta `COOKIE_SAMESITE=lax`.
- **Región sa-east-1 (São Paulo):** es donde ya está el bucket de los audios. Que el dato salga de Chile sigue abierto con el cliente (`docs/client-open-questions.md`, registro legal L-02).
- **Datos sin enmascarar en el front:** es una decisión de Johannes (registro legal L-34). El DPA y la confidencialidad de los externos siguen pendientes (L-28).

## Pasos

Los scripts de `scripts/deploy/` hacen todo con la CLI de AWS y Docker Desktop. Guardan las llaves y los secretos
en `.deploy/`, que está ignorado por git.

1. **Credenciales de AWS en la CLI:** `aws configure sso` o `aws configure`. El usuario necesita poder crear recursos de ECR, EC2, RDS e IAM en sa-east-1.
2. **Crear la infraestructura** (genera costo mensual):
   ```bash
   bash scripts/deploy/aws_setup.sh
   ```
   El script crea:
   - repositorios de ECR para las dos imágenes;
   - security groups: 80/443 públicos, 22 solo desde tu IP y 5432 solo desde el EC2;
   - un rol IAM para el EC2, con lectura de ECR y `s3:GetObject` sobre `qubico-call-audit/audios/*`;
   - el RDS Postgres 16: privado, cifrado, con 7 días de backups y protegido contra borrado;
   - el EC2 Amazon Linux 2023 con Docker y una IP elástica.

   Al final escribe `.deploy/server.env` con `DATABASE_URL`, `SESSION_SECRET` y `COOKIE_SECURE=true`.
3. **DNS:** crea el registro A `audit.qubicoenergy.com` apuntando a la IP que imprime el script, donde esté administrado `qubicoenergy.com`. Caddy pide el certificado HTTPS cuando el DNS ya resuelve.
4. **Desplegar** (se repite en cada versión nueva):
   ```bash
   bash scripts/deploy/deploy.sh
   ```
   Construye las imágenes en el PC, las copia al EC2 por SSH (`docker save | docker load`), copia `docker-compose.prod.yml`, `Caddyfile` y `.env`, y levanta todo. La API aplica las migraciones al arrancar. No pasa por ECR: en Windows, `docker login` a ECR falla porque el token es más largo de lo que acepta el almacén de credenciales. Los repositorios de ECR que crea `aws_setup.sh` quedan sin uso.
5. **Cargar los datos desde el PC con los datos**, por un túnel SSH al RDS. El túnel lo imprime `deploy.sh`; se deja abierto en otra terminal mientras se carga:
   ```bash
   DATABASE_URL=postgresql+psycopg://audit:<clave de .deploy/db_password>@localhost:5433/audit      uv run python -m call_audit.ingestion.import_bench --out ../transcripts/layer2_real_100_v2.7        --metadata "../audios/Retenciones BECS Para Revision.xlsx" --catalog ../call-audit/data/catalog/products.json        --label v2.7 --current-model gemini-3-8-flash --asr-dir ../transcripts/asr_bench        --reviews ../transcripts/layer2_real_100_v2.7/revision_capa2.csv --reviewer <tu email>
   ```
   Repetir con `--out ../transcripts/layer2_real_100_v2.7_r2 --label "v2.7 corrida 2"`, sin `--current-model` ni `--reviews`.
6. **Cuentas** (L-33: la contraseña inicial va por un canal distinto del correo y se rota al cerrar la calibración):
   ```bash
   DATABASE_URL=... uv run python -m call_audit.admin create-user --email <correo> --name "<nombre>" --role auditor --model-io
   ```
   Tu cuenta va primero, con `--role supervisor --model-io`; `--reviews` la necesita.
7. **Prueba antes de compartir:** entrar con una cuenta de prueba, abrir una llamada, escuchar el audio, guardar una nota y recargar.

## Pipeline automático (SFTP → ASR → capa 2)

```
S4P ──deja audios .mp3 + metadata .xlsx/.csv──> SFTP de S4P (cuenta existente)
worker (EC2, cada 15 min) ──SFTP──> baja lo nuevo ──> Gemini ASR ──> <carpeta>/output/<grabación>.json en el SFTP
                          ──> prompt capa 2 (Gemini) ──> RDS + audio a S3 (la app lo reproduce desde S3)
```

- **Qué hace cada pasada:** está en el docstring de `src/call_audit/ingestion/pipeline.py`. Lo procesado (audio y su `.json`) queda en `output/`, y también cada archivo de metadata cuando todas sus grabaciones terminaron; en la carpeta quedan solo los pendientes. Un audio sin fila de metadata espera; uno con `output/<grabación>.json` no se vuelve a transcribir; una grabación que ya tiene corrida "automático" no se vuelve a validar, ni siquiera cuando cambia el prompt (eso se decide a mano).
- **Metadata:** las mismas columnas del Excel "Retenciones BECS", con el nombre del archivo sin extensión en la primera columna. Si no viene `ID` ni `FECHA_GESTION`, se sacan del nombre (`<n>_<AAAAMMDD>_<id>.mp3`). Si no viene `TIPIFICACION`, se asume `RETENCION`.
- **Cuenta SFTP** (variables en `.env` para local y en `.deploy/server.env` para el EC2; las escribes tú, no van al chat ni a git):
  ```
  SFTP_HOST=...           # servidor de S4P
  SFTP_PORT=22
  SFTP_USER=...
  SFTP_PASSWORD=...
  SFTP_DIR=.              # carpeta de los audios, relativa al inicio de la cuenta
  SFTP_HOST_KEY=...       # sale de: uv run python -m call_audit.ingestion.pipeline --host-key
  ```
  En el servidor (EC2 `sftp-s4p`, sa-east-1, Ubuntu), `qubico` está enjaulado en `/sftp/qubico` y ve la carpeta de S4P (`/sftp/s4p/upload`) por un montaje `bind,ro`. Para que el pipeline pueda escribir `output/` y mover ahí los audios procesados, `/etc/fstab` tiene encima un `bind` de escritura solo de `Retenciones A Evaluar` (2026-10-21; respaldos en `/etc/fstab.bak-*`), y esa carpeta tiene `770` (grupo `sftpusers`):
  ```
  /sftp/s4p/upload/Retenciones A Evaluar /sftp/qubico/s4p/Retenciones A Evaluar none bind 0 0
  ```
  La llave del servidor se fija para que el worker no le entregue la contraseña a un servidor impostor.
  Las grabaciones que ya estaban en la app se movieron sin gastar con `--adopt ../transcripts/asr_bench`: usa la transcripción del bench para su `.json`. Si S4P la cambia, el worker deja de conectarse hasta actualizarla. `--list` muestra qué ve en la carpeta sin procesar nada.
- **Puesta en marcha** (una vez):
  1. Agregar `GEMINI_API_KEY` y las `SFTP_*` a `.deploy/server.env`. `deploy.sh` no despliega sin ellas.
  2. El security group `sftp-s4p-sg` del servidor SFTP solo abre el puerto 22 a IP puntuales: tiene que incluir la IP del EC2 (`HOST` en `.deploy/deploy.env`, hoy `54.232.204.96/32`, regla "call-audit worker", agregada el 2026-10-22).
  3. `bash scripts/deploy/aws_setup.sh`: le da al EC2 permiso de subir audios a S3.
  4. `bash scripts/deploy/deploy.sh`: construye y levanta también el worker.
- **Ver qué hace:** `ssh -i .deploy/call-audit-admin.pem ec2-user@<IP> "cd /opt/call-audit && docker compose -f docker-compose.prod.yml logs -f worker"`. Los prompts y respuestas de cada pasada quedan en `/opt/call-audit/work/runs/`, y las fallas de ASR en `/opt/call-audit/work/asr_failures.json`.
- **En local sin SFTP:** sin `SFTP_HOST`, lee de `PIPELINE_LOCAL_DIR` (audios y metadata en la raíz). Necesita `GEMINI_API_KEY` y `data/catalog/products.json`.

## Catálogo de seguros (Cambio 11)

- **Una vez, después del deploy que trae la migración 0002:** cargar los 66 seguros actuales como v1, desde el worker (tiene `products.json` en la imagen):
  ```bash
  ssh -i .deploy/call-audit-admin.pem ec2-user@<IP> "docker exec call-audit-worker-1 python -m call_audit.catalog seed --file data/catalog/products.json"
  ```
  Desde ahí el worker valida con el catálogo de la base; `products.json` queda solo como respaldo si la base está vacía.
- **Permiso para gestionarlo** (solo supervisores): `python -m call_audit.admin grant --email <correo> --permission manage_catalog` (por el túnel al RDS, o con `docker exec call-audit-api-1 ...`).
- Las cargas de Excel las procesa el worker cada 15 s; el Excel original queda en la base (`catalog_uploads.content`) hasta que se descarta la carga.

**Bajar todo al terminar la calibración:** borrar el EC2, liberar la IP elástica y borrar el RDS (primero se quita
`--deletion-protection`). Los audios quedan en S3, como antes.

## Probar lo mismo en local

```bash
docker compose up --build      # Postgres + API + front en http://localhost:3200
```
