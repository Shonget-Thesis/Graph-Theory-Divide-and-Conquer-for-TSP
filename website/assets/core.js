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

  /* ---------- router: #/page or #/page/section ---------- */
  var PAGES = ["home", "problem", "algorithm", "graph", "implementation", "conclusion", "references"];
  var inits = {}, shows = {}, done = {};
  DC.onPage = function (page, fn) { (inits[page] = inits[page] || []).push(fn); };
  DC.onShow = function (page, fn) { (shows[page] = shows[page] || []).push(fn); };
  DC.page = null;

  function parse() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("/");
    var page = PAGES.indexOf(h[0]) >= 0 ? h[0] : "home";
    return { page: page, section: h[1] ? page + "-" + h[1] : null };
  }
  function swap(r) {
    $$(".page").forEach(function (s) { s.classList.toggle("is-active", s.dataset.page === r.page); });
    $$("[data-nav]").forEach(function (a) {
      if (a.dataset.nav === r.page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var sec = $('.page[data-page="' + r.page + '"]');
    document.title = (r.page === "home" ? "" : sec.dataset.title.replace(/^\d+ · /, "") + " · ") + "Divide & Conquer TSP";
    if (!done[r.page]) { done[r.page] = true; (inits[r.page] || []).forEach(function (f) { f(); }); }
    (shows[r.page] || []).forEach(function (f) { f(); });
    DC.page = r.page;
  }
  function route() {
    var r = parse(), changed = r.page !== DC.page;
    var go = function () {
      if (changed) swap(r);
      var target = r.section && document.getElementById(r.section);
      if (target) target.scrollIntoView({ behavior: changed || DC.reduced ? "auto" : "smooth" });
      else if (changed) window.scrollTo(0, 0);
      $("#sheet").classList.remove("is-open");
      $("#menu-toggle").setAttribute("aria-expanded", "false");
      onScroll();
    };
    if (changed && DC.page && document.startViewTransition && !DC.reduced) document.startViewTransition(go);
    else go();
  }
  DC.go = function (hash) { if (location.hash === hash) route(); else location.hash = hash; };

  /* ---------- scroll progress + current section tag ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      $("#progress").style.width = (max > 0 ? (scrollY / max) * 100 : 0) + "%";
      var page = $(".page.is-active"); if (!page) return;
      var tag = page.dataset.title, heads = $$(".section-head .note--ink", page);
      heads.forEach(function (h) { if (h.getBoundingClientRect().top < innerHeight * 0.35) tag = h.textContent.replace(/[\[\]]/g, ""); });
      $("#progress-tag").textContent = tag;
    });
  }
  addEventListener("scroll", onScroll, { passive: true });

  /* ---------- reveal + count-up ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      $$("[data-count]", en.target).forEach(countUp);
      io.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }) : null;
  DC.reveal = function (rootEl) {
    $$(".reveal", rootEl).forEach(function (e) { if (io) io.observe(e); else { e.classList.add("is-in"); $$("[data-count]", e).forEach(countUp); } });
  };
  function countUp(e) {
    if (e.dataset.counted) return; e.dataset.counted = "1";
    var to = DC.num[e.dataset.count], d = +(e.dataset.d || 0), suffix = e.dataset.suffix || "";
    var small = e.querySelector("small"), smallHtml = small ? small.outerHTML : "";
    var put = function (v) { e.innerHTML = fmt(v, d) + suffix + smallHtml; };
    if (DC.reduced) return put(to);
    var t0 = performance.now(), dur = 1100;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - k, 3);
      put(k < 1 ? to * ease : to);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
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
    cmds = [];
    $$(".page").forEach(function (pg) {
      var page = pg.dataset.page;
      cmds.push({ label: pg.dataset.title.replace(/^\d+ · /, ""), hint: pg.dataset.title.split(" · ")[0], run: function () { DC.go(page === "home" ? "#/" : "#/" + page); } });
      $$(".section[id]", pg).forEach(function (s) {
        var head = $(".section-head .note--ink", s); if (!head) return;
        var txt = head.textContent.replace(/^\[([\d.]+)\]\s*/, ""), num = (head.textContent.match(/\[([\d.]+)\]/) || [])[1];
        cmds.push({ label: txt, hint: num, run: function () { DC.go("#/" + page + "/" + s.id.slice(page.length + 1)); } });
      });
    });
    p.trace.filter(function (e) { return e.step === "merge"; }).forEach(function (m) {
      cmds.push({ label: "Player: jump to merge " + m.name, hint: "04.1", run: function () { DC.player && DC.player.jump(m.name); } });
    });
    cmds.push({ label: "Toggle dark / light theme", hint: "theme", run: DC.toggleTheme });
    cmds.push({ label: "Toggle 12-column grid", hint: "Alt G", run: toggleGrid });
  }
  function renderPalette(q) {
    q = (q || "").trim().toLowerCase();
    shown = cmds.filter(function (c) { return !q || (c.label + " " + c.hint).toLowerCase().indexOf(q) >= 0; });
    var n = /^\d{1,3}$/.test(q) ? +q : (/^seed\s*(\d{1,3})$/.exec(q) || [])[1];
    if (n != null && +n < RUN.seeds.length) {
      var s = RUN.seeds[+n];
      shown.unshift({ label: "Player: replay seed " + n + " (" + fmt(s.total) + " km" + (s.optimal ? ", optimal" : "") + ")", hint: "04.1", run: function () { DC.player && DC.player.setSeed(+n, true); } });
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
    preloader();
    $("#theme-toggle").addEventListener("click", DC.toggleTheme);
    $("#palette-open").addEventListener("click", openPalette);
    $("#menu-toggle").addEventListener("click", function () {
      var open = $("#sheet").classList.toggle("is-open");
      this.setAttribute("aria-expanded", String(open));
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
      if (e.altKey && (e.code === "KeyG" || e.key.toLowerCase() === "g")) { e.preventDefault(); toggleGrid(); }
    });
    addEventListener("hashchange", route);
    DC.reveal(document);
    route();
  });
})();
