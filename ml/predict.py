"""Forecast every Delhi hexagon for the Diwali window using the real weather forecast.

Run: python -m ml.predict      (needs `python -m ml.train` first)
"""
import json
import numpy as np
import pandas as pd
import lightgbm as lgb
import xgboost as xgb
from datetime import datetime, timedelta, timezone

from ml.config import MODELS, PROC, RAW
from ml.features import FEATURES, GROUPS, STATS, WX, add_neighbours, build, fire_daily
from ml.ingest.weather import VARS, get, points
from ml.train import nearest_pt

IST = timezone(timedelta(hours=5, minutes=30))
START = datetime(2026, 11, 6, 0, 0, tzinfo=IST)
HOURS = 144
START_UTC = START.astimezone(timezone.utc).replace(tzinfo=None)
# India is UTC+5:30, so IST midnight is 18:30 UTC. Weather and training rows sit on UTC hour boundaries,
# so forecast hour 0 is the first UTC hour at or after IST midnight (00:30 IST).
FIRST_HOUR = pd.Timestamp(START_UTC).ceil("h")


def hour_at(t):
    return FIRST_HOUR + pd.Timedelta(hours=int(t))


def forecast_weather():
    frames = []
    for i, (lat, lon) in enumerate(points()):
        d = pd.DataFrame(get("https://api.open-meteo.com/v1/forecast",
                             dict(latitude=lat, longitude=lon, timezone="UTC", forecast_days=16, hourly=VARS)))
        d["pt"] = i
        frames.append(d)
    w = pd.concat(frames, ignore_index=True)
    w["time"] = pd.to_datetime(w["time"])
    w["cams_pm25"] = np.nan
    return w


FC = PROC / "weather_fc.parquet"


def load_inputs(refresh=False):
    """Hexagon grid, weather forecast (cached unless refresh) and daily fire counts with the persistence assumption."""
    grid = pd.read_parquet(PROC / "hex_static.parquet")
    pts = pd.DataFrame(points(), columns=["lat", "lon"])
    grid["pt"] = nearest_pt(grid.lat.values, grid.lon.values, pts)
    if refresh or not FC.exists():
        forecast_weather().to_parquet(FC)
    w = pd.read_parquet(FC)
    w["time"] = pd.to_datetime(w["time"])
    fires = fire_daily()
    last = fires.iloc[-7:].mean()        # future fire counts are unknown: assume the last 7 observed days persist
    fires = fires.reindex(pd.date_range(fires.index.min(), "2026-12-31"), fill_value=np.nan).fillna(last)
    return grid, w, fires


def feature_frame(grid, hex_ids, times, w, fires):
    """Model inputs for the given hexagons and UTC hours. Used for the full forecast and for live single-hexagon runs."""
    base = grid[grid.h3.isin(hex_ids)][["h3", "lat", "lon", "pt"]].merge(pd.DataFrame({"time": times}), how="cross")
    base["t"] = (base.time - FIRST_HOUR).dt.total_seconds() // 3600
    X = add_neighbours(build(base, w, fires, grid), pd.read_parquet(STATS))
    assert len(X) == len(base), "feature build changed row count"
    missing = X[WX].isna().mean()
    assert (missing == 0).all(), f"weather forecast missing for requested hours: {missing[missing > 0].to_dict()}"
    X["t"] = base["t"].values
    return X


def main():
    grid, w, fires = load_inputs(refresh=True)
    times = pd.date_range(FIRST_HOUR, periods=HOURS, freq="h")
    X = feature_frame(grid, set(grid.h3), times, w, fires)

    models = {q: lgb.Booster(model_file=str(MODELS / f"q{q}.txt")) for q in (10, 50, 90)}
    p = {q: np.expm1(m.predict(X[FEATURES])) for q, m in models.items()}
    # hybrid median: LightGBM and XGBoost blended in log space; P10/P90 stay LightGBM quantiles
    bw = json.loads((MODELS / "blend.json").read_text())
    xg = xgb.XGBRegressor(); xg.load_model(str(MODELS / "xgb_q50.json"))
    blend = np.expm1(bw["lightgbm"] * np.log1p(p[50]) + bw["xgboost"] * xg.predict(X[FEATURES]))
    lo, hi = np.minimum(p[10], p[90]), np.maximum(p[10], p[90])
    mid = np.clip(blend, lo, hi)
    out = pd.DataFrame({"t": X.t.astype(int), "h3": X.h3, "p10": lo.round(1), "p50": mid.round(1), "p90": hi.round(1)})

    # "why": positive SHAP pushes (log space) of the median model, grouped
    contrib = models[50].predict(X[FEATURES], pred_contrib=True)[:, :-1]
    pos = {g: np.clip(contrib[:, [FEATURES.index(f) for f in fs]], 0, None).sum(1) for g, fs in GROUPS.items()}
    tot = sum(pos.values()) + 1e-9
    for g, v in pos.items():
        out["c_" + g.split()[0].lower()] = (v / tot).round(3)
    out.to_parquet(PROC / "predictions.parquet")
    print(out.describe().T[["mean", "min", "max"]])
    peak = out.groupby("t").p50.mean()
    print("city-mean PM2.5 peak at t =", int(peak.idxmax()), "->", START + timedelta(hours=int(peak.idxmax())), round(peak.max(), 1))


if __name__ == "__main__":
    main()
