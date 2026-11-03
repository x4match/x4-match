#!/usr/bin/env bash
# Instala Grafana Alloy en la EC2 y lo conecta a Grafana Cloud. Correr una vez:
#   bash infra/grafana/setup-alloy.sh
# Datos de Grafana Cloud: grafana.com → tu stack → Prometheus / Loki → "Details":
# URL, usuario numérico y token ("Generate now"). Si usás un solo token con
# metrics:write + logs:write, pegalo en las dos preguntas.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/x4match}"
API_ENV="$APP_DIR/apps/api/.env"

ask() {
  local var="$1" prompt="$2" secret="${3:-}"
  if [[ -z "${!var:-}" ]]; then
    if [[ -n "$secret" ]]; then read -rsp "$prompt: " "${var?}"; echo; else read -rp "$prompt: " "${var?}"; fi
  fi
  [[ -n "${!var}" ]] || { echo "Falta $var"; exit 1; }
}

ask GRAFANA_PROM_URL "Prometheus URL (https://prometheus-...grafana.net/api/prom/push)"
ask GRAFANA_PROM_USER "Prometheus User (número)"
ask GRAFANA_PROM_TOKEN "Prometheus token (glc_...)" secret
ask GRAFANA_LOKI_URL "Loki URL (https://logs-...grafana.net)"
ask GRAFANA_LOKI_USER "Loki User (número)"
ask GRAFANA_LOKI_TOKEN "Loki token (glc_...)" secret

for var in GRAFANA_PROM_TOKEN GRAFANA_LOKI_TOKEN; do
  if [[ "$(grep -o 'glc_' <<<"${!var}" | wc -l)" -ne 1 ]]; then
    echo "$var no es un token válido (¿se pegó dos veces?). Volvé a correr el script."
    exit 1
  fi
done

GRAFANA_PROM_URL="${GRAFANA_PROM_URL%/}"
[[ "$GRAFANA_PROM_URL" == */api/prom/push ]] || GRAFANA_PROM_URL="$GRAFANA_PROM_URL/api/prom/push"
GRAFANA_LOKI_URL="${GRAFANA_LOKI_URL%/}"
[[ "$GRAFANA_LOKI_URL" == */loki/api/v1/push ]] || GRAFANA_LOKI_URL="$GRAFANA_LOKI_URL/loki/api/v1/push"

if ! grep -q '^METRICS_TOKEN=.\+' "$API_ENV"; then
  echo "==> Generando METRICS_TOKEN en $API_ENV"
  sed -i '/^METRICS_TOKEN=/d' "$API_ENV"
  printf '\nMETRICS_TOKEN=%s\n' "$(openssl rand -hex 32)" >>"$API_ENV"
  sudo systemctl restart x4match-api
fi
METRICS_TOKEN="$(grep '^METRICS_TOKEN=' "$API_ENV" | tail -1 | cut -d= -f2-)"

if ! command -v alloy >/dev/null 2>&1; then
  echo "==> Instalando Grafana Alloy..."
  sudo mkdir -p /etc/apt/keyrings
  wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg >/dev/null
  echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" |
    sudo tee /etc/apt/sources.list.d/grafana.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq alloy
fi

echo "==> Configurando Alloy..."
sudo cp "$APP_DIR/infra/grafana/config.alloy" /etc/alloy/config.alloy
sudo tee /etc/default/alloy >/dev/null <<EOF
CONFIG_FILE="/etc/alloy/config.alloy"
CUSTOM_ARGS=""
RESTART_ON_UPGRADE=true
GOMEMLIMIT=180MiB
GRAFANA_PROM_URL="$GRAFANA_PROM_URL"
GRAFANA_PROM_USER="$GRAFANA_PROM_USER"
GRAFANA_LOKI_URL="$GRAFANA_LOKI_URL"
GRAFANA_LOKI_USER="$GRAFANA_LOKI_USER"
GRAFANA_PROM_TOKEN="$GRAFANA_PROM_TOKEN"
GRAFANA_LOKI_TOKEN="$GRAFANA_LOKI_TOKEN"
METRICS_TOKEN="$METRICS_TOKEN"
EOF
sudo chmod 600 /etc/default/alloy

# Leer el journal de systemd (logs de la API).
sudo usermod -aG systemd-journal alloy

# La EC2 es chica: que Alloy no compita con la API por memoria.
sudo mkdir -p /etc/systemd/system/alloy.service.d
sudo tee /etc/systemd/system/alloy.service.d/limits.conf >/dev/null <<'EOF'
[Service]
MemoryMax=250M
EOF

sudo systemctl daemon-reload
sudo systemctl enable alloy
sudo systemctl restart alloy
sleep 3
sudo systemctl --no-pager --full status alloy | head -15

echo "==> Probando /metrics..."
curl -fsS -H "Authorization: Bearer $METRICS_TOKEN" http://127.0.0.1:5000/metrics | grep -m3 '^x4_' || {
  echo "La API no responde /metrics: ¿está desplegada la versión con observabilidad?"
  exit 1
}
echo "OK — Alloy enviando a Grafana Cloud."
