#!/usr/bin/env bash
# Expose CarburFlow via ngrok (un seul tunnel → frontend Vite :5174,
# qui proxy /api vers Django :8001).
#
# Prérequis (dans 2 terminaux séparés) :
#   1) ./scripts/start-api.sh
#   2) ./scripts/start-frontend.sh tunnel   ← IMPORTANT (mode VITE_TUNNEL=1)
#   3) ./scripts/start-ngrok.sh
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
  echo "  Lance d’abord :  $ROOT/scripts/start-api.sh"
  exit 1
fi

if ! ss -tln | grep -q ":${FRONT_PORT}"; then
  echo "⚠ Frontend absent sur :${FRONT_PORT}"
  echo "  Lance d’abord :  $ROOT/scripts/start-frontend.sh tunnel"
  exit 1
fi

# Sans VITE_TUNNEL=1, la page ngrok charge souvent en blanc (HMR ws sur le mauvais port).
if ! pgrep -af "vite" | grep -q "VITE_TUNNEL=1\|dev:tunnel" 2>/dev/null; then
  # Heuristique : le script npm run dev:tunnel laisse VITE_TUNNEL dans l’environnement du parent.
  # On prévient toujours — le cas le plus fréquent de page blanche.
  echo "⚠ Astuce : le frontend doit tourner en mode tunnel :"
  echo "    $ROOT/scripts/start-frontend.sh tunnel"
  echo "  (sinon HMR / page blanche derrière ngrok HTTPS)"
  echo ""
fi

echo "→ Tunnel ngrok → http://127.0.0.1:${FRONT_PORT}"
echo "  Dashboard ngrok local : http://127.0.0.1:4040"
echo ""
echo "  Sur le plan gratuit, ngrok affiche d’abord une page d’avertissement :"
echo "  cliquez une fois sur « Visit Site », puis l’app CarburFlow s’affiche."
echo ""
exec ngrok http "http://127.0.0.1:${FRONT_PORT}" --host-header=rewrite --log=stdout
