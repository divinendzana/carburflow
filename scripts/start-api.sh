#!/usr/bin/env bash
# Démarre l'API Django CarburFlow sur le port 8001.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Préférer un Python qui a réellement Django (le venv local peut être vide)
if [[ -x "$ROOT/venv/bin/python" ]] && "$ROOT/venv/bin/python" -c "import django" 2>/dev/null; then
  PY="$ROOT/venv/bin/python"
elif /usr/bin/python3 -c "import django" 2>/dev/null; then
  PY="/usr/bin/python3"
else
  PY="python3"
fi

echo "→ Migrations…"
"$PY" manage.py migrate --noinput
echo "→ Comptes démo (admin/admin, user/user123)…"
"$PY" manage.py seed_accounts
echo "→ API sur http://127.0.0.1:8001/"
exec "$PY" manage.py runserver 8001
