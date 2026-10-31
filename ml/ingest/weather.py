"""Hourly meteorology from Open-Meteo (ERA5 reanalysis archive, no API key).

Boundary-layer height + wind are the main reason Delhi smog gets trapped in Oct-Nov.

Usage: python -m ml.ingest.weather [--years 2022 2023 2024]
"""
import argparse
from datetime import timedelta

import pandas as pd
import requests

from ml.config import DIWALI_DATES, PROCESSED_DIR, STATIONS, WINDOW_AFTER, WINDOW_BEFORE

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
HOURLY_VARS = [
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "wind_direction_10m",
    "boundary_layer_height",
    "surface_pressure",
]


def fetch_weather(lat: float, lon: float, start, end) -> pd.DataFrame:
    resp = requests.get(
        ARCHIVE_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": str(start),
            "end_date": str(end),
            "hourly": ",".join(HOURLY_VARS),
            "timezone": "Asia/Kolkata",
        },
        timeout=30,
    )
    resp.raise_for_status()
    df = pd.DataFrame(resp.json()["hourly"])
    df["time"] = pd.to_datetime(df["time"])
    return df


def fetch_diwali_windows(years: list[int]) -> pd.DataFrame:
    frames = []
    for year in years:
        d = DIWALI_DATES[year]
        start, end = d - timedelta(days=WINDOW_BEFORE), d + timedelta(days=WINDOW_AFTER)
        for name, (lat, lon) in STATIONS.items():
            df = fetch_weather(lat, lon, start, end)
            df["station"], df["diwali_year"] = name, year
            frames.append(df)
    return pd.concat(frames, ignore_index=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, nargs="+", default=[2022, 2023, 2024])
    args = ap.parse_args()
    out = PROCESSED_DIR / "weather_diwali.parquet"
    df = fetch_diwali_windows(args.years)
    df.to_parquet(out, index=False)
    print(f"wrote {len(df):,} rows -> {out}")
