"""Build the edge-weight matrices from data/locations.csv.

Queries the public OSRM routing service (driving profile, OpenStreetMap road
network) for every ordered pair of locations, then writes:

  data/raw_directed_km.csv   d(i -> j) exactly as returned (one-way streets make it asymmetric)
  data/distance_matrix_km.csv  undirected weight w(i, j) = mean of both directions, 2 decimals

The solver only reads distance_matrix_km.csv. If you collect distances from
Google Maps instead, edit that file directly (keep it symmetric) and do not
re-run this script, or it will overwrite your values.

Usage:  python tools/build_dataset.py
"""
import csv
import json
import sys
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
OSRM_URL = "https://router.project-osrm.org/table/v1/driving/{coords}?annotations=distance"


def read_locations():
    with open(DATA / "locations.csv", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_matrix(path, labels, matrix):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([""] + labels)
        for label, row in zip(labels, matrix):
            writer.writerow([label] + [f"{x:.2f}" for x in row])


def main():
    locations = read_locations()
    labels = [loc["label"] for loc in locations]
    coords = ";".join(f'{loc["lon"]},{loc["lat"]}' for loc in locations)

    request = urllib.request.Request(
        OSRM_URL.format(coords=coords),
        headers={"User-Agent": "dc-tsp-student-project/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if payload.get("code") != "Ok":
        sys.exit(f"OSRM error: {payload}")

    directed = [[d / 1000 for d in row] for row in payload["distances"]]
    n = len(directed)
    undirected = [
        [0.0 if i == j else round((directed[i][j] + directed[j][i]) / 2, 2) for j in range(n)]
        for i in range(n)
    ]

    write_matrix(DATA / "raw_directed_km.csv", labels, directed)
    write_matrix(DATA / "distance_matrix_km.csv", labels, undirected)
    print(f"Wrote {n}x{n} matrices to {DATA}")


if __name__ == "__main__":
    main()
