"""Step 2 - Clean the raw data with PySpark and save it as partitioned Parquet.

Why this step matters (good viva talking point):
  Real-world data is messy. The raw files contain negative fares, 0-mile trips,
  trips lasting 20 hours, and dates from 2008. We remove these so our analysis
  and model are trustworthy.
"""
import json
import time

from pyspark.sql import functions as F

from common import DATA_CLEAN, DATA_RAW, MONTHS, OUTPUT, get_spark

# Only the columns we need, with one fixed type each (types vary slightly between months).
COLUMNS = {
    "tpep_pickup_datetime": "timestamp",
    "tpep_dropoff_datetime": "timestamp",
    "passenger_count": "int",
    "trip_distance": "double",
    "PULocationID": "int",
    "DOLocationID": "int",
    "payment_type": "int",
    "fare_amount": "double",
    "tip_amount": "double",
    "tolls_amount": "double",
    "total_amount": "double",
}


def load_month(spark, month: str):
    """Read one month and force a consistent schema."""
    df = spark.read.parquet(str(DATA_RAW / f"yellow_tripdata_{month}.parquet"))
    df = df.select([F.col(c).cast(t).alias(c) for c, t in COLUMNS.items()])
    year, mon = map(int, month.split("-"))
    # Keep only trips whose pickup actually falls in this file's month
    return df.where((F.year("tpep_pickup_datetime") == year) & (F.month("tpep_pickup_datetime") == mon))


def main() -> None:
    start = time.time()
    spark = get_spark("nyc-taxi-clean")

    available = [m for m in MONTHS if (DATA_RAW / f"yellow_tripdata_{m}.parquet").exists()]
    if not available:
        raise SystemExit("No raw data found - run src/01_download_data.py first.")
    print(f"Cleaning {len(available)} month(s): {available[0]} .. {available[-1]}")

    raw = None
    for m in available:
        df = load_month(spark, m)
        raw = df if raw is None else raw.unionByName(df)

    raw_count = sum(spark.read.parquet(str(DATA_RAW / f"yellow_tripdata_{m}.parquet")).count() for m in available)

    duration_min = (F.unix_timestamp("tpep_dropoff_datetime") - F.unix_timestamp("tpep_pickup_datetime")) / 60

    clean = (
        raw.withColumn("duration_min", duration_min)
        .where(F.col("fare_amount").between(3, 500))          # NYC minimum fare is $3
        .where(F.col("total_amount") > 0)
        .where(F.col("trip_distance").between(0.1, 100))      # miles
        .where(F.col("duration_min").between(1, 180))         # 1 minute to 3 hours
        .where(F.col("PULocationID").between(1, 263) & F.col("DOLocationID").between(1, 263))
        .withColumn("passenger_count",
                    F.when(F.col("passenger_count").between(1, 6), F.col("passenger_count")).otherwise(1))
        .withColumn("speed_mph", F.col("trip_distance") / (F.col("duration_min") / 60))
        .where(F.col("speed_mph") < 80)                       # physically impossible otherwise
        # Handy derived columns for analysis and ML
        .withColumn("year", F.year("tpep_pickup_datetime"))
        .withColumn("month", F.month("tpep_pickup_datetime"))
        .withColumn("pickup_hour", F.hour("tpep_pickup_datetime"))
        .withColumn("day_of_week", F.dayofweek("tpep_pickup_datetime"))  # 1=Sun .. 7=Sat
        .withColumn("tip_pct",
                    F.when(F.col("fare_amount") > 0, F.col("tip_amount") / F.col("fare_amount") * 100))
    )

    # Partitioning by year/month means later queries only read the months they need.
    clean.write.mode("overwrite").partitionBy("year", "month").parquet(str(DATA_CLEAN))

    clean_count = spark.read.parquet(str(DATA_CLEAN)).count()
    stats = {
        "months": available,
        "raw_rows": raw_count,
        "clean_rows": clean_count,
        "removed_rows": raw_count - clean_count,
        "removed_pct": round((raw_count - clean_count) / raw_count * 100, 2),
        "clean_seconds": round(time.time() - start, 1),
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "cleaning_stats.json").write_text(json.dumps(stats, indent=2))
    print(json.dumps(stats, indent=2))
    spark.stop()


if __name__ == "__main__":
    main()
