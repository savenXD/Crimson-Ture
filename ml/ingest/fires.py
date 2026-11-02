"""Daily VIIRS farm-fire counts over Punjab/Haryana (NASA FIRMS)."""
import io, os, time
import pandas as pd
import requests
from ml.config import RAW, TRAIN_YEARS

BBOX = "73.8,28.4,77.6,32.6"

def chunk(args):
    key, src, d, n = args
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/{BBOX}/{n}/{d:%Y-%m-%d}"
    for _ in range(5):
        try:
            r = requests.get(url, timeout=120)
            if r.ok and r.text.startswith("latitude"):  # FIRMS allows max 5 days per call
                return pd.read_csv(io.StringIO(r.text), usecols=["latitude", "longitude", "acq_date", "frp", "confidence"])
        except requests.RequestException:
            pass
        time.sleep(5)
    print("FAILED chunk", d, flush=True)
    return None


def main():
    from concurrent.futures import ThreadPoolExecutor
    key = os.environ["FIRMS_MAP_KEY"]
    old = pd.read_parquet(RAW / "fires.parquet") if (RAW / "fires.parquet").exists() else None
    have = lambda y: old is not None and ((old.acq_date >= f"{y}-09-05") & (old.acq_date <= f"{y}-09-12")).any()
    years = [y for y in TRAIN_YEARS if not have(y)]
    spans = [(f"{y}-09-05", f"{y + 1}-01-15") for y in years] + ([] if old is not None else [("2026-09-05", "2026-11-01")])
    now = pd.Timestamp.now("UTC").tz_localize(None)
    jobs = []
    for a, b in spans:
        d, end = pd.Timestamp(a), pd.Timestamp(b)
        while d <= end:
            n = min(5, (end - d).days + 1)
            jobs.append((key, "VIIRS_SNPP_NRT" if d > now - pd.Timedelta(days=60) else "VIIRS_SNPP_SP", d, n))
            d += pd.Timedelta(days=n)
    with ThreadPoolExecutor(6) as ex:
        frames = [f for f in ex.map(chunk, jobs) if f is not None]
    df = pd.concat(([old] if old is not None else []) + frames).drop_duplicates()
    df["acq_date"] = pd.to_datetime(df["acq_date"])
    df.to_parquet(RAW / "fires.parquet")
    print(len(jobs) - len(frames), "failed chunks;", len(df), "fire detections;", df.acq_date.min(), "->", df.acq_date.max())


if __name__ == "__main__":
    main()
