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

echo "==> restart systemd..."
sudo systemctl restart x4match-api
sudo systemctl --no-pager --full status x4match-api || true

PUBLIC_URL="${API_PUBLIC_URL:-http://127.0.0.1:5000}"
echo "==> health check..."
sleep 2
if curl -fsS "${PUBLIC_URL}/health" || curl -fsS "http://127.0.0.1:5000/health"; then
  echo ""
  echo "OK — API arriba."
else
  echo "Health falló. Logs: sudo journalctl -u x4match-api -n 80 --no-pager"
  exit 1
fi
