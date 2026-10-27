#!/usr/bin/env bash
# Runs the whole pipeline. Quick test with 1 month:  MONTHS=1 ./run_all.sh
set -euo pipefail
cd "$(dirname "$0")"

python src/01_download_data.py
python src/02_clean_data.py
python src/03_analyze.py
python src/04_train_model.py

echo
echo "All done! Start the website with:  ./start.sh"
