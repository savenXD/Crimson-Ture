"""Download hourly PM2.5 for every sensor, for each Sep15-Jan15 season (OpenAQ v3)."""
import json, os, sys, time
import pandas as pd
import requests
from ml.config import RAW, TRAIN_YEARS

# the Kaggle CPCB file already covers 2015-2020, so OpenAQ is only needed from 2022 on
YEARS = [y for y in TRAIN_YEARS if y >= 2022] if (RAW / "kaggle" / "station_hour.csv").exists() else TRAIN_YEARS

OUT = RAW / "pm25_hourly.parquet"
CKPT = RAW / "pm25_ckpt.json"

def fetch(sensor, a, b, probe=False):
    rows, page = [], 1
    while True:
        for _ in range(8):
            r = requests.get(
                f"https://api.openaq.org/v3/sensors/{sensor}/hours",
                params={"datetime_from": a, "datetime_to": b, "limit": 1 if probe else 1000, "page": page},
                headers={"X-API-Key": os.environ["OPENAQ_API_KEY"]}, timeout=90)
            if r.status_code == 429:
                time.sleep(int(r.headers.get("x-ratelimit-reset", 20)) + 1); continue
            if r.status_code >= 500:
                time.sleep(5); continue
            break
        r.raise_for_status()
        res = r.json().get("results", [])
        rows += [(x["period"]["datetimeFrom"]["utc"], x["value"]) for x in res if x["value"] is not None]
        time.sleep(1.05)
        if probe or len(res) < 1000:
            return rows
        page += 1

def main():
    sensors = json.loads((RAW / "sensors.json").read_text())
    done = set(json.loads(CKPT.read_text())) if CKPT.exists() else set()
    frames = [pd.read_parquet(OUT)] if OUT.exists() else []
    for s in sensors:
        old = [y for y in YEARS if y < 2022 and f"{s['sensor']}_{y}" not in done]
        if old and not fetch(s["sensor"], "2018-09-01T00:00:00Z", "2022-01-31T00:00:00Z", probe=True):
            done.update(f"{s['sensor']}_{y}" for y in old)     # nothing before 2022: skip those seasons
            CKPT.write_text(json.dumps(sorted(done)))
        for y in YEARS + [2026]:
            a = f"{y}-09-15T00:00:00Z"
            b = f"{y + 1}-01-15T00:00:00Z" if y < 2026 else "2026-11-01T00:00:00Z"
            key = f"{s['sensor']}_{y}"
            if key in done:
                continue
            rows = fetch(s["sensor"], a, b)
            if rows:
                df = pd.DataFrame(rows, columns=["ts", "pm25"])
                df["station_id"], df["sensor"] = s["id"], s["sensor"]
                frames.append(df)
            done.add(key)
            CKPT.write_text(json.dumps(sorted(done)))
            if rows:
                pd.concat(frames).to_parquet(OUT.with_suffix('.tmp')); OUT.with_suffix('.tmp').replace(OUT)
            print(key, s["name"][:30], len(rows), flush=True)

if __name__ == "__main__":
    main()
