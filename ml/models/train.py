"""LightGBM quantile forecaster + baselines + leave-one-station-out CV.

- One global model across all stations (shares the Diwali pattern across neighborhoods)
- Quantiles P10/P50/P90 -> honest uncertainty band on the dashboard
- Validation:
    * temporal: hold out an entire Diwali season (e.g. train <=2022, test 2023)
    * spatial: leave-one-station-out -> proves skill at unmonitored neighborhoods
- Baselines to beat: persistence (t-24h) and CAMS global model
"""
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

QUANTILES = [0.1, 0.5, 0.9]
TARGET = "pm25"
DROP = {"time", "station", "phase", TARGET}


def feature_cols(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in DROP and pd.api.types.is_numeric_dtype(df[c])]


def fit_quantile_models(train: pd.DataFrame) -> dict[float, lgb.LGBMRegressor]:
    X, y = train[feature_cols(train)], train[TARGET]
    models = {}
    for q in QUANTILES:
        m = lgb.LGBMRegressor(objective="quantile", alpha=q, n_estimators=600, learning_rate=0.03,
                              num_leaves=31, min_child_samples=20, subsample=0.8, colsample_bytree=0.8,
                              verbose=-1)
        models[q] = m.fit(X, y)
    return models


def predict(models, df: pd.DataFrame) -> pd.DataFrame:
    X = df[feature_cols(df)]
    return pd.DataFrame({f"p{int(q * 100)}": m.predict(X) for q, m in models.items()}, index=df.index)


def score(y_true, y_pred) -> dict:
    return {"rmse": root_mean_squared_error(y_true, y_pred), "mae": mean_absolute_error(y_true, y_pred)}


def baselines(test: pd.DataFrame) -> dict:
    out = {"persistence_24h": score(test[TARGET], test[f"{TARGET}_lag24"])}
    if "cams_pm25" in test:
        out["cams"] = score(test[TARGET], test["cams_pm25"])
    return out


def temporal_split_eval(df: pd.DataFrame, test_year: int) -> dict:
    df = df.dropna(subset=[TARGET, f"{TARGET}_lag24"])
    train, test = df[df["time"].dt.year < test_year], df[df["time"].dt.year == test_year]
    models = fit_quantile_models(train)
    preds = predict(models, test)
    coverage = np.mean((test[TARGET] >= preds["p10"]) & (test[TARGET] <= preds["p90"]))
    return {"model": score(test[TARGET], preds["p50"]), "p10_p90_coverage": coverage, **baselines(test)}


def leave_one_station_out(df: pd.DataFrame, static_only_lags: bool = True) -> pd.DataFrame:
    """Spatial generalization: train without station s, predict s.

    With static_only_lags=True the held-out station's own PM2.5 lags are removed,
    simulating a neighborhood that has no sensor at all.
    """
    df = df.dropna(subset=[TARGET])
    rows = []
    for s in df["station"].unique():
        train, test = df[df["station"] != s], df[df["station"] == s].copy()
        if static_only_lags:
            lag_cols = [c for c in test.columns if c.startswith(f"{TARGET}_")]
            train, test = train.drop(columns=lag_cols), test.drop(columns=lag_cols)
        preds = predict(fit_quantile_models(train), test)
        rows.append({"station": s, **score(test[TARGET], preds["p50"])})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    # TODO(round2): load merged CPCB + weather + fires frame, build features, run evals
    # from ml.features.build import build
    # df = build(pd.read_parquet(PROCESSED_DIR / "merged.parquet"))
    # print(temporal_split_eval(df, test_year=2019)); print(leave_one_station_out(df))
    print("train skeleton ready")
