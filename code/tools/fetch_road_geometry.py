"""Fetch the road path of every edge, for the website's road-snapped maps.

Queries the public OSRM route service (driving profile, OpenStreetMap road
network, the same source as build_dataset.py) once for every ordered pair of
locations and writes website/data/roads.js:

  window.DC_ROADS = {"pairs": {"0-1": {"km": 0.998, "path": [[lat, lon], ...]}, ...}, ...};

(a script rather than JSON, so the site also works when opened straight from disk)

Each path is the street route OSRM drives from u to v. The solver never reads
this file: edge weights still come only from data/distance_matrix_km.csv. The
script checks every path length against data/raw_directed_km.csv and reports
any pair that differs by more than TOLERANCE_KM, so the drawn roads match the
weights the algorithm used.

Usage:  python tools/fetch_road_geometry.py
"""
import csv
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT.parent / "website" / "data" / "roads.js"
OSRM_URL = ("https://router.project-osrm.org/route/v1/driving/{a};{b}"
            "?overview=full&geometries=geojson&steps=false")
TOLERANCE_KM = 0.02


def read_locations():
    with open(DATA / "locations.csv", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def read_matrix(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    return [[float(x) for x in row[1:]] for row in rows[1:]]


def fetch(a, b):
    url = OSRM_URL.format(a=f'{a["lon"]},{a["lat"]}', b=f'{b["lon"]},{b["lat"]}')
    request = urllib.request.Request(url, headers={"User-Agent": "dc-tsp-student-project/1.0"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            if payload.get("code") == "Ok":
                return payload
        except OSError:
            pass
        time.sleep(1.5 * (attempt + 1))
    sys.exit(f"OSRM request failed: {url}")


def main():
    locations = read_locations()
    raw = read_matrix(DATA / "raw_directed_km.csv")
    n = len(locations)

    pairs, mismatches = {}, []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            payload = fetch(locations[i], locations[j])
            route = payload["routes"][0]
            km = route["distance"] / 1000
            # GeoJSON is [lon, lat]; store [lat, lon] (Leaflet order), ~1 m precision
            path = [[round(lat, 5), round(lon, 5)] for lon, lat in route["geometry"]["coordinates"]]
            pairs[f"{i}-{j}"] = {"km": round(km, 3), "path": path}
            if abs(km - raw[i][j]) > TOLERANCE_KM:
                mismatches.append((i, j, km, raw[i][j]))
            print(f"V{i} -> V{j}: {km:.3f} km (matrix {raw[i][j]:.2f}), {len(path)} points")
            time.sleep(0.25)  # be polite to the public demo server

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("window.DC_ROADS = " + json.dumps({
        "source": "OSRM route service, driving profile, OpenStreetMap data (router.project-osrm.org)",
        "retrieved": time.strftime("%Y-%m-%d"),
        "note": "Display only. Edge weights come from code/data/distance_matrix_km.csv.",
        "tolerance_km": TOLERANCE_KM,
        "mismatches": [{"from": i, "to": j, "path_km": round(km, 3), "matrix_km": m}
                       for i, j, km, m in mismatches],
        "pairs": pairs,
    }, separators=(",", ":")) + ";\n", encoding="utf-8")

    print(f"\nWrote {len(pairs)} road paths to {OUT}")
    if mismatches:
        print(f"{len(mismatches)} path(s) differ from raw_directed_km.csv by more than {TOLERANCE_KM} km:")
        for i, j, km, m in mismatches:
            print(f"  V{i} -> V{j}: path {km:.3f} km vs matrix {m:.2f} km")
    else:
        print(f"All path lengths are within {TOLERANCE_KM} km of raw_directed_km.csv.")


if __name__ == "__main__":
    main()
