"""Shared constants: study area, Diwali calendar, paths."""
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "data" / "processed"

# Delhi NCT study area
DELHI_CENTER = (28.6139, 77.2090)
DELHI_BBOX = {"lat_min": 28.40, "lat_max": 28.88, "lon_min": 76.84, "lon_max": 77.35}
H3_RES = 8  # ~0.74 km^2 per hex -> "neighborhood" unit

# Lakshmi Puja date as observed in Delhi. Diwali follows the lunar calendar,
# so the date moves every year -> the model needs "days from Diwali", not day-of-year.
DIWALI_DATES = {
    2015: date(2015, 11, 11),
    2016: date(2016, 10, 30),
    2017: date(2017, 10, 19),
    2018: date(2018, 11, 7),
    2019: date(2019, 10, 27),
    2020: date(2020, 11, 14),
    2021: date(2021, 11, 4),
    2022: date(2022, 10, 24),
    2023: date(2023, 11, 12),
    2024: date(2024, 10, 31),
    2025: date(2025, 10, 20),
    2026: date(2026, 11, 8),
}

# Analysis window around Diwali (days)
WINDOW_BEFORE = 7
WINDOW_AFTER = 7

# Representative CPCB/DPCC monitoring locations (used for weather/CAMS pulls and as model nodes)
STATIONS = {
    "Anand Vihar": (28.6469, 77.3159),
    "ITO": (28.6289, 77.2410),
    "Punjabi Bagh": (28.6740, 77.1310),
    "RK Puram": (28.5633, 77.1869),
    "Okhla Phase-2": (28.5308, 77.2713),
    "Jahangirpuri": (28.7328, 77.1706),
    "Dwarka Sec-8": (28.5710, 77.0719),
    "Lodhi Road": (28.5918, 77.2273),
}
