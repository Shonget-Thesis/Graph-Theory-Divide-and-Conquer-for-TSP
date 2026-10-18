"""Divide and Conquer TSP: a one-day city tour of Cagayan de Oro starting at USTP.

Run:   python main.py                 (default seed and merge rule)
       python main.py --seed 7 --rule best
       python main.py --export-latex  (also refresh the tables/figures used by the LaTeX report)
       python main.py --export-web    (also refresh website/data/run.json)

Input data (see data/):
  locations.csv          vertices: name, coordinates (lat, lon)
  distance_matrix_km.csv edge weights: undirected road distance in km
"""
import argparse
import csv
import io
import statistics
import sys
import time
from pathlib import Path

from dc_tsp import divide_and_conquer_tsp
from verify import check_route, held_karp

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OUTPUT = ROOT / "output"


# ----------------------------------------------------------------------------
# Data loading
# ----------------------------------------------------------------------------
def load_locations(path=DATA / "locations.csv"):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for i, row in enumerate(rows):
        assert int(row["id"]) == i, "locations.csv ids must be 0, 1, 2, ... in order"
    return rows


def load_matrix(path=DATA / "distance_matrix_km.csv"):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    matrix = [[float(x) for x in row[1:]] for row in rows[1:]]
    n = len(matrix)
    for i in range(n):
        assert len(matrix[i]) == n and matrix[i][i] == 0, "matrix must be square with a zero diagonal"
        for j in range(n):
            assert matrix[i][j] == matrix[j][i], f"matrix must be symmetric (V{i}, V{j})"
    return matrix


# ----------------------------------------------------------------------------
# Console output
# ----------------------------------------------------------------------------
class Tee(io.TextIOBase):
    """Print as usual and keep a copy (the website replays the console output of the run)."""

    def __init__(self, stream):
        self.stream, self.copy = stream, io.StringIO()

    def write(self, text):
        self.copy.write(text)
        return self.stream.write(text)

    def flush(self):
        self.stream.flush()


def heading(text):
    print(f"\n{'=' * 78}\n{text}\n{'=' * 78}")


def vs(vertices):
    return "{" + ", ".join(f"V{v}" for v in sorted(vertices)) + "}"


def cycle(tour):
    return "-".join(f"V{v}" for v in tour + tour[:1]) if len(tour) > 1 else f"V{tour[0]}"


def edge(e, dist):
    return f"V{e[0]}-V{e[1]} ({dist[e[0]][e[1]]:.2f})"


def print_inputs(locations, dist):
    heading("INPUT DATA")
    print(f"{'Vertex':<7}{'Location':<38}{'Latitude':>11}{'Longitude':>12}")
    for loc in locations:
        tag = "  <- start/end" if loc["role"] == "start" else ""
        print(f"{loc['label']:<7}{loc['name']:<38}{float(loc['lat']):>11.5f}{float(loc['lon']):>12.5f}{tag}")

    print("\nEdge weights w(i, j): road distance in km (undirected, complete graph)")
    n = len(dist)
    print("      " + "".join(f"{'V' + str(j):>7}" for j in range(n)))
    for i in range(n):
        print(f"{'V' + str(i):<6}" + "".join(f"{dist[i][j]:>7.2f}" for j in range(n)))


def print_trace(result, dist):
    for ev in result.trace:
        pad = "  " * ev["depth"]
        if ev["step"] == "split":
            axis = "x (longitude)" if ev["axis"] == "x" else "y (latitude)"
            print(f"{pad}DIVIDE {vs(ev['cities'])} by {axis}")
            print(f"{pad}   -> {vs(ev['left'])} | {vs(ev['right'])}")
        elif ev["step"] == "base":
            print(f"{pad}BASE   {cycle(ev['cities'])}  cost = {ev['cost']:.2f} km")
        else:
            print(f"{pad}MERGE  {cycle(ev['left_tour'])} ({ev['left_cost']:.2f})"
                  f" + {cycle(ev['right_tour'])} ({ev['right_cost']:.2f})")
            if ev["bridge"]:
                print(f"{pad}   shortest bridge: {edge(ev['bridge'], dist)}")
            removed = ", ".join(edge(e, dist) for e in ev["removed"]) or "none (single city)"
            print(f"{pad}   remove: {removed}")
            print(f"{pad}   add:    {', '.join(edge(e, dist) for e in ev['added'])}")
            print(f"{pad}   cost = {ev['left_cost']:.2f} + {ev['right_cost']:.2f}"
                  f" + ({ev['delta']:+.2f}) = {ev['cost']:.2f} km  ->  {cycle(ev['tour'])}")


def print_route(route, locations, dist):
    heading("RESULTING ROUTE")
    print(" -> ".join(f"V{v}" for v in route))
    print(f"\n{'Leg':<5}{'From':<40}{'To':<40}{'km':>7}{'Cum.':>8}")
    cumulative = 0.0
    for k in range(len(route) - 1):
        u, v = route[k], route[k + 1]
        cumulative += dist[u][v]
        print(f"{k + 1:<5}{'V%d %s' % (u, locations[u]['name']):<40}"
              f"{'V%d %s' % (v, locations[v]['name']):<40}{dist[u][v]:>7.2f}{cumulative:>8.2f}")


def run_experiments(coords, dist, runs, optimum):
    """Repeat the randomized algorithm over many seeds, as in Table 2 of the paper."""
    stats = {}
    for rule in ("bridge", "best"):
        lengths = []
        t0 = time.perf_counter()
        for seed in range(runs):
            lengths.append(divide_and_conquer_tsp(coords, dist, seed=seed, rule=rule).total)
        elapsed = time.perf_counter() - t0
        stats[rule] = {
            "best": min(lengths), "worst": max(lengths), "mean": statistics.mean(lengths),
            "std": statistics.pstdev(lengths),
            "optimal_hits": sum(abs(x - optimum) < 1e-9 for x in lengths),
            "ms_per_run": 1000 * elapsed / runs, "lengths": lengths,
        }
    return stats


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, default=1, help="random seed (shuffle and split axis); default 1")
    parser.add_argument("--rule", choices=["bridge", "best"], default="bridge",
                        help="merge rule: 'bridge' follows the paper (default), 'best' is the alternative variant")
    parser.add_argument("--runs", type=int, default=100, help="repeated runs for the summary table")
    parser.add_argument("--no-plot", action="store_true", help="skip the matplotlib figures")
    parser.add_argument("--export-latex", action="store_true", help="write tables/figures for the LaTeX documents")
    parser.add_argument("--export-web", action="store_true", help="write website/data/run.json for the website")
    args = parser.parse_args()
    if args.export_web:
        sys.stdout = Tee(sys.stdout)

    locations = load_locations()
    dist = load_matrix()
    coords = [(float(loc["lon"]), float(loc["lat"])) for loc in locations]  # x = longitude, y = latitude
    start = next(int(loc["id"]) for loc in locations if loc["role"] == "start")

    print_inputs(locations, dist)

    heading(f"DIVIDE AND CONQUER  (seed = {args.seed}, merge rule = {args.rule})")
    t0 = time.perf_counter()
    result = divide_and_conquer_tsp(coords, dist, start=start, seed=args.seed, rule=args.rule)
    elapsed_ms = 1000 * (time.perf_counter() - t0)
    print_trace(result, dist)

    print_route(result.route, locations, dist)
    print(f"\nTOTAL DISTANCE (reported by algorithm): {result.total:.2f} km   [{elapsed_ms:.2f} ms]")

    heading("VERIFICATION")
    checks, legs, recomputed = check_route(result.route, dist, start)
    for text, ok in checks.items():
        print(f"  [{'OK' if ok else 'FAIL'}] {text}")
    print("  Recomputed from edge weights: " + " + ".join(f"{w:.2f}" for _, _, w in legs)
          + f" = {recomputed:.2f} km")
    match = abs(recomputed - result.total) < 1e-9
    print(f"  [{'OK' if match else 'FAIL'}] recomputed total equals reported total")

    heading("HOW GOOD IS IT?  (exact Held-Karp baseline, for comparison only)")
    opt_route, optimum = held_karp(dist, start)
    gap = 100 * (result.total - optimum) / optimum
    print(f"  Optimal route: {' -> '.join(f'V{v}' for v in opt_route)}")
    print(f"  Optimal length: {optimum:.2f} km")
    print(f"  Divide and conquer: {result.total:.2f} km  (gap = {gap:.2f}% above optimal)")

    heading(f"REPEATED RUNS  (seeds 0..{args.runs - 1})")
    stats = run_experiments(coords, dist, args.runs, optimum)
    print(f"  {'Merge rule':<12}{'Best':>8}{'Worst':>8}{'Mean':>8}{'Std':>7}{'Optimal':>10}{'ms/run':>9}")
    for rule, s in stats.items():
        print(f"  {rule:<12}{s['best']:>8.2f}{s['worst']:>8.2f}{s['mean']:>8.2f}{s['std']:>7.2f}"
              f"{s['optimal_hits']:>6}/{args.runs:<3}{s['ms_per_run']:>9.3f}")

    if not args.no_plot:
        from plots import plot_graph, plot_route, plot_steps
        OUTPUT.mkdir(exist_ok=True)
        plot_graph(locations, coords, dist, OUTPUT / "graph.png")
        plot_steps(coords, result, OUTPUT / "steps.png")
        plot_route(locations, coords, result.route, result.total, OUTPUT / "route.png")
        print(f"\nFigures saved to {OUTPUT}")

    if args.export_latex:
        from export_latex import export
        export(locations, coords, dist, result, args, checks, recomputed, opt_route, optimum, stats)

    if args.export_web:
        from export_web import export as export_web
        console = sys.stdout.copy.getvalue()
        export_web(locations, coords, dist, result, args, checks, recomputed, opt_route, optimum, stats, console)


if __name__ == "__main__":
    main()
