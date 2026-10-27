"""Step 4 - Train a fare prediction model with Spark MLlib.

Question the model answers: "Before I get in the taxi, roughly what will the fare be?"
Inputs (all known before the trip): distance, pickup/dropoff zone, hour, day, month.

We compare two models:
  * Linear Regression   - simple baseline
  * Gradient-Boosted Trees (GBT) - more powerful, captures non-linear patterns
"""
import json
import os
import time

from pyspark.ml import Pipeline
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.regression import GBTRegressor, LinearRegression
from pyspark.sql import functions as F

from common import DATA_CLEAN, MODEL_DIR, OUTPUT, get_spark

FEATURES = ["trip_distance", "PULocationID", "DOLocationID", "pickup_hour", "day_of_week", "is_weekend", "month"]
TARGET = "fare_amount"
# Training on all ~55M rows on a laptop would take hours; a random sample of
# ~3M rows gives practically the same accuracy.
TRAIN_ROWS = int(os.environ.get("TRAIN_ROWS", 3_000_000))


def main() -> None:
    start = time.time()
    spark = get_spark("nyc-taxi-model")

    trips = spark.read.parquet(str(DATA_CLEAN))
    total = trips.count()
    fraction = min(1.0, TRAIN_ROWS / total)
    data = (
        trips.sample(fraction=fraction, seed=42)
        .withColumn("is_weekend", F.col("day_of_week").isin(1, 7).cast("int"))
        .select(*FEATURES, TARGET)
        .dropna()
    )
    train, test = data.randomSplit([0.8, 0.2], seed=42)
    train.cache()
    print(f"Sampled {fraction:.1%} of {total:,} trips -> train {train.count():,} / test {test.count():,}")

    assembler = VectorAssembler(inputCols=FEATURES, outputCol="features")
    evaluators = {m: RegressionEvaluator(labelCol=TARGET, metricName=m) for m in ("rmse", "mae", "r2")}

    def evaluate(model):
        preds = model.transform(test)
        return {m: round(e.evaluate(preds), 3) for m, e in evaluators.items()}

    results = {}

    print("Training Linear Regression ...")
    t0 = time.time()
    lr_model = Pipeline(stages=[assembler, LinearRegression(labelCol=TARGET)]).fit(train)
    results["Linear Regression"] = {**evaluate(lr_model), "train_seconds": round(time.time() - t0, 1)}
    print("  ", results["Linear Regression"])

    print("Training Gradient-Boosted Trees ...")
    t0 = time.time()
    gbt = GBTRegressor(labelCol=TARGET, maxIter=40, maxDepth=6, maxBins=270, seed=42)
    gbt_model = Pipeline(stages=[assembler, gbt]).fit(train)
    results["Gradient-Boosted Trees"] = {**evaluate(gbt_model), "train_seconds": round(time.time() - t0, 1)}
    print("  ", results["Gradient-Boosted Trees"])

    gbt_model.write().overwrite().save(str(MODEL_DIR))

    importances = gbt_model.stages[-1].featureImportances.toArray()
    summary = {
        "train_rows": train.count(),
        "test_rows": test.count(),
        "models": results,
        "feature_importance": dict(sorted(
            {f: round(float(v), 4) for f, v in zip(FEATURES, importances)}.items(), key=lambda x: -x[1])),
        "total_seconds": round(time.time() - start, 1),
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "model_metrics.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    spark.stop()


if __name__ == "__main__":
    main()
