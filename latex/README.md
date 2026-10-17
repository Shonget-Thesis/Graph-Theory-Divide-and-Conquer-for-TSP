# LaTeX: Report and Presentation

Set up following [cjohnramirez/vscode-latex-setup](https://github.com/cjohnramirez/vscode-latex-setup) (VS Code + LaTeX Workshop + MiKTeX + Strawberry Perl). Follow that guide's install steps 1–3 first. Step 4 (LaTeX Workshop settings) is already included in this repo's `.vscode/settings.json`.

## Folder structure

```
latex/
├── shared/
│   ├── dc-tsp-refs.bib      <- all citations (used by both documents)
│   ├── generated/           <- AUTO-GENERATED tables + \newcommand macros (do not edit)
│   └── figures/             <- AUTO-GENERATED graph.pdf, route.pdf (do not edit)
├── report/
│   ├── main.tex             <- preamble + chapter list (the file you build)
│   ├── .latexmkrc           <- lets BibTeX find shared/dc-tsp-refs.bib
│   └── chapters/
│       ├── 01-introduction/   chapter.tex, background.tex, problem.tex
│       ├── 02-algorithm/      chapter.tex, overview.tex, procedure.tex, complexity.tex, properties.tex
│       ├── 03-methodology/    chapter.tex, vertices.tex, edges.tex, data.tex, application.tex
│       ├── 04-implementation/ chapter.tex, components.tex, execution.tex, verification.tex
│       ├── 05-conclusion/     chapter.tex, results.tex, optimality.tex, limitations.tex, conclusion.tex
│       └── appendix/          chapter.tex (source code listings)
└── presentation/
    ├── main.tex             <- beamer preamble + section list (the file you build)
    ├── .latexmkrc
    └── sections/            <- one file per talk section, with suggested timings
        ├── 01-introduction.tex   (2–3 min)
        ├── 02-algorithm.tex      (2–3 min)
        ├── 03-graph-model.tex    (2–3 min)
        ├── 04-implementation.tex (3–4 min, includes the live demo)
        └── 05-conclusion.tex     (1–2 min)
```

As in the template: `main.tex` loads each `chapter.tex`, and each `chapter.tex` loads its section files. **Always build `main.tex`.** Paths start from the folder that holds `main.tex`.

## Building

- **VS Code:** open any `.tex` file and save (auto-build), or press `Ctrl+Alt+B`. The PDF goes to `build/main.pdf` next to that `main.tex`.
- **Tasks** (`Ctrl+Shift+B`): *Build report*, *Build presentation*, *Run TSP solver and refresh LaTeX assets*.
- **Terminal:** `cd latex/report` then `latexmk -pdf -outdir=build main.tex` (same for `latex/presentation`).

## Keeping numbers consistent with the code

Every number, table and figure that comes from the program (the route, totals, the weight matrix, the merge steps, the divide tree, the experiment table) is read from `shared/generated/` and `shared/figures/`. After any change to the data or code, run:

```powershell
cd code
python main.py --export-latex
```

then rebuild. In the prose, use the macros from `shared/generated/macros.tex` (`\DCTotal`, `\DCRoute`, `\OptTotal`, `\DCGap`, …) instead of typing numbers.

## Before submitting

Search both documents for `\groupnote`. Each one prints a red reminder (Google Maps screenshots, spot-checking distances, the screen-recording cue) that should be resolved and then removed.
