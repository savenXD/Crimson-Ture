"""CPCB National AQI from PM2.5 (24h-average breakpoints, applied to hourly values)."""
import numpy as np

# (pm25_lo, pm25_hi, aqi_lo, aqi_hi)
_BP = [(0, 30, 0, 50), (30, 60, 51, 100), (60, 90, 101, 200), (90, 120, 201, 300),
       (120, 250, 301, 400), (250, 500, 401, 500)]
CATS = [(50, "Good"), (100, "Satisfactory"), (200, "Moderate"), (300, "Poor"), (400, "Very Poor"), (10**9, "Severe")]


def pm25_to_aqi(pm):
    pm = np.asarray(pm, dtype=float)
    out = np.full(pm.shape, np.nan)
    for lo, hi, alo, ahi in _BP:
        m = (pm >= lo) & (pm <= hi)
        out[m] = alo + (pm[m] - lo) * (ahi - alo) / (hi - lo)
    out[pm > 500] = 500 + (pm[pm > 500] - 500) * 0.2
    return out


def category(aqi):
    for lim, name in CATS:
        if aqi <= lim:
            return name
    return "Severe"
