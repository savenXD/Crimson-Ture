"""Stubble-burning fire counts from NASA FIRMS (VIIRS), Punjab + Haryana.

Smoke from these fires reaches Delhi 1-3 days later on north-westerly winds,
and peaks in the same weeks as Diwali. Needs a free MAP_KEY:
https://firms.modaps.eosdis.nasa.gov/api/map_key/

Usage: FIRMS_MAP_KEY=... python -m ml.ingest.fires --date 2024-10-31 --days 10
"""
import argparse
import io
import os

import pandas as pd
import requests

from ml.config import PROCESSED_DIR

# west, south, east, north - Punjab + Haryana agricultural belt
PUNJAB_HARYANA_BBOX = "73.8,28.4,77.6,32.6"
FIRMS_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/VIIRS_SNPP_SP/{bbox}/{days}/{date}"


def fetch_fire_counts(end_date: str, days: int = 10) -> pd.DataFrame:
    """Daily count of fire detections in the bbox for `days` days starting at end_date (max 10/call)."""
    url = FIRMS_URL.format(key=os.environ["FIRMS_MAP_KEY"], bbox=PUNJAB_HARYANA_BBOX, days=days, date=end_date)
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    fires = pd.read_csv(io.StringIO(resp.text))
    daily = fires.groupby("acq_date").size().rename("fire_count").reset_index()
    daily["acq_date"] = pd.to_datetime(daily["acq_date"])
    return daily


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", required=True)
    ap.add_argument("--days", type=int, default=10)
    args = ap.parse_args()
    df = fetch_fire_counts(args.date, args.days)
    out = PROCESSED_DIR / f"fires_{args.date}.parquet"
    df.to_parquet(out, index=False)
    print(f"wrote {len(df)} days -> {out}")
