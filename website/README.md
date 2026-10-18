# Website: Divide & Conquer for the TSP

A static site that presents the project. Its tabs follow the presentation outline (01 Problem → 05 Conclusion, plus References). The **04 Implementation** tab is the final prototype: a step player that replays the recorded run of `code/dc_tsp.py` on the map. Every divide, base case and merge is drawn along the actual street route behind each edge weight.

## View it

- **From disk:** open `website/index.html` in a browser. The data files are scripts, so no server is needed.
- **Local server** (recommended while presenting):
  ```powershell
  cd website
  python -m http.server 8000      # then open http://localhost:8000
  ```
- **GitHub Pages:** publish the `website/` folder. It has no build step.

The basemap, Leaflet, MapLibre, KaTeX and the Geist fonts load from the internet. Without a connection the maps don't load, but every table and number still shows.

The basemap is [OpenFreeMap](https://openfreemap.org) (OpenStreetMap data, no API key), drawn with MapLibre inside Leaflet. Browsers without WebGL fall back to Esri's gray canvas tiles. Don't switch to `tile.openstreetmap.org`: it blocks requests without a `Referer`, which includes every page opened from disk (403 "Access blocked").

## Where the numbers come from

Nothing is typed in by hand. Both data files are generated:

| File | Written by | Contents |
| --- | --- | --- |
| `data/run.js` | `python main.py --export-web` (in `code/`) | vertices, weight matrices, the seed-1 trace, the route, the checks, the Held–Karp optimum, the best 2-opt move, all 100 seeds with their traces, the experiment table, the Google Maps cross-check, the source of `dc_tsp.py` / `verify.py`, and the console output of the run |
| `data/roads.js` | `python tools/fetch_road_geometry.py` (in `code/`) | the OSRM street path for all 90 ordered pairs, used **for drawing only** |

`fetch_road_geometry.py` checks every path length against `code/data/raw_directed_km.csv` (all are within 0.02 km). The map labels always show the model weight `w(u,v)` from `distance_matrix_km.csv`. `python test_dc_tsp.py` includes a test that `run.js` and `roads.js` agree with the LaTeX macros the report and slides use.

After changing the data or the code, regenerate everything together:

```powershell
cd code
python main.py --export-latex --export-web
python tools/fetch_road_geometry.py   # only if locations.csv changed
python test_dc_tsp.py
```

## Files

| File | What it does |
| --- | --- |
| `index.html` | All tabs and their text (matches the report and slides) |
| `assets/style.css` | Design tokens (light/dark), layout, map and player styles |
| `assets/core.js` | Number bindings (`data-k`, `data-w`), hash router with View Transitions, theme, preloader, ⌘/Ctrl K command menu, Alt G grid overlay |
| `assets/maps.js` | Leaflet helpers: road-snapped edges, arrows, weight tags, vertex pins |
| `assets/pages.js` | Tables, the K₁₀ probe, matrix-hover roads, divide tree, code viewer, terminal replay, route and comparison maps, seed chart |
| `assets/player.js` | The 04.1 step player |

Keyboard: `Ctrl/⌘ K` opens the command menu (type a seed number to replay it), `Alt G` toggles the 12-column grid, and `←` / `→` / `Space` drive the step player.

Design reference: [piergorelli.com](https://piergorelli.com/), a blueprint style with paper/ink colors, a single blue accent, Geist + Geist Mono, numbered sections and hairline rules.
