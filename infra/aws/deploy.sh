#!/usr/bin/env bash
# Deploy / update API en EC2 (después de setup-ec2.sh).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/x4match}"
cd "$APP_DIR"

if [[ ! -f apps/api/.env ]]; then
  echo "Falta apps/api/.env — copiá infra/aws/env.example y completá Neon + secrets."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source apps/api/.env
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL vacía en apps/api/.env"
  exit 1
fi

echo "==> git pull..."
git pull --ff-only

echo "==> pnpm install..."
pnpm install --frozen-lockfile

echo "==> build API..."
pnpm build:api

echo "==> migraciones (Neon)..."
pnpm --filter api db:migrate:ci

echo "==> systemd unit..."
sudo cp "$APP_DIR/infra/aws/x4match-api.service" /etc/systemd/system/x4match-api.service
sudo systemctl daemon-reload
sudo systemctl enable x4match-api
sudo systemctl restart x4match-api

PORT_LOCAL="${PORT:-5000}"
PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:${PORT_LOCAL}}"
echo "==> health check (hasta 60s) en :${PORT_LOCAL}..."

ok=0
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT_LOCAL}/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  # Si el servicio murió, no tiene sentido seguir esperando
  if ! systemctl is-active --quiet x4match-api; then
    echo "x4match-api no está active."
    break
  fi
  sleep 2
done

sudo systemctl --no-pager --full status x4match-api || true

if [[ "$ok" -eq 1 ]]; then
  curl -fsS "http://127.0.0.1:${PORT_LOCAL}/health" || true
  echo ""
  echo "OK — API arriba."
else
  echo "Health falló. Últimos logs:"
  sudo journalctl -u x4match-api -n 80 --no-pager || true
  # Intento extra por URL pública (Caddy)
  curl -fsS "${PUBLIC_URL}/health" && echo "" && echo "OK vía ${PUBLIC_URL}" && exit 0
  exit 1
fi
