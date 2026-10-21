#!/usr/bin/env bash
# Construye las imágenes en el PC, las copia al EC2 por SSH y levanta el compose de producción. Requiere haber corrido
# aws_setup.sh (deja .deploy/deploy.env) y Docker Desktop.
#   bash scripts/deploy/deploy.sh             (desde call-audit-rcv)
#
# Las imágenes viajan con "docker save | docker load" en vez de pasar por ECR: en Windows, "docker login" a ECR falla
# porque el token es más largo de lo que acepta el almacén de credenciales ("The stub received bad data").
set -euo pipefail
source .deploy/deploy.env
TAG=$(git rev-parse --short HEAD)$(git diff --quiet -- . ':!prompts' ':!docs' ':!scripts/prompt_bench' || echo -dirty)
API_IMAGE="$NAME-api:$TAG"
WORKER_IMAGE="$NAME-worker:$TAG"
FRONT_IMAGE="$NAME-front:$TAG"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$HOST")

# El worker (pipeline SFTP → ASR → capa 2) necesita la llave de Gemini, la cuenta SFTP de S4P y el catálogo de
# productos (no está en git).
for var in GEMINI_API_KEY SFTP_HOST SFTP_USER SFTP_PASSWORD SFTP_HOST_KEY; do
  grep -q "^$var=." .deploy/server.env || { echo "Falta $var=... en .deploy/server.env (docs/deploy.md)"; exit 1; }
done
[ -f data/catalog/products.json ] || { echo "Falta data/catalog/products.json (extract_catalog.py)"; exit 1; }

docker build --platform linux/amd64 --target api -t "$API_IMAGE" .
docker build --platform linux/amd64 --target worker -t "$WORKER_IMAGE" .
# El front reenvía /api/* al servicio "api" del compose (red interna de Docker).
docker build --platform linux/amd64 -t "$FRONT_IMAGE" --build-arg API_URL=http://api:8000 frontend

"${SSH[@]}" "cloud-init status --wait >/dev/null"
echo "Copiando imágenes al servidor..."
docker save "$API_IMAGE" "$WORKER_IMAGE" "$FRONT_IMAGE" | gzip -1 | "${SSH[@]}" "gunzip | docker load"

scp -i "$KEY" docker-compose.prod.yml Caddyfile "ec2-user@$HOST:/opt/call-audit/"
scp -i "$KEY" .deploy/server.env "ec2-user@$HOST:/opt/call-audit/.env"
"${SSH[@]}" "chmod 600 /opt/call-audit/.env && cd /opt/call-audit \
  && sudo install -d -o 10001 -g 10001 -m 750 /opt/call-audit/work   && API_IMAGE=$API_IMAGE WORKER_IMAGE=$WORKER_IMAGE FRONT_IMAGE=$FRONT_IMAGE DOMAIN=$DOMAIN docker compose -f docker-compose.prod.yml up -d \
  && docker image prune -f"

echo "Desplegado $TAG en https://$DOMAIN"
echo "Túnel para cargar datos al RDS: ssh -i $KEY -N -L 5434:$DB_HOST:5432 ec2-user@$HOST"
