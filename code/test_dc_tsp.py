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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"passed  {name}")
