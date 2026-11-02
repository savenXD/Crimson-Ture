"""Independent re-check that what the site shows is real.   Run:  ./nox verify

 1. Model and forecast files are unchanged since the proof was built (SHA-256).
 2. The weather forecast covers every forecast hour (no missing inputs).
 3. Re-run the models from scratch on random hexagon-hours and compare with the saved forecast.
 4. Compare latest sensor readings with what OpenAQ's public API says right now.
"""
import hashlib
import json
import sys
from datetime import timedelta

import lightgbm as lgb
import numpy as np
import pandas as pd
import requests

from ml import predict as P
from ml.config import MODELS, PROC, RAW
from ml.features import FEATURES, WX

fails = 0


def check(name, cond, detail=""):
    global fails
    fails += 0 if cond else 1
    print(f"  {'PASS' if cond else 'FAIL'}  {name}  {detail}")


def main():
    print("1. File fingerprints")
    proof = json.loads((PROC / "proof.json").read_text()) if (PROC / "proof.json").exists() else None
    if proof:
        for name, fp in proof["fingerprints"].items():
            f = next((x for x in (MODELS / name, PROC / name) if x.exists()), None)
            check(name, f is not None and hashlib.sha256(f.read_bytes()).hexdigest() == fp["sha256"], fp["sha256"][:12])
    else:
        check("proof.json present", False, "run: python -m ml.proof")

    print("2. Weather inputs")
    grid, w, fires = P.load_inputs()
    times = pd.date_range(P.FIRST_HOUR, periods=P.HOURS, freq="h")
    X = P.feature_frame(grid, set(grid.h3), times, w, fires)
    check("no missing weather values", bool(X[WX].notna().all().all()), f"{len(X):,} hexagon-hours")

    print("3. Re-run the models from scratch")
    models = {q: lgb.Booster(model_file=str(MODELS / f"q{q}.txt")) for q in (10, 50, 90)}
    saved = pd.read_parquet(PROC / "predictions.parquet")
    pick = X.sample(200, random_state=11)
    mid = np.sort(np.stack([np.expm1(models[q].predict(pick[FEATURES])) for q in (10, 50, 90)]), axis=0)[1]
    ref = saved.set_index(["h3", "t"]).p50.reindex(list(zip(pick.h3, pick.t.astype(int)))).values
    d = np.abs(mid - ref)
    check("200 random hexagon-hours equal the saved forecast", bool((d <= 0.15).all()), f"max difference {d.max():.2f} µg/m³")

    print("4. Latest readings vs OpenAQ right now")
    import os
    key = os.environ.get("OPENAQ_API_KEY")
    latest = json.loads((PROC / "stations_latest.json").read_text()) if (PROC / "stations_latest.json").exists() else {}
    sensors = json.loads((RAW / "sensors.json").read_text())
    if not key or not latest:
        print("  SKIP  needs OPENAQ_API_KEY and stations_latest.json")
    else:
        done = 0
        for sid, r in list(latest.items()):
            if done >= 5 or not r.get("url"):
                continue
            t0 = pd.Timestamp(r["last_time"])
            vals = []
            for s in [x for x in sensors if x["id"] == int(sid)]:
                resp = requests.get(f"https://api.openaq.org/v3/sensors/{s['sensor']}/hours", headers={"X-API-Key": key}, timeout=60,
                                    params={"datetime_from": t0.isoformat(), "datetime_to": (t0 + timedelta(hours=1)).isoformat(), "limit": 5})
                vals += [x["value"] for x in resp.json().get("results", []) if x["value"] is not None and x["period"]["datetimeFrom"]["utc"][:16] == t0.strftime("%Y-%m-%dT%H:%M")]
                import time; time.sleep(1.1)
            if vals:
                done += 1
                check(f"{r['name']} {t0:%d %b %H:%M}Z", abs(np.mean(vals) - r["last"]) < 0.6, f"site {r['last']} vs OpenAQ {np.mean(vals):.1f} µg/m³")
        if done == 0:
            print("  SKIP  could not match readings to OpenAQ hours")

    print(f"\n{'ALL CHECKS PASSED' if not fails else str(fails) + ' CHECK(S) FAILED'}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
