#!/usr/bin/env bash
# Idempotent: exposes Node API on HTTPS host API_PUBLIC_HOST (e.g. api.example.ru).
# Requires passwordless sudo for nginx/certbot on the VPS (typical for deploy user).
# Set API_PUBLIC_HOST (and optionally CERTBOT_EMAIL) in the environment.
set -euo pipefail

API_PUBLIC_HOST="${API_PUBLIC_HOST:-}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [ -z "$API_PUBLIC_HOST" ]; then
  echo "[install-api-proxy] API_PUBLIC_HOST is empty — skip (set GitHub secret API_PUBLIC_HOST to enable)."
  exit 0
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "[install-api-proxy] sudo not found" >&2
  exit 1
fi

SUDO=(sudo)
if sudo -n true 2>/dev/null; then
  SUDO=(sudo -n)
fi

UPSTREAM_HOST="${API_UPSTREAM_HOST:-127.0.0.1}"
UPSTREAM_PORT="${API_UPSTREAM_PORT:-8787}"

install_debian_packages() {
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "[install-api-proxy] apt-get not found — install nginx + certbot manually, then re-run." >&2
    exit 1
  fi
  "${SUDO[@]}" apt-get update -qq
  DEBIAN_FRONTEND=noninteractive "${SUDO[@]}" apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null
}

if ! command -v nginx >/dev/null 2>&1; then
  echo "[install-api-proxy] Installing nginx + certbot..."
  install_debian_packages
fi

CONF_NAME="site-api-${API_PUBLIC_HOST}.conf"
CONF_PATH="/etc/nginx/sites-available/${CONF_NAME}"
ENABLED="/etc/nginx/sites-enabled/${CONF_NAME}"

echo "[install-api-proxy] Writing ${CONF_PATH}"
"${SUDO[@]}" tee "${CONF_PATH}" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${API_PUBLIC_HOST};

    client_max_body_size 12m;

    location / {
        proxy_pass http://${UPSTREAM_HOST}:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

"${SUDO[@]}" ln -sf "${CONF_PATH}" "${ENABLED}"
echo "[install-api-proxy] Enabling site: ${ENABLED}"

"${SUDO[@]}" nginx -t
"${SUDO[@]}" systemctl reload nginx || "${SUDO[@]}" service nginx reload

CERT_PATH="/etc/letsencrypt/live/${API_PUBLIC_HOST}/fullchain.pem"
if [ -f "${CERT_PATH}" ]; then
  echo "[install-api-proxy] TLS cert already present: ${CERT_PATH}"
  exit 0
fi

if [ -z "${CERTBOT_EMAIL}" ]; then
  echo "[install-api-proxy] No TLS cert yet. Set GitHub secret CERTBOT_EMAIL to obtain Let's Encrypt on next deploy (DNS A for ${API_PUBLIC_HOST} must point to this VPS)."
  exit 0
fi

echo "[install-api-proxy] Requesting certificate for ${API_PUBLIC_HOST} (certbot)..."
set +e
"${SUDO[@]}" certbot --nginx \
  -d "${API_PUBLIC_HOST}" \
  --non-interactive \
  --agree-tos \
  -m "${CERTBOT_EMAIL}" \
  --redirect
CERT_STATUS=$?
set -e

if [ "${CERT_STATUS}" -ne 0 ]; then
  echo "[install-api-proxy] certbot failed (exit ${CERT_STATUS}). Check DNS A for ${API_PUBLIC_HOST} → this server and port 80 reachable, then re-run deploy." >&2
  exit 0
fi

"${SUDO[@]}" nginx -t
"${SUDO[@]}" systemctl reload nginx || "${SUDO[@]}" service nginx reload
echo "[install-api-proxy] Done. HTTPS should be active for https://${API_PUBLIC_HOST}"
