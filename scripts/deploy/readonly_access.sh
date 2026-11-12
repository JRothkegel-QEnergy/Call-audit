#!/usr/bin/env bash
# Publica el visor SQL de solo lectura en https://<dominio>/db (guía: docs/db-readonly-access.md). Se puede correr de
# nuevo; por ejemplo, después de una migración que agregue tablas.
#   bash scripts/deploy/readonly_access.sh      (desde call-audit-rcv, con Docker Desktop)
#
# Crea el usuario de Postgres qubico_readonly, deja la configuración en .deploy/server.env y levanta solo pgweb y Caddy,
# sin tocar la API, el worker ni el front. Las claves quedan en .deploy/ (ignorado por git) y no se imprimen.
set -euo pipefail
source .deploy/deploy.env
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$HOST")
WEB_USER=consulta

secret() {  # secret <archivo>: crea la clave si no existe
  if [ ! -f "$1" ]; then
    python -c "import secrets; print(secrets.token_urlsafe(24))" > "$1"
    chmod 600 "$1"
  fi
}
secret .deploy/readonly_db_password
secret .deploy/pgweb_password
DB_PASSWORD=$(tr -d '\r\n' < .deploy/readonly_db_password)
WEB_PASSWORD=$(tr -d '\r\n' < .deploy/pgweb_password)

# --- 1. Usuario de Postgres ---------------------------------------------------------------------------------------
{ printf "RO_PASSWORD = '%s'\n" "$DB_PASSWORD"; cat scripts/deploy/grant_readonly.py; } \
  | "${SSH[@]}" "docker exec -i $NAME-api-1 python -"

# --- 2. Configuración en server.env ---------------------------------------------------------------------------------
HASH=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$WEB_PASSWORD" | tr -d '\r\n')
sed -i '/^PGWEB_DATABASE_URL=/d;/^PGWEB_USER=/d;/^PGWEB_AUTH_HASH=/d' .deploy/server.env
{
  echo "PGWEB_DATABASE_URL=postgresql://qubico_readonly:$DB_PASSWORD@$DB_HOST:5432/audit?sslmode=require"
  echo "PGWEB_USER=$WEB_USER"
  echo "PGWEB_AUTH_HASH='$HASH'"  # comillas simples: el hash trae signos $
} >> .deploy/server.env

# --- 3. Levantar pgweb y Caddy con las imágenes que ya están corriendo --------------------------------------------------
scp -i "$KEY" docker-compose.prod.yml Caddyfile "ec2-user@$HOST:/opt/call-audit/"
scp -i "$KEY" .deploy/server.env "ec2-user@$HOST:/opt/call-audit/.env"
"${SSH[@]}" "set -e; chmod 600 /opt/call-audit/.env; cd /opt/call-audit
  image() { docker inspect -f '{{.Config.Image}}' $NAME-\$1-1; }
  API_IMAGE=\$(image api) WORKER_IMAGE=\$(image worker) FRONT_IMAGE=\$(image front) DOMAIN=$DOMAIN \
    docker compose -f docker-compose.prod.yml up -d --no-deps pgweb caddy"

echo
echo "Listo: https://$DOMAIN/db/ · usuario: $WEB_USER · clave en .deploy/pgweb_password (no la mandes junto con el enlace)."
