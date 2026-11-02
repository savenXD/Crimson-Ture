"""Feature matrix shared by training and prediction. One row = (location, hour)."""
import numpy as np
import pandas as pd
from ml.config import DIWALI_DT, PROC, RAW

STATIC = ["road_major_km", "road_all_km", "road_density", "industrial_frac", "green_frac",
          "residential_frac", "n_school", "n_hospital", "n_market"]
WX = ["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "precipitation", "boundary_layer_height", "surface_pressure"]
# what the nearest monitors say, so hexagons far from any monitor can borrow their behaviour
NEIGHBOUR = ["dist_monitor_km", "nbr_level", "nbr_diwali_uplift"]
FEATURES = (["hour_sin", "hour_cos", "dow", "hours_from_diwali", "cracker_window", "lat", "lon"]
            + WX + ["wind_u", "wind_v", "ventilation", "nw_wind", "fire_lag1", "fire_lag2", "fire_lag3", "fire_3d", "stubble_transport"]
            + STATIC + NEIGHBOUR)

# groups used for the "why" split (SHAP is summed within each group)
GROUPS = {
    "Crackers": ["hours_from_diwali", "cracker_window"],
    "Stubble smoke": ["fire_lag1", "fire_lag2", "fire_lag3", "fire_3d", "stubble_transport"],
    "Weather & trapped air": WX + ["wind_u", "wind_v", "ventilation", "nw_wind", "hour_sin", "hour_cos"],
    "Local sources": STATIC + NEIGHBOUR + ["lat", "lon", "dow"],
}


def diwali_clock(ts_ist: pd.Series) -> pd.DataFrame:
    """Hours from the Diwali night (20:00 IST) of the season the timestamp belongs to."""
    season = ts_ist.dt.year.where(ts_ist.dt.month >= 6, ts_ist.dt.year - 1)
    ref = season.map(lambda y: DIWALI_DT.get(int(y), pd.NaT))
    # fall back to next-year Diwali for months Jan-May if season mapping missing
    h = (ts_ist.dt.tz_localize(None) - pd.to_datetime(ref)).dt.total_seconds() / 3600
    # clipped so the model learns the Diwali curve only near the festival and cannot memorise which season a date is in
    return pd.DataFrame({"hours_from_diwali": h.clip(-72, 120), "cracker_window": ((h >= -2) & (h <= 14)).astype(int),
                         "raw_hours_from_diwali": h})


def fire_daily():
    """Daily fire counts. Cached in a tiny file so a fresh clone can forecast without the raw detections."""
    cache, raw = PROC / "fires_daily.parquet", RAW / "fires.parquet"
    if cache.exists() and not (raw.exists() and raw.stat().st_mtime > cache.stat().st_mtime):
        return pd.read_parquet(cache)["n"]
    s = pd.read_parquet(raw).groupby("acq_date").size().rename("n").asfreq("D", fill_value=0)
    s.to_frame().to_parquet(cache)
    return s


def build(base: pd.DataFrame, weather: pd.DataFrame, fires: pd.Series, static: pd.DataFrame) -> pd.DataFrame:
    """base: columns [loc, lat, lon, h3, time(UTC)]; weather: hourly rows with column pt for nearest point."""
    df = base.merge(weather, on=["pt", "time"], how="left", suffixes=("", "_w"))
    ist = df["time"].dt.tz_localize("UTC").dt.tz_convert("Asia/Kolkata") if df["time"].dt.tz is None else df["time"].dt.tz_convert("Asia/Kolkata")
    df["hour_sin"] = np.sin(2 * np.pi * ist.dt.hour / 24); df["hour_cos"] = np.cos(2 * np.pi * ist.dt.hour / 24)
    df["dow"] = ist.dt.dayofweek
    df = pd.concat([df.reset_index(drop=True), diwali_clock(ist.reset_index(drop=True))], axis=1)
    rad = np.deg2rad(df["wind_direction_10m"])
    df["wind_u"] = -df["wind_speed_10m"] * np.sin(rad); df["wind_v"] = -df["wind_speed_10m"] * np.cos(rad)
    df["ventilation"] = df["wind_speed_10m"] * df["boundary_layer_height"] / 1000
    df["nw_wind"] = ((df["wind_direction_10m"] >= 270) & (df["wind_direction_10m"] <= 360)).astype(int)
    day = pd.to_datetime(ist.dt.tz_localize(None).dt.normalize().values)
    fd = fires.reindex(pd.date_range(fires.index.min() - pd.Timedelta(days=5), fires.index.max() + pd.Timedelta(days=60)), fill_value=np.nan)
    for k in (1, 2, 3):
        df[f"fire_lag{k}"] = fd.reindex(day - pd.Timedelta(days=k)).values
    df["fire_3d"] = df[["fire_lag1", "fire_lag2", "fire_lag3"]].sum(axis=1, min_count=1)
    df["stubble_transport"] = df["fire_3d"] * df["nw_wind"]
    df = df.merge(static[["h3"] + STATIC], on="h3", how="left")
    return df


STATS = PROC / "station_stats.parquet"
K_NEIGHBOURS = 3


def station_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Per monitor: long-run mean log PM2.5 and its Diwali uplift (log-ratio inside Diwali +-48 h vs outside)."""
    d = df.assign(lp=np.log1p(df.pm25), win=df.raw_hours_from_diwali.abs() <= 48)
    g = d.groupby("station_id")
    out = g[["lat", "lon"]].first()
    out["level"] = g.lp.mean()
    inside, outside = d[d.win].groupby("station_id").lp.mean(), d[~d.win].groupby("station_id").lp.mean()
    out["uplift"] = (inside - outside).reindex(out.index).fillna(0)
    return out.reset_index()


def add_neighbours(df: pd.DataFrame, stats: pd.DataFrame, exclude_self: bool = False) -> pd.DataFrame:
    """Distance to the nearest monitor plus an inverse-distance blend of the K nearest monitors' history.
    Training passes exclude_self=True: a monitor row only sees OTHER monitors, as a far-away hexagon would.
    Works per location (not per row) so it stays fast."""
    key = "station_id" if exclude_self else "h3"
    loc = df.drop_duplicates(key)[[key, "lat", "lon"]].reset_index(drop=True)
    dy = (loc.lat.values[:, None] - stats.lat.values[None]) * 111.0
    dx = (loc.lon.values[:, None] - stats.lon.values[None]) * 98.0
    d = np.hypot(dx, dy)
    if exclude_self:
        d[loc[key].values[:, None] == stats.station_id.values[None]] = np.inf
    idx = np.argsort(d, axis=1)[:, :K_NEIGHBOURS]
    dk = np.take_along_axis(d, idx, 1)
    w = 1.0 / np.maximum(dk, 0.5) ** 2
    w /= w.sum(1, keepdims=True)
    loc["dist_monitor_km"] = dk[:, 0]
    loc["nbr_level"] = (w * stats.level.values[idx]).sum(1)
    loc["nbr_diwali_uplift"] = (w * stats.uplift.values[idx]).sum(1)
    return df.merge(loc[[key] + NEIGHBOUR], on=key, how="left")
