"""Static per-hex covariates from OpenStreetMap (traffic proxy + land use).

There is no free historical traffic feed for Delhi, so traffic load is proxied by
major-road length per hex x hour-of-day/weekday profile x festive-shopping days.
These static features also let the model predict hexes with no monitor
(land-use regression).

Features per H3 hex (res 8):
  road_km_major, road_km_minor, dist_to_highway_m,
  industrial_frac, green_frac, n_markets, population (WorldPop)
"""
import h3

from ml.config import DELHI_BBOX, H3_RES

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
MAJOR_ROADS = "motorway|trunk|primary|secondary"


def delhi_hexes(res: int = H3_RES) -> list[str]:
    b = DELHI_BBOX
    poly = h3.LatLngPoly(
        [(b["lat_min"], b["lon_min"]), (b["lat_min"], b["lon_max"]),
         (b["lat_max"], b["lon_max"]), (b["lat_max"], b["lon_min"])]
    )
    return list(h3.polygon_to_cells(poly, res))


def overpass_roads_query() -> str:
    b = DELHI_BBOX
    return f"""[out:json][timeout:120];
way["highway"~"{MAJOR_ROADS}"]({b['lat_min']},{b['lon_min']},{b['lat_max']},{b['lon_max']});
out geom;"""


def build_static_features():
    # TODO(round2): run overpass_roads_query(), assign road segments to hexes,
    # sum length per hex; same for landuse=industrial, leisure=park, shop=*/amenity=marketplace.
    raise NotImplementedError


if __name__ == "__main__":
    print(f"{len(delhi_hexes()):,} H3 res-{H3_RES} hexes cover Delhi")
