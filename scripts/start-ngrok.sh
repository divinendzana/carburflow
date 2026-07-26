#!/usr/bin/env bash
# Expose CarburFlow via ngrok (un seul tunnel → frontend Vite :5174,
# qui proxy /api vers Django :8001).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONT_PORT="${FRONT_PORT:-5174}"
API_PORT="${API_PORT:-8001}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok introuvable. Installe-le : https://ngrok.com/download"
  exit 1
fi

if ! ss -tln | grep -q ":${API_PORT}"; then
  echo "⚠ API absente sur :${API_PORT}"
  echo "  Lance d’abord :  cd $ROOT && ./scripts/start-api.sh"
  exit 1
fi

if ! ss -tln | grep -q ":${FRONT_PORT}"; then
  echo "⚠ Frontend absent sur :${FRONT_PORT}"
  echo "  Lance d’abord :  $ROOT/scripts/start-frontend.sh tunnel"
  exit 1
fi

echo "→ Tunnel ngrok → http://127.0.0.1:${FRONT_PORT}"
echo "  Dashboard ngrok local : http://127.0.0.1:4040"
echo "  Astuce : démarre le frontend avec npm run dev:tunnel (HMR + allowedHosts)"
echo ""
exec ngrok http "${FRONT_PORT}" --log=stdout
