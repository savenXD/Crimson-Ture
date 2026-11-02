"""H3 grid over Delhi NCT + static per-hex features from OpenStreetMap (Overpass)."""
import json, math, time
import h3
import numpy as np
import pandas as pd
import requests
from ml.config import RAW, PROC, H3_RES

UA = {"User-Agent": "nox-hackathon/0.1"}
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]

def delhi_cells():
    r = requests.get("https://nominatim.openstreetmap.org/search",
                     params={"q": "Delhi, India", "format": "json", "polygon_geojson": 1, "limit": 1,
                             "featuretype": "state"}, headers=UA, timeout=60).json()[0]
    g = r["geojson"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    cells = set()
    for p in polys:
        shape = h3.LatLngPoly([(la, lo) for lo, la in p[0]], *[[(la, lo) for lo, la in h] for h in p[1:]])
        cells |= set(h3.polygon_to_cells(shape, H3_RES))
    return sorted(cells)

def overpass(q):
    for url in OVERPASS * 2:
        try:
            r = requests.post(url, data={"data": q}, headers=UA, timeout=300)
            if r.ok:
                return r.json()["elements"]
        except requests.RequestException:
            pass
        time.sleep(10)
    raise RuntimeError("overpass failed")

AREA = 'area["name"="Delhi"]["admin_level"="4"]->.a;'

def ways(filter_, out="geom"):
    return overpass(f'[out:json][timeout:280];{AREA}way{filter_}(area.a);out {out};')

def main():
    cells = delhi_cells()
    print(len(cells), "hexes")
    feat = pd.DataFrame({"h3": cells})
    ll = [h3.cell_to_latlng(c) for c in cells]
    feat["lat"], feat["lon"] = [a for a, _ in ll], [b for _, b in ll]
    idx = {c: i for i, c in enumerate(cells)}
    cols = {k: np.zeros(len(cells)) for k in
            ["road_major_km", "road_all_km", "industrial_frac", "green_frac", "residential_frac", "n_school", "n_hospital", "n_market"]}

    def add_line_km(els, col):
        for w in els:
            g = w.get("geometry") or []
            for a, b in zip(g, g[1:]):
                c = h3.latlng_to_cell((a["lat"] + b["lat"]) / 2, (a["lon"] + b["lon"]) / 2, H3_RES)
                if c in idx:
                    d = math.hypot((b["lat"] - a["lat"]) * 111.0, (b["lon"] - a["lon"]) * 111.0 * math.cos(math.radians(a["lat"])))
                    cols[col][idx[c]] += d

    print("roads"); add_line_km(ways('["highway"~"^(motorway|trunk|primary|secondary)(_link)?$"]'), "road_major_km")
    add_line_km(ways('["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$"]'), "road_all_km")
    cell_area = h3.cell_area(cells[0], unit="km^2")

    def add_area_frac(filter_, col):
        for w in ways(filter_, "center"):
            c = w.get("center")
            if c:
                h = h3.latlng_to_cell(c["lat"], c["lon"], H3_RES)
                if h in idx:
                    cols[col][idx[h]] += 1
    print("landuse")
    add_area_frac('["landuse"="industrial"]', "industrial_frac")
    add_area_frac('["leisure"~"^(park|garden)$"]', "green_frac")
    add_area_frac('["landuse"~"^(residential)$"]', "residential_frac")
    print("poi")
    add_area_frac('["amenity"="school"]', "n_school")
    add_area_frac('["amenity"~"^(hospital|clinic)$"]', "n_hospital")
    add_area_frac('["amenity"="marketplace"]', "n_market")
    for k, v in cols.items():
        feat[k] = v
    feat["road_density"] = feat["road_all_km"] / cell_area
    feat.to_parquet(PROC / "hex_static.parquet")
    print(feat.describe().T[["mean", "max"]])

if __name__ == "__main__":
    main()
