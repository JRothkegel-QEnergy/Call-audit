#!/usr/bin/env bash
# Construye las imágenes en el PC, las sube a ECR y actualiza el EC2. Requiere haber corrido aws_setup.sh.
#   bash scripts/deploy/deploy.sh             (desde call-audit-rcv, con Docker Desktop y credenciales de AWS)
set -euo pipefail
source .deploy/deploy.env
TAG=$(git rev-parse --short HEAD)$(git diff --quiet || echo -dirty)
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
API_IMAGE="$REGISTRY/$NAME-api:$TAG"
FRONT_IMAGE="$REGISTRY/$NAME-front:$TAG"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$HOST")

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker build --platform linux/amd64 -t "$API_IMAGE" .
# El front reenvía /api/* al servicio "api" del compose (red interna de Docker).
docker build --platform linux/amd64 -t "$FRONT_IMAGE" --build-arg API_URL=http://api:8000 frontend
docker push "$API_IMAGE"
docker push "$FRONT_IMAGE"

"${SSH[@]}" "cloud-init status --wait >/dev/null"
scp -i "$KEY" docker-compose.prod.yml Caddyfile "ec2-user@$HOST:/opt/call-audit/"
scp -i "$KEY" .deploy/server.env "ec2-user@$HOST:/opt/call-audit/.env"
"${SSH[@]}" "cloud-init status --wait >/dev/null && chmod 600 /opt/call-audit/.env && cd /opt/call-audit \
  && aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $REGISTRY \
  && API_IMAGE=$API_IMAGE FRONT_IMAGE=$FRONT_IMAGE DOMAIN=$DOMAIN docker compose -f docker-compose.prod.yml up -d \
  && docker image prune -f"

echo "Desplegado $TAG en https://$DOMAIN"
echo "Túnel para cargar datos al RDS: ssh -i $KEY -N -L 5433:$DB_HOST:5432 ec2-user@$HOST"
