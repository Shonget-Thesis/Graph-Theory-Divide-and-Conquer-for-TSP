# Code: Divide and Conquer for TSP

Python implementation of Algorithm 2.8 (Divide and Conquer) from Luna-Garcia, Candano and Caga-anan (2024), *Performance Analysis of Classical Algorithms for the Traveling Salesman Problem*, The Mindanawan Journal of Mathematics 6(2), 79–111. It is applied to a one-day city tour of Cagayan de Oro that starts and ends at USTP.

## Run

```powershell
pip install -r requirements.txt   # only matplotlib, for the figures
python main.py                    # the demo: input, every step, route, verification, optimality check
python test_dc_tsp.py             # sanity tests
```

Options:

| Option | Meaning |
| --- | --- |
| `--seed N` | Random seed for the shuffle and the split axis (default `1`, the run used in the report) |
| `--rule bridge` / `--rule best` | Merge rule: `bridge` follows the paper (default); `best` is an alternative variant (compared in the report) |
| `--runs N` | Number of seeds in the repeated-runs table (default `100`) |
| `--no-plot` | Skip the figures |
| `--export-latex` | Also regenerate the tables and figures used by `latex/` |
| `--export-web` | Also regenerate `website/data/run.js`, the data behind the website |

## Files

| File | Contents |
| --- | --- |
| `data/locations.csv` | **Dataset, vertices:** id, label, name, area, latitude, longitude, start/stop |
| `data/distance_matrix_km.csv` | **Dataset, edge weights:** symmetric road distance in km (this is what the solver reads) |
| `data/raw_directed_km.csv` | Raw directed road distances before averaging (for reference) |
| `dc_tsp.py` | The algorithm: `split`, `shortest_bridge`, `merge`, `solve`, `divide_and_conquer_tsp` |
| `verify.py` | `check_route` (valid closed tour and recomputed total) and `held_karp` (exact optimum, for comparison only) |
| `main.py` | Loads the data, runs everything, prints the demo output |
| `data/google_maps_check_km.csv` | Google Maps driving distance of each leg of the final route (cross-check only) |
| `plots.py`, `export_latex.py` | Figures, and the generated LaTeX in `latex/shared/` |
| `export_web.py` | The website data, `website/data/run.js` |
| `test_dc_tsp.py` | Tests on random instances, plus a check that the website data matches the LaTeX macros |
| `tools/build_dataset.py` | Rebuilds the distance matrices from `locations.csv` using OSRM (OpenStreetMap road network) |
| `tools/fetch_road_geometry.py` | Fetches the OSRM street path of every ordered pair for the website maps (`website/data/roads.js`); display only |
| `original_merge_output.txt` | Preserved run of the paper's merge expression (see below) |

## About the merge step

The paper's printed code (Appendix 4.8) merges two sub-tours as `tour1[:-1] + [a, b] + tour2`. That repeats the bridge cities, so the result is not a valid tour. The preserved run in `original_merge_output.txt`, on a seven-city subproblem, returns 8 entries, repeats V5 and does not close at its start. `dc_tsp.merge` keeps the paper's rule (connect through the shortest bridge) but joins the two cycles properly: it removes one edge from each cycle and adds the bridge plus one closing edge, so every city appears exactly once.

## Changing the data

- **Use Google Maps distances:** edit `data/distance_matrix_km.csv` directly. Keep it symmetric, with a zero diagonal; `main.py` checks both. Do not re-run `tools/build_dataset.py` afterwards, or it will overwrite your values.
- **Change the locations:** edit `data/locations.csv` (ids must be `0..n-1`, with exactly one `start` row), then run `python tools/build_dataset.py` or fill in the matrix yourself.
- Then run `python main.py --export-latex` so the report and slides pick up the new numbers. Also reread the prose in `latex/report/chapters/05-conclusion/results.tex` and `.../03-methodology/edges.tex`, which describe the route and one example distance in words.
