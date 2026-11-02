"""Evidence that the numbers are real, written to ml/data/processed/proof.json.

1. Replay: train WITHOUT a past Diwali season, then compare the model's predictions with what the real sensors measured.
2. Latest real sensor readings, each with a link to the public OpenAQ page so anyone can cross-check.
3. Fingerprints (SHA-256) of the model and forecast files.
"""
import hashlib
import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from ml.config import DIWALI, MODELS, PROC, RAW
from ml.features import FEATURES
from ml.train import dataset, fit

SEASONS = (2025, 2019)


def names():
    n = {o["id"]: o["name"] for o in json.loads((RAW / "stations_all.json").read_text())}
    if (RAW / "kaggle_pm25.parquet").exists():
        k = pd.read_parquet(RAW / "kaggle_pm25.parquet", columns=["station_id", "name"]).drop_duplicates("station_id")
        n.update(dict(zip(k.station_id, k.name)))
    return n


def url(i):
    return f"https://explore.openaq.org/locations/{int(i)}" if i < 900000 else None


def short(n):
    return n.split(",")[0].strip()


def replay(df, nm):
    X, y = df[FEATURES], np.log1p(df.pm25.values)
    out = []
    for s in SEASONS:
        te = ((df.season == s) & (df.raw_hours_from_diwali.abs() <= 120)).values
        tr = (df.season != s).values
        if te.sum() < 500:
            continue
        print(f"replay {s}: training without that season ({tr.sum():,} rows)", flush=True)
        m = {q: fit(X[tr], y[tr], q, quick=True) for q in (0.1, 0.5, 0.9)}
        d = df.loc[te, ["station_id", "pm25", "raw_hours_from_diwali"]].copy()
        p = np.sort(np.stack([np.expm1(m[q].predict(X[te])) for q in (0.1, 0.5, 0.9)]), axis=0)
        d["p10"], d["p50"], d["p90"] = p
        d["h"] = d.raw_hours_from_diwali.round().astype(int)
        city = d.groupby("h")[["pm25", "p10", "p50", "p90"]].mean().round(1)
        n_st = d.groupby("h").station_id.nunique()
        city = city[n_st >= max(3, int(n_st.max() * 0.5))]
        err = d.p50 - d.pm25
        stations = []
        for sid, g in sorted(d.groupby("station_id"), key=lambda kv: -len(kv[1]))[:10]:
            g = g.sort_values("h")
            stations.append({"id": int(sid), "name": short(nm.get(sid, str(sid))), "url": url(sid), "n": int(len(g)),
                             "series": [[int(a), round(b, 1), round(c, 1), round(e, 1), round(f, 1)] for a, b, c, e, f in zip(g.h, g.pm25, g.p50, g.p10, g.p90)]})
        out.append({
            "season": int(s), "diwali": DIWALI[s], "rows": int(te.sum()), "stations_used": int(d.station_id.nunique()),
            "trained_on_rows": int(tr.sum()),
            "city": [[int(h), r.pm25, r.p50, r.p10, r.p90] for h, r in city.iterrows()],
            "stations": stations,
            "stats": {"mae": round(float(err.abs().mean()), 1), "corr": round(float(np.corrcoef(d.p50, d.pm25)[0, 1]), 2),
                      "within_range": round(float(((d.pm25 >= d.p10) & (d.pm25 <= d.p90)).mean()), 2),
                      "peak_actual": float(city.pm25.max()), "peak_pred": float(city.p50.max()),
                      "peak_actual_h": int(city.pm25.idxmax()), "peak_pred_h": int(city.p50.idxmax())},
        })
    return out


def latest(nm, delhi_only=True):
    a = pd.read_parquet(RAW / "pm25_hourly.parquet")
    a["time"] = pd.to_datetime(a.ts, utc=True)
    a = a.groupby(["station_id", "time"], as_index=False).pm25.mean()
    end = a.time.max()
    rows = []
    for sid, g in a[a.time > end - pd.Timedelta(hours=48)].groupby("station_id"):
        g = g.sort_values("time")
        name = nm.get(sid, "")
        if delhi_only and "Delhi" not in name and "Pusa" not in name:
            continue
        rows.append({"id": int(sid), "name": short(name), "url": url(sid), "last_time": g.time.iloc[-1].isoformat(),
                     "last": round(float(g.pm25.iloc[-1]), 1), "mean_24h": round(float(g[g.time > g.time.iloc[-1] - pd.Timedelta(hours=24)].pm25.mean()), 1)})
    return sorted(rows, key=lambda r: -r["last"])


def fingerprints():
    fs = {}
    for f in [MODELS / "q10.txt", MODELS / "q50.txt", MODELS / "q90.txt", MODELS / "xgb_q50.json", MODELS / "blend.json", MODELS / "metrics.json", PROC / "predictions.parquet", PROC / "hex_grid.parquet"]:
        if f.exists():
            fs[f.name] = {"sha256": hashlib.sha256(f.read_bytes()).hexdigest(), "bytes": f.stat().st_size}
    return fs


def refresh_fingerprints():
    """After a new forecast, re-record the file fingerprints (the replay itself doesn't change)."""
    f = PROC / "proof.json"
    if f.exists():
        d = json.loads(f.read_text())
        d["fingerprints"] = fingerprints()
        f.write_text(json.dumps(d))


def stations_latest():
    """Latest real reading for every station that reported in the last 48 h (shown on the map)."""
    rows = latest(names(), delhi_only=False)
    (PROC / "stations_latest.json").write_text(json.dumps({str(r["id"]): r for r in rows}))
    print(len(rows), "stations with a recent reading")


def main():
    import sys
    if "--stations" in sys.argv:
        return stations_latest()
    nm = names()
    df = dataset()
    res = {"generated": datetime.now(timezone.utc).isoformat(), "replays": replay(df, nm), "latest": latest(nm)[:12], "fingerprints": fingerprints()}
    (PROC / "proof.json").write_text(json.dumps(res))
    stations_latest()
    print("proof.json written:", [(r["season"], r["stats"]) for r in res["replays"]])


if __name__ == "__main__":
    main()
