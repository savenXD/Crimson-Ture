"""Air-quality ingestion.

Sources:
  1. CPCB station data (ground truth) - Kaggle "Air Quality Data in India 2015-2020"
     (station_hour.csv + stations.csv) and OpenAQ v3 for 2021+. Load from disk.
  2. CAMS global model PM2.5 via Open-Meteo (no key) - used as a *baseline to beat*
     and as an input feature. ~40 km resolution, so it cannot see neighborhood-level
     or firecracker spikes - which is exactly the gap this project fills.

Usage: python -m ml.ingest.aq [--years 2022 2023 2024]
"""
import argparse
import os
from datetime import timedelta

import pandas as pd
import requests

from ml.config import DIWALI_DATES, PROCESSED_DIR, RAW_DIR, STATIONS, WINDOW_AFTER, WINDOW_BEFORE

CAMS_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
OPENAQ_URL = "https://api.openaq.org/v3"


def fetch_cams(lat: float, lon: float, start, end) -> pd.DataFrame:
    resp = requests.get(
        CAMS_URL,
        params={
            "latitude": lat,
            "longitude": lon,
            "start_date": str(start),
            "end_date": str(end),
            "hourly": "pm2_5,pm10,nitrogen_dioxide,carbon_monoxide,aerosol_optical_depth",
            "timezone": "Asia/Kolkata",
        },
        timeout=30,
    )
    resp.raise_for_status()
    df = pd.DataFrame(resp.json()["hourly"]).rename(columns={"pm2_5": "cams_pm25", "pm10": "cams_pm10"})
    df["time"] = pd.to_datetime(df["time"])
    return df


def fetch_cams_diwali_windows(years: list[int]) -> pd.DataFrame:
    frames = []
    for year in years:
        d = DIWALI_DATES[year]
        start, end = d - timedelta(days=WINDOW_BEFORE), d + timedelta(days=WINDOW_AFTER)
        for name, (lat, lon) in STATIONS.items():
            df = fetch_cams(lat, lon, start, end)
            df["station"], df["diwali_year"] = name, year
            frames.append(df)
    return pd.concat(frames, ignore_index=True)


def load_cpcb_kaggle(raw_dir=RAW_DIR, city: str = "Delhi") -> pd.DataFrame:
    """Hourly CPCB station data from the Kaggle dump (download into ml/data/raw/)."""
    hours = pd.read_csv(raw_dir / "station_hour.csv", parse_dates=["Datetime"])
    stations = pd.read_csv(raw_dir / "stations.csv")
    stations = stations[stations["City"] == city]
    df = hours.merge(stations[["StationId", "StationName"]], on="StationId")
    return df.rename(columns={"Datetime": "time", "PM2.5": "pm25", "PM10": "pm10", "StationName": "station"})


def fetch_openaq_sensor(sensor_id: int, start, end) -> pd.DataFrame:
    """OpenAQ v3 hourly measurements for one sensor (needs OPENAQ_API_KEY)."""
    # TODO(round2): discover Delhi PM2.5 sensor ids via /v3/locations?bbox=... and loop
    resp = requests.get(
        f"{OPENAQ_URL}/sensors/{sensor_id}/hours",
        params={"datetime_from": str(start), "datetime_to": str(end), "limit": 1000},
        headers={"X-API-Key": os.environ["OPENAQ_API_KEY"]},
        timeout=30,
    )
    resp.raise_for_status()
    rows = [{"time": r["period"]["datetimeFrom"]["local"], "pm25": r["value"]} for r in resp.json()["results"]]
    return pd.DataFrame(rows)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", type=int, nargs="+", default=[2022, 2023, 2024])
    args = ap.parse_args()
    out = PROCESSED_DIR / "cams_diwali.parquet"
    df = fetch_cams_diwali_windows(args.years)
    df.to_parquet(out, index=False)
    print(f"wrote {len(df):,} rows -> {out}")
