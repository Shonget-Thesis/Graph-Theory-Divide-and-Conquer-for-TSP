"""Checks on a computed route, plus an exact baseline used only for comparison.

The exact baseline (Held-Karp dynamic programming, Algorithm 2.2 of the same
paper) is NOT the assigned algorithm. It is run only to measure how far the
divide-and-conquer route is from the true optimum, so the report never claims
optimality without evidence.
"""
from itertools import combinations


def check_route(route, dist, start=0):
    """Verify the route is a valid closed tour and recompute its length leg by leg.

    Returns (checks, legs, total) where checks maps a description to True/False.
    """
    n = len(dist)
    inner = route[:-1]
    checks = {
        f"starts at V{start}": route[0] == start,
        f"returns to V{start}": route[-1] == start,
        f"has {n + 1} entries ({n} legs)": len(route) == n + 1,
        "every location visited exactly once": sorted(inner) == list(range(n)),
    }
    legs = [(route[i], route[i + 1], dist[route[i]][route[i + 1]]) for i in range(len(route) - 1)]
    total = sum(w for _, _, w in legs)
    return checks, legs, total


def held_karp(dist, start=0):
    """Exact TSP by dynamic programming over subsets, O(n^2 2^n). Fine for n <= ~15."""
    n = len(dist)
    others = [v for v in range(n) if v != start]
    best = {}  # (frozenset S, last j) -> (cost, previous)
    for j in others:
        best[(frozenset([j]), j)] = (dist[start][j], start)
    for size in range(2, n):
        for subset in combinations(others, size):
            s = frozenset(subset)
            for j in subset:
                rest = s - {j}
                best[(s, j)] = min((best[(rest, k)][0] + dist[k][j], k) for k in rest)

    full = frozenset(others)
    cost, last = min((best[(full, j)][0] + dist[j][start], j) for j in others)

    route, s = [start], full
    while last != start:
        route.append(last)
        _, prev = best[(s, last)]
        s, last = s - {last}, prev
    route.append(start)
    return route[::-1], cost
