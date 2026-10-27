"""Step 5 - Hailwise web server.

Serves the website (built React app) plus a small JSON API:
  GET  /api/summary   all the analysis results from step 3 and model metrics from step 4
  GET  /api/zones     every taxi zone, for the fare form
  GET  /api/route     historical stats for one pickup -> drop-off route
  POST /api/estimate  live fare prediction with the Spark MLlib model

Run with:  ./start.sh   (or: uvicorn web.api:app --port 8000)
"""
import json
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from common import MODEL_DIR, OUTPUT, ZONES_CSV, get_spark  # noqa: E402

FRONTEND = Path(__file__).resolve().parent / "frontend" / "dist"
state = {}


def table(name: str) -> pd.DataFrame:
    return pd.read_parquet(OUTPUT / f"{name}.parquet")


def stats(name: str) -> dict:
    return json.loads((OUTPUT / f"{name}.json").read_text())


def records(df: pd.DataFrame) -> list:
    return json.loads(df.to_json(orient="records"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start Spark and load the trained model once, not on every request.
    from pyspark.ml import PipelineModel

    spark = get_spark("hailwise-api")
    spark.sparkContext.setLogLevel("ERROR")
    state["spark"] = spark
    state["model"] = PipelineModel.load(str(MODEL_DIR))
    state["routes"] = table("routes").set_index(["PULocationID", "DOLocationID"]).sort_index()
    zones = pd.read_csv(ZONES_CSV, keep_default_na=False)  # keep the borough "N/A" as text
    state["zones"] = zones[~zones["Borough"].isin(["Unknown", "N/A", ""]) & (zones["Zone"] != "")]
    yield
    spark.stop()


app = FastAPI(title="Hailwise API", lifespan=lifespan)


@app.get("/api/summary")
def summary():
    return {
        "kpis": stats("kpis"),
        "cleaning": stats("cleaning_stats"),
        "model": stats("model_metrics"),
        "monthly": records(table("monthly")),
        "hourly": records(table("hourly")),
        "heatmap": records(table("heatmap")[["day_of_week", "hour", "trips"]]),
        "top_zones": records(table("top_zones")),
        "boroughs": records(table("boroughs")),
        "payments": records(table("payments")),
        "airports": records(table("airports")),
        "routes_count": len(state["routes"]),
    }


@app.get("/api/zones")
def zones():
    z = state["zones"].sort_values(["Borough", "Zone"])
    return [{"id": int(r.LocationID), "zone": r.Zone, "borough": r.Borough} for r in z.itertuples()]


def route_stats(pickup: int, dropoff: int):
    try:
        r = state["routes"].loc[(pickup, dropoff)]
    except KeyError:
        return None  # fewer than 20 historical trips on this route
    return {"trips": int(r["trips"]), "median_distance": round(float(r["median_distance"]), 1),
            "avg_fare": round(float(r["avg_fare"]), 2), "avg_duration": round(float(r["avg_duration"]), 1)}


@app.get("/api/route")
def route(pickup: int, dropoff: int):
    return {"route": route_stats(pickup, dropoff)}


class Trip(BaseModel):
    pickup: int = Field(ge=1, le=263)
    dropoff: int = Field(ge=1, le=263)
    hour: int = Field(ge=0, le=23)
    day: int = Field(ge=1, le=7)          # 1 = Sunday ... 7 = Saturday (Spark's dayofweek)
    month: int = Field(ge=1, le=12)
    distance: float | None = Field(default=None, gt=0, le=100)


@app.post("/api/estimate")
def estimate(trip: Trip):
    hist = route_stats(trip.pickup, trip.dropoff)
    distance = trip.distance or (hist and hist["median_distance"])
    if not distance:
        raise HTTPException(422, "Not enough past rides on this route - please enter the distance.")

    row = state["spark"].createDataFrame([{
        "trip_distance": float(distance), "PULocationID": trip.pickup, "DOLocationID": trip.dropoff,
        "pickup_hour": trip.hour, "day_of_week": trip.day, "is_weekend": int(trip.day in (1, 7)),
        "month": trip.month,
    }])
    fare = state["model"].transform(row).first()["prediction"]
    return {"fare": round(max(fare, 3.0), 2), "distance": distance, "route": hist}


# The website itself (built with `npm run build` in web/frontend)
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="site")
