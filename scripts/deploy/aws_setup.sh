#!/usr/bin/env bash
# Crea la infraestructura del despliegue v0 en AWS (docs/deploy.md). Se puede correr de nuevo: lo que ya existe se
# reutiliza. Crea recursos con costo mensual (RDS, EC2, IP elástica): revisa los tipos de instancia antes de correrlo.
#
#   bash scripts/deploy/aws_setup.sh            (desde call-audit-rcv, con credenciales de AWS en la CLI)
#
# Deja en .deploy/ (ignorado por git): la llave SSH, la contraseña del RDS y deploy.env con lo que usa deploy.sh.
set -euo pipefail
# Git Bash (Windows) convierte rutas como /aws/service/... en rutas de Windows: se desactiva.
export MSYS_NO_PATHCONV=1

REGION="${REGION:-sa-east-1}"
NAME="${NAME:-call-audit}"
DOMAIN="${DOMAIN:-audit.qubicoenergy.com}"
BUCKET="${BUCKET:-qubico-call-audit}"
AUDIO_PREFIX="${AUDIO_PREFIX:-audios/}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"    # x86_64: las imágenes se construyen en el PC (amd64)
DB_CLASS="${DB_CLASS:-db.t4g.micro}"
DB_NAME=audit
DB_USER=audit
STATE=.deploy
mkdir -p "$STATE"
aws() { command aws --region "$REGION" "$@"; }

echo "Cuenta: $(aws sts get-caller-identity --query Account --output text) · región $REGION"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
MY_IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')

# --- ECR: repositorios de las dos imágenes ---------------------------------------------------------
for repo in "$NAME-api" "$NAME-front"; do
  aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$repo" --image-scanning-configuration scanOnPush=true >/dev/null
done

# --- Red: VPC por defecto y security groups --------------------------------------------------------
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
sg() {  # sg <nombre> <descripción> → id
  local id
  id=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$1" Name=vpc-id,Values="$VPC" \
    --query 'SecurityGroups[0].GroupId' --output text)
  if [ "$id" = "None" ]; then
    id=$(aws ec2 create-security-group --group-name "$1" --description "$2" --vpc-id "$VPC" --query GroupId --output text)
  fi
  echo "$id"
}
allow() { aws ec2 authorize-security-group-ingress "$@" >/dev/null 2>&1 || true; }  # ya existe = ok
SG_WEB=$(sg "$NAME-web" "Call Audit: HTTPS publico, SSH solo admin")
SG_DB=$(sg "$NAME-db" "Call Audit: Postgres solo desde el servidor web")
allow --group-id "$SG_WEB" --protocol tcp --port 80 --cidr 0.0.0.0/0
allow --group-id "$SG_WEB" --protocol tcp --port 443 --cidr 0.0.0.0/0
allow --group-id "$SG_WEB" --protocol tcp --port 22 --cidr "$MY_IP/32"
allow --group-id "$SG_DB" --protocol tcp --port 5432 --source-group "$SG_WEB"

# --- IAM: rol del EC2 (leer imágenes de ECR y audios de S3) -----------------------------------------
ROLE="$NAME-ec2"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
  aws iam create-instance-profile --instance-profile-name "$ROLE" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$ROLE" --role-name "$ROLE"
  sleep 10  # el perfil tarda en propagarse
fi
# La API lee los audios y el worker sube ahí los que baja del SFTP de S4P.
aws iam put-role-policy --role-name "$ROLE" --policy-name read-audios --policy-document \
  "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUCKET/$AUDIO_PREFIX*\"}]}"

# --- RDS Postgres (privado, cifrado, con backups) --------------------------------------------------
DB_ID="$NAME-db"
if [ ! -f "$STATE/db_password" ]; then
  python -c "import secrets; print(secrets.token_urlsafe(24))" > "$STATE/db_password"
fi
DB_PASSWORD=$(cat "$STATE/db_password")
if ! aws rds describe-db-instances --db-instance-identifier "$DB_ID" >/dev/null 2>&1; then
  aws rds create-db-instance --db-instance-identifier "$DB_ID" --engine postgres --engine-version 16 \
    --db-instance-class "$DB_CLASS" --allocated-storage 20 --storage-type gp3 --storage-encrypted \
    --master-username "$DB_USER" --master-user-password "$DB_PASSWORD" --db-name "$DB_NAME" \
    --vpc-security-group-ids "$SG_DB" --no-publicly-accessible --backup-retention-period 7 \
    --deletion-protection >/dev/null
  echo "RDS creándose (tarda varios minutos)..."
fi

# --- EC2 con Docker --------------------------------------------------------------------------------
KEY="$NAME-admin"
if [ ! -f "$STATE/$KEY.pem" ]; then
  aws ec2 create-key-pair --key-name "$KEY" --query KeyMaterial --output text > "$STATE/$KEY.pem"
  chmod 600 "$STATE/$KEY.pem"
fi
INSTANCE=$(aws ec2 describe-instances --filters Name=tag:Name,Values="$NAME" Name=instance-state-name,Values=pending,running,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$INSTANCE" = "None" ]; then
  AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text)
  INSTANCE=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$INSTANCE_TYPE" --key-name "$KEY" \
    --security-group-ids "$SG_WEB" --iam-instance-profile Name="$ROLE" \
    --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3,Encrypted=true}' \
    --metadata-options HttpTokens=required \
    --user-data file://scripts/deploy/ec2_user_data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
    --query 'Instances[0].InstanceId' --output text)
fi
aws ec2 wait instance-running --instance-ids "$INSTANCE"

EIP=$(aws ec2 describe-addresses --filters Name=tag:Name,Values="$NAME" --query 'Addresses[0].PublicIp' --output text)
if [ "$EIP" = "None" ]; then
  ALLOC=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" --query AllocationId --output text)
  aws ec2 associate-address --instance-id "$INSTANCE" --allocation-id "$ALLOC" >/dev/null
  EIP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)
fi

aws rds wait db-instance-available --db-instance-identifier "$DB_ID"
DB_HOST=$(aws rds describe-db-instances --db-instance-identifier "$DB_ID" --query 'DBInstances[0].Endpoint.Address' --output text)

# --- Estado para deploy.sh y .env del servidor ------------------------------------------------------
cat > "$STATE/deploy.env" <<EOF
REGION=$REGION
ACCOUNT=$ACCOUNT
NAME=$NAME
DOMAIN=$DOMAIN
HOST=$EIP
KEY=$STATE/$KEY.pem
DB_HOST=$DB_HOST
EOF
if [ ! -f "$STATE/server.env" ]; then
  cat > "$STATE/server.env" <<EOF
DATABASE_URL=postgresql+psycopg://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME
SESSION_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(48))")
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
S3_BUCKET=$BUCKET
S3_PREFIX=$AUDIO_PREFIX
AWS_REGION=$REGION
EOF
fi

echo
echo "Listo. Falta el DNS: crea un registro A  $DOMAIN → $EIP  donde esté el dominio qubicoenergy.com."
echo "Después: bash scripts/deploy/deploy.sh"
