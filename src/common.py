"""Shared settings and helpers used by every pipeline step."""
import os
from pathlib import Path

# ---------- Paths ----------
ROOT = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT / "data" / "raw"            # downloaded monthly parquet files
DATA_CLEAN = ROOT / "data" / "clean"        # cleaned, partitioned dataset
ZONES_CSV = ROOT / "data" / "taxi_zone_lookup.csv"
OUTPUT = ROOT / "output"                    # small result tables for the dashboard
MODEL_DIR = ROOT / "models" / "fare_model"

# ---------- Which months to process ----------
# Jan 2023 -> Jun 2024 = 18 months, roughly 55 million trips.
# Set MONTHS=1 (e.g. `MONTHS=1 python src/01_download_data.py`) for a quick test run.
ALL_MONTHS = [f"2023-{m:02d}" for m in range(1, 13)] + [f"2024-{m:02d}" for m in range(1, 7)]
MONTHS = ALL_MONTHS[: int(os.environ.get("MONTHS", len(ALL_MONTHS)))]

TRIP_URL = "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_{month}.parquet"
ZONES_URL = "https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv"


def get_spark(app_name: str):
    """Start Spark in local mode, using every CPU core on this machine."""
    from pyspark.sql import SparkSession

    return (
        SparkSession.builder.appName(app_name)
        .master("local[*]")
        .config("spark.driver.memory", os.environ.get("SPARK_MEM", "8g"))
        .config("spark.sql.session.timeZone", "UTC")  # keep NYC wall-clock times as-is
        .config("spark.sql.shuffle.partitions", "64")
        .config("spark.ui.showConsoleProgress", "true")
        .getOrCreate()
    )
