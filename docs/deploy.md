# Despliegue v0 en AWS

Objetivo: que Vero y el equipo externo revisen las llamadas de la calibración desde una URL con login. Es la API
delgada sobre las corridas del bench, sin pipeline.

## Arquitectura

```
navegador ──HTTPS──> EC2 (Caddy :443) ──> front (Next, :3000) ──/api/*──> api (FastAPI, :8000) ──> RDS Postgres
                                                                              └── URL firmadas ──> S3 (audios)
```

- **Un solo dominio:** Next reenvía `/api/*` a la API. La cookie de sesión es del mismo origen, así que no hace falta CORS y basta `COOKIE_SAMESITE=lax`.
- **Región sa-east-1 (São Paulo):** es donde ya está el bucket de los audios. Que el dato salga de Chile sigue abierto con el cliente (`docs/client-open-questions.md`, registro legal L-02).
- **Datos sin enmascarar en el front:** es una decisión de Johannes (registro legal L-34). El DPA y la confidencialidad de los externos siguen pendientes (L-28).

## Pasos

1. **RDS Postgres 16, instancia chica:**
   - sin acceso público;
   - security group que solo acepte el puerto 5432 desde el EC2;
   - backups automáticos activados.
2. **EC2 (Amazon Linux 2023)** con Docker y el plugin compose:
   - Abrir los puertos 80 y 443.
   - Abrir el 22 solo para tu IP.
   - Asociarle un rol IAM con `s3:GetObject` sobre `arn:aws:s3:::<bucket>/audios/*`. Las URL firmadas con credenciales de rol duran lo que dura la sesión del rol (hasta ~6 h, ver `share_dashboard.py`), y la API las firma por 1 hora (`AUDIO_URL_TTL_SEC`).
3. **DNS:** un registro A, por ejemplo `audit.qubicoenergy.com`, que apunte a la IP elástica del EC2.
4. **En el EC2**, crear `.env` (nunca se commitea):
   ```
   DATABASE_URL=postgresql+psycopg://USUARIO:CLAVE@<endpoint-rds>:5432/audit
   SESSION_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(48))">
   COOKIE_SECURE=true
   S3_BUCKET=qubico-call-audit
   S3_PREFIX=audios/
   AWS_REGION=sa-east-1
   ```
5. **Construir y levantar** con `docker-compose.prod.yml` (API + front + Caddy; usa el RDS, no el Postgres local):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   La API aplica las migraciones al arrancar, y Caddy obtiene el certificado HTTPS solo.
6. **Cargar los datos desde el PC con los datos.** Se hace por un túnel SSH al RDS, porque el RDS no es público:
   ```bash
   ssh -N -L 5433:<endpoint-rds>:5432 ec2-user@<ip-ec2>
   DATABASE_URL=postgresql+psycopg://USUARIO:CLAVE@localhost:5433/audit uv run python -m call_audit.ingestion.import_bench \
       --out ../transcripts/layer2_real_100_v2.7 --metadata "../audios/Retenciones BECS Para Revision.xlsx" \
       --catalog ../call-audit/data/catalog/products.json --label v2.7 --current-model gemini-3-8-flash \
       --asr-dir ../transcripts/asr_bench --reviews ../transcripts/layer2_real_100_v2.7/revision_capa2.csv --reviewer <tu email>
   ```
   Repetir con `--label "v2.7 corrida 2"` para la segunda corrida (sin `--current-model`).
7. **Cuentas** (L-33: la contraseña inicial va por un canal distinto del correo y se rota al cerrar la calibración):
   ```bash
   DATABASE_URL=... uv run python -m call_audit.admin create-user --email <correo> --name "<nombre>" --role auditor --model-io
   ```
8. **Prueba antes de compartir:** entrar con una cuenta de prueba, abrir una llamada, escuchar el audio, guardar una nota y recargar.

## Probar lo mismo en local

```bash
docker compose up --build      # Postgres + API + front en http://localhost:3200
```
