# BibTeX runs inside the build/ folder (LaTeX Workshop) or next to main.tex
# (the VS Code task), so list both relative paths to the shared .bib file.
# (Relative paths, because the full path may contain spaces, which BibTeX
# cannot handle.)
ensure_path('BIBINPUTS', '..', '../shared', '../../shared');
