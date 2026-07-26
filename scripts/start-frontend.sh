#!/usr/bin/env bash
# Démarre Vite (port 5174) avec Node ≥ 18.
# Usage:
#   ./scripts/start-frontend.sh          # local
#   ./scripts/start-frontend.sh tunnel   # ngrok / Dev Tunnels (HMR wss)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-local}"

# Préférer le Node local du projet, sinon ~/.local, sinon PATH système
if [[ -x "$ROOT/.tools/node-v20.19.0-linux-x64/bin/node" ]]; then
  export PATH="$ROOT/.tools/node-v20.19.0-linux-x64/bin:$PATH"
elif [[ -x "$HOME/.local/opt/node-v20.19.0-linux-x64/bin/node" ]]; then
  export PATH="$HOME/.local/opt/node-v20.19.0-linux-x64/bin:$PATH"
elif [[ -x "$HOME/.local/node/bin/node" ]]; then
  export PATH="$HOME/.local/node/bin:$PATH"
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "Node ≥ 18 requis (trouvé: $(node -v 2>/dev/null || echo absent))."
  echo "Installe Node 20 dans .tools/ ou ~/.local/opt/ puis relance."
  exit 1
fi

cd "$ROOT/frontend"
echo "→ Node $(node -v) · frontend :5174"
if [[ "$MODE" == "tunnel" ]]; then
  exec npm run dev:tunnel
fi
exec npm run dev
