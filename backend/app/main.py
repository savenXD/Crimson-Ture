"""NOx API. Serves model predictions from ml/data/processed/predictions.parquet. There is no fallback data: until the model has run, forecast endpoints return 503."""
import json
import math
import time
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.lan import lan_ip
from backend.app import push
from backend.app.status import stages
from ml.aqi import category, pm25_to_aqi
from ml.config import DIWALI, PROC, RAW

IST = timezone(timedelta(hours=5, minutes=30))
START = datetime(2026, 11, 6, 0, 0, tzinfo=IST)          # window start (Diwali - 2 days)
HOURS = 144                                              # 6 days: D-2 ... D+3
DIWALI_T = (datetime.fromisoformat(DIWALI[2026] + "T20:00:00").replace(tzinfo=IST) - START).total_seconds() / 3600

app = FastAPI(title="NOx API")
app.include_router(push.router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def hav(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = np.sin((lat2 - lat1) * p / 2) ** 2 + np.cos(lat1 * p) * np.cos(lat2 * p) * np.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * np.arcsin(np.sqrt(a))


@lru_cache
def grid():
    g = pd.read_parquet(PROC / "hex_grid.parquet").reset_index(drop=True)
    st = json.loads((RAW / "stations.json").read_text())
    st = [s for s in st if s["last"] >= "2026-10-01" and 28.40 <= s["lat"] <= 28.88 and 76.84 <= s["lon"] <= 77.35]
    d = np.stack([hav(g.lat.values, g.lon.values, s["lat"], s["lon"]) for s in st], 1)
    g["dist_km"] = d.min(1)
    g["station"] = [st[i]["name"].split(",")[0] for i in d.argmin(1)]
    return g, st


_cache: dict = {}


def loaded():
    """Model output, reloaded whenever predictions.parquet changes. None until the model has run."""
    f = PROC / "predictions.parquet"
    if not f.exists():
        return None
    key = f.stat().st_mtime
    if _cache.get("key") != key:
        g, _ = grid()
        p = pd.read_parquet(f)
        piv = lambda c: p.pivot(index="t", columns="h3", values=c).reindex(columns=g.h3).values
        c = None
        if "c_crackers" in p:
            c = {k: piv("c_" + k) for k in ("crackers", "stubble", "weather", "local")}
        _cache.update(key=key, tables=(piv("p50"), piv("p10"), piv("p90")), causes=c)
    return _cache


def need():
    d = loaded()
    if d is None:
        raise HTTPException(503, "Forecast not ready. Run ./nox run to download data and train the model.")
    return d["tables"]


def causes():
    d = loaded()
    return d["causes"] if d else None


@app.get("/api/meta")
def meta():
    g, st = grid()
    lf = PROC / "stations_latest.json"
    latest = json.loads(lf.read_text()) if lf.exists() else {}
    stations = []
    for s in st:
        r = latest.get(str(s["id"]), {})
        stations.append({"id": s["id"], "name": s["name"].split(",")[0], "lat": s["lat"], "lon": s["lon"], "last": r.get("last"),
                         "last_time": r.get("last_time"), "url": f"https://explore.openaq.org/locations/{s['id']}"})
    return {"ready": loaded() is not None, "city": "Delhi", "start": START.isoformat(), "hours": HOURS, "diwali_t": DIWALI_T,
            "hexes": len(g), "stations": stations}


@app.get("/api/hexes")
def hexes(t: int = 0):
    g, _ = grid()
    p50, p10, p90 = need()
    t = max(0, min(HOURS - 1, t))
    aqi = pm25_to_aqi(p50[t])
    return {"t": t, "h3": g.h3.tolist(), "pm25": np.round(p50[t], 1).tolist(), "aqi": np.round(aqi).astype(int).tolist(),
            "dist": np.round(g.dist_km.values, 1).tolist()}


def advice(aqi):
    if aqi <= 100: return "Air is fine for normal activity.", "हवा सामान्य गतिविधियों के लिए ठीक है।"
    if aqi <= 200: return "Sensitive people should limit long outdoor exertion.", "संवेदनशील लोग बाहर ज़्यादा मेहनत से बचें।"
    if aqi <= 300: return "Keep children and elderly indoors. Avoid outdoor exercise.", "बच्चों और बुज़ुर्गों को घर के अंदर रखें। बाहर कसरत न करें।"
    return "Stay indoors, keep windows closed, wear an N95 if you must go out.", "घर के अंदर रहें, खिड़कियाँ बंद रखें, बाहर जाना ज़रूरी हो तो N95 मास्क पहनें।"


@app.get("/api/hex/{cell}")
def hex_detail(cell: str, t: int = 0):
    g, _ = grid()
    i = g.index[g.h3 == cell]
    if len(i) == 0:
        raise HTTPException(404, "hex not found")
    i = int(i[0])
    p50, p10, p90 = need()
    aqi = pm25_to_aqi(p50[:, i])
    t = max(0, min(HOURS - 1, t))
    row = g.iloc[i]
    series = [{"t": k, "p10": round(float(p10[k, i]), 1), "p50": round(float(p50[k, i]), 1), "p90": round(float(p90[k, i]), 1),
               "aqi": int(aqi[k])} for k in range(HOURS)]
    # peak-night window for alert text
    peak = int(np.argmax(p50[:, i]))
    en, hi = advice(float(aqi[t]))
    pk = START + timedelta(hours=peak)
    alert = {"en": f"Air in your area may reach {category(float(aqi[peak]))} around {pk:%-I %p, %d %b}. {advice(float(aqi[peak]))[0]}",
             "hi": f"{pk:%d %b} को लगभग {pk:%-I %p} बजे आपके इलाके की हवा {category(float(aqi[peak]))} स्तर तक पहुँच सकती है। {advice(float(aqi[peak]))[1]}"}
    return {"h3": cell, "lat": row.lat, "lon": row.lon, "nearest_station": row.station, "dist_km": round(float(row.dist_km), 1),
            "t": t, "aqi": int(aqi[t]), "category": category(float(aqi[t])), "pm25": round(float(p50[t, i]), 1),
            "p10": round(float(p10[t, i]), 1), "p90": round(float(p90[t, i]), 1), "advice": {"en": en, "hi": hi},
            "alert": alert, "peak_t": peak, "series": series, "causes": cause_at(i, t)}


def cause_at(i, t):
    c = causes()
    if c is None:
        return None
    names = {"crackers": "Crackers", "stubble": "Farm-fire smoke", "weather": "Weather & trapped air", "local": "Local sources"}
    return [{"name": names[k], "share": round(float(c[k][t, i]), 3)} for k in names]


@app.get("/api/model")
def model_info():
    from backend.app import modelinfo
    need()
    return modelinfo.info()


@app.get("/api/model/live")
def model_live(h3: str, t: int = 0):
    from backend.app import modelinfo
    need()
    try:
        return modelinfo.live(h3, max(0, min(HOURS - 1, t)))
    except KeyError:
        raise HTTPException(404, "hex not found")


@app.on_event("startup")
def _start_alerts():
    push.start()


@app.get("/api/connect")
def connect(request: Request):
    """Link a phone on the same Wi-Fi can open. Plain http, so the browser treats it as a normal web page, not an installable app."""
    port = request.url.port or 80
    return {"url": f"http://{lan_ip()}:{port}", "ip": lan_ip(), "port": port}


@app.get("/api/health")
def health():
    d = loaded()
    return {"ok": True, "ready": d is not None, "hexagons": int(len(grid()[0])), "forecast_hours": HOURS,
            "forecast_file_age_s": int(time.time() - (PROC / "predictions.parquet").stat().st_mtime) if d is not None else None}


@app.get("/api/proof")
def proof():
    f = PROC / "proof.json"
    if not f.exists():
        raise HTTPException(503, "Proof data not built yet. Run: python -m ml.proof")
    return json.loads(f.read_text())


@app.get("/api/status")
def status():
    return {"stages": stages()}


@app.get("/api/metrics")
def metrics():
    f = Path(__file__).resolve().parents[2] / "ml" / "models" / "metrics.json"
    return json.loads(f.read_text()) if f.exists() else {}


@app.get("/api/hotspots")
def hotspots(t: int = 0, n: int = 8):
    g, _ = grid()
    p50, _a, _b = need()
    t = max(0, min(HOURS - 1, t))
    idx = np.argsort(-p50[t])[:n]
    return [{"h3": g.h3[i], "lat": float(g.lat[i]), "lon": float(g.lon[i]), "near": g.station[i],
             "aqi": int(pm25_to_aqi(p50[t, i])), "dist_km": round(float(g.dist_km[i]), 1)} for i in idx]


# serve the built website from the same port (./nox run)
_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
