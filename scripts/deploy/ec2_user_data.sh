#!/bin/bash
# Primer arranque del EC2 (Amazon Linux 2023): Docker y el plugin compose.
set -euxo pipefail
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v2.39.2/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
mkdir -p /opt/call-audit && chown ec2-user:ec2-user /opt/call-audit
