#!/usr/bin/env bash
# Builds the Hailwise website and starts it at http://localhost:8000
set -euo pipefail
cd "$(dirname "$0")"

# Use the "nyc-taxi" conda env (it has Java 17) if it exists; otherwise use what is on PATH.
ENV="${HAILWISE_ENV:-$(conda info --base 2>/dev/null || echo /opt/miniconda3)/envs/nyc-taxi}"
if [ -d "$ENV" ]; then
  export PATH="$ENV/bin:$PATH"
  [ -d "$ENV/lib/jvm" ] && export JAVA_HOME="$ENV/lib/jvm"
fi

if [ ! -d web/frontend/node_modules ]; then (cd web/frontend && npm install --no-fund --no-audit); fi
(cd web/frontend && npm run build --silent)

echo "Hailwise is starting at http://localhost:${PORT:-8000}"
exec uvicorn web.api:app --port "${PORT:-8000}" --log-level warning
