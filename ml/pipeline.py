"""One command for the whole data + model pipeline. Every step is skipped if its output already exists.

    python -m ml.pipeline            # fill in whatever is missing
    python -m ml.pipeline --refresh  # re-pull this season's data, retrain, re-forecast
"""
import json
import os
import sys
import time

from ml.config import MODELS, PROC, RAW


def step(name, done, fn):
    if done:
        print(f"  ✓ {name} (cached)", flush=True)
        return False
    print(f"  → {name} ...", flush=True)
    t0 = time.time()
    fn()
    print(f"  ✓ {name} ({time.time() - t0:.0f}s)", flush=True)
    return True


def main():
    refresh = "--refresh" in sys.argv
    if "--forecast" in sys.argv:                  # new weather forecast only (~30 s)
        from ml import predict
        (PROC / "predictions.parquet").unlink(missing_ok=True)
        predict.main()
        from ml import proof
        proof.refresh_fingerprints()
        return
    if not refresh and (PROC / "predictions.parquet").exists() and (MODELS / "metrics.json").exists():
        print("Model and forecast already built: nothing to do.")
        return
    for k in ("OPENAQ_API_KEY", "FIRMS_MAP_KEY"):
        if not os.environ.get(k) and not (RAW / "pm25_hourly.parquet").exists():
            sys.exit(f"Missing {k}. Put it in .env (see .env.example).")

    from ml.ingest import aq, fires, kaggle, osm, sensors, stations, weather
    from ml import predict, proof, train

    if refresh:                                   # re-pull only the current season
        ck = RAW / "pm25_ckpt.json"
        if ck.exists():
            ck.write_text(json.dumps([k for k in json.loads(ck.read_text()) if not k.endswith("_2026")]))
        for f in ("fires.parquet",):
            (PROC / "fires_daily.parquet").unlink(missing_ok=True)
            (RAW / f).unlink(missing_ok=True)
        for f in MODELS.glob("q*.txt"):
            f.unlink()
        (PROC / "predictions.parquet").unlink(missing_ok=True)
        (PROC / "proof.json").unlink(missing_ok=True)

    print("Data")
    step("stations", (RAW / "stations.json").exists(), stations.main)
    step("sensors", (RAW / "sensors.json").exists(), sensors.main)
    step("air-quality history (OpenAQ, resumable)", False, aq.main)
    step("Kaggle CPCB history 2015-2020", (RAW / "kaggle_pm25.parquet").exists() or not (RAW / "kaggle" / "station_hour.csv").exists(), kaggle.main)
    step("weather history (Open-Meteo)", (RAW / "weather_hist.parquet").exists(), weather.main)
    step("farm fires (NASA FIRMS)", (RAW / "fires.parquet").exists(), fires.main)
    step("map features (OpenStreetMap)", (PROC / "hex_static.parquet").exists(), osm.main)
    print("Model")
    trained = step("train + evaluate", (MODELS / "q50.txt").exists(), train.main)
    step("forecast every hexagon", (PROC / "predictions.parquet").exists() and not trained, predict.main)
    step("proof: past-Diwali replay + latest readings", (PROC / "proof.json").exists(), proof.main)
    print("Pipeline complete.")


if __name__ == "__main__":
    main()
