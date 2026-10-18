/* 04.1 and 04.2 step players.
   Both replay the trace recorded by dc_tsp.solve (exported per seed) in recursion order, the same order
   main.py prints it. One engine builds the steps and the side-panel arithmetic; two renderers draw them:
     graph  the simple graph: vertices at their map position, straight arrows, weights as labels (SVG)
     road   the map: every edge follows the OSRM street path for the direction it is driven (Leaflet) */
(function () {
  "use strict";
  var DC = window.DC, RUN = DC.RUN, M = DC.map, $ = DC.$, $$ = DC.$$, fmt = DC.fmt, V = DC.V, w = DC.w;
  var N = RUN.locations.length, START = RUN.presented.route[0], ALL = RUN.locations.map(function (_, i) { return i; });

  var key = function (c) { return c.slice().sort(function (a, b) { return a - b; }).join(","); };
  var set = function (c) { return "{" + c.slice().sort(function (a, b) { return a - b; }).map(V).join(", ") + "}"; };
  var cyc = DC.cycleStr;
  // direction of edge {u,v} inside a cycle: u→v if v follows u
  var dir = function (tour, u, v) { var k = tour.indexOf(u); return tour[(k + 1) % tour.length] === v ? [u, v] : [v, u]; };
  var same = function (e, f) { return (e[0] === f[0] && e[1] === f[1]) || (e[0] === f[1] && e[1] === f[0]); };

  /* ======================= steps (shared) ======================= */
  function build(s) {
    var data = RUN.seeds[s], out = [], active = [], cuts = [];
    var snap = function () { return { active: active.map(function (t) { return t.slice(); }), cuts: cuts.slice() }; };
    out.push({ kind: "input", depth: 0, label: N + " vertices, K" + N, st: snap() });
    out.push({ kind: "shuffle", depth: 0, label: "shuffle the cities", order: data.shuffled, st: snap() });
    data.trace.forEach(function (ev) {
      if (ev.step === "split") {
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
    return out;
  }

  /* ======================= drawing (shared, through an adapter) =======================
     Edge options: cls (faint|L|R|route|add|bridge|del), draw, arrow, tone (accent|gold|ink),
     label, ltone (accent|gold|red), pair (the tour is a→b→a, so both directions exist). */
  function draw(st, A) {
    A.clear();
    if (A.mode) A.mode(st.kind);
    var S = st.st, ev = st.ev, groupL = {}, groupR = {}, focus;
    var tour = function (t, o) {
      if (t.length < 2) return;
      for (var k = 0; k < t.length; k++) {
        var a = t[k], b = t[(k + 1) % t.length], opt = typeof o === "function" ? o(a, b) : o;
        A.edge(a, b, Object.assign({ pair: t.length === 2 }, opt));
      }
    };
    var others = function (exclude) { S.active.forEach(function (t) { if (exclude.indexOf(key(t)) < 0) tour(t, { cls: "faint" }); }); };
    S.cuts.forEach(function (c) { if (c !== ev) A.cut(c, false); });

    if (st.kind === "input" || st.kind === "shuffle") {
      A.pins(function () { return ""; });
      focus = ALL;
    } else if (st.kind === "split") {
      ev.left.forEach(function (c) { groupL[c] = 1; }); ev.right.forEach(function (c) { groupR[c] = 1; });
      others([]);
      A.cut(ev, true);
      A.pins(function (i) { return groupL[i] ? "L" : groupR[i] ? "R" : "dim"; });
      focus = ev.cities;
    } else if (st.kind === "base") {
      others([key(ev.cities)]);
      if (ev.cities.length === 1) A.ring(ev.cities[0]);
      else tour(ev.cities, function (a, b) { return { cls: "L", draw: true, arrow: true, tone: "accent", label: fmt(w(a, b)), ltone: "accent" }; });
      A.pins(function (i) { return ev.cities.indexOf(i) >= 0 ? "L" : "dim"; });
      focus = ev.cities;
    } else if (st.kind === "splice") {
      var lt = ev.left_tour, rt = ev.right_tour, pending = ev.removed.slice();
      others([key(lt), key(rt)]);
      var keep = function (t, cls, tone) {
        if (t.length < 2) return;
        for (var k = 0; k < t.length; k++) {
          var a = t[k], b = t[(k + 1) % t.length], hit = -1;
          // skip only the first match: a 2-city tour a→b→a has two parallel edges and loses one
          pending.forEach(function (e, n) { if (hit < 0 && same(e, [a, b])) hit = n; });
          if (hit >= 0) { pending.splice(hit, 1); continue; }
          A.edge(a, b, { cls: cls, arrow: true, tone: tone, pair: t.length === 2 });
        }
      };
      keep(lt, "L", "accent"); keep(rt, "R", "ink");
      ev.removed.forEach(function (e) {
        var t = lt.indexOf(e[0]) >= 0 ? lt : rt, d = dir(t, e[0], e[1]);
        A.edge(d[0], d[1], { cls: "del", label: "−" + fmt(w(e[0], e[1])), ltone: "red", pair: t.length === 2 });
      });
      ev.added.forEach(function (e) {
        var d = dir(ev.tour, e[0], e[1]), isBridge = ev.bridge && same(e, ev.bridge);
        A.edge(d[0], d[1], { cls: isBridge ? "bridge" : "add", draw: true, arrow: true, tone: "gold", label: (isBridge ? "bridge " : "+") + fmt(w(e[0], e[1])), ltone: "gold", pair: ev.tour.length === 2 });
      });
      lt.forEach(function (c) { groupL[c] = 1; }); rt.forEach(function (c) { groupR[c] = 1; });
      if (lt.length === 1) A.ring(lt[0]);
      if (rt.length === 1) A.ring(rt[0]);
      A.pins(function (i) { return groupL[i] ? "L" : groupR[i] ? "R" : "dim"; });
      focus = lt.concat(rt);
    } else if (st.kind === "merged") {
      others([key(ev.tour)]);
      var all = ev.tour.length <= 6;
      tour(ev.tour, function (a, b) {
        var added = ev.added.some(function (e) { return same(e, [a, b]); });
        return { cls: added ? "add" : "L", draw: added, arrow: true, tone: added ? "gold" : "accent", label: all || added ? fmt(w(a, b)) : null, ltone: added ? "gold" : "accent" };
      });
      A.pins(function (i) { return ev.tour.indexOf(i) >= 0 ? "L" : "dim"; });
      focus = ev.tour;
    } else {
      var r = st.route;
      for (var k = 0; k < r.length - 1; k++) {
        var e = A.edge(r[k], r[k + 1], { cls: "route", draw: st.kind === "final", arrow: true, tone: "accent", tip: "Leg " + (k + 1) + " · " + V(r[k]) + " → " + V(r[k + 1]) + " · " + fmt(w(r[k], r[k + 1])) + " km" });
        A.legno(e, k + 1);
      }
      A.pins(function () { return ""; });
      focus = r.slice(0, -1);
    }
    A.fit(focus);
  }

  /* ---------- renderer 1: road map (Leaflet) ---------- */
  function roadAdapter(el) {
    var map = M.create(el, { padding: [56, 56] });
    if (!map) return null;
    var layer = L.layerGroup().addTo(map), pins = L.layerGroup().addTo(map);
    var ARROW = { accent: "accent", gold: "gold", ink: "ink" };
    return {
      refresh: function () { M.refresh(map); },
      clear: function () { layer.clearLayers(); },
      edge: function (a, b, o) {
        return M.edge(layer, a, b, { cls: "rd--" + o.cls, halo: o.cls !== "faint" && o.cls !== "del", draw: o.draw, arrow: o.arrow, arrowTone: ARROW[o.tone],
          label: o.label, labelCls: "wtag wtag--" + (o.ltone || "accent"), labelAt: 0.5, tip: o.tip });
      },
      legno: function (e, n) { M.tag(layer, M.along(e.path, 0.5).ll, String(n), "legno", 600); },
      ring: function (i) { M.ring(layer, i); },
      cut: function (ev, current) {
        var lats = ev.cities.map(function (c) { return RUN.locations[c].lat; }), lons = ev.cities.map(function (c) { return RUN.locations[c].lon; });
        var m = 0.0012, lo, hi, pts, lbl;
        if (ev.axis === "x") { lo = Math.min.apply(null, lats) - m; hi = Math.max.apply(null, lats) + m; pts = [[lo, ev.cut], [hi, ev.cut]]; lbl = [hi + 0.0004, ev.cut]; }
        else { lo = Math.min.apply(null, lons) - m; hi = Math.max.apply(null, lons) + m; pts = [[ev.cut, lo], [ev.cut, hi]]; lbl = [ev.cut, hi + 0.0009]; }
        L.polyline(pts, { className: "rd " + (current ? "rd--cut" : "rd--cut-old"), interactive: false }).addTo(layer);
        M.tag(layer, lbl, "L" + (ev.depth + 1) + (current ? " · " + ev.axis + " = " + fmt(ev.cut, 4) : ""), current ? "cutlbl" : "cutlbl cutlbl--old", 700);
      },
      pins: function (fn) { pins.clearLayers(); M.vertices(pins, { cls: function (i) { var c = fn(i); return c ? "vx--" + c : ""; } }); },
      fit: function (cities) { M.fit(map, cities, { padding: [56, 56] }); }
    };
  }

  /* ---------- renderer 2: simple graph (SVG) ---------- */
  function graphAdapter(el) {
    var NS = "http://www.w3.org/2000/svg", W = 160, H = 100, PAD = 9, R = 3.4;
    var L0 = RUN.locations, k = Math.cos(L0[0].lat * Math.PI / 180);
    var xs = L0.map(function (l) { return l.lon * k; }), ys = L0.map(function (l) { return l.lat; });
    var minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs), miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    var s = Math.min((W - 2 * PAD) / (maxx - minx), (H - 2 * PAD - 4) / (maxy - miny));
    var ox = (W - (maxx - minx) * s) / 2, oy = (H - (maxy - miny) * s) / 2 + 2;
    var X = function (lon) { return ox + (lon * k - minx) * s; }, Y = function (lat) { return H - (oy + (lat - miny) * s); };
    var P = L0.map(function (l) { return [X(l.lon), Y(l.lat)]; });
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    var k10 = "";
    for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) k10 += "<line x1='" + P[i][0] + "' y1='" + P[i][1] + "' x2='" + P[j][0] + "' y2='" + P[j][1] + "'/>";
    svg.innerHTML = "<g class='g-k10'>" + k10 + "</g><g data-l='cuts'></g><g data-l='edges'></g><g data-l='labels'></g><g data-l='verts'></g>";
    el.appendChild(svg);
    var G = {}; ["cuts", "edges", "labels", "verts"].forEach(function (n) { G[n] = svg.querySelector("[data-l='" + n + "']"); });
    var verts = P.map(function (p, i) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("class", "g-v" + (i === START ? " is-start" : ""));
      g.innerHTML = "<title>" + V(i) + " · " + DC.esc(DC.name(i)) + "</title><circle cx='" + p[0] + "' cy='" + p[1] + "' r='" + R + "'/><text x='" + p[0] + "' y='" + p[1] + "' font-size='2.5'>" + V(i) + "</text>";
      G.verts.appendChild(g);
      return g;
    });
    function add(layer, html) { layer.insertAdjacentHTML("beforeend", html); }
    function label(x, y, text, tone, pop) {
      var wdt = text.length * 1.32 + 2.2;
      add(G.labels, "<g class='g-lbl g-lbl--" + tone + (pop ? " g-pop" : "") + "' style='transform-origin:" + x + "px " + y + "px'><rect x='" + (x - wdt / 2) + "' y='" + (y - 1.8) + "' width='" + wdt + "' height='3.6' rx='0.8'/><text x='" + x + "' y='" + y + "' font-size='2.1'>" + DC.esc(text) + "</text></g>");
    }
    // quadratic edge a→b, shortened to the circle rims; pair edges bend so a→b and b→a do not overlap
    function geom(a, b, bend) {
      var p = P[a], q = P[b], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
      var nx = -uy, ny = ux, h = bend * len;
      var c = [(p[0] + q[0]) / 2 + nx * h, (p[1] + q[1]) / 2 + ny * h];
      var start = [p[0] + ux * (R + 0.5) + nx * h * 0.25, p[1] + uy * (R + 0.5) + ny * h * 0.25];
      var end = [q[0] - ux * (R + 0.5) + nx * h * 0.25, q[1] - uy * (R + 0.5) + ny * h * 0.25];
      var at = function (t) { var m = 1 - t; return [m * m * start[0] + 2 * m * t * c[0] + t * t * end[0], m * m * start[1] + 2 * m * t * c[1] + t * t * end[1]]; };
      var tan = function (t) { return [2 * (1 - t) * (c[0] - start[0]) + 2 * t * (end[0] - c[0]), 2 * (1 - t) * (c[1] - start[1]) + 2 * t * (end[1] - c[1])]; };
      return { d: "M" + start[0].toFixed(2) + " " + start[1].toFixed(2) + " Q" + c[0].toFixed(2) + " " + c[1].toFixed(2) + " " + end[0].toFixed(2) + " " + end[1].toFixed(2), at: at, tan: tan, n: [nx, ny], bend: h };
    }
    var TONE = { accent: "g-arrow", gold: "g-arrow g-arrow--gold", ink: "g-arrow g-arrow--muted" };
    return {
      refresh: function () {},
      // the complete graph K10 is shown clearly while introducing the input, then fades to a faint backdrop
      mode: function (kind) { el.classList.toggle("is-k10", kind === "input" || kind === "shuffle"); },
      clear: function () { G.cuts.innerHTML = ""; G.edges.innerHTML = ""; G.labels.innerHTML = ""; },
      edge: function (a, b, o) {
        var g = geom(a, b, o.pair ? 0.2 : 0);
        add(G.edges, "<path class='g-e g-e--" + o.cls + "' d='" + g.d + "'>" + (o.tip ? "<title>" + DC.esc(o.tip) + "</title>" : "") + "</path>");
        if (o.draw && !DC.reduced) {
          // strokes are non-scaling, so dashes are in screen px: measure the on-screen length for the draw-on effect
          var path = G.edges.lastElementChild, ctm = svg.getScreenCTM();
          if (ctm && path.getTotalLength) { path.style.setProperty("--len", (path.getTotalLength() * ctm.a + 2).toFixed(1)); path.classList.add("g-e--draw"); }
        }
        if (o.arrow) {
          var p = g.at(0.6), t = g.tan(0.6), ang = Math.atan2(t[1], t[0]) * 180 / Math.PI;
          add(G.edges, "<polygon class='" + (TONE[o.tone] || "g-arrow") + (o.draw ? " g-fade" : "") + "' points='1.3,0 -1.1,-1.15 -0.55,0 -1.1,1.15' transform='translate(" + p[0].toFixed(2) + " " + p[1].toFixed(2) + ") rotate(" + ang.toFixed(1) + ")'/>");
        }
        if (o.label != null) {
          var m = g.at(0.5), off = o.pair ? 2.6 : 0;
          label(m[0] + g.n[0] * off, m[1] + g.n[1] * off, o.label, o.ltone || "accent", o.draw);
        }
        return g;
      },
      legno: function (g, n) {
        var m = g.at(0.5), x = m[0] - g.n[0] * 2.6, y = m[1] - g.n[1] * 2.6;
        add(G.labels, "<g class='g-lbl g-lbl--leg'><circle cx='" + x + "' cy='" + y + "' r='1.9'/><text x='" + x + "' y='" + y + "' font-size='1.9'>" + n + "</text></g>");
      },
      ring: function (i) { add(G.edges, "<circle class='g-ring g-pop' style='transform-origin:" + P[i][0] + "px " + P[i][1] + "px' cx='" + P[i][0] + "' cy='" + P[i][1] + "' r='" + (R + 2.4) + "'/>"); },
      cut: function (ev, current) {
        var cx = ev.cities.map(function (c) { return P[c][0]; }), cy = ev.cities.map(function (c) { return P[c][1]; }), m = 6, x1, y1, x2, y2, lx, ly;
        if (ev.axis === "x") { x1 = x2 = X(ev.cut); y1 = Math.min.apply(null, cy) - m; y2 = Math.max.apply(null, cy) + m; lx = x1; ly = y1 - 2.2; }
        else { y1 = y2 = Y(ev.cut); x1 = Math.min.apply(null, cx) - m; x2 = Math.max.apply(null, cx) + m; lx = x2 + 6; ly = y1; }
        add(G.cuts, "<line class='g-cut" + (current ? "" : " g-cut--old") + "' x1='" + x1 + "' y1='" + y1 + "' x2='" + x2 + "' y2='" + y2 + "'/>");
        label(lx, ly, "L" + (ev.depth + 1) + (current ? " · " + ev.axis : ""), current ? "cut" : "cutold", current);
      },
      pins: function (fn) {
        verts.forEach(function (g, i) {
          var c = fn(i);
          g.setAttribute("class", "g-v" + (i === START ? " is-start" : "") + (c ? " is-" + c : ""));
        });
      },
      fit: function () {}
    };
  }

  /* ======================= side panel text (shared) ======================= */
  function sortedBy(cities, axis) {
    var k = axis === "x" ? "lon" : "lat";
    return cities.slice().sort(function (a, b) { return (RUN.locations[a][k] - RUN.locations[b][k]) || (a - b); });
  }
  function panel(st, seed, mode) {
    var ev = st.ev, data = RUN.seeds[seed], html = "", kind = "", title = "";
    if (st.kind === "input") {
      kind = "Input"; title = N + " vertices, complete graph K" + N;
      html = "<p>Locations from <code>locations.csv</code>, weights from <code>distance_matrix_km.csv</code>. Every pair is an edge, " + (N * (N - 1) / 2) + " in total" + (mode === "graph" ? " (the faint lines)" : "") + ". The tour starts and ends at <strong>" + V(START) + "</strong>, " + DC.esc(DC.name(START)) + ".</p><p class='note'>Use → or Play to step through the recursion in the order <code>main.py</code> prints it.</p>";
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
          (mode === "graph" ? "<p class='note'>Drawn as two curved arrows, one for each direction. Both carry the same weight w = " + fmt(w(a, b)) + " km because the graph is undirected.</p>"
            : "<p class='note'>Both roads are drawn: " + V(a) + "→" + V(b) + " is " + fmt(RUN.raw[a][b]) + " km and " + V(b) + "→" + V(a) + " is " + fmt(RUN.raw[b][a]) + " km on the raw one-way data. The model uses their average, w = " + fmt(w(a, b)) + ".</p>");
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
      var r = st.route, seen = r.slice(0, -1).sort(function (a, b) { return a - b; }), sum = 0, parts = [];
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
    return { kind: kind, title: title, html: html, sub: "seed " + seed + (seed === RUN.presented.seed ? " · presented run" : "") + " · " + fmt(data.total) + " km" };
  }

  /* ======================= a player = steps + renderer + controls ======================= */
  function Player(root, mode, adapterFor) {
    var self = this, q = function (r) { return root.querySelector("[data-r='" + r + "']"); }, act = function (a) { return root.querySelector("[data-a='" + a + "']"); };
    var A = adapterFor(q("stage")), stages = [], cur = 0, timer = null;
    self.root = root; self.seed = RUN.presented.seed;

    function renderList() {
      q("list").innerHTML = stages.map(function (s, i) {
        var tag = { input: "in", shuffle: "S1", split: "div", base: "base", splice: s.ev && s.ev.name, merged: "=", final: "→", verify: "✓" }[s.kind];
        var d = s.kind === "input" || s.kind === "shuffle" || s.kind === "final" || s.kind === "verify" ? 0 : s.depth + 1;
        return "<li><button type='button' data-i='" + i + "' style='--d:" + Math.min(d, 4) + "'><span class='tag'>" + tag + "</span><span>" + DC.esc(s.label) + "</span></button></li>";
      }).join("");
    }
    self.show = function (i) {
      cur = Math.max(0, Math.min(stages.length - 1, i));
      var st = stages[cur], t = panel(st, self.seed, mode);
      if (A) draw(st, A);
      q("kind").textContent = t.kind; q("title").textContent = t.title; q("body").innerHTML = t.html;
      q("badge").textContent = t.kind; q("sub").textContent = t.sub;
      q("count").textContent = (cur + 1) + " / " + stages.length;
      q("progress").style.width = ((cur + 1) / stages.length * 100) + "%";
      var list = q("list");
      $$("button", list).forEach(function (b, k) {
        b.parentNode.classList.toggle("is-done", k < cur);
        if (k === cur) {
          b.setAttribute("aria-current", "step");
          // keep the current step visible inside the list without scrolling the page
          var top = b.offsetTop - list.offsetTop;
          if (top < list.scrollTop || top + b.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - list.clientHeight / 2;
        } else b.removeAttribute("aria-current");
      });
      act("prev").disabled = act("first").disabled = cur === 0;
      act("next").disabled = act("last").disabled = cur === stages.length - 1;
      if (cur === stages.length - 1) self.stop();
    };
    self.cur = function () { return cur; };
    self.play = function () {
      if (cur === stages.length - 1) self.show(0);
      act("play").textContent = "❚❚ Pause";
      timer = setInterval(function () { self.show(cur + 1); }, 2400);
    };
    self.stop = function () { clearInterval(timer); timer = null; act("play").textContent = "▶ Play"; };
    self.toggle = function () { timer ? self.stop() : self.play(); };
    self.step = function (d) { self.stop(); self.show(cur + d); };
    self.setSeed = function (s) {
      self.seed = s;
      q("seed").value = String(s);
      var d = RUN.seeds[s], tot = q("seedTotal");
      if (tot) tot.innerHTML = fmt(d.total) + " km" + (d.optimal ? " · <span class='note--accent'>optimal</span>" : "");
      self.stop();
      stages = build(s);
      renderList();
      self.show(0);
    };
    self.jump = function (name) {
      for (var i = 0; i < stages.length; i++) if (stages[i].kind === "splice" && stages[i].ev.name === name) { self.stop(); self.show(i); return; }
    };
    self.refresh = function () { if (A) A.refresh(); };

    q("seed").innerHTML = RUN.seeds.map(function (d) {
      return "<option value='" + d.seed + "'>" + d.seed + " · " + fmt(d.total) + " km" + (d.seed === RUN.presented.seed ? " ★ presented" : "") + (d.optimal ? " · opt" : "") + "</option>";
    }).join("");
    q("seed").addEventListener("change", function () { DC.player.setSeed(+this.value, false); });
    q("list").addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) { self.stop(); self.show(+b.dataset.i); } });
    act("prev").addEventListener("click", function () { self.step(-1); });
    act("next").addEventListener("click", function () { self.step(1); });
    act("first").addEventListener("click", function () { self.stop(); self.show(0); });
    act("last").addEventListener("click", function () { self.stop(); self.show(stages.length - 1); });
    act("play").addEventListener("click", self.toggle);
  }

  /* ======================= wiring ======================= */
  var players = [];
  // the seed is shared, so both players always show the same run
  DC.player = {
    setSeed: function (s, nav) {
      players.forEach(function (p) { p.setSeed(s); });
      if (nav) { DC.go("#/implementation/graph"); DC.toast("Replaying seed " + s); }
    },
    jump: function (name) { players.forEach(function (p) { p.jump(name); }); }
  };

  DC.onPage("implementation", function () {
    var graph = new Player($("[data-player='graph']"), "graph", graphAdapter);
    var road = new Player($("[data-player='road']"), "road", roadAdapter);
    players = [graph, road];
    DC.player.setSeed(RUN.presented.seed, false);
    $("[data-player='graph'] [data-a='sync']").addEventListener("click", function () {
      road.stop(); road.show(graph.cur());
      document.getElementById("implementation-player").scrollIntoView({ behavior: DC.reduced ? "auto" : "smooth" });
    });
    document.addEventListener("keydown", function (e) {
      if (DC.page !== "implementation" || $("#palette").classList.contains("is-open")) return;
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName || "")) return;
      // drive whichever player is closest to the middle of the screen
      var best = null, bd = 1e9;
      players.forEach(function (p) {
        var r = p.root.getBoundingClientRect();
        if (r.bottom < 80 || r.top > innerHeight - 80) return;
        var d = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2);
        if (d < bd) { bd = d; best = p; }
      });
      if (!best) return;
      if (e.key === "ArrowRight") { e.preventDefault(); best.step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); best.step(-1); }
      else if (e.key === " " && !/BUTTON|A/.test(e.target.tagName)) { e.preventDefault(); best.toggle(); }
    });
  });
  DC.onShow("implementation", function () { players.forEach(function (p) { p.refresh(); }); });
})();
