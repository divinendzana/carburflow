#!/usr/bin/env bash
# Démarre l'API et le frontend pour le développement local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONT_PORT="${FRONT_PORT:-5174}"
API_PORT="${API_PORT:-8001}"

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

wait_for_port() {
  local port="$1"
  local service_name="$2"
  echo -n "→ Attente de $service_name sur le port $port..."
  for _ in $(seq 1 40); do # Attend jusqu'à 10 secondes
    if ss -tln | grep -q ":$port"; then
      echo " ✓"
      return 0
    fi
    sleep 0.25
  done
  echo " ✗"
  echo "Erreur: $service_name n'a pas démarré sur le port $port."
  exit 1
}

echo "→ Démarrage du backend (API)..."
"$ROOT/scripts/start-api.sh" >/tmp/carburflow-api.log 2>&1 &
API_PID=$!
wait_for_port "$API_PORT" "L'API backend"

echo "→ Démarrage du frontend..."
"$ROOT/scripts/start-frontend.sh" >/tmp/carburflow-frontend.log 2>&1 &
FRONT_PID=$!
wait_for_port "$FRONT_PORT" "Le frontend"

echo ""
echo "🎉 CarburFlow est prêt ! L'application est disponible sur http://localhost:$FRONT_PORT"
echo "   Les logs sont dans /tmp/carburflow-api.log et /tmp/carburflow-frontend.log"
wait