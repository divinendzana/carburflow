#!/usr/bin/env bash
# Démarre l'API et le frontend pour le développement local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  echo ""
  echo "→ Arrêt des services de développement…"
  # L'utilisation de `pkill -P` garantit que seuls les processus enfants de ce script sont tués.
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONT_PID:-}" ]]; then
    kill "$FRONT_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ Démarrage du backend (API)..."
"$ROOT/scripts/start-api.sh" &
API_PID=$!

echo "→ Démarrage du frontend..."
"$ROOT/scripts/start-frontend.sh" &
FRONT_PID=$!

wait