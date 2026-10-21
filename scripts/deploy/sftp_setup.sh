#!/usr/bin/env bash
# Crea (o actualiza) el usuario SFTP del cliente en el EC2. Se puede correr de nuevo.
#
#   bash scripts/deploy/sftp_setup.sh [llave_publica.pub]      (desde call-audit-rcv, después de aws_setup.sh)
#
# El usuario queda enjaulado en /srv/sftp/<usuario>: solo SFTP (sin shell ni túneles), solo con llave, y ve dos
# carpetas: input/ (sube audios .mp3 y la metadata .xlsx/.csv) y output/ (transcripción + metadata por audio).
# Sin argumento genera una llave de prueba en .deploy/sftp-<usuario> para probar nosotros; la del cliente se agrega
# corriendo el script con su .pub (se suma a las existentes). Las IP del cliente se abren en el puerto 22 con
# SFTP_CIDRS en aws_setup.sh.
set -euo pipefail
source .deploy/deploy.env
SFTP_USER="${SFTP_USER:-bancoestado}"
PUBKEY="${1:-}"
if [ -z "$PUBKEY" ]; then
  PUBKEY=".deploy/sftp-$SFTP_USER.pub"
  [ -f ".deploy/sftp-$SFTP_USER" ] || ssh-keygen -t ed25519 -N "" -C "sftp-$SFTP_USER-prueba" -f ".deploy/sftp-$SFTP_USER"
fi
KEY_LINE=$(cat "$PUBKEY")

# uid 10001 = usuario "app" de la imagen del worker: el worker lee input/ y escribe output/ sin cambiar permisos.
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@$HOST" sudo bash -s -- "$SFTP_USER" "$KEY_LINE" <<'REMOTE'
set -euo pipefail
user="$1"; key="$2"
groupadd -f sftponly
id "$user" >/dev/null 2>&1 || useradd --uid 10001 --gid sftponly --no-create-home --home-dir / --shell /sbin/nologin "$user"
# La raíz del chroot tiene que ser de root y sin escritura para otros (exigencia de sshd).
install -d -o root -g root -m 755 /srv/sftp "/srv/sftp/$user"
install -d -o "$user" -g sftponly -m 770 "/srv/sftp/$user/input" "/srv/sftp/$user/output"
install -d -o root -g root -m 755 /etc/ssh/sftp_keys
touch "/etc/ssh/sftp_keys/$user"
grep -qxF "$key" "/etc/ssh/sftp_keys/$user" || echo "$key" >> "/etc/ssh/sftp_keys/$user"
chown root:root "/etc/ssh/sftp_keys/$user"; chmod 644 "/etc/ssh/sftp_keys/$user"
# El bloque Match va al final de sshd_config: todo lo que venga después de un Match queda dentro de él.
if ! grep -q "^Match Group sftponly" /etc/ssh/sshd_config; then
  cat >> /etc/ssh/sshd_config <<'EOF'

# SFTP de clientes (scripts/deploy/sftp_setup.sh)
Match Group sftponly
    ChrootDirectory /srv/sftp/%u
    ForceCommand internal-sftp -u 0007
    AuthorizedKeysFile /etc/ssh/sftp_keys/%u
    PasswordAuthentication no
    AllowTcpForwarding no
    X11Forwarding no
EOF
fi
sshd -t
systemctl reload sshd
echo "SFTP listo: usuario $user, carpetas input/ y output/"
REMOTE

echo "Prueba: sftp -i .deploy/sftp-$SFTP_USER $SFTP_USER@$HOST   (o $SFTP_USER@$DOMAIN)"
