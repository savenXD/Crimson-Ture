"""Train the NOx model and evaluate it honestly.

Tests:  1) hide-a-station (GroupKFold by station)   2) hold out a whole Diwali season   3) baselines
Run:    python -m ml.train
"""
import json
import h3
import lightgbm as lgb
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import GroupKFold

from ml.aqi import category, pm25_to_aqi
from ml.config import DIWALI_DT, H3_RES, MODELS, PROC, RAW
from ml.features import FEATURES, STATS, add_neighbours, build, fire_daily, station_stats

PARAMS = dict(n_estimators=400, learning_rate=0.06, num_leaves=48, min_child_samples=60, subsample=0.8,
              subsample_freq=1, colsample_bytree=0.8, reg_lambda=2.0, n_jobs=16, verbose=-1)
XGB_PARAMS = dict(n_estimators=400, learning_rate=0.06, max_depth=8, min_child_weight=40, subsample=0.8,
                  colsample_bytree=0.8, reg_lambda=2.0, tree_method="hist", n_jobs=16, objective="reg:absoluteerror")


def say(msg):
    """Progress line: printed, and saved so the website can show it live."""
    print(msg, flush=True)
    MODELS.mkdir(exist_ok=True)
    (MODELS / "progress.txt").write_text(msg)


def load_weather():
    w = pd.read_parquet(RAW / "weather_hist.parquet")
    w["time"] = pd.to_datetime(w["time"])
    return w.drop(columns=["lat", "lon"]), w.groupby("pt")[["lat", "lon"]].first()


def nearest_pt(lat, lon, pts):
    d = (lat[:, None] - pts.lat.values[None]) ** 2 + ((lon[:, None] - pts.lon.values[None]) * 0.88) ** 2
    return pts.index.values[d.argmin(1)]


def dataset():
    oa = pd.read_parquet(RAW / "pm25_hourly.parquet")
    oa["time"] = pd.to_datetime(oa["ts"], utc=True).dt.tz_localize(None)
    coords = pd.DataFrame(json.loads((RAW / "stations_all.json").read_text()))[["id", "lat", "lon"]].rename(columns={"id": "station_id"})
    oa = oa.merge(coords, on="station_id")[["station_id", "time", "pm25", "lat", "lon"]]
    parts = [oa]
    if (RAW / "kaggle_pm25.parquet").exists():                    # CPCB 2015-2020 (Kaggle), already in UTC
        parts.append(pd.read_parquet(RAW / "kaggle_pm25.parquet")[["station_id", "time", "pm25", "lat", "lon"]])
    aq = pd.concat(parts, ignore_index=True)
    aq["time"] = aq["time"].dt.floor("h")
    aq = aq[(aq.pm25 > 0) & (aq.pm25 < 1500)]
    aq = aq.groupby(["station_id", "time"], as_index=False).agg(pm25=("pm25", "mean"), lat=("lat", "first"), lon=("lon", "first"))
    aq["h3"] = [h3.latlng_to_cell(a, b, H3_RES) for a, b in zip(aq.lat, aq.lon)]
    w, pts = load_weather()
    aq["pt"] = nearest_pt(aq.lat.values, aq.lon.values, pts)
    static = pd.read_parquet(PROC / "hex_static.parquet")
    df = build(aq, w, fire_daily(), static)
    df = df.dropna(subset=["temperature_2m", "boundary_layer_height", "raw_hours_from_diwali"]).reset_index(drop=True)
    df["season"] = df.time.dt.year.where(df.time.dt.month >= 6, df.time.dt.year - 1)
    stats = station_stats(df)
    stats.to_parquet(STATS)                      # forecasting reads this to give every hexagon its neighbours
    return add_neighbours(df, stats, exclude_self=True)


def phase(h):
    return np.where(h < -24, "before", np.where(h <= 36, "during", "after"))


def fit(X, y, alpha=None, quick=False):
    p = dict(PARAMS)
    if quick:                      # evaluation fits use every 2nd hour: ~2x faster, slightly pessimistic
        X, y = X.iloc[::2], y[::2]
    if alpha is None:
        return lgb.LGBMRegressor(objective="regression_l1", **p).fit(X, y)
    return lgb.LGBMRegressor(objective="quantile", alpha=alpha, **p).fit(X, y)


def fit_xgb(X, y, quick=False):
    """Second model family for the hybrid: XGBoost on the same features (median / L1)."""
    if quick:
        X, y = X.iloc[::2], y[::2]
    return xgb.XGBRegressor(**XGB_PARAMS).fit(X, y)


def scores(y, p):
    e = p - y
    cat = np.mean([category(a) == category(b) for a, b in zip(pm25_to_aqi(y), pm25_to_aqi(p))])
    return {"mae": round(float(np.abs(e).mean()), 1), "rmse": round(float(np.sqrt((e ** 2).mean())), 1),
            "r2": round(float(1 - (e ** 2).sum() / ((y - y.mean()) ** 2).sum()), 3), "aqi_category_acc": round(float(cat), 3), "n": int(len(y))}


def nearest_other_station(df):
    """Baseline: copy the value of the nearest OTHER station at the same hour."""
    out = np.full(len(df), np.nan)
    stations = df.groupby("station_id")[["lat", "lon"]].first()
    piv = df.pivot_table(index="time", columns="station_id", values="pm25")
    for sid, g in df.groupby("station_id"):
        d = np.hypot((stations.lat - stations.loc[sid, "lat"]) * 111, (stations.lon - stations.loc[sid, "lon"]) * 98)
        d = d.drop(sid).sort_values()
        vals = None
        for o in d.index:
            col = piv[o].reindex(g.time).values
            vals = col if vals is None else np.where(np.isnan(vals), col, vals)
        out[g.index] = vals
    return out


def main():
    (MODELS / "progress.txt").unlink(missing_ok=True)
    say("Preparing features from every station-hour")
    df = dataset()
    say(f"{len(df):,} station-hours from {df.station_id.nunique()} stations across {df.season.nunique()} seasons")
    X, y = df[FEATURES], np.log1p(df.pm25.values)
    report = {"rows": int(len(df)), "stations": int(df.station_id.nunique()), "seasons": [int(s) for s in sorted(df.season.unique())]}

    # 1) hide-a-station
    pred, pred_x = np.zeros(len(df)), np.zeros(len(df))
    for k, (tr, te) in enumerate(GroupKFold(n_splits=5).split(X, y, df.station_id), 1):
        say(f"Hide-a-station test: fold {k} of 5 (predicting stations the model has never seen)")
        pred[te] = np.expm1(fit(X.iloc[tr], y[tr], quick=True).predict(X.iloc[te]))
        pred_x[te] = np.expm1(fit_xgb(X.iloc[tr], y[tr], quick=True).predict(X.iloc[te]))
    # hybrid: pick the LightGBM share that gives the lowest hide-a-station error (blend in log space)
    grid = np.linspace(0, 1, 21)
    mae = [np.abs(np.expm1(w * np.log1p(pred) + (1 - w) * np.log1p(pred_x)) - df.pm25.values).mean() for w in grid]
    w_lgb = float(grid[int(np.argmin(mae))])
    pred_h = np.expm1(w_lgb * np.log1p(pred) + (1 - w_lgb) * np.log1p(pred_x))
    df["cv_pred"] = pred_h
    MODELS.mkdir(exist_ok=True)
    (MODELS / "blend.json").write_text(json.dumps({"lightgbm": w_lgb, "xgboost": round(1 - w_lgb, 2)}))
    df["nn_pred"] = nearest_other_station(df)
    ok = df.nn_pred.notna()
    report["blend_weights"] = {"lightgbm": w_lgb, "xgboost": round(1 - w_lgb, 2)}
    report["hide_a_station"] = {"lightgbm_only": scores(df.pm25.values, pred), "xgboost_only": scores(df.pm25.values, pred_x),
                                "model": scores(df.pm25.values, pred_h), "model_same_rows": scores(df.pm25[ok].values, pred_h[ok]),
                                "copy_nearest_station": scores(df.pm25[ok].values, df.nn_pred[ok].values)}
    c = df.cams_pm25.notna()
    if c.sum() > 1000:
        report["hide_a_station"]["cams_global_model"] = scores(df.pm25[c].values, df.cams_pm25[c].values)
        report["hide_a_station"]["model_same_rows_as_cams"] = scores(df.pm25[c].values, pred_h[c])
    ph = phase(df.raw_hours_from_diwali.values)
    report["by_phase"] = {p: scores(df.pm25[ph == p].values, pred_h[ph == p]) for p in ("before", "during", "after") if (ph == p).sum() > 200}

    # 2) hold out a whole Diwali season (stations also unseen is NOT required here: this tests the future-year case)
    seasons = [s for s in (2017, 2019, 2022, 2025) if s in set(df.season)]   # unseen-Diwali tests
    report["held_out_season"] = {}
    for s in seasons:
        te = (df.season == s).values
        win = te & (np.abs(df.raw_hours_from_diwali.values) <= 96)
        print(f'season {s}: rows {te.sum()}, in Diwali window {win.sum()}')
        if win.sum() < 300 or (~te).sum() < 20000:
            say(f'Skipping season {s}: not enough data'); 
            continue
        say(f"Unseen-Diwali test: training without the {s} season")
        m = fit(X[~te], y[~te], quick=True)
        report["held_out_season"][int(s)] = scores(df.pm25[win].values, np.expm1(m.predict(X[win])))
        report["held_out_season"][int(s)]["window"] = "Diwali ±4 days"
        report["held_out_season"][int(s)]["peak_actual"] = round(float(df.pm25[win].quantile(.95)), 0)
        report["held_out_season"][int(s)]["peak_predicted"] = round(float(np.expm1(m.predict(X[win])).max()), 0)

    # 3) final models: P10 / P50 / P90
    MODELS.mkdir(exist_ok=True)
    say("Training the final model (low / likely / high range)")
    final = {q: fit(X, y, q) for q in (0.1, 0.5, 0.9)}
    for q, m in final.items():
        m.booster_.save_model(str(MODELS / f"q{int(q * 100)}.txt"))
    xgb_final = fit_xgb(X, y)
    xgb_final.save_model(str(MODELS / "xgb_q50.json"))
    lo, hi = final[0.1].predict(X), final[0.9].predict(X)
    report["interval_p10_p90_coverage_in_sample"] = round(float(np.mean((y >= lo) & (y <= hi))), 3)
    imp = pd.Series(final[0.5].booster_.feature_importance("gain"), index=FEATURES)
    report["top_features"] = {k: round(float(v / imp.sum()), 3) for k, v in imp.sort_values(ascending=False).head(10).items()}
    (MODELS / "metrics.json").write_text(json.dumps(report, indent=1))
    say("Model trained and tested")
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
