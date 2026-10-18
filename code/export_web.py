"""Write the data and results used by the website (website/data/run.js).

Called by `python main.py --export-web`. Like export_latex.py, it only
serialises what the program computed, so the site never shows a number the
code did not produce. Road geometry is separate (tools/fetch_road_geometry.py
writes website/data/roads.js) and is used for drawing only. Both are scripts that
set a global (window.DC_RUN, window.DC_ROADS) so the site also works from disk.

Contents of run.js:
  locations, dist (symmetric weights), raw (directed distances)
  presented   seed, rule, route, total, trace, checks, legs, recomputed, directed_total
  optimum     Held-Karp route and length (comparison only)
  two_opt     best single 2-opt move on the presented route
  seeds       shuffled order, route, total and trace for every seed in the repeated runs (paper rule)
  experiments summary table for both merge rules, plus every run's length
  google      leg-by-leg Google Maps cross-check (data/google_maps_check_km.csv)
  source      dc_tsp.py, verify.py and original_merge_output.txt as text, and the console output of this run
"""
import csv
import json
import random
from pathlib import Path

from dc_tsp import divide_and_conquer_tsp
from verify import check_route

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUT = ROOT.parent / "website" / "data" / "run.js"


def r2(x):
    return round(x + 0.0, 4)


def pair(e):
    return [e[0], e[1]] if e else None


def cut_value(ev, coords):
    """Coordinate of the median cut line: halfway between the two halves along the split axis."""
    k = 0 if ev["axis"] == "x" else 1
    return r2((max(coords[c][k] for c in ev["left"]) + min(coords[c][k] for c in ev["right"])) / 2)


def trace_json(trace, coords):
    out, merge_no = [], 0
    for ev in trace:
        if ev["step"] == "split":
            out.append({"step": "split", "depth": ev["depth"], "cities": ev["cities"], "axis": ev["axis"],
                        "left": ev["left"], "right": ev["right"], "cut": cut_value(ev, coords)})
        elif ev["step"] == "base":
            out.append({"step": "base", "depth": ev["depth"], "cities": ev["cities"], "cost": r2(ev["cost"])})
        else:
            merge_no += 1
            out.append({"step": "merge", "name": f"M{merge_no}", "depth": ev["depth"],
                        "left_tour": ev["left_tour"], "right_tour": ev["right_tour"],
                        "left_cost": r2(ev["left_cost"]), "right_cost": r2(ev["right_cost"]),
                        "bridge": pair(ev["bridge"]), "removed": [pair(e) for e in ev["removed"]],
                        "added": [pair(e) for e in ev["added"]], "delta": r2(ev["delta"]),
                        "tour": ev["tour"], "cost": r2(ev["cost"])})
    return out


def best_two_opt(route, dist):
    """The single 2-opt move (reverse route[i..j]) that shortens the closed route the most."""
    best = None
    n = len(route) - 1
    for i in range(1, n - 1):
        for j in range(i + 1, n):
            a, b, c, d = route[i - 1], route[i], route[j], route[j + 1]
            delta = dist[a][c] + dist[b][d] - dist[a][b] - dist[c][d]
            if best is None or delta < best["delta"] - 1e-12:
                best = {"i": i, "j": j, "removed": [[a, b], [c, d]], "added": [[a, c], [b, d]],
                        "delta": r2(delta), "reversed": route[i:j + 1],
                        "route": route[:i] + route[i:j + 1][::-1] + route[j + 1:]}
    best["total"] = r2(sum(dist[best["route"][k]][best["route"][k + 1]] for k in range(n)))
    return best


def google_check(route, dist):
    with open(DATA / "google_maps_check_km.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    legs = []
    for row in rows:
        u, v = int(row["from"]), int(row["to"])
        k = int(row["leg"])
        assert [route[k - 1], route[k]] == [u, v], f"google_maps_check_km.csv leg {k} is not on the route"
        g, m = float(row["google_km"]), dist[u][v]
        legs.append({"leg": k, "from": u, "to": v, "matrix": m, "google": g,
                     "diff": r2(g - m), "pct": r2(100 * (g - m) / m)})
    matrix_total = sum(x["matrix"] for x in legs)
    google_total = sum(x["google"] for x in legs)
    return {"legs": legs, "matrix_total": r2(matrix_total), "google_total": r2(google_total),
            "pct": r2(100 * (google_total - matrix_total) / matrix_total)}


def export(locations, coords, dist, result, args, checks, recomputed, opt_route, optimum, stats, console):
    with open(DATA / "raw_directed_km.csv", newline="", encoding="utf-8") as f:
        raw = [[float(x) for x in row[1:]] for row in list(csv.reader(f))[1:]]
    start = result.route[0]
    route = result.route

    seeds = []
    for seed in range(args.runs):
        res = divide_and_conquer_tsp(coords, dist, start=start, seed=seed, rule=args.rule)
        ok = all(check_route(res.route, dist, start)[0].values())
        shuffled = list(range(len(coords)))
        random.Random(seed).shuffle(shuffled)  # Step 1 of Algorithm 2.8, as in divide_and_conquer_tsp
        seeds.append({"seed": seed, "shuffled": shuffled, "route": res.route, "total": r2(res.total), "valid": ok,
                      "optimal": abs(res.total - optimum) < 1e-9, "trace": trace_json(res.trace, coords)})

    legs = check_route(route, dist, start)[1]
    payload = {
        "generated_by": "code/main.py --export-web",
        "units": "km",
        "locations": [{"id": int(loc["id"]), "label": loc["label"], "name": loc["name"], "area": loc["area"],
                       "lat": float(loc["lat"]), "lon": float(loc["lon"]), "role": loc["role"]}
                      for loc in locations],
        "dist": dist,
        "raw": raw,
        "presented": {
            "seed": args.seed, "rule": args.rule, "route": route, "total": r2(result.total),
            "trace": trace_json(result.trace, coords),
            "checks": [{"text": text, "ok": ok} for text, ok in checks.items()]
                      + [{"text": "recomputed total equals reported total", "ok": abs(recomputed - result.total) < 1e-9}],
            "legs": [{"from": u, "to": v, "w": w} for u, v, w in legs],
            "recomputed": r2(recomputed),
            "directed_total": r2(sum(raw[route[k]][route[k + 1]] for k in range(len(route) - 1))),
            "gap_pct": r2(100 * (result.total - optimum) / optimum),
        },
        "optimum": {"route": opt_route, "total": r2(optimum)},
        "two_opt": best_two_opt(route, dist),
        "seeds": seeds,
        "experiments": {
            "runs": args.runs,
            "rules": {rule: {"best": r2(s["best"]), "worst": r2(s["worst"]), "mean": r2(s["mean"]),
                             "std": r2(s["std"]), "mean_gap_pct": r2(100 * (s["mean"] - optimum) / optimum),
                             "optimal_hits": s["optimal_hits"], "lengths": [r2(x) for x in s["lengths"]]}
                      for rule, s in stats.items()},
        },
        "google": google_check(route, dist),
        "source": {name: (ROOT / name).read_text(encoding="utf-8")
                   for name in ("dc_tsp.py", "verify.py", "original_merge_output.txt")} | {"console": console},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("window.DC_RUN = " + json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + ";\n",
                   encoding="utf-8")
    print(f"Website data written to {OUT}")
