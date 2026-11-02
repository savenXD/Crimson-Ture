"""Fetch PM2.5 station metadata around Delhi from the OpenAQ v3 API."""
import json
import os
import requests
from ml.config import RAW, NCR_BBOX

def main():
    key = os.environ["OPENAQ_API_KEY"]
    b = NCR_BBOX
    r = requests.get(
        "https://api.openaq.org/v3/locations",
        params={"bbox": f"{b[0]},{b[1]},{b[2]},{b[3]}", "parameters_id": 2, "limit": 1000},
        headers={"X-API-Key": key}, timeout=60)
    r.raise_for_status()
    out = []
    for x in r.json()["results"]:
        first = (x.get("datetimeFirst") or {}).get("utc", "")[:10]
        last = (x.get("datetimeLast") or {}).get("utc", "")[:10]
        if not last or last < "2022-09-01":
            continue
        out.append({"id": x["id"], "name": x["name"], "lat": x["coordinates"]["latitude"],
                    "lon": x["coordinates"]["longitude"], "first": first, "last": last})
    (RAW / "stations.json").write_text(json.dumps(out, indent=1))
    print(len(out), "stations with data since 2022")

if __name__ == "__main__":
    main()
