# Website: Divide & Conquer for the TSP

A static site that presents the project as a **16:9 slide deck**: 33 slides on a fixed 1920×1080 canvas, scaled to fit any screen (full screen with `F`). The tabs at the top follow the presentation outline (01 Problem → 05 Conclusion, plus References) and jump to each section. Slides slide in horizontally, and their contents build in one after another.

**04 Implementation** is the final prototype. Two step players replay the recorded run of `code/dc_tsp.py`: first on the simple graph (04.1), then on the map (04.2), where every divide, base case and merge is drawn along the actual street route behind each edge weight.

### Presenting

| Key | Action |
| --- | --- |
| `→` `PageDown` `Space` | next. On the two player slides, this steps through the algorithm first, then moves on after the last step (like PowerPoint click animations) |
| `←` `PageUp` | previous (going back into a player slide shows its last step) |
| `Shift` + `→` / `←` | skip the step builds and change slide directly |
| `Home` / `End` | first / last slide |
| `F` | full screen |
| `Ctrl/⌘ K` | jump to any slide, merge step or seed |

The on-screen ‹ › buttons always change slide. A presentation clicker works, because it sends `PageDown` / `PageUp`. On touch screens, swipe left or right.

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
| `index.html` | The 33 slides and their text (matches the report and the LaTeX slides) |
| `assets/style.css` | Design tokens (light/dark), components, map and player styles, and the deck canvas |
| `assets/core.js` | Number bindings (`data-k`, `data-w`), the slide deck (16:9 scaling, horizontal transitions, keyboard/clicker/swipe navigation, full screen), theme, preloader, ⌘/Ctrl K command menu, Alt G grid overlay |
| `assets/maps.js` | Leaflet helpers: road-snapped edges, arrows, weight tags, vertex pins |
| `assets/pages.js` | Tables, the K₁₀ probe, matrix-hover roads, divide tree, code viewer, terminal replay, route and comparison maps, seed chart |
| `assets/player.js` | The two step players (04.1 simple graph, 04.2 roads): one engine, two renderers |

`Alt G` toggles the 12-column grid overlay. In the command menu, type a seed number to replay that seed in both step players.

Design reference: [piergorelli.com](https://piergorelli.com/), a blueprint style with paper/ink colors, a single blue accent, Geist + Geist Mono, numbered sections and hairline rules.
