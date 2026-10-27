"""Step 1 - Download NYC yellow taxi trip data (free, public, from NYC TLC).

Each month is one ~50 MB Parquet file with ~3 million trips.
Files that already exist are skipped, so it is safe to re-run.
"""
import sys

import requests

from common import DATA_RAW, MONTHS, TRIP_URL, ZONES_CSV, ZONES_URL


def download(url: str, dest) -> None:
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  already have {dest.name}")
        return
    print(f"  downloading {dest.name} ...", end="", flush=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
    tmp.rename(dest)
    print(f" {dest.stat().st_size / 1e6:.0f} MB")


def main() -> None:
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {len(MONTHS)} month(s) of trip data + zone lookup")
    download(ZONES_URL, ZONES_CSV)
    for month in MONTHS:
        try:
            download(TRIP_URL.format(month=month), DATA_RAW / f"yellow_tripdata_{month}.parquet")
        except requests.RequestException as e:
            print(f"\n  FAILED {month}: {e}", file=sys.stderr)
    total = sum(f.stat().st_size for f in DATA_RAW.glob("*.parquet")) / 1e9
    print(f"Done. Raw data on disk: {total:.2f} GB")


if __name__ == "__main__":
    main()
