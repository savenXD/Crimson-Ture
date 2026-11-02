"""What model is running, on what, and a live single-hexagon run of the real trained model."""
import hashlib
import json
import os
import platform
import sys
import time
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb

from ml import predict as P
from ml.aqi import category, pm25_to_aqi
from ml.config import MODELS, PROC, RAW
from ml.features import FEATURES, GROUPS

GROUP_OF = {f: g for g, fs in GROUPS.items() for f in fs}
LABELS = {
    "hours_from_diwali": "Hours from Diwali night", "cracker_window": "Inside cracker window", "hour_sin": "Time of day (sin)",
    "hour_cos": "Time of day (cos)", "dow": "Day of week", "lat": "Latitude", "lon": "Longitude",
    "temperature_2m": "Temperature", "relative_humidity_2m": "Humidity", "wind_speed_10m": "Wind speed",
    "precipitation": "Rain", "boundary_layer_height": "Mixing height", "surface_pressure": "Surface pressure",
    "wind_u": "Wind east-west", "wind_v": "Wind north-south", "ventilation": "Ventilation (wind × mixing height)",
    "nw_wind": "North-west wind", "fire_lag1": "Farm fires, 1 day ago", "fire_lag2": "Farm fires, 2 days ago",
    "fire_lag3": "Farm fires, 3 days ago", "fire_3d": "Farm fires, last 3 days", "stubble_transport": "Fire smoke carried by NW wind",
    "road_major_km": "Major road length", "road_all_km": "All road length", "road_density": "Road density",
    "industrial_frac": "Industrial areas", "green_frac": "Parks & greenery", "residential_frac": "Residential areas",
    "n_school": "Schools", "n_hospital": "Hospitals & clinics", "n_market": "Markets",
    "dist_monitor_km": "Distance to nearest monitor", "nbr_level": "Nearby monitors: usual level (log)", "nbr_diwali_uplift": "Nearby monitors: Diwali rise (log)",
}
UNITS = {"dist_monitor_km": "km", "temperature_2m": "°C", "relative_humidity_2m": "%", "wind_speed_10m": "km/h", "precipitation": "mm",
         "boundary_layer_height": "m", "surface_pressure": "hPa", "hours_from_diwali": "h", "ventilation": "×1000 m²/s",
         "road_major_km": "km", "road_all_km": "km", "road_density": "km/km²"}


@lru_cache
def boosters():
    return {q: lgb.Booster(model_file=str(MODELS / f"q{q}.txt")) for q in (10, 50, 90)}


@lru_cache
def hybrid():
    """XGBoost median and the log-space blend weights, exactly as ml/predict.py uses them."""
    xg = xgb.XGBRegressor()
    xg.load_model(str(MODELS / "xgb_q50.json"))
    return xg, json.loads((MODELS / "blend.json").read_text())


@lru_cache
def inputs():
    return P.load_inputs()


def _cpu():
    try:
        for line in open("/proc/cpuinfo"):
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def _ram_gb():
    try:
        return round(int(open("/proc/meminfo").readline().split()[1]) / 1024 / 1024)
    except (OSError, ValueError):
        return None


def _iso(path):
    return datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat() if path.exists() else None


def info():
    from ml.train import PARAMS  # same settings the models were trained with
    b = boosters()
    imp = pd.Series(b[50].feature_importance("gain"), index=b[50].feature_name())
    imp = (imp / imp.sum()).sort_values(ascending=False)
    files = []
    for q in (10, 50, 90):
        f = MODELS / f"q{q}.txt"
        files.append({"name": f.name, "role": {10: "Low (P10)", 50: "Likely (P50)", 90: "High (P90)"}[q], "kb": round(f.stat().st_size / 1024),
                      "sha": hashlib.sha256(f.read_bytes()).hexdigest()[:12], "trees": b[q].num_trees(), "trained": _iso(f)})
    xg, bw = hybrid()
    f = MODELS / "xgb_q50.json"
    files.append({"name": f.name, "role": "Likely (XGBoost)", "kb": round(f.stat().st_size / 1024),
                  "sha": hashlib.sha256(f.read_bytes()).hexdigest()[:12], "trees": xg.get_booster().num_boosted_rounds(), "trained": _iso(f)})
    metrics = json.loads((MODELS / "metrics.json").read_text()) if (MODELS / "metrics.json").exists() else {}
    grid, w, fires = inputs()
    last_fire = fires.dropna()
    obs = P.fire_daily()
    aq_last = None
    if (RAW / "pm25_hourly.parquet").exists():
        aq_last = str(pd.to_datetime(pd.read_parquet(RAW / "pm25_hourly.parquet", columns=["ts"]).ts, utc=True).max())
    return {
        "model": {
            "family": "Hybrid: LightGBM quantile trees + XGBoost median", "version": lgb.__version__, "xgboost": xgb.__version__,
            "objective": (f"LightGBM quantile regression (10th, 50th, 90th percentile) on log(1 + PM2.5); the likely value blends "
                          f"LightGBM {bw['lightgbm']:.2f} / XGBoost {bw['xgboost']:.2f} in log space, clipped to the P10-P90 range"),
            "params": {k: v for k, v in PARAMS.items() if k in ("n_estimators", "learning_rate", "num_leaves", "min_child_samples", "subsample", "colsample_bytree", "reg_lambda")},
            "files": files, "n_features": len(FEATURES),
        },
        "features": [{"name": f, "label": LABELS.get(f, f), "group": GROUP_OF.get(f, "Other"), "gain": round(float(imp.get(f, 0)), 4)} for f in imp.index],
        "training": {"rows": metrics.get("rows"), "stations": metrics.get("stations"), "seasons": metrics.get("seasons")},
        "runtime": {"python": sys.version.split()[0], "lightgbm": lgb.__version__, "xgboost": xgb.__version__, "cpu": _cpu(), "cores": os.cpu_count(), "ram_gb": _ram_gb(),
                    "os": f"{platform.system()} {platform.release()}", "device": "CPU (no GPU used)"},
        "serving": {"hexagons": int(len(grid)), "hours": P.HOURS, "forecasts": int(len(grid) * P.HOURS), "start": P.START.isoformat()},
        "freshness": {
            "weather_forecast_fetched": _iso(P.FC), "weather_forecast_from": str(w.time.min()), "weather_forecast_to": str(w.time.max()),
            "weather_source": "Open-Meteo forecast API (9 points over Delhi)",
            "fires_last_observed": str(obs.index.max().date()), "fires_assumed_per_day": round(float(obs.iloc[-7:].mean()), 1),
            "air_quality_last_reading": aq_last, "forecast_built": _iso(PROC / "predictions.parquet"), "model_trained": _iso(MODELS / "metrics.json"),
        },
        "sources": [
            {"name": "Station PM2.5", "detail": "CPCB/DPCC/IMD monitors via OpenAQ (2022+) and the CPCB archive (2015-2020)"},
            {"name": "Weather", "detail": "Open-Meteo: ERA5 history and the live forecast, incl. mixing height"},
            {"name": "Farm fires", "detail": "NASA FIRMS VIIRS detections over Punjab and Haryana"},
            {"name": "Local features", "detail": "OpenStreetMap roads, industry, parks, schools, hospitals"},
        ],
    }


def live(h3: str, t: int):
    """Run the real trained models for one hexagon and hour. Nothing here is cached or precomputed."""
    grid, w, fires = inputs()
    if h3 not in set(grid.h3):
        raise KeyError(h3)
    when = P.hour_at(t)
    t0 = time.perf_counter()
    X = P.feature_frame(grid, [h3], [when], w, fires)
    t1 = time.perf_counter()
    row = X[FEATURES]
    b = boosters()
    out = {q: float(np.expm1(b[q].predict(row)[0])) for q in (10, 50, 90)}
    xg, bw = hybrid()
    blend = float(np.expm1(bw["lightgbm"] * np.log1p(out[50]) + bw["xgboost"] * xg.predict(row)[0]))
    contrib = b[50].predict(row, pred_contrib=True)[0]
    t2 = time.perf_counter()
    lo, hi = min(out[10], out[90]), max(out[10], out[90])
    mid = min(max(blend, lo), hi)
    items = []
    for i, f in enumerate(FEATURES):
        v = row.iloc[0][f]
        items.append({"name": f, "label": LABELS.get(f, f), "group": GROUP_OF.get(f, "Other"), "unit": UNITS.get(f, ""),
                      "value": None if pd.isna(v) else round(float(v), 3), "push": round(float(contrib[i]), 4)})
    items.sort(key=lambda x: -abs(x["push"]))
    saved = None
    try:
        s = pd.read_parquet(PROC / "predictions.parquet", filters=[("h3", "==", h3), ("t", "==", t)])
        if len(s):
            saved = float(s.p50.iloc[0])
    except Exception:
        pass
    return {
        "h3": h3, "t": t, "when_utc": str(when),
        "prediction": {"p10": round(lo, 1), "p50": round(mid, 1), "p90": round(hi, 1), "aqi": int(round(float(pm25_to_aqi(mid)))), "category": category(float(pm25_to_aqi(mid)))},
        "baseline_pm25": round(float(np.expm1(contrib[-1])), 1),
        "inputs": items,
        "timing_ms": {"features": round((t1 - t0) * 1000, 1), "model": round((t2 - t1) * 1000, 1), "total": round((t2 - t0) * 1000, 1)},
        "check": {"saved_p50": saved, "matches": None if saved is None else abs(saved - mid) <= 0.15},
        "trees_evaluated": sum(b[q].num_trees() for q in b) + xg.get_booster().num_boosted_rounds(),
    }
