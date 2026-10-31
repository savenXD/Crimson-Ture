"""Quick EDA: align several Diwali seasons on 'hours from Diwali night' and plot
PM2.5 against the ventilation index (wind x boundary-layer height).

Uses CAMS + ERA5 via Open-Meteo (no keys). If the Kaggle CPCB file is present in
ml/data/raw/, ground-truth station PM2.5 for 2015-2019 Diwalis is plotted too.

Usage: python -m ml.eda_diwali  -> docs/img/diwali_eda.png
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from ml.config import RAW_DIR
from ml.features.build import add_diwali_features, add_met_features
from ml.ingest.aq import fetch_cams_diwali_windows, load_cpcb_kaggle
from ml.ingest.weather import fetch_diwali_windows

OUT = Path(__file__).resolve().parents[1] / "docs" / "img" / "diwali_eda.png"
YEARS = [2022, 2023, 2024]


def main():
    cams = fetch_cams_diwali_windows(YEARS)
    met = fetch_diwali_windows(YEARS)
    df = cams.merge(met, on=["time", "station", "diwali_year"])
    df = add_met_features(add_diwali_features(df))
    city = df.groupby(["diwali_year", "hours_from_diwali"])[["cams_pm25", "ventilation"]].mean().reset_index()

    n_rows = 3 if (RAW_DIR / "station_hour.csv").exists() else 2
    fig, axes = plt.subplots(n_rows, 1, figsize=(11, 3.2 * n_rows), sharex=True)
    for year, g in city.groupby("diwali_year"):
        axes[0].plot(g["hours_from_diwali"], g["cams_pm25"], label=f"Diwali {year}")
        axes[1].plot(g["hours_from_diwali"], g["ventilation"] / 1000, label=f"{year}")
    axes[0].set_ylabel("PM2.5 µg/m³\n(CAMS global model)")
    axes[0].set_title("Delhi around Diwali: PM2.5 vs ability of air to disperse it")
    axes[1].set_ylabel("Ventilation index\n(×1000 m²/s)")

    if n_rows == 3:
        cpcb = add_diwali_features(load_cpcb_kaggle())
        cpcb = cpcb[cpcb["hours_from_diwali"].between(-168, 168)]
        gt = cpcb.groupby([cpcb["time"].dt.year, "hours_from_diwali"])["pm25"].mean().reset_index()
        for year, g in gt.groupby("time"):
            axes[2].plot(g["hours_from_diwali"], g["pm25"], label=f"Diwali {year}")
        axes[2].set_ylabel("PM2.5 µg/m³\n(CPCB ground stations)")
        axes[2].legend(fontsize=8)

    for ax in axes:
        ax.axvline(0, color="red", ls="--", lw=1)
        ax.axvspan(-24, 36, color="red", alpha=0.06)
        ax.grid(alpha=0.3)
    axes[0].legend(fontsize=8)
    axes[-1].set_xlabel("hours from Diwali night (20:00 IST)")
    fig.tight_layout()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT, dpi=130)
    print(f"saved {OUT}")


if __name__ == "__main__":
    main()
