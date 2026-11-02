"""Shared constants for the NOx pipeline (Delhi)."""
import os
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "ml" / "data" / "raw"
PROC = ROOT / "ml" / "data" / "processed"
MODELS = ROOT / "ml" / "models"


def load_env():
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


load_env()

# Delhi NCT bounding box (lon_min, lat_min, lon_max, lat_max)
DELHI_BBOX = (76.84, 28.40, 77.35, 28.88)
# wider box used for pulling training stations (NCR neighbours help the model)
NCR_BBOX = (76.7, 28.3, 77.5, 29.0)
H3_RES = 8

# Diwali night (Lakshmi Puja) dates
DIWALI = {
    2015: "2015-11-11", 2016: "2016-10-30", 2017: "2017-10-19",
    2018: "2018-11-07", 2019: "2019-10-27",
    2020: "2020-11-14", 2021: "2021-11-04", 2022: "2022-10-24", 2023: "2023-11-12",
    2024: "2024-11-01", 2025: "2025-10-20", 2026: "2026-11-08",
}
DIWALI_DT = {y: datetime.fromisoformat(d + "T20:00:00") for y, d in DIWALI.items()}

# Seasons used for training: mid-Sep to mid-Jan (covers stubble + Diwali + winter)
TRAIN_YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
SEASON_START = (9, 15)
SEASON_END = (1, 15)
