#!/usr/bin/env bash
# Crea una cuenta invitada en producción e imprime el enlace /invite/<token> (vence en 72 h). No manda correo.
#   bash scripts/deploy/invite_link.sh <correo> "<nombre>" [rol]      (desde call-audit-rcv; rol por defecto: qubico_admin)
set -euo pipefail
[ $# -ge 2 ] || { echo "Uso: bash scripts/deploy/invite_link.sh <correo> \"<nombre>\" [rol]"; exit 1; }
source .deploy/deploy.env

args=""
for value in "$@"; do args+=" $(printf %q "$value")"; done
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$HOST" \
  "docker exec -i $NAME-api-1 python -$args" < scripts/deploy/issue_invite.py
