"""Pipeline progress, derived from files on disk so it works however the pipeline was started."""
import json
from ml.config import MODELS, PROC, RAW

SEASONS = 5 if (RAW / "kaggle" / "station_hour.csv").exists() else 12  # OpenAQ seasons needed (2022-2026 when the Kaggle file covers older years)


def stages():
    sensors = json.loads((RAW / "sensors.json").read_text()) if (RAW / "sensors.json").exists() else []
    ck = RAW / "pm25_ckpt.json"
    done_keys = len(json.loads(ck.read_text())) if ck.exists() else 0
    aq_frac = min(1.0, done_keys / (len(sensors) * SEASONS)) if sensors else 0.0
    prog = (MODELS / "progress.txt").read_text() if (MODELS / "progress.txt").exists() else ""
    spec = [
        ("stations", "Finding air-quality stations around Delhi", (RAW / "sensors.json").exists(), None, ""),
        ("aq", "Downloading hourly PM2.5 history", aq_frac >= 0.999, aq_frac, f"{done_keys} of {len(sensors) * SEASONS} sensor-seasons"),
        ("weather", "Downloading weather (wind, mixing height)", (RAW / "weather_hist.parquet").exists(), None, ""),
        ("fires", "Downloading farm-fire detections (NASA)", (RAW / "fires.parquet").exists(), None, ""),
        ("map", "Mapping roads, industry, schools, hospitals", (PROC / "hex_static.parquet").exists(), None, ""),
        ("train", "Training and testing the model", (MODELS / "metrics.json").exists(), None, prog),
        ("predict", "Forecasting every hexagon for 6-12 Nov", (PROC / "predictions.parquet").exists(), None, ""),
    ]
    out, running_set = [], False
    for sid, label, done, frac, detail in spec:
        state = "done" if done else "pending"
        if not done and not running_set:
            state, running_set = "running", True
        out.append({"id": sid, "label": label, "state": state, "progress": 1.0 if done else (frac or 0.0), "detail": detail if state == "running" else ""})
    return out
