#!/usr/bin/env bash
# Démarre API + frontend (mode tunnel) + ngrok pour un accès public.
# Usage : ./scripts/start-public.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONT_PORT="${FRONT_PORT:-5174}"
API_PORT="${API_PORT:-8001}"

cleanup() {
  echo ""
  echo "→ Arrêt des services démarrés par start-public…"
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if ! ss -tln | grep -q ":${API_PORT}"; then
  echo "→ Démarrage API :${API_PORT}"
  "$ROOT/scripts/start-api.sh" &
  API_PID=$!
  for _ in $(seq 1 40); do
    if ss -tln | grep -q ":${API_PORT}"; then break; fi
    sleep 0.25
  done
else
  echo "→ API déjà active sur :${API_PORT}"
fi

# Toujours (re)démarrer le frontend en mode tunnel pour ngrok
if ss -tln | grep -q ":${FRONT_PORT}"; then
  echo "→ Arrêt du frontend actuel sur :${FRONT_PORT} (relance en mode tunnel)…"
  # Tue les process vite liés au projet
  pkill -f "$ROOT/frontend/node_modules/.bin/vite" 2>/dev/null || true
  sleep 1
fi

echo "→ Démarrage frontend (tunnel) :${FRONT_PORT}"
"$ROOT/scripts/start-frontend.sh" tunnel &
FRONT_PID=$!
for _ in $(seq 1 40); do
  if ss -tln | grep -q ":${FRONT_PORT}"; then break; fi
  sleep 0.25
done

if ! ss -tln | grep -q ":${FRONT_PORT}"; then
  echo "✗ Frontend n’a pas démarré sur :${FRONT_PORT}"
  exit 1
fi

echo "→ Démarrage ngrok…"
exec "$ROOT/scripts/start-ngrok.sh"
