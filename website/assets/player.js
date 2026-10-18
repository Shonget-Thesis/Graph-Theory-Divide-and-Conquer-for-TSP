/* 04.1 Road-snapped step player.
   Replays the trace recorded by dc_tsp.solve (exported per seed) in recursion order, the same order
   main.py prints it. Every edge on the map follows the OSRM street path for the direction it is driven. */
(function () {
  "use strict";
  var DC = window.DC, RUN = DC.RUN, M = DC.map, $ = DC.$, $$ = DC.$$, fmt = DC.fmt, V = DC.V, w = DC.w;
  var N = RUN.locations.length, START = RUN.presented.route[0];
  var map, layer, pins, stages = [], cur = 0, seed = RUN.presented.seed, timer = null;

  var key = function (c) { return c.slice().sort(function (a, b) { return a - b; }).join(","); };
  var set = function (c) { return "{" + c.slice().sort(function (a, b) { return a - b; }).map(V).join(", ") + "}"; };
  var cyc = DC.cycleStr;
  var tourCost = function (t) { if (t.length < 2) return 0; var s = 0; for (var k = 0; k < t.length; k++) s += w(t[k], t[(k + 1) % t.length]); return s; };
  // direction of edge {u,v} inside a cycle: u→v if v follows u
  var dir = function (tour, u, v) { var k = tour.indexOf(u); return tour[(k + 1) % tour.length] === v ? [u, v] : [v, u]; };
  var same = function (e, f) { return (e[0] === f[0] && e[1] === f[1]) || (e[0] === f[1] && e[1] === f[0]); };

  /* ---------- build the stage list for one seed ---------- */
  function build(s) {
    var data = RUN.seeds[s], out = [], active = [], cuts = [], level = {};
    var snap = function () { return { active: active.map(function (t) { return t.slice(); }), cuts: cuts.slice() }; };
    out.push({ kind: "input", depth: 0, label: N + " vertices, K" + N, st: snap() });
    out.push({ kind: "shuffle", depth: 0, label: "shuffle the cities", order: data.shuffled, st: snap() });
    data.trace.forEach(function (ev) {
      if (ev.step === "split") {
        level[key(ev.cities)] = ev.depth + 1;
        cuts.push(ev);
        out.push({ kind: "split", depth: ev.depth, ev: ev, label: set(ev.cities) + " by " + ev.axis, st: snap() });
      } else if (ev.step === "base") {
        active.push(ev.cities.slice());
        out.push({ kind: "base", depth: ev.depth, ev: ev, label: cyc(ev.cities) + " · " + fmt(ev.cost) + " km", st: snap() });
      } else {
        out.push({ kind: "splice", depth: ev.depth, ev: ev, label: "bridge " + V(ev.bridge[0]) + "–" + V(ev.bridge[1]) + " · Δ " + DC.sgn(ev.delta), st: snap() });
        var kl = key(ev.left_tour), kr = key(ev.right_tour);
        active = active.filter(function (t) { var k = key(t); return k !== kl && k !== kr; });
        active.push(ev.tour.slice());
        var ku = key(ev.left_tour.concat(ev.right_tour));
        cuts = cuts.filter(function (c) { return key(c.cities) !== ku; });
        out.push({ kind: "merged", depth: ev.depth, ev: ev, label: "merged · " + fmt(ev.cost) + " km", st: snap() });
      }
    });
    out.push({ kind: "final", depth: 0, label: "route from V" + START + " · " + fmt(data.total) + " km", route: data.route, st: snap() });
    out.push({ kind: "verify", depth: 0, label: "verify the tour", route: data.route, st: snap() });
    out.level = level;
    return out;
  }

  /* ---------- drawing ---------- */
  function drawTour(t, o) { return M.cycle(layer, t, o); }
  function cutLine(ev, current) {
    var lats = ev.cities.map(function (c) { return RUN.locations[c].lat; }), lons = ev.cities.map(function (c) { return RUN.locations[c].lon; });
    var m = 0.0012, lo, hi, pts, lbl;
    if (ev.axis === "x") {
      lo = Math.min.apply(null, lats) - m; hi = Math.max.apply(null, lats) + m;
      pts = [[lo, ev.cut], [hi, ev.cut]]; lbl = [hi + 0.0004, ev.cut];
    } else {
      lo = Math.min.apply(null, lons) - m; hi = Math.max.apply(null, lons) + m;
      pts = [[ev.cut, lo], [ev.cut, hi]]; lbl = [ev.cut, hi + 0.0009];
    }
    L.polyline(pts, { className: "rd " + (current ? "rd--cut" : "rd--cut-old"), interactive: false }).addTo(layer);
    M.tag(layer, lbl, "L" + (ev.depth + 1) + (current ? " · " + ev.axis + " = " + fmt(ev.cut, 4) : ""), current ? "cutlbl" : "cutlbl cutlbl--old", 700);
  }
  function pinsFor(cls) {
    pins.clearLayers();
    M.vertices(pins, { cls: cls });
  }

  function draw(st) {
    layer.clearLayers();
    var S = st.st, ev = st.ev, groupL = {}, groupR = {}, focus = null;
    var others = function (exclude) {
      S.active.forEach(function (t) { if (exclude.indexOf(key(t)) < 0) drawTour(t, { cls: "rd--faint" }); });
    };
    S.cuts.forEach(function (c) { if (!ev || c !== ev) cutLine(c, false); });

    if (st.kind === "input" || st.kind === "shuffle") {
      pinsFor(function () { return ""; });
      focus = RUN.locations.map(function (_, i) { return i; });
    } else if (st.kind === "split") {
      ev.left.forEach(function (c) { groupL[c] = 1; }); ev.right.forEach(function (c) { groupR[c] = 1; });
      others([]);
      cutLine(ev, true);
      pinsFor(function (i) { return groupL[i] ? "vx--L" : groupR[i] ? "vx--R" : "vx--dim"; });
      focus = ev.cities;
    } else if (st.kind === "base") {
      others([key(ev.cities)]);
      if (ev.cities.length === 1) M.ring(layer, ev.cities[0]);
      else drawTour(ev.cities, function (a, b) { return { cls: "rd--L", halo: true, draw: true, arrow: true, label: fmt(w(a, b)), labelCls: "wtag wtag--accent", labelAt: 0.5 }; });
      pinsFor(function (i) { return ev.cities.indexOf(i) >= 0 ? "vx--L" : "vx--dim"; });
      focus = ev.cities;
    } else if (st.kind === "splice") {
      var lt = ev.left_tour, rt = ev.right_tour;
      others([key(lt), key(rt)]);
      var removed = ev.removed, pending = removed.slice();
      var keep = function (t, cls) {
        if (t.length < 2) return;
        for (var k = 0; k < t.length; k++) {
          var a = t[k], b = t[(k + 1) % t.length];
          // skip only the first match: a 2-city tour a→b→a has two parallel edges and loses one
          var hit = -1;
          pending.forEach(function (e, n) { if (hit < 0 && same(e, [a, b])) hit = n; });
          if (hit >= 0) { pending.splice(hit, 1); continue; }
          M.edge(layer, a, b, { cls: cls, halo: true, arrow: true, arrowTone: cls === "rd--L" ? "accent" : "ink" });
        }
      };
      keep(lt, "rd--L"); keep(rt, "rd--R");
      removed.forEach(function (e) {
        var t = lt.indexOf(e[0]) >= 0 ? lt : rt, d = dir(t, e[0], e[1]);
        M.edge(layer, d[0], d[1], { cls: "rd--del", label: "−" + fmt(w(e[0], e[1])), labelCls: "wtag wtag--red", labelAt: 0.5 });
      });
      ev.added.forEach(function (e) {
        var d = dir(ev.tour, e[0], e[1]), isBridge = ev.bridge && same(e, ev.bridge);
        M.edge(layer, d[0], d[1], { cls: isBridge ? "rd--bridge" : "rd--add", halo: true, draw: true, arrow: true, arrowTone: "gold",
          label: (isBridge ? "bridge " : "+") + fmt(w(e[0], e[1])), labelCls: "wtag wtag--gold", labelAt: 0.5 });
      });
      lt.forEach(function (c) { groupL[c] = 1; }); rt.forEach(function (c) { groupR[c] = 1; });
      if (lt.length === 1) M.ring(layer, lt[0]);
      if (rt.length === 1) M.ring(layer, rt[0]);
      pinsFor(function (i) { return groupL[i] ? "vx--L" : groupR[i] ? "vx--R" : "vx--dim"; });
      focus = lt.concat(rt);
    } else if (st.kind === "merged") {
      others([key(ev.tour)]);
      var lbl = ev.tour.length <= 6;
      drawTour(ev.tour, function (a, b) {
        var added = ev.added.some(function (e) { return same(e, [a, b]); });
        return { cls: added ? "rd--add" : "rd--L", halo: true, draw: added, arrow: true, arrowTone: added ? "gold" : "accent", label: lbl || added ? fmt(w(a, b)) : null, labelCls: added ? "wtag wtag--gold" : "wtag wtag--accent", labelAt: 0.5 };
      });
      pinsFor(function (i) { return ev.tour.indexOf(i) >= 0 ? "vx--L" : "vx--dim"; });
      focus = ev.tour;
    } else {
      var r = st.route;
      for (var k = 0; k < r.length - 1; k++) {
        var e = M.edge(layer, r[k], r[k + 1], { cls: "rd--route", halo: true, draw: st.kind === "final", arrow: true, tip: "Leg " + (k + 1) + " · " + V(r[k]) + " → " + V(r[k + 1]) + " · " + fmt(w(r[k], r[k + 1])) + " km" });
        M.tag(layer, M.along(e.path, 0.5).ll, String(k + 1), "legno", 600);
      }
      pinsFor(function () { return ""; });
      focus = r.slice(0, -1);
    }
    M.fit(map, focus, { padding: [56, 56] });
  }

  /* ---------- side panel text ---------- */
  function sortedBy(cities, axis) {
    var k = axis === "x" ? "lon" : "lat";
    return cities.slice().sort(function (a, b) { return (RUN.locations[a][k] - RUN.locations[b][k]) || (a - b); });
  }
  function panel(st) {
    var ev = st.ev, data = RUN.seeds[seed], html = "", kind = "", title = "";
    if (st.kind === "input") {
      kind = "Input"; title = N + " vertices, complete graph K" + N;
      html = "<p>Locations from <code>locations.csv</code>, weights from <code>distance_matrix_km.csv</code>. Every pair is an edge, " + (N * (N - 1) / 2) + " in total. The tour starts and ends at <strong>" + V(START) + "</strong>, " + DC.esc(DC.name(START)) + ".</p><p class='note'>Use → or Play to step through the recursion in the order <code>main.py</code> prints it.</p>";
    } else if (st.kind === "shuffle") {
      kind = "Step 1 · Shuffle"; title = "Random order of the cities";
      html = "<div class='calc'>" + st.order.map(V).join("  ") + "</div><p>The split sorts by a deterministic (coordinate, index) key, so this order does not change the splits. It is kept to follow the paper, and it advances the random-number generator. The random <strong>axis</strong> choice is what changes the result.</p>";
    } else if (st.kind === "split") {
      var sorted = sortedBy(ev.cities, ev.axis), mid = Math.floor(sorted.length / 2), axisName = ev.axis === "x" ? "longitude" : "latitude";
      kind = "Step 2 · Divide · level " + (ev.depth + 1);
      title = "DIVIDE " + set(ev.cities) + " by " + ev.axis + " (" + axisName + ")";
      html = "<p>Sorted by " + axisName + " and cut at the median:</p><div class='calc'><span class='acc'>" + sorted.slice(0, mid).map(V).join(" ") + "</span>  │  " + sorted.slice(mid).map(V).join(" ") +
        "\ncut " + ev.axis + " = " + fmt(ev.cut, 5) + "°\n→ " + set(ev.left) + " | " + set(ev.right) + "</div><p class='note'>Halves of " + ev.left.length + " and " + ev.right.length + " (⌊m/2⌋ and ⌈m/2⌉, m = " + ev.cities.length + "). The coordinates only decide the split; every cost uses road distance.</p>";
    } else if (st.kind === "base") {
      kind = "Step 3 · Base case";
      if (ev.cities.length === 1) {
        title = "BASE " + V(ev.cities[0]) + " · cost = 0.00 km";
        html = "<p>One city: the tour is the city itself, of length 0.</p>";
      } else {
        var a = ev.cities[0], b = ev.cities[1];
        title = "BASE " + cyc(ev.cities) + " · cost = " + fmt(ev.cost) + " km";
        html = "<p>Two cities: the tour " + V(a) + " → " + V(b) + " → " + V(a) + " uses the edge twice, as in the paper.</p><div class='calc'>2 · w(" + V(a) + "," + V(b) + ") = 2 × " + fmt(w(a, b)) + " = <span class='acc'>" + fmt(ev.cost) + " km</span></div>" +
          "<p class='note'>Both roads are drawn: " + V(a) + "→" + V(b) + " is " + fmt(RUN.raw[a][b]) + " km and " + V(b) + "→" + V(a) + " is " + fmt(RUN.raw[b][a]) + " km on the raw one-way data. The model uses their average, w = " + fmt(w(a, b)) + ".</p>";
      }
    } else if (st.kind === "splice") {
      var lt = ev.left_tour, rt = ev.right_tour, br = ev.bridge;
      kind = "Steps 5–6 · Combine · " + ev.name;
      title = "MERGE " + cyc(lt) + " (" + fmt(ev.left_cost) + ") + " + cyc(rt) + " (" + fmt(ev.right_cost) + ")";
      var rows = ["checked " + lt.length + "·" + rt.length + " = " + lt.length * rt.length + " cross pairs", "<span class='add'>bridge  " + V(br[0]) + "–" + V(br[1]) + "  " + fmt(w(br[0], br[1])) + "  (shortest)</span>"];
      ev.removed.forEach(function (e, k) { rows.push("<span class='del'>" + (k ? "        " : "remove  ") + V(e[0]) + "–" + V(e[1]) + "  " + fmt(w(e[0], e[1])) + "</span>"); });
      if (!ev.removed.length) rows.push("<span class='del'>remove  none (single city)</span>");
      ev.added.forEach(function (e, k) { rows.push("<span class='add'>" + (k ? "        " : "add     ") + V(e[0]) + "–" + V(e[1]) + "  " + fmt(w(e[0], e[1])) + (same(e, br) ? "  ← bridge" : "") + "</span>"); });
      var addS = ev.added.map(function (e) { return fmt(w(e[0], e[1])); }), remS = ev.removed.map(function (e) { return fmt(w(e[0], e[1])); });
      rows.push("Δ = (" + addS.join(" + ") + ")\n  − (" + (remS.join(" + ") || "0") + ") = <span class='acc'>" + DC.sgn(ev.delta) + " km</span>");
      html = "<div class='calc'>" + rows.join("\n") + "</div><p>The paper's rule: the shortest bridge must be one of the two added edges. Of the ways to open one edge next to each bridge endpoint and close the loop, the cheapest is kept." +
        (lt.length === 1 || rt.length === 1 ? " A single city has no edge to open, so only one edge is removed." : "") + "</p>";
    } else if (st.kind === "merged") {
      kind = "Combine · " + ev.name + " · result";
      title = cyc(ev.tour);
      html = "<div class='calc'>L(T) = L(T₁) + L(T₂) + Δ\n     = " + fmt(ev.left_cost) + " + " + fmt(ev.right_cost) + " " + (ev.delta >= 0 ? "+" : "−") + " " + fmt(Math.abs(ev.delta)) + " = <span class='acc'>" + fmt(ev.cost) + " km</span></div><p>One cycle through " + ev.tour.length + " cities, each exactly once. Gold edges are the two that were just added.</p>";
    } else if (st.kind === "final") {
      kind = "Result"; title = "Route: " + fmt(data.total) + " km";
      html = "<p>The top-level cycle, rotated to start at " + V(START) + ":</p><div class='calc' style='white-space:pre-wrap'>" + DC.routeStr(data.route) + "</div>" +
        (seed === RUN.presented.seed ? "<p>This is the run presented in the report and the slides.</p>" : "") +
        "<p>" + (data.optimal ? "<span class='chip chip--ok'>equals the optimum</span> This seed happens to match the Held–Karp optimum of " + fmt(RUN.optimum.total) + " km. The algorithm itself cannot tell." : "<span class='chip'>" + DC.sgn(100 * (data.total - RUN.optimum.total) / RUN.optimum.total) + "% vs. optimum</span> Held–Karp's optimum is " + fmt(RUN.optimum.total) + " km.") + "</p>";
    } else {
      var r = st.route, inner = r.slice(0, -1), seen = inner.slice().sort(function (a, b) { return a - b; }), sum = 0, parts = [];
      for (var k = 0; k < r.length - 1; k++) { sum += w(r[k], r[k + 1]); parts.push(fmt(w(r[k], r[k + 1]))); }
      var checks = [
        ["starts at " + V(START), r[0] === START],
        ["returns to " + V(START), r[r.length - 1] === START],
        ["has " + (N + 1) + " entries (" + N + " legs)", r.length === N + 1],
        ["every location visited exactly once", seen.every(function (v, i) { return v === i; }) && seen.length === N],
        ["recomputed total equals reported total", Math.abs(sum - data.total) < 1e-6]
      ];
      kind = "Step 4 of the task · Verify"; title = checks.every(function (c) { return c[1]; }) ? "All checks passed" : "A check FAILED";
      html = "<div class='calc' style='white-space:pre-wrap'>" + checks.map(function (c) { return (c[1] ? "<span class='okc'>[OK]</span> " : "<span class='del'>[FAIL]</span> ") + c[0]; }).join("\n") + "</div><div class='calc' style='white-space:pre-wrap'>" + parts.join(" + ") + "\n= <span class='okc'>" + fmt(sum) + " km</span></div><p class='note'>Recomputed here in the browser from the weight matrix, independently of the Python check.</p>";
    }
    $("#player-kind").textContent = kind;
    $("#player-title").textContent = title;
    $("#player-body").innerHTML = html;
    $("#player-badge").textContent = kind;
    $("#player-sub").textContent = "seed " + seed + (seed === RUN.presented.seed ? " · presented run" : "") + " · " + fmt(data.total) + " km";
  }

  /* ---------- navigation ---------- */
  function renderList() {
    $("#player-list").innerHTML = stages.map(function (s, i) {
      var tag = { input: "in", shuffle: "S1", split: "div", base: "base", splice: s.ev && s.ev.name, merged: "=", final: "→", verify: "✓" }[s.kind];
      var d = s.kind === "merged" || s.kind === "splice" ? s.depth + 1 : s.kind === "split" || s.kind === "base" ? s.depth + 1 : 0;
      return "<li><button type='button' data-i='" + i + "' style='--d:" + Math.min(d, 4) + "'><span class='tag'>" + tag + "</span><span>" + DC.esc(s.label) + "</span></button></li>";
    }).join("");
  }
  function show(i) {
    cur = Math.max(0, Math.min(stages.length - 1, i));
    var st = stages[cur];
    if (map) draw(st);
    panel(st);
    $("#player-count").textContent = (cur + 1) + " / " + stages.length;
    $("#player-progress").style.width = ((cur + 1) / stages.length * 100) + "%";
    $$("#player-list button").forEach(function (b, k) {
      if (k === cur) { b.setAttribute("aria-current", "step"); b.scrollIntoView({ block: "nearest" }); } else b.removeAttribute("aria-current");
      b.parentNode.classList.toggle("is-done", k < cur);
    });
    $("#pl-prev").disabled = cur === 0; $("#pl-first").disabled = cur === 0;
    $("#pl-next").disabled = cur === stages.length - 1; $("#pl-last").disabled = cur === stages.length - 1;
    if (cur === stages.length - 1) stop();
  }
  function play() {
    if (cur === stages.length - 1) show(0);
    $("#pl-play").textContent = "❚❚ Pause";
    timer = setInterval(function () { show(cur + 1); }, 2400);
  }
  function stop() { clearInterval(timer); timer = null; var b = $("#pl-play"); if (b) b.textContent = "▶ Play"; }

  function setSeed(s, nav) {
    seed = s;
    $("#seed-select").value = String(s);
    var d = RUN.seeds[s];
    $("#seed-total").innerHTML = fmt(d.total) + " km" + (d.optimal ? " · <span class='note--accent'>optimal</span>" : "");
    stop();
    stages = build(s);
    renderList();
    show(0);
    if (nav) { DC.go("#/implementation/player"); DC.toast("Replaying seed " + s); }
  }

  DC.player = {
    setSeed: setSeed,
    jump: function (name) {
      for (var i = 0; i < stages.length; i++) if (stages[i].kind === "splice" && stages[i].ev.name === name) { stop(); show(i); return; }
    }
  };

  DC.onPage("implementation", function () {
    var sel = $("#seed-select");
    sel.innerHTML = RUN.seeds.map(function (d) {
      return "<option value='" + d.seed + "'>" + d.seed + " · " + fmt(d.total) + " km" + (d.seed === RUN.presented.seed ? " ★ presented" : "") + (d.optimal ? " · opt" : "") + "</option>";
    }).join("");
    sel.addEventListener("change", function () { setSeed(+sel.value, false); });
    map = M.create($("#map-player"), { padding: [56, 56] });
    if (map) { layer = L.layerGroup().addTo(map); pins = L.layerGroup().addTo(map); }
    $("#player-list").addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) { stop(); show(+b.dataset.i); } });
    $("#pl-prev").addEventListener("click", function () { stop(); show(cur - 1); });
    $("#pl-next").addEventListener("click", function () { stop(); show(cur + 1); });
    $("#pl-first").addEventListener("click", function () { stop(); show(0); });
    $("#pl-last").addEventListener("click", function () { stop(); show(stages.length - 1); });
    $("#pl-play").addEventListener("click", function () { timer ? stop() : play(); });
    document.addEventListener("keydown", function (e) {
      if (DC.page !== "implementation" || $("#palette").classList.contains("is-open")) return;
      if (/INPUT|SELECT|TEXTAREA/.test((e.target.tagName || ""))) return;
      var r = $("#player").getBoundingClientRect();
      if (r.bottom < 80 || r.top > innerHeight - 80) return;
      if (e.key === "ArrowRight") { e.preventDefault(); stop(); show(cur + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); show(cur - 1); }
      else if (e.key === " " && !/BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); timer ? stop() : play(); }
    });
    setSeed(seed, false);
  });
  DC.onShow("implementation", function () { M.refresh(map); });
})();
