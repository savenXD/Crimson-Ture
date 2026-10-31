"""NOx API - neighborhood-level Diwali air-quality forecasts.

Run: uvicorn backend.app.main:app --reload   (from repo root)
Time convention: `t` = hours relative to Diwali night 20:00 IST (-168 .. +168).
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.app import mock
from ml.config import DIWALI_DATES

app = FastAPI(title="NOx - Street-level Diwali Air Forecast", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

T_RANGE = Query(0, ge=-168, le=168, description="hours relative to Diwali night 20:00")


class Scenario(BaseModel):
    t: float = 0
    cracker_factor: float = Field(1.0, ge=0, le=2, description="1 = business as usual, 0.3 = green crackers only")
    traffic_factor: float = Field(1.0, ge=0, le=2, description="0.5 = odd-even / heavy-vehicle ban")


def _check(cell: str):
    if cell not in set(mock.delhi_hexes()):
        raise HTTPException(404, f"hex {cell} not in Delhi grid")


@app.get("/health")
def health():
    return {"status": "ok", "model": "mock-v0", "diwali_2026": str(DIWALI_DATES[2026])}


@app.get("/hexes")
def hexes(t: float = T_RANGE):
    """City-wide snapshot: predicted PM2.5 + AQI for every neighborhood hex at time t."""
    out = []
    for cell in mock.delhi_hexes():
        p = mock.forecast_point(cell, t)
        out.append({"h3": cell, "pm25": p["p50"], "aqi": p["aqi"], "category": p["category"]})
    return {"t": t, "resolution": 8, "cells": out}


@app.get("/forecast/{cell}")
def forecast(cell: str, start: float = -168, end: float = 168, step: int = 3):
    """Time series with P10/P50/P90 band for one neighborhood (before/during/after)."""
    _check(cell)
    series = [mock.forecast_point(cell, t) for t in range(int(start), int(end) + 1, step)]
    return {"h3": cell, "nearest_station": mock.nearest_station(cell), "series": series}


@app.get("/explain/{cell}")
def explain(cell: str, t: float = T_RANGE):
    """Source attribution (SHAP-style) - how much each driver contributes right now."""
    _check(cell)
    comps = mock.components(cell, t)
    total = sum(comps.values())
    return {"h3": cell, "t": t, "pm25": round(total, 1),
            "drivers": [{"source": k, "ug_m3": round(v, 1), "share": round(v / total, 3)}
                        for k, v in sorted(comps.items(), key=lambda kv: -kv[1])]}


@app.post("/scenario")
def scenario(s: Scenario):
    """What-if: city-wide AQI change under an intervention."""
    rows, base_total, new_total = [], 0.0, 0.0
    for cell in mock.delhi_hexes():
        base = mock.pm25(cell, s.t)
        new = mock.pm25(cell, s.t, cracker_factor=s.cracker_factor, traffic_factor=s.traffic_factor)
        base_total, new_total = base_total + base, new_total + new
        rows.append({"h3": cell, "pm25": round(new, 1), "delta": round(new - base, 1)})
    n = len(rows)
    return {"scenario": s, "mean_pm25_before": round(base_total / n, 1),
            "mean_pm25_after": round(new_total / n, 1), "cells": rows}


@app.get("/advisory/{cell}")
def advisory(cell: str, t: float = T_RANGE):
    """Plain-language health advisory + safest outdoor hours in the next 24h."""
    _check(cell)
    now = mock.forecast_point(cell, t)
    next24 = [mock.forecast_point(cell, t + h) for h in range(24)]
    safest = sorted(next24, key=lambda p: p["p50"])[:3]
    msg = {
        "Good": "Air is clean. Enjoy outdoor activities.",
        "Satisfactory": "Sensitive groups should limit long exertion outdoors.",
        "Moderate": "Children, elderly and asthma patients should reduce outdoor activity.",
        "Poor": "Avoid outdoor exercise. Wear an N95 mask outside.",
        "Very Poor": "Stay indoors, run air purifiers, N95 mandatory outdoors.",
        "Severe": "Health emergency: stay indoors, keep windows shut, avoid all outdoor exposure.",
    }[now["category"]]
    return {"h3": cell, "now": now, "advice": msg,
            "safest_hours_offset": [p["t"] - t for p in safest]}
