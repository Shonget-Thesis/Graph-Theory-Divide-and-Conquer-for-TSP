"""Figures: the weighted graph model and the resulting route, on one map of downtown Cagayan de Oro."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyArrowPatch  # noqa: E402

LABEL_ABOVE = {"V5", "V7", "V9"}  # names drawn above the marker to avoid overlaps
START_COLOR, STOP_COLOR, EDGE_COLOR, ROUTE_COLOR = "#c0392b", "#1f4e79", "#b0b7c3", "#2e86c1"


def _base(ax, locations, coords, title):
    for loc, (x, y) in zip(locations, coords):
        is_start = loc["role"] == "start"
        ax.scatter(x, y, s=300 if is_start else 230, color=START_COLOR if is_start else STOP_COLOR,
                   zorder=3, edgecolor="white", linewidth=1.5)
        ax.annotate(loc["label"], (x, y), color="white", fontsize=7.5, fontweight="bold",
                    ha="center", va="center", zorder=4)
        above = loc["label"] in LABEL_ABOVE
        ax.annotate(loc["name"], (x, y), xytext=(0, 13 if above else -13), textcoords="offset points",
                    fontsize=7.5, ha="center", va="bottom" if above else "top", zorder=4,
                    bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.8))
    # explicit limits: arrow patches would otherwise distort autoscaling
    xs, ys = [c[0] for c in coords], [c[1] for c in coords]
    px, py = 0.16 * (max(xs) - min(xs)), 0.12 * (max(ys) - min(ys))
    ax.set_xlim(min(xs) - px, max(xs) + px)
    ax.set_ylim(min(ys) - py, max(ys) + py)
    ax.ticklabel_format(useOffset=False)
    ax.set_aspect("equal")
    ax.set_title(title, fontsize=11)
    ax.set_xlabel("longitude (x)", fontsize=9)
    ax.set_ylabel("latitude (y)", fontsize=9)
    ax.tick_params(labelsize=8)


def plot_graph(locations, coords, dist, path, pdf_path=None):
    """Complete weighted graph K_n: every pair of locations is joined by a road connection."""
    fig, ax = plt.subplots(figsize=(9, 6.2), layout="constrained")
    n = len(coords)
    for i in range(n):
        for j in range(i + 1, n):
            ax.plot(*zip(coords[i], coords[j]), color=EDGE_COLOR, linewidth=0.7, zorder=1)
    _base(ax, locations, coords,
          f"Weighted graph model: complete graph $K_{{{n}}}$ (weights in the distance matrix, km)")
    fig.savefig(path, dpi=200)
    if pdf_path:
        fig.savefig(pdf_path)
    plt.close(fig)


GROUP_COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#9467bd", "#8c564b", "#e377c2", "#17becf", "#bcbd22"]
REMOVED_COLOR, ADDED_COLOR = "#c0392b", "#d4a017"


def _bounds(coords, pad=0.08):
    xs, ys = [c[0] for c in coords], [c[1] for c in coords]
    px, py = pad * (max(xs) - min(xs)), pad * (max(ys) - min(ys))
    return [min(xs) - px, max(xs) + px], [min(ys) - py, max(ys) + py]


def _draw_cycle(ax, tour, coords, color, lw=2.0):
    if len(tour) < 2:
        return
    pairs = [(tour[0], tour[1])] if len(tour) == 2 else [(tour[i], tour[(i + 1) % len(tour)]) for i in range(len(tour))]
    for u, v in pairs:
        ax.plot(*zip(coords[u], coords[v]), color=color, lw=lw, zorder=2, solid_capstyle="round")


def _small_vertices(ax, coords, colors):
    for k, ((x, y), color) in enumerate(zip(coords, colors)):
        ax.scatter(x, y, s=190, color=color, zorder=3, edgecolor="white", linewidth=1.0)
        ax.annotate(f"V{k}", (x, y), color="white", fontsize=6.5, fontweight="bold", ha="center", va="center", zorder=4)


def _panel(ax, title, xlim, ylim):
    ax.set_xlim(*xlim)
    ax.set_ylim(*ylim)
    ax.set_aspect("equal")
    ax.set_xticks([])
    ax.set_yticks([])
    ax.set_title(title, fontsize=8.5)


def plot_steps(coords, result, path, pdf_path=None):
    """The divide and conquer run drawn on the map: split lines, base cases, then each merge level."""
    trace = result.trace
    splits = {frozenset(ev["cities"]): ev for ev in trace if ev["step"] == "split"}
    bases = [ev for ev in trace if ev["step"] == "base"]
    merges = [ev for ev in trace if ev["step"] == "merge"]
    xlim, ylim = _bounds(coords)

    # Divide: each split cuts its region at the midpoint between the two halves.
    cuts = []

    def divide(cities, region, depth):
        ev = splits.get(frozenset(cities))
        if ev is None:
            return
        k = 0 if ev["axis"] == "x" else 1
        cut = (max(coords[c][k] for c in ev["left"]) + min(coords[c][k] for c in ev["right"])) / 2
        (x0, x1), (y0, y1) = region
        if k == 0:
            cuts.append(((cut, cut), (y0, y1), depth))
            divide(ev["left"], ((x0, cut), (y0, y1)), depth + 1)
            divide(ev["right"], ((cut, x1), (y0, y1)), depth + 1)
        else:
            cuts.append(((x0, x1), (cut, cut), depth))
            divide(ev["left"], ((x0, x1), (y0, cut)), depth + 1)
            divide(ev["right"], ((x0, x1), (cut, y1)), depth + 1)

    divide(trace[0]["cities"], (tuple(xlim), tuple(ylim)), 0)
    group_of = {c: g for g, ev in enumerate(bases) for c in ev["cities"]}
    leaf_colors = [GROUP_COLORS[group_of[k] % len(GROUP_COLORS)] for k in range(len(coords))]

    levels = sorted({ev["depth"] for ev in merges}, reverse=True)
    n_panels = 2 + len(levels)
    ncols = 3
    nrows = -(-n_panels // ncols)
    fig, axes = plt.subplots(nrows, ncols, figsize=(8, 2.9 * nrows), layout="constrained")
    axes = list(axes.flat)

    # (a) divide
    ax = axes[0]
    for xs, ys, depth in cuts:
        ax.plot(xs, ys, color="#555555", lw=max(2.6 - 0.8 * depth, 0.8), linestyle="--", zorder=1)
        vertical = xs[0] == xs[1]
        anchor = (xs[0], ys[1]) if vertical else (xs[0], ys[0])  # top of a vertical cut, left end of a horizontal one
        ax.annotate(str(depth + 1), anchor, fontsize=7, color="#555555", fontweight="bold",
                    xytext=(3, -9) if vertical else (3, 2), textcoords="offset points")
    _small_vertices(ax, coords, leaf_colors)
    _panel(ax, "(a) Divide: median cuts by level", xlim, ylim)

    # (b) base cases
    ax = axes[1]
    for ev in bases:
        _draw_cycle(ax, ev["cities"], coords, GROUP_COLORS[group_of[ev["cities"][0]] % len(GROUP_COLORS)])
    _small_vertices(ax, coords, leaf_colors)
    _panel(ax, "(b) Base cases: 1 or 2 cities", xlim, ylim)

    # (c...) merge levels, deepest first
    tours = {frozenset(ev["cities"]): ev["cities"] for ev in bases}
    for i, depth in enumerate(levels):
        removed, added = [], []
        for ev in (e for e in merges if e["depth"] == depth):
            tours.pop(frozenset(ev["left_tour"]))
            tours.pop(frozenset(ev["right_tour"]))
            tours[frozenset(ev["tour"])] = ev["tour"]
            # A 2-city tour a-b-a loses only one copy of its doubled edge; the other copy stays.
            kept = {frozenset(e) for e in zip(ev["tour"], ev["tour"][1:] + ev["tour"][:1])}
            removed += [e for e in ev["removed"] if frozenset(e) not in kept]
            added += ev["added"]
        ax = axes[2 + i]
        colors = [None] * len(coords)
        for tour in tours.values():
            color = leaf_colors[min(tour)] if len(tours) > 1 else "#2e86c1"  # keep the colour from panel (b)
            _draw_cycle(ax, tour, coords, color, lw=1.6)
            for c in tour:
                colors[c] = color
        for u, v in removed:
            ax.plot(*zip(coords[u], coords[v]), color=REMOVED_COLOR, lw=1.6, linestyle=(0, (3, 2)), zorder=2.5)
        for u, v in added:
            ax.plot(*zip(coords[u], coords[v]), color=ADDED_COLOR, lw=3.2, zorder=2.4, alpha=0.9)
        _small_vertices(ax, coords, colors)
        letter = "abcdefgh"[2 + i]
        final = depth == 0
        cost = f": {result.total:.2f} km" if final else ""
        title = f"({letter}) Level-{depth + 1} merge" + (f" = final tour{cost}" if final else "")
        _panel(ax, title, xlim, ylim)

    for ax in axes[n_panels:]:
        ax.axis("off")
    if n_panels < len(axes):
        legend_ax = axes[n_panels]
        handles = [plt.Line2D([], [], color="#555555", lw=1.5, linestyle="--", label="divide line"),
                   plt.Line2D([], [], color=REMOVED_COLOR, lw=1.6, linestyle=(0, (3, 2)), label="edge removed by merge"),
                   plt.Line2D([], [], color=ADDED_COLOR, lw=3.2, label="edge added by merge\n(bridge + closing edge)"),
                   plt.Line2D([], [], color="#1f77b4", lw=2, label="sub-tour\n(one colour per sub-tour)")]
        legend_ax.legend(handles=handles, loc="center", fontsize=7.5, frameon=False)
    fig.savefig(path, dpi=200)
    if pdf_path:
        fig.savefig(pdf_path)
    plt.close(fig)


def plot_route(locations, coords, route, total, path, pdf_path=None):
    fig, ax = plt.subplots(figsize=(9, 6.2), layout="constrained")
    for k in range(len(route) - 1):
        (x1, y1), (x2, y2) = coords[route[k]], coords[route[k + 1]]
        ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=13,
                                     color=ROUTE_COLOR, lw=1.8, shrinkA=10, shrinkB=10, zorder=2))
        ax.annotate(str(k + 1), ((x1 + x2) / 2, (y1 + y2) / 2), fontsize=7, color=ROUTE_COLOR,
                    ha="center", va="center", zorder=3,
                    bbox=dict(boxstyle="circle,pad=0.15", fc="white", ec=ROUTE_COLOR, lw=0.7))
    order = " $\\to$ ".join(f"V{v}" for v in route)
    _base(ax, locations, coords,
          f"Divide and conquer route: {total:.2f} km (circled numbers = leg order)\n{order}")
    fig.savefig(path, dpi=200)
    if pdf_path:
        fig.savefig(pdf_path)
    plt.close(fig)
