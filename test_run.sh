#!/usr/bin/env bash
# Runs the data pipeline inside the "nyc-taxi" conda env.
#   ./test_run.sh              quick test with 1 month (~3M trips)
#   MONTHS=18 ./test_run.sh    full run (~58M trips)
set -euo pipefail
cd "$(dirname "$0")"

ENV="${HAILWISE_ENV:-$(conda info --base 2>/dev/null || echo /opt/miniconda3)/envs/nyc-taxi}"
if [ -d "$ENV" ]; then
  export PATH="$ENV/bin:$PATH"
  [ -d "$ENV/lib/jvm" ] && export JAVA_HOME="$ENV/lib/jvm"
fi
java -version 2>&1 | head -1
python -c "import pyspark; print('pyspark', pyspark.__version__)"

time MONTHS="${MONTHS:-1}" ./run_all.sh 2>&1 | grep -v -E "WARN|^\s*$|Stage [0-9]+"
