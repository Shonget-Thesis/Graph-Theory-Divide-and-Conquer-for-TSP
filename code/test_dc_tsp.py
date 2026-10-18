"""Sanity tests. Run:  python test_dc_tsp.py"""
import math
import random
from itertools import permutations

from dc_tsp import divide_and_conquer_tsp
from verify import check_route, held_karp


def random_instance(n, rng):
    pts = [(rng.random(), rng.random()) for _ in range(n)]
    dist = [[math.dist(p, q) for q in pts] for p in pts]
    return pts, dist


def brute_force(dist):
    n = len(dist)
    return min(dist[0][p[0]] + sum(dist[p[i]][p[i + 1]] for i in range(n - 2)) + dist[p[-1]][0]
               for p in permutations(range(1, n)))


def test_routes_are_valid_closed_tours():
    rng = random.Random(0)
    for n in range(1, 40):
        pts, dist = random_instance(n, rng)
        for rule in ("bridge", "best"):
            for seed in range(5):
                res = divide_and_conquer_tsp(pts, dist, start=0, seed=seed, rule=rule)
                checks, _, total = check_route(res.route, dist, 0)
                assert all(checks.values()), (n, rule, seed, checks)
                assert abs(total - res.total) < 1e-9


def test_held_karp_matches_brute_force():
    rng = random.Random(1)
    for n in range(3, 9):
        _, dist = random_instance(n, rng)
        route, cost = held_karp(dist)
        assert abs(cost - brute_force(dist)) < 1e-9
        assert abs(check_route(route, dist)[2] - cost) < 1e-9


def test_heuristic_never_beats_optimum():
    rng = random.Random(2)
    for n in range(3, 11):
        pts, dist = random_instance(n, rng)
        _, opt = held_karp(dist)
        for seed in range(10):
            assert divide_and_conquer_tsp(pts, dist, seed=seed).total >= opt - 1e-9


def test_website_data_matches_latex():
    """website/data/run.js and roads.js agree with the LaTeX macros and the dataset."""
    import json
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parent.parent

    def script_data(name):  # "window.X = {...};" -> {...}
        text = (root / "website/data" / name).read_text(encoding="utf-8")
        return json.loads(text[text.index("=") + 1:].strip().rstrip(";"))

    run, roads = script_data("run.js"), script_data("roads.js")
    tex = (root / "latex/shared/generated/macros.tex").read_text(encoding="utf-8")
    m = dict(re.findall(r"\\newcommand\{\\(\w+)\}\{(.*)\}", tex))

    def route(r):
        return " $\\to$ ".join(f"V{v}" for v in r)

    p, rules = run["presented"], run["experiments"]["rules"]
    assert m["DCSeed"] == str(p["seed"]) and m["DCRule"] == p["rule"]
    assert m["DCRoute"] == route(p["route"]) and m["OptRoute"] == route(run["optimum"]["route"])
    assert m["DCTotal"] == f"{p['total']:.2f}" == f"{p['recomputed']:.2f}"
    assert m["OptTotal"] == f"{run['optimum']['total']:.2f}" and m["DCGap"] == f"{p['gap_pct']:.2f}"
    assert all(c["ok"] for c in p["checks"]) and m["DCAllChecks"] == "passed"
    assert m["RunCount"] == str(run["experiments"]["runs"]) == str(len(run["seeds"]))
    for rule, prefix in (("bridge", "Bridge"), ("best", "BestRule")):
        assert m[f"{prefix}Mean"] == f"{rules[rule]['mean']:.2f}"
        assert m[f"{prefix}OptHits"] == str(rules[rule]["optimal_hits"])
    assert run["seeds"][p["seed"]]["route"] == p["route"]

    n = len(run["locations"])
    assert len(roads["pairs"]) == n * (n - 1) and not roads["mismatches"]
    for key, road in roads["pairs"].items():
        i, j = map(int, key.split("-"))
        assert abs(road["km"] - run["raw"][i][j]) <= roads["tolerance_km"], key


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"passed  {name}")
