"""Deterministic mock predictions with a realistic Diwali shape.

Lets the frontend be built against the final API contract before the model is trained.
Replaced in Round 2 by ml.models inference.
"""
import math
from functools import lru_cache

import h3

from ml.aqi import sub_index
from ml.config import DELHI_BBOX, H3_RES, STATIONS

# Known Delhi hotspots: (lat, lon, strength)
HOTSPOTS = [
    (28.6469, 77.3159, 1.0),   # Anand Vihar (bus terminal, traffic)
    (28.7328, 77.1706, 0.9),   # Jahangirpuri (industrial)
    (28.5308, 77.2713, 0.8),   # Okhla (industrial)
    (28.6740, 77.1310, 0.8),   # Punjabi Bagh (dense residential, crackers)
    (28.6505, 77.2303, 0.9),   # Chandni Chowk (markets, crackers)
]


@lru_cache
def delhi_hexes() -> list[str]:
    b = DELHI_BBOX
    poly = h3.LatLngPoly(
        [(b["lat_min"], b["lon_min"]), (b["lat_min"], b["lon_max"]),
         (b["lat_max"], b["lon_max"]), (b["lat_max"], b["lon_min"])]
    )
    return sorted(h3.polygon_to_cells(poly, H3_RES))


def _spatial_weight(cell: str) -> float:
    lat, lon = h3.cell_to_latlng(cell)
    w = 0.55
    for hlat, hlon, s in HOTSPOTS:
        d2 = ((lat - hlat) * 111) ** 2 + ((lon - hlon) * 98) ** 2  # km^2
        w += s * math.exp(-d2 / 30)
    # small deterministic per-hex texture
    w *= 0.9 + 0.2 * ((int(cell, 16) >> 12) % 100) / 100
    return w


def components(cell: str, t: float, cracker_factor: float = 1.0, traffic_factor: float = 1.0) -> dict:
    """PM2.5 contributions (ug/m3) at hours `t` relative to Diwali night 20:00."""
    w = _spatial_weight(cell)
    hour = (20 + t) % 24
    night = 1.0 if (hour >= 19 or hour <= 7) else 0.6        # nocturnal inversion
    background = 95 * night
    stubble = 70 * math.exp(-((t + 24) / 120) ** 2)          # season peaks around Diwali
    meteorology = 40 * night * (1 + 0.5 * math.exp(-((t - 12) / 48) ** 2))
    rush = math.exp(-((hour - 9) / 2) ** 2) + math.exp(-((hour - 19) / 2) ** 2)
    traffic = 35 * w * traffic_factor * (0.4 + rush) * (1.3 if -72 < t < 0 else 1.0)  # festive shopping
    crackers = 0.0
    if -4 < t < 14:
        crackers = 380 * w * cracker_factor * math.exp(-((t - 4) / 3.5) ** 2)
    elif 14 <= t < 72:
        crackers = 60 * w * cracker_factor * math.exp(-(t - 14) / 20)  # slow decay, stagnant air
    return {
        "crackers": crackers,
        "stubble": stubble * (0.8 + 0.2 * w),
        "traffic": traffic,
        "meteorology_trap": meteorology,
        "background": background * (0.7 + 0.3 * w),
    }


def pm25(cell: str, t: float, **factors) -> float:
    return sum(components(cell, t, **factors).values())


def forecast_point(cell: str, t: float, **factors) -> dict:
    p50 = pm25(cell, t, **factors)
    spread = 0.15 + 0.1 * min(abs(t), 72) / 72 + (0.15 if -4 < t < 14 else 0)  # wider on Diwali night
    aqi, cat = sub_index(p50)
    return {"t": t, "p10": round(p50 * (1 - spread), 1), "p50": round(p50, 1),
            "p90": round(p50 * (1 + spread), 1), "aqi": aqi, "category": cat}


def nearest_station(cell: str) -> str:
    lat, lon = h3.cell_to_latlng(cell)
    return min(STATIONS, key=lambda s: (STATIONS[s][0] - lat) ** 2 + (STATIONS[s][1] - lon) ** 2)
