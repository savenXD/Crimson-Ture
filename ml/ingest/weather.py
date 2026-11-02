"""Hourly weather (ERA5 + forecast) and CAMS PM2.5 on a coarse grid over Delhi (Open-Meteo, no key)."""
import time
import numpy as np
import pandas as pd
import requests
from ml.config import RAW, DELHI_BBOX, TRAIN_YEARS

VARS = ("temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,"
        "precipitation,boundary_layer_height,surface_pressure")

def points(n=3):
    x0, y0, x1, y1 = DELHI_BBOX
    return [(round(la, 3), round(lo, 3)) for la in np.linspace(y0, y1, n) for lo in np.linspace(x0, x1, n)]

def get(url, params):
    for _ in range(8):
        try:
            r = requests.get(url, params=params, timeout=180)
        except requests.RequestException:
            time.sleep(10); continue
        if r.status_code == 429:
            time.sleep(40); continue
        r.raise_for_status()
        return r.json()["hourly"]
    raise RuntimeError("open-meteo throttled")

def pull(lat, lon, start, end):
    base = dict(latitude=lat, longitude=lon, timezone="UTC", start_date=start, end_date=end)
    w = pd.DataFrame(get("https://archive-api.open-meteo.com/v1/archive", {**base, "hourly": VARS}))
    try:  # CAMS archive on Open-Meteo starts mid-2022
        a = pd.DataFrame(get("https://air-quality-api.open-meteo.com/v1/air-quality",
                             {**base, "hourly": "pm2_5"}))[["pm2_5"]].rename(columns={"pm2_5": "cams_pm25"})
    except requests.HTTPError:
        a = pd.DataFrame({"cams_pm25": np.nan}, index=w.index)
    return pd.concat([w, a], axis=1)

def season_missing(df, y):
    return not ((df["time"] >= f"{y}-09-10") & (df["time"] < f"{y}-09-12")).any()


def one_point(args):
    i, lat, lon = args
    cache = RAW / f"weather_pt{i}.parquet"
    have = pd.read_parquet(cache) if cache.exists() else None
    if have is not None:
        have["time"] = pd.to_datetime(have["time"])
    years = [y for y in TRAIN_YEARS if have is None or season_missing(have, y)]
    parts = [have] if have is not None else []
    for y in years:
        d = pull(lat, lon, f"{y}-09-10", f"{y + 1}-01-20")
        d["time"] = pd.to_datetime(d["time"])
        parts.append(d.assign(pt=i, lat=lat, lon=lon))
    if have is None:
        end = (pd.Timestamp.now("UTC") - pd.Timedelta(days=6)).strftime("%Y-%m-%d")
        d = pull(lat, lon, "2026-09-10", end)
        d["time"] = pd.to_datetime(d["time"])
        parts.append(d.assign(pt=i, lat=lat, lon=lon))
    out = pd.concat(parts, ignore_index=True).drop_duplicates("time").sort_values("time").reset_index(drop=True)
    if years or have is None:
        out.to_parquet(cache)
    print("weather point", i, "years added:", years, flush=True)
    return out


def main():
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(3) as ex:
        frames = list(ex.map(one_point, [(i, la, lo) for i, (la, lo) in enumerate(points())]))
    df = pd.concat(frames, ignore_index=True)
    df["time"] = pd.to_datetime(df["time"])
    df.to_parquet(RAW / "weather_hist.parquet")


if __name__ == "__main__":
    main()
