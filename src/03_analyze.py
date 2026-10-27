"""Step 3 - Big data analysis with Spark SQL / DataFrames.

Spark crunches tens of millions of rows and produces small summary tables.
Those summaries are saved to output/ so the dashboard loads instantly.
"""
import json
import time

import pandas as pd
from pyspark.sql import functions as F

from common import DATA_CLEAN, OUTPUT, ZONES_CSV, get_spark

PAYMENT_NAMES = {1: "Credit card", 2: "Cash", 3: "No charge", 4: "Dispute", 0: "Flex fare / unknown"}
DAY_NAMES = {1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat"}


def save(pdf: pd.DataFrame, name: str) -> None:
    pdf.to_parquet(OUTPUT / f"{name}.parquet", index=False)
    print(f"  saved {name:<16} ({len(pdf)} rows)")


def main() -> None:
    start = time.time()
    spark = get_spark("nyc-taxi-analyze")
    OUTPUT.mkdir(parents=True, exist_ok=True)

    trips = spark.read.parquet(str(DATA_CLEAN))
    zones = spark.read.option("header", True).csv(str(ZONES_CSV)).select(
        F.col("LocationID").cast("int").alias("LocationID"), "Borough", "Zone")
    trips.cache()  # reused by every query below, so keep it in memory
    trips.createOrReplaceTempView("trips")
    zones.createOrReplaceTempView("zones")

    # 1. Headline numbers
    k = trips.agg(
        F.count("*").alias("total_trips"),
        F.sum("total_amount").alias("total_revenue"),
        F.avg("fare_amount").alias("avg_fare"),
        F.avg("trip_distance").alias("avg_distance"),
        F.avg("duration_min").alias("avg_duration"),
        F.avg(F.when(F.col("payment_type") == 1, F.col("tip_pct"))).alias("avg_tip_pct_card"),
    ).first().asDict()
    (OUTPUT / "kpis.json").write_text(json.dumps({key: float(v) for key, v in k.items()}, indent=2))
    print(f"  {int(k['total_trips']):,} trips analysed")

    # 2. Trend over months
    monthly = spark.sql("""
        SELECT year, month, COUNT(*) AS trips, SUM(total_amount) AS revenue, AVG(fare_amount) AS avg_fare
        FROM trips GROUP BY year, month ORDER BY year, month
    """).toPandas()
    save(monthly, "monthly")

    # 3. Hour of day
    save(spark.sql("""
        SELECT pickup_hour AS hour, COUNT(*) AS trips, AVG(fare_amount) AS avg_fare,
               AVG(speed_mph) AS avg_speed_mph, AVG(CASE WHEN payment_type = 1 THEN tip_pct END) AS avg_tip_pct
        FROM trips GROUP BY pickup_hour ORDER BY hour
    """).toPandas(), "hourly")

    # 4. Day x hour heatmap
    heat = spark.sql("""
        SELECT day_of_week, pickup_hour AS hour, COUNT(*) AS trips
        FROM trips GROUP BY day_of_week, pickup_hour
    """).toPandas()
    heat["day"] = heat["day_of_week"].map(DAY_NAMES)
    save(heat, "heatmap")

    # 5. Busiest pickup zones
    save(spark.sql("""
        SELECT z.Zone AS zone, z.Borough AS borough, COUNT(*) AS trips, AVG(t.fare_amount) AS avg_fare
        FROM trips t JOIN zones z ON t.PULocationID = z.LocationID
        GROUP BY z.Zone, z.Borough ORDER BY trips DESC LIMIT 25
    """).toPandas(), "top_zones")

    # 6. Borough comparison
    save(spark.sql("""
        SELECT z.Borough AS borough, COUNT(*) AS trips, AVG(t.fare_amount) AS avg_fare,
               AVG(t.trip_distance) AS avg_distance,
               AVG(CASE WHEN t.payment_type = 1 THEN t.tip_pct END) AS avg_tip_pct
        FROM trips t JOIN zones z ON t.PULocationID = z.LocationID
        WHERE z.Borough NOT IN ('Unknown', 'N/A')
        GROUP BY z.Borough ORDER BY trips DESC
    """).toPandas(), "boroughs")

    # 7. Payment methods
    pay = spark.sql("SELECT payment_type, COUNT(*) AS trips FROM trips GROUP BY payment_type").toPandas()
    pay["method"] = pay["payment_type"].map(PAYMENT_NAMES).fillna("Other")
    save(pay.groupby("method", as_index=False)["trips"].sum(), "payments")

    # 8. Every route (pickup zone -> dropoff zone) with typical distance/fare/time.
    #    Used for "top routes" and to fill in distance for the fare predictor.
    routes = spark.sql("""
        SELECT t.PULocationID, t.DOLocationID, pz.Zone AS pickup_zone, pz.Borough AS pickup_borough,
               dz.Zone AS dropoff_zone, dz.Borough AS dropoff_borough, COUNT(*) AS trips,
               percentile_approx(t.trip_distance, 0.5) AS median_distance,
               AVG(t.fare_amount) AS avg_fare, AVG(t.duration_min) AS avg_duration
        FROM trips t
        JOIN zones pz ON t.PULocationID = pz.LocationID
        JOIN zones dz ON t.DOLocationID = dz.LocationID
        GROUP BY t.PULocationID, t.DOLocationID, pz.Zone, pz.Borough, dz.Zone, dz.Borough
        HAVING COUNT(*) >= 20
    """).toPandas()
    save(routes, "routes")

    # 9. Airports vs. the rest of the city
    save(spark.sql("""
        SELECT CASE WHEN PULocationID = 132 OR DOLocationID = 132 THEN 'JFK Airport'
                    WHEN PULocationID = 138 OR DOLocationID = 138 THEN 'LaGuardia Airport'
                    WHEN PULocationID = 1   OR DOLocationID = 1   THEN 'Newark Airport'
                    ELSE 'Non-airport' END AS trip_type,
               COUNT(*) AS trips, AVG(fare_amount) AS avg_fare, AVG(trip_distance) AS avg_distance
        FROM trips GROUP BY 1 ORDER BY trips DESC
    """).toPandas(), "airports")

    # 10. Performance demo: Parquet partition pruning (reads 1 month instead of all).
    #     We average a real column (a plain count() is answered from file metadata,
    #     so it would not show the difference).
    trips.unpersist()
    y, m = int(monthly.iloc[-1]["year"]), int(monthly.iloc[-1]["month"])

    def timed(df):
        t0 = time.time()
        rows = df.agg(F.count("*"), F.avg("fare_amount"), F.avg("trip_distance")).first()[0]
        return rows, time.time() - t0

    timed(spark.read.parquet(str(DATA_CLEAN)))  # warm-up so both timings start equal
    one, t_one = timed(spark.read.parquet(str(DATA_CLEAN)).where(f"year = {y} AND month = {m}"))
    everything, t_all = timed(spark.read.parquet(str(DATA_CLEAN)))

    perf = {"analysis_seconds": round(time.time() - start, 1),
            "partition_query_rows": one, "partition_query_seconds": round(t_one, 2),
            "full_scan_rows": everything, "full_scan_seconds": round(t_all, 2)}
    (OUTPUT / "perf.json").write_text(json.dumps(perf, indent=2))
    print(json.dumps(perf, indent=2))
    spark.stop()


if __name__ == "__main__":
    main()
