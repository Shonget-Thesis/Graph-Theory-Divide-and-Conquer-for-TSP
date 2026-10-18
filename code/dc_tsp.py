"""Divide and Conquer heuristic for the Traveling Salesperson Problem.

This implementation is adapted from Appendix 4.8 of Luna-Garcia et al. (2024),
with the merge correction described below.

Follows Algorithm 2.8 of Luna-Garcia, Candano and Caga-anan (2024),
"Performance Analysis of Classical Algorithms for the Traveling Salesman
Problem", The Mindanawan Journal of Mathematics 6(2), 79-111:

  1. Randomly shuffle the cities.
  2. Recursively split the cities into two halves by x or y coordinate
     (axis chosen at random).
  3. Base cases: 1 city -> the city itself; 2 cities -> the edge between them.
  4. Recursively solve each half.
  5. Merge the two sub-tours through the shortest connection (bridge).
  6. Adjust the merged solution so no city is repeated.

Step 6 is where this implementation differs from the paper's listing. The
listing concatenates tour1 + bridge + tour2, which repeats the two bridge
cities and adds only one connecting edge, so the result is not a Hamiltonian
cycle. Here two sub-tours (cycles) are merged the standard way: delete one
edge from each cycle and add two cross edges, which always gives a single
cycle that visits every city exactly once.

Two merge rules are provided:

  "bridge"  paper-faithful: the shortest bridge (a, b) between the two halves
            must be one of the two added edges; the cheapest way to
            reconnect around it is chosen.
  "best"    try every pair of removed edges and keep the cheapest splice
            (a variant compared in the report).

Both rules examine O(|T1| * |T2|) = O(n^2) options per merge, so the
running time is T(n) = 2T(n/2) + O(n^2) = O(n^2), as in Theorem 2.8.

Coordinates are used only to split the cities; every cost uses the road
distance matrix.
"""
import random
from dataclasses import dataclass, field


@dataclass
class Result:
    route: list[int]  # closed route: starts and ends at the start vertex
    total: float  # total length in the matrix's unit (km)
    trace: list[dict] = field(default_factory=list)


def tour_cost(tour, dist):
    """Length of the closed cycle through `tour` (a 2-city tour costs 2*d, as in the paper)."""
    if len(tour) < 2:
        return 0.0
    return sum(dist[tour[i]][tour[(i + 1) % len(tour)]] for i in range(len(tour)))


def cycle_edges(tour):
    """Edges (u, v) of the cycle as (position, u, v). A 1-city tour has the 'edge' (a, a)."""
    m = len(tour)
    return [(i, tour[i], tour[(i + 1) % m]) for i in range(m)]


def split(cities, coords, rng):
    """Divide step: sort by a randomly chosen axis and cut at the median."""
    axis = rng.choice(["x", "y"])
    k = 0 if axis == "x" else 1
    ordered = sorted(cities, key=lambda c: (coords[c][k], c))
    mid = len(ordered) // 2
    return axis, ordered[:mid], ordered[mid:]


def shortest_bridge(left, right, dist):
    """The closest pair (a, b) with a in `left` and b in `right`."""
    return min(((a, b) for a in left for b in right), key=lambda e: (dist[e[0]][e[1]], e))


def merge(t1, t2, dist, rule="bridge"):
    """Combine two cycles into one by removing one edge from each and adding two cross edges.

    Returns (merged_tour, info) where info records the removed/added edges and the cost change.
    """
    bridge = shortest_bridge(t1, t2, dist) if rule == "bridge" else None

    best = None
    for i, a, a2 in cycle_edges(t1):
        for j, b, b2 in cycle_edges(t2):
            if bridge and not ({a, a2} & {bridge[0]} and {b, b2} & {bridge[1]}):
                continue
            # t1 rotated to run a2 ... a, t2 rotated to run b2 ... b
            r1 = t1[i + 1:] + t1[:i + 1]
            r2 = t2[j + 1:] + t2[:j + 1]
            removed = dist[a][a2] + dist[b][b2]
            options = [
                (r1 + r2, [(a, b2), (b, a2)]),  # keep t2's direction
                (r1 + r2[::-1], [(a, b), (b2, a2)]),  # reverse t2
            ]
            for merged, added in options:
                if bridge and not any({u, v} == set(bridge) for u, v in added):
                    continue
                delta = sum(dist[u][v] for u, v in added) - removed
                if best is None or delta < best[0] - 1e-12:
                    best = (delta, merged, [(a, a2), (b, b2)], added)

    delta, merged, removed_edges, added_edges = best
    info = {
        "bridge": bridge,
        "removed": [e for e in removed_edges if e[0] != e[1]],
        "added": added_edges,
        "delta": delta,
    }
    return merged, info


def solve(cities, coords, dist, rng, rule, trace, depth=0):
    """Recursive divide and conquer. Returns a cycle (list of vertices, not closed)."""
    if len(cities) <= 2:
        tour = list(cities)
        trace.append({"step": "base", "depth": depth, "cities": tour, "cost": tour_cost(tour, dist)})
        return tour

    axis, left, right = split(cities, coords, rng)
    trace.append({"step": "split", "depth": depth, "cities": list(cities), "axis": axis,
                  "left": left, "right": right})

    t1 = solve(left, coords, dist, rng, rule, trace, depth + 1)
    t2 = solve(right, coords, dist, rng, rule, trace, depth + 1)
    merged, info = merge(t1, t2, dist, rule)

    cost1, cost2, cost = tour_cost(t1, dist), tour_cost(t2, dist), tour_cost(merged, dist)
    assert abs(cost1 + cost2 + info["delta"] - cost) < 1e-9, "merge bookkeeping is inconsistent"
    trace.append({"step": "merge", "depth": depth, "left_tour": t1, "right_tour": t2,
                  "left_cost": cost1, "right_cost": cost2, **info, "tour": merged, "cost": cost})
    return merged


def divide_and_conquer_tsp(coords, dist, start=0, seed=None, rule="bridge"):
    """Solve the TSP heuristically. Returns a Result whose route starts and ends at `start`."""
    rng = random.Random(seed)
    cities = list(range(len(coords)))
    rng.shuffle(cities)  # Step 1 of Algorithm 2.8

    trace = []
    tour = solve(cities, coords, dist, rng, rule, trace)

    k = tour.index(start)
    route = tour[k:] + tour[:k] + [start]
    total = sum(dist[route[i]][route[i + 1]] for i in range(len(route) - 1))
    return Result(route, total, trace)
