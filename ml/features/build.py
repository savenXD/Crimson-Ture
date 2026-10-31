"""Feature engineering: event (Diwali), meteorology, autoregressive, transport, static.

Input: hourly frame with columns [time, station, pm25, <weather vars>, cams_pm25, fire_count]
Output: model-ready frame, one row per (station, hour).
"""
import numpy as np
import pandas as pd

from ml.config import DIWALI_DATES

LAGS_H = [1, 3, 6, 24, 48, 168]
ROLL_H = [6, 24]


def add_diwali_features(df: pd.DataFrame) -> pd.DataFrame:
    """Hours relative to Diwali night (20:00 IST) of that season + phase flags."""
    diwali_night = df["time"].dt.year.map(lambda y: pd.Timestamp(DIWALI_DATES[y]) + pd.Timedelta(hours=20))
    hrs = (df["time"] - diwali_night).dt.total_seconds() / 3600
    df["hours_from_diwali"] = hrs
    df["days_from_diwali"] = np.floor((hrs + 20) / 24)
    df["phase"] = pd.cut(hrs, [-np.inf, -24, 36, np.inf], labels=["before", "during", "after"])
    # firecracker burst: Diwali night 18:00 -> next day 06:00
    df["is_cracker_window"] = ((hrs >= -2) & (hrs <= 10)).astype(int)
    df["cracker_x_hour"] = df["is_cracker_window"] * df["time"].dt.hour
    return df


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df["hour"] = df["time"].dt.hour
    df["dow"] = df["time"].dt.dayofweek
    df["hour_sin"], df["hour_cos"] = np.sin(2 * np.pi * df["hour"] / 24), np.cos(2 * np.pi * df["hour"] / 24)
    return df


def add_met_features(df: pd.DataFrame) -> pd.DataFrame:
    rad = np.deg2rad(df["wind_direction_10m"])
    df["wind_u"], df["wind_v"] = -df["wind_speed_10m"] * np.sin(rad), -df["wind_speed_10m"] * np.cos(rad)
    # Ventilation index: low = stagnant air, pollution trapped
    df["ventilation"] = df["wind_speed_10m"] / 3.6 * df["boundary_layer_height"]
    # North-westerly flow carries Punjab/Haryana stubble smoke into Delhi
    df["is_nw_wind"] = df["wind_direction_10m"].between(270, 360).astype(int)
    return df


def add_transport_features(df: pd.DataFrame) -> pd.DataFrame:
    if "fire_count" in df:
        for lag in (1, 2, 3):
            df[f"fire_lag{lag}d"] = df.groupby("station")["fire_count"].shift(24 * lag)
        df["stubble_transport"] = df["fire_lag1d"] * df["is_nw_wind"]
    return df


def add_autoregressive(df: pd.DataFrame, target: str = "pm25") -> pd.DataFrame:
    g = df.groupby("station")[target]
    for lag in LAGS_H:
        df[f"{target}_lag{lag}"] = g.shift(lag)
    for w in ROLL_H:
        df[f"{target}_roll{w}"] = g.transform(lambda s: s.shift(1).rolling(w, min_periods=1).mean())
    return df


def build(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["station", "time"]).reset_index(drop=True)
    for step in (add_time_features, add_diwali_features, add_met_features, add_transport_features, add_autoregressive):
        df = step(df)
    return df
