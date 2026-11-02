"""Load the Kaggle 'Air Quality Data in India' station_hour.csv (CPCB, 2015-2020) for the Delhi-NCR stations.

Kaggle has no coordinates, so stations are matched by name to OpenAQ locations (same CPCB names).
Put station_hour.csv and stations.csv in ml/data/raw/kaggle/.
"""
import json
import re
import pandas as pd
from ml.config import NCR_BBOX, RAW

K = RAW / "kaggle"
OUT = RAW / "kaggle_pm25.parquet"
CITIES = {"Delhi", "Gurugram", "Noida", "Ghaziabad", "Faridabad", "Greater Noida", "Bahadurgarh", "Manesar", "Ballabgarh"}
MANUAL = {  # CPCB stations not found in OpenAQ's list (approximate coordinates)
    "East Arjun Nagar, Delhi - CPCB": (28.6564, 77.2913),
}


def norm(n):
    n = n.lower().replace("new delhi", "delhi")
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\b(delhi|dpcc|cpcb|imd|iitm|hspcb|uppcb|up)\b", "", n).split()


def key(n):
    parts = norm(n)
    return " ".join(parts)


def main():
    if not (K / "station_hour.csv").exists():
        print("no Kaggle file, skipping"); return
    st = pd.read_csv(K / "stations.csv")
    st = st[st.City.isin(CITIES)]
    oa = json.loads((RAW / "stations_all.json").read_text())
    by = {}
    for o in oa:
        by.setdefault(key(o["name"]), []).append(o)
    rows, miss = [], []
    for _, r in st.iterrows():
        cands = by.get(key(r.StationName), [])
        if cands:
            # prefer same agency suffix when several; otherwise first
            tag = r.StationName.split("-")[-1].strip().lower()
            c = next((o for o in cands if tag in o["name"].lower()), cands[0])
            rows.append((r.StationId, c["id"], c["lat"], c["lon"], r.StationName))
        elif r.StationName in MANUAL:
            la, lo = MANUAL[r.StationName]
            rows.append((r.StationId, 900000 + len(rows), la, lo, r.StationName))
        else:
            miss.append(r.StationName)
    m = pd.DataFrame(rows, columns=["StationId", "station_id", "lat", "lon", "name"])
    m = m[(m.lat.between(NCR_BBOX[1], NCR_BBOX[3])) & (m.lon.between(NCR_BBOX[0], NCR_BBOX[2]))]
    print(len(m), "Kaggle stations matched to coordinates; unmatched:", miss)
    h = pd.read_csv(K / "station_hour.csv", usecols=["StationId", "Datetime", "PM2.5"], parse_dates=["Datetime"])
    h = h[h.StationId.isin(m.StationId)].dropna(subset=["PM2.5"])
    h = h.rename(columns={"PM2.5": "pm25"}).merge(m[["StationId", "station_id", "lat", "lon", "name"]], on="StationId")
    h["time"] = h.Datetime - pd.Timedelta(hours=5, minutes=30)          # CPCB logs IST; we work in UTC
    h[["station_id", "time", "pm25", "lat", "lon", "name"]].to_parquet(OUT)
    print(len(h), "hourly readings,", h.time.min(), "->", h.time.max())


if __name__ == "__main__":
    main()
