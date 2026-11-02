"""Resolve PM2.5 sensors for each station and record their date spans."""
import json, os, time, requests
from ml.config import RAW

H = lambda: {"X-API-Key": os.environ["OPENAQ_API_KEY"]}

def get(url, **kw):
    for _ in range(6):
        r = requests.get(url, headers=H(), timeout=60, **kw)
        if r.status_code == 429:
            time.sleep(int(r.headers.get("x-ratelimit-reset", 20)) + 1); continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("rate limited")

def main():
    stations = json.loads((RAW / "stations.json").read_text())
    out = []
    for i, s in enumerate(stations):
        d = get(f"https://api.openaq.org/v3/locations/{s['id']}")["results"][0]
        for sen in d["sensors"]:
            if sen["parameter"]["name"] != "pm25":
                continue
            out.append({**s, "sensor": sen["id"],
                        "s_first": (sen.get("datetimeFirst") or {}).get("utc", "")[:10],
                        "s_last": (sen.get("datetimeLast") or {}).get("utc", "")[:10]})
        time.sleep(1.05)
    (RAW / "sensors.json").write_text(json.dumps(out, indent=1))
    print(len(out), "pm25 sensors")

if __name__ == "__main__":
    main()
