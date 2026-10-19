/* Core: data access, number bindings, router, theme, preloader, palette, grid overlay.
   Every number shown on the site is read from window.DC_RUN (written by code/main.py --export-web). */
(function () {
  "use strict";
  var RUN = window.DC_RUN, ROADS = window.DC_ROADS;
  var DC = (window.DC = { RUN: RUN, ROADS: ROADS });

  /* ---------- small helpers ---------- */
  var $ = (DC.$ = function (s, root) { return (root || document).querySelector(s); });
  var $$ = (DC.$$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); });
  DC.el = function (tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "style") e.style.cssText = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  DC.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  // Round half away from zero on the decimal string, like Python's format for these values.
  var fmt = (DC.fmt = function (x, d) {
    d = d == null ? 2 : d;
    var p = Math.pow(10, d), v = Math.round((Math.abs(x) + 1e-9) * p) / p;
    return (x < 0 && v !== 0 ? "-" : "") + v.toFixed(d);
  });
  DC.sgn = function (x, d) { return (x >= 0 ? "+" : "−") + fmt(Math.abs(x), d); };
  DC.V = function (i) { return "V" + i; };
  DC.name = function (i) { return RUN.locations[i].name; };
  DC.w = function (i, j) { return RUN.dist[i][j]; };
  DC.routeStr = function (r, sep) { return r.map(DC.V).join(sep || " → "); };
  DC.cycleStr = function (t) { return t.length > 1 ? t.concat([t[0]]).map(DC.V).join("–") : DC.V(t[0]); };
  DC.store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  DC.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  DC.isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  /* ---------- derived values (bound with data-k) ---------- */
  var p = RUN.presented, ex = RUN.experiments.rules, g = RUN.google, two = RUN.two_opt, w = DC.w;
  var m2 = p.trace.filter(function (e) { return e.step === "merge"; })[1];
  var v0 = RUN.locations[p.route[0]];
  var K = (DC.K = {
    n: RUN.locations.length,
    edges: RUN.locations.length * (RUN.locations.length - 1) / 2,
    startName: v0.name,
    v0coords: fmt(v0.lat, 4) + "° N, " + fmt(v0.lon, 4) + "° E",
    seed: p.seed,
    total: fmt(p.total), recomputed: fmt(p.recomputed), opt: fmt(RUN.optimum.total), gap: fmt(p.gap_pct),
    checks: p.checks.every(function (c) { return c.ok; }) ? "passed" : "FAILED",
    route: DC.routeStr(p.route), optRoute: DC.routeStr(RUN.optimum.route),
    directed: fmt(p.directed_total),
    runs: RUN.experiments.runs, runsMax: RUN.experiments.runs - 1,
    bridgeHits: ex.bridge.optimal_hits, bestHits: ex.best.optimal_hits,
    bridgeMean: fmt(ex.bridge.mean), bridgeBest: fmt(ex.bridge.best), bridgeWorst: fmt(ex.bridge.worst),
    bridgeMeanGap: fmt(ex.bridge.mean_gap_pct), bestMean: fmt(ex.best.mean),
    raw01: fmt(RUN.raw[0][1]), raw10: fmt(RUN.raw[1][0]),
    googleTotal: fmt(g.google_total), googlePct: fmt(g.pct, 1),
    googleMaxPct: fmt(Math.max.apply(null, g.legs.map(function (l) { return Math.abs(l.pct); })), 0),
    twoOptSave: fmt(-two.delta), twoOptTotal: fmt(two.total),
    roadTol: fmt(ROADS.tolerance_km),
    m2delta: m2 ? DC.sgn(m2.delta) : "",
    // seed-1 narrative (05.1): open the M1 triangle at V3–V4 and add V6–V4, V8–V3 instead
    altDelta: DC.sgn((w(6, 4) + w(8, 3)) - (w(3, 4) + w(8, 6)))
  });
  DC.num = { total: p.total, opt: RUN.optimum.total, gap: p.gap_pct, bridgeHits: ex.bridge.optimal_hits };

  function bind(root) {
    $$("[data-k]", root).forEach(function (e) { if (K[e.dataset.k] != null) e.textContent = K[e.dataset.k]; });
    $$("[data-w]", root).forEach(function (e) { var ij = e.dataset.w.split(","); e.textContent = fmt(w(+ij[0], +ij[1])); });
    $$("[data-tex]", root).forEach(function (e) {
      if (window.katex) {
        try { katex.render(e.dataset.tex, e, { displayMode: e.hasAttribute("data-display"), throwOnError: false }); return; } catch (err) {}
      }
      e.textContent = e.dataset.tex;
      e.classList.add("mono");
    });
  }
  DC.bind = bind;

  /* ---------- theme ---------- */
  var root = document.documentElement;
  DC.theme = function () {
    if (root.dataset.theme) return root.dataset.theme;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };
  function setTheme(t) {
    root.dataset.theme = t;
    DC.store.set("dc-theme", t);
    document.dispatchEvent(new CustomEvent("dc:theme", { detail: t }));
  }
  DC.toggleTheme = function () { setTheme(DC.theme() === "dark" ? "light" : "dark"); };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if (!root.dataset.theme) document.dispatchEvent(new CustomEvent("dc:theme", { detail: DC.theme() }));
  });

  /* ---------- toast ---------- */
  var toastTimer;
  DC.toast = function (msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 1800);
  };

  /* ---------- projection for the small SVG figures ---------- */
  DC.project = function (pad) {
    pad = pad == null ? 10 : pad;
    var L = RUN.locations, k = Math.cos(L[0].lat * Math.PI / 180);
    var xs = L.map(function (l) { return l.lon * k; }), ys = L.map(function (l) { return l.lat; });
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs), miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    var s = (100 - 2 * pad) / Math.max(maxx - minx, maxy - miny);
    var ox = (100 - (maxx - minx) * s) / 2, oy = (100 - (maxy - miny) * s) / 2;
    return L.map(function (l, i) { return [ox + (xs[i] - minx) * s, 100 - (oy + (ys[i] - miny) * s)]; });
  };

  /* ---------- deck: 16:9 slides, horizontal transitions, PowerPoint-style navigation ----------
     Hash: #/ (title), #/<tab> (first slide of a tab), #/<tab>/<name> (slide id "<tab>-<name>").
     DC.onPage(tab, fn) runs once, the first time any slide of that tab is shown;
     DC.onShow(tab, fn) runs every time one is shown; DC.onEnter(fn(slide, dir)) runs on every slide change.
     DC.build(slide, dir) may consume a forward/back press (the step players use it for click-by-click builds). */
  var inits = {}, shows = {}, enters = [], done = {};
  DC.onPage = function (tab, fn) { (inits[tab] = inits[tab] || []).push(fn); };
  DC.onShow = function (tab, fn) { (shows[tab] = shows[tab] || []).push(fn); };
  DC.onEnter = function (fn) { enters.push(fn); };
  DC.page = null;
  var slides = [], cur = -1, EASE = "cubic-bezier(.76, 0, .24, 1)";

  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    $("#stage").style.setProperty("--scale", s.toFixed(4));
  }
  function indexFromHash() {
    var parts = (location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    if (!parts.length) return 0;
    var id = parts.join("-"), i = slides.map(function (s) { return s.id; }).indexOf(id);
    if (i < 0) for (var k = 0; k < slides.length; k++) if (slides[k].dataset.tab === parts[0]) { i = k; break; }
    return i < 0 ? 0 : i;
  }
  function hashFor(i) { return i === 0 ? "#/" : "#/" + slides[i].id.replace("-", "/"); }

  function show(i, dir) {
    if (i === cur || i < 0 || i >= slides.length) return;
    var prev = slides[cur], next = slides[i], tab = next.dataset.tab;
    dir = dir || (cur < 0 ? 0 : i > cur ? 1 : -1);
    if (!done[tab]) { done[tab] = true; (inits[tab] || []).forEach(function (f) { f(); }); }
    next.classList.add("is-active");
    if (prev) {
      prev.classList.remove("is-active");
      if (dir && !DC.reduced && next.animate) {
        prev.classList.add("is-leaving");
        var opts = { duration: 700, easing: EASE };
        next.animate([{ transform: "translateX(" + dir * 100 + "%)" }, { transform: "none" }], opts);
        prev.animate([{ transform: "none" }, { transform: "translateX(" + -dir * 100 + "%)" }], opts).onfinish = function () { prev.classList.remove("is-leaving"); };
      }
    }
    cur = i; DC.page = tab; DC.slide = next;
    $$("[data-nav]").forEach(function (a) { if (a.dataset.nav === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#progress").style.width = ((i + 1) / slides.length * 100) + "%";
    $("#deck-label").textContent = next.dataset.label;
    $("#deck-count").textContent = (i + 1) + " / " + slides.length;
    $$("#deck-dots i").forEach(function (d, k) { d.classList.toggle("is-cur", k === i); d.classList.toggle("is-tab", slides[k].dataset.tab === tab); });
    $$("[data-deck='prev']").forEach(function (b) { b.disabled = i === 0; });
    $$("[data-deck='next']").forEach(function (b) { b.disabled = i === slides.length - 1; });
    document.title = (i === 0 ? "" : next.dataset.label.replace(/^[\d.]+ · /, "") + " · ") + "Divide & Conquer TSP";
    $$("[data-count]", next).forEach(countUp);
    (shows[tab] || []).forEach(function (f) { f(); });
    enters.forEach(function (f) { f(next, dir); });
    if (location.hash !== hashFor(i) && !(i === 0 && !location.hash)) history.replaceState(null, "", hashFor(i));
  }
  function go(i, dir) { show(Math.max(0, Math.min(slides.length - 1, i)), dir); }
  DC.deck = {
    next: function (skipBuilds) { if (!skipBuilds && DC.build && DC.build(slides[cur], 1)) return; go(cur + 1, 1); },
    prev: function (skipBuilds) { if (!skipBuilds && DC.build && DC.build(slides[cur], -1)) return; go(cur - 1, -1); },
    index: function () { return cur; }
  };
  DC.go = function (hash) {
    if (location.hash === hash) show(indexFromHash());
    else location.hash = hash;
  };

  function countUp(e) {
    var to = DC.num[e.dataset.count], d = +(e.dataset.d || 0), suffix = e.dataset.suffix || "";
    var small = e.querySelector("small"), smallHtml = small ? small.outerHTML : "";
    var put = function (v) { e.innerHTML = fmt(v, d) + suffix + smallHtml; };
    if (DC.reduced) return put(to);
    var t0 = performance.now() + 350, dur = 1100;
    put(0);
    (function step(t) {
      var k = Math.max(0, Math.min(1, (t - t0) / dur)), ease = 1 - Math.pow(1 - k, 3);
      put(k < 1 ? to * ease : to);
      if (k < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  function toggleFullscreen() {
    var d = document;
    if (d.fullscreenElement) d.exitFullscreen && d.exitFullscreen();
    else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(function () {});
  }

  /* ---------- preloader ---------- */
  function preloader() {
    var pre = $("#preloader");
    if (root.dataset.preloaded === "yes") return;
    var P = DC.project(12), svg = $("#preloader-art"), parts = [];
    for (var i = 0; i < P.length; i++) for (var j = i + 1; j < P.length; j++)
      parts.push('<line class="pl-edge" x1="' + P[i][0] + '" y1="' + P[i][1] + '" x2="' + P[j][0] + '" y2="' + P[j][1] + '"/>');
    parts.push('<polyline class="pl-route" pathLength="1" points="' + p.route.map(function (v) { return P[v].join(","); }).join(" ") + '"/>');
    P.forEach(function (q, i) { parts.push('<circle class="pl-v' + (i === p.route[0] ? " pl-v0" : "") + '" cx="' + q[0] + '" cy="' + q[1] + '" r="1.9"/>'); });
    svg.innerHTML = parts.join("");
    var count = $("#preloader-count"), t0 = performance.now(), dur = 1500;
    (function tick(t) {
      var k = Math.min(1, (t - t0) / dur);
      count.textContent = String(Math.round(k * 100)).padStart(2, "0");
      if (k < 1) return requestAnimationFrame(tick);
      pre.classList.add("is-done");
      root.dataset.preloaded = "done";
      try { sessionStorage.setItem("dc-preloaded", "1"); } catch (e) {}
      setTimeout(function () { pre.style.display = "none"; }, 900);
    })(t0);
  }

  /* ---------- command palette ---------- */
  var cmds = [], sel = 0, shown = [];
  function buildCommands() {
    cmds = slides.map(function (s, i) {
      var parts = s.dataset.label.split(" · ");
      return { label: parts.slice(1).join(" · "), hint: parts[0] + " · " + (i + 1), run: function () { go(i); } };
    });
    p.trace.filter(function (e) { return e.step === "merge"; }).forEach(function (m) {
      cmds.push({ label: "Step players: jump to merge " + m.name, hint: "04", run: function () { DC.go("#/implementation/graph"); setTimeout(function () { DC.player && DC.player.jump(m.name); }, 50); } });
    });
    cmds.push({ label: "Toggle dark / light theme", hint: "theme", run: DC.toggleTheme });
    cmds.push({ label: "Full screen", hint: "F", run: toggleFullscreen });
    cmds.push({ label: "Toggle 12-column grid", hint: "Alt G", run: toggleGrid });
  }
  function renderPalette(q) {
    q = (q || "").trim().toLowerCase();
    shown = cmds.filter(function (c) { return !q || (c.label + " " + c.hint).toLowerCase().indexOf(q) >= 0; });
    var n = /^\d{1,3}$/.test(q) ? +q : (/^seed\s*(\d{1,3})$/.exec(q) || [])[1];
    if (n != null && +n < RUN.seeds.length) {
      var s = RUN.seeds[+n];
      shown.unshift({ label: "Step players: replay seed " + n + " (" + fmt(s.total) + " km" + (s.optimal ? ", optimal" : "") + ")", hint: "04", run: function () { DC.player && DC.player.setSeed(+n, true); } });
    }
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    $("#palette-list").innerHTML = shown.map(function (c, i) {
      return '<li><button type="button" role="option" data-i="' + i + '" aria-selected="' + (i === sel) + '"><span>' + DC.esc(c.label) + '</span><span class="note">' + DC.esc(c.hint || "") + "</span></button></li>";
    }).join("") || '<li class="note" style="padding:12px">No match. Type a seed number (0–' + K.runsMax + ") to replay it.</li>";
  }
  function openPalette() {
    if (!cmds.length) buildCommands();
    $("#palette").classList.add("is-open"); sel = 0;
    var inp = $("#palette-input"); inp.value = ""; renderPalette(""); inp.focus();
  }
  function closePalette() { $("#palette").classList.remove("is-open"); }
  function runSel(i) { var c = shown[i]; closePalette(); if (c) c.run(); }

  function toggleGrid() {
    var on = $("#grid-overlay").classList.toggle("is-on");
    DC.toast(on ? "Grid on · Alt G to hide" : "Grid off");
  }

  /* ---------- wire up ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("#kbd-mod").textContent = DC.isMac ? "⌘" : "Ctrl ";
    $("#kbd-mod2").textContent = DC.isMac ? "⌘" : "Ctrl";
    bind(document);
    $("#merge-bug-output").textContent = RUN.source["original_merge_output.txt"];
    slides = $$(".slide");
    slides.forEach(function (s) { $$(".reveal", s).forEach(function (e, k) { e.style.setProperty("--i", k); }); });
    $("#deck-dots").innerHTML = slides.map(function () { return "<i></i>"; }).join("");
    fit(); addEventListener("resize", fit);
    preloader();

    $("#theme-toggle").addEventListener("click", DC.toggleTheme);
    $("#palette-open").addEventListener("click", openPalette);
    $("#fullscreen").addEventListener("click", toggleFullscreen);
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-deck]");
      if (!b) return;
      e.preventDefault();
      if (b.dataset.deck === "next") DC.deck.next(true); else DC.deck.prev(true);
    });
    $("#palette").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]");
      if (b) runSel(+b.dataset.i); else if (e.target === this) closePalette();
    });
    $("#palette-input").addEventListener("input", function () { sel = 0; renderPalette(this.value); });

    document.addEventListener("keydown", function (e) {
      var pal = $("#palette").classList.contains("is-open");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal ? closePalette() : openPalette(); return; }
      if (pal) {
        if (e.key === "Escape") closePalette();
        else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(1, shown.length);
          renderPalette($("#palette-input").value);
          var b = $('#palette-list [aria-selected="true"]'); if (b) b.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") { e.preventDefault(); runSel(sel); }
        return;
      }
      if (e.altKey && (e.code === "KeyG" || e.key.toLowerCase() === "g")) { e.preventDefault(); toggleGrid(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target.tagName || "").toUpperCase();
      if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
      var onControl = /BUTTON|A/.test(tag);
      switch (e.key) {
        case "ArrowRight": case "PageDown": e.preventDefault(); DC.deck.next(e.shiftKey); break;
        case "ArrowLeft": case "PageUp": e.preventDefault(); DC.deck.prev(e.shiftKey); break;
        case " ": if (onControl) return; e.preventDefault(); e.shiftKey ? DC.deck.prev() : DC.deck.next(); break;
        case "Home": e.preventDefault(); go(0, -1); break;
        case "End": e.preventDefault(); go(slides.length - 1, 1); break;
        case "f": case "F": toggleFullscreen(); break;
      }
    });

    // swipe left/right on touch screens (not when the gesture starts on a map or a figure)
    var sx = null, sy = 0;
    $("#main").addEventListener("pointerdown", function (e) {
      sx = e.target.closest(".map, .gstage, .probe, .term pre, .codebox pre, .matrix, .dots, select, button, a") ? null : e.clientX; sy = e.clientY;
    });
    $("#main").addEventListener("pointerup", function (e) {
      if (sx == null || e.pointerType === "mouse") return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) dx < 0 ? DC.deck.next(true) : DC.deck.prev(true);
    });

    addEventListener("hashchange", function () { show(indexFromHash()); });
    show(indexFromHash(), 0);
  });
})();
