#!/usr/bin/env bash
# Bootstrap EC2 Ubuntu 22.04/24.04 (t3.micro free tier) — API x4 match + Neon.
# Uso (como ubuntu, con sudo):
#   curl -fsSL ... | bash   OR
#   bash infra/aws/setup-ec2.sh api.tudominio.com
set -euo pipefail

API_DOMAIN="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/x4match/x4-match.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/x4match}"

if [[ -z "$API_DOMAIN" ]]; then
  echo "Uso: $0 <api-domain>"
  echo "Ej:  $0 api.x4match.com"
  exit 1
fi

echo "==> Dominio API: $API_DOMAIN"
echo "==> App dir: $APP_DIR"

# Swap 2G (build en t3.micro sin OOM)
if ! swapon --show | grep -q .; then
  echo "==> Creando swap 2G..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Paquetes base..."
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates debian-keyring debian-archive-keyring apt-transport-https

# Node 20 via NodeSource
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20* ]]; then
  echo "==> Instalando Node 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> Instalando pnpm..."
  sudo npm install -g pnpm@10
fi

# Caddy
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Instalando Caddy..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi

echo "==> Clonando / actualizando repo..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$REPO_BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$REPO_BRANCH"
else
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

if [[ ! -f "$APP_DIR/apps/api/.env" ]]; then
  cp "$APP_DIR/infra/aws/env.example" "$APP_DIR/apps/api/.env"
  # Rellenar URLs con el dominio pasado
  sed -i "s|https://api.tudominio.com|https://${API_DOMAIN}|g" "$APP_DIR/apps/api/.env"
  chmod 600 "$APP_DIR/apps/api/.env"
  echo ""
  echo ">>> Editá secrets en: $APP_DIR/apps/api/.env"
  echo ">>> Pegá DATABASE_URL de Neon y el resto de keys, luego:"
  echo ">>>   $APP_DIR/infra/aws/deploy.sh"
  echo ""
fi

# Caddyfile
sudo mkdir -p /etc/caddy
sed "s/\${API_DOMAIN}/${API_DOMAIN}/g" "$APP_DIR/infra/aws/Caddyfile" \
  | sudo tee /etc/caddy/Caddyfile >/dev/null
# El template usa {$API_DOMAIN}; forzamos valor literal:
echo "${API_DOMAIN} {
	encode gzip
	reverse_proxy 127.0.0.1:5000
}" | sudo tee /etc/caddy/Caddyfile >/dev/null

sudo systemctl enable caddy
sudo systemctl restart caddy

# systemd unit (ruta real de pnpm)
PNPM_BIN="$(command -v pnpm)"
sed "s|/usr/bin/pnpm|${PNPM_BIN}|g" "$APP_DIR/infra/aws/x4match-api.service" \
  | sudo tee /etc/systemd/system/x4match-api.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable x4match-api

echo ""
echo "==> Setup listo."
echo "1) Security group EC2: TCP 22 (tu IP), 80, 443."
echo "2) DNS A: ${API_DOMAIN} → IP pública de esta instancia."
echo "3) Neon: permitir conexiones (SSL). Pegá DATABASE_URL en apps/api/.env"
echo "4) Ejecutá: bash $APP_DIR/infra/aws/deploy.sh"
echo "5) MP Developers redirect: https://${API_DOMAIN}/clubs/oauth/mercadopago/callback"
echo "6) Mobile EXPO_PUBLIC_API_URL=https://${API_DOMAIN}"
