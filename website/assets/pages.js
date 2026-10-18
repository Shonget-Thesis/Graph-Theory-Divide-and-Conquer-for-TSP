/* Page content built from window.DC_RUN: tables, figures, maps, code viewer, terminal replay. */
(function () {
  "use strict";
  var DC = window.DC, RUN = DC.RUN, M = DC.map, $ = DC.$, $$ = DC.$$, fmt = DC.fmt, V = DC.V, w = DC.w;
  var P = RUN.presented, N = RUN.locations.length;
  var merges = P.trace.filter(function (e) { return e.step === "merge"; });
  function edgeTxt(e) { return V(e[0]) + "–" + V(e[1]) + " (" + fmt(w(e[0], e[1])) + ")"; }
  function wsum(edges) { return edges.reduce(function (s, e) { return s + w(e[0], e[1]); }, 0); }

  /* ======================= K10 probe (home hero, 03.1) ======================= */
  function probe(box, svg, nameEl, sumEl, opts) {
    var pos = DC.project(11), lines = [], wts = [], dots = [], parts = [];
    for (var i = 0; i < N; i++) for (var j = i + 1; j < N; j++) {
      parts.push('<line class="probe__edge" data-i="' + i + '" data-j="' + j + '" x1="' + pos[i][0] + '" y1="' + pos[i][1] + '" x2="' + pos[j][0] + '" y2="' + pos[j][1] + '"/>');
      if (opts.edgeHits) parts.push('<line class="probe__hit" data-i="' + i + '" data-j="' + j + '" x1="' + pos[i][0] + '" y1="' + pos[i][1] + '" x2="' + pos[j][0] + '" y2="' + pos[j][1] + '" stroke="transparent" stroke-width="3.2"/>');
    }
    for (i = 0; i < N; i++) for (j = i + 1; j < N; j++)
      parts.push('<text class="probe__w" data-i="' + i + '" data-j="' + j + '" x="' + (pos[i][0] + pos[j][0]) / 2 + '" y="' + (pos[i][1] + pos[j][1]) / 2 + '" text-anchor="middle" dominant-baseline="central" font-size="2.7">' + fmt(w(i, j)) + "</text>");
    pos.forEach(function (q, i) {
      var start = RUN.locations[i].role === "start";
      parts.push('<circle class="probe__v' + (start ? " is-start" : "") + '" data-v="' + i + '" cx="' + q[0] + '" cy="' + q[1] + '" r="2.3"/>');
      var dy = q[1] < 12 ? 5.5 : -4.2;
      parts.push('<text class="probe__lbl" x="' + q[0] + '" y="' + (q[1] + dy) + '" text-anchor="middle" font-size="3.2">' + V(i) + "</text>");
    });
    svg.innerHTML = parts.join("");
    lines = $$(".probe__edge", svg); wts = $$(".probe__w", svg); dots = $$(".probe__v", svg);
    // weight labels are tiny in viewBox units; scale font so they stay ~10px on screen
    function hot(v, edge) {
      box.classList.toggle("is-probing", v != null || edge != null);
      lines.forEach(function (l, k) {
        var a = +l.dataset.i, b = +l.dataset.j;
        var on = edge ? (a === edge[0] && b === edge[1]) : (a === v || b === v);
        l.classList.toggle("is-hot", on); wts[k].classList.toggle("is-hot", on);
      });
      dots.forEach(function (d) { d.classList.toggle("is-hot", edge ? (+d.dataset.v === edge[0] || +d.dataset.v === edge[1]) : +d.dataset.v === v); });
      if (edge) {
        nameEl.textContent = V(edge[0]) + "–" + V(edge[1]);
        sumEl.textContent = "w = " + fmt(w(edge[0], edge[1])) + " km";
      } else if (v != null) {
        var best = null;
        for (var u = 0; u < N; u++) if (u !== v && (best == null || w(v, u) < w(v, best))) best = u;
        nameEl.textContent = V(v) + " · " + DC.name(v);
        sumEl.textContent = "nearest by road: " + V(best) + " · " + fmt(w(v, best)) + " km";
      }
    }
    function pt(e) {
      var r = svg.getBoundingClientRect(), s = Math.min(r.width, r.height);
      return [((e.clientX - r.left) - (r.width - s) / 2) / s * 100, ((e.clientY - r.top) - (r.height - s) / 2) / s * 100];
    }
    box.addEventListener("pointermove", function (e) {
      if (opts.edgeHits && e.target.classList.contains("probe__hit")) return hot(null, [+e.target.dataset.i, +e.target.dataset.j]);
      var q = pt(e), best = 0, bd = 1e9;
      pos.forEach(function (c, i) { var d = Math.pow(c[0] - q[0], 2) + Math.pow(c[1] - q[1], 2); if (d < bd) { bd = d; best = i; } });
      hot(best);
    });
    box.addEventListener("pointerleave", function () { hot(opts.rest); });
    hot(opts.rest);
  }

  /* ======================= 00 home ======================= */
  DC.onPage("home", function () {
    probe($("#probe"), $("#probe-svg"), $("#probe-name"), $("#probe-sum"), { rest: P.route[0] });
  });

  /* ======================= 01 problem ======================= */
  var problemMap;
  DC.onPage("problem", function () {
    problemMap = M.create($("#map-problem"));
    if (problemMap) M.vertices(L.layerGroup().addTo(problemMap), {});
  });
  DC.onShow("problem", function () { M.refresh(problemMap); });

  /* ======================= 03 graph model ======================= */
  var matrixMap, matrixLayer;
  DC.onPage("graph", function () {
    // vertices
    $("#tbl-vertices tbody").innerHTML = RUN.locations.map(function (l) {
      return "<tr><td class='num'><strong>" + l.label + "</strong></td><td>" + DC.esc(l.name) + (l.role === "start" ? " <span class='chip chip--accent'>start</span>" : "") +
        "</td><td class='muted'>" + DC.esc(l.area) + "</td><td class='num r'>" + fmt(l.lat, 5) + "</td><td class='num r'>" + fmt(l.lon, 5) +
        "</td><td class='r'><a class='note' href='https://www.google.com/maps/search/?api=1&query=" + l.lat + "," + l.lon + "' target='_blank' rel='noopener'>open ↗</a></td></tr>";
    }).join("");
    probe($("#graph-k10"), $("#k10-svg"), $("#k10-name"), $("#k10-sum"), { edgeHits: true, rest: null });
    $("#k10-name").textContent = "hover a vertex or an edge";

    // matrix
    var head = "<thead><tr><th></th>" + RUN.locations.map(function (_, j) { return "<th data-col='" + j + "'>" + V(j) + "</th>"; }).join("") + "</tr></thead>";
    var body = "<tbody>" + RUN.dist.map(function (row, i) {
      return "<tr><th data-row='" + i + "'>" + V(i) + "</th>" + row.map(function (x, j) {
        return i === j ? "<td class='diag'>–</td>" : "<td data-i='" + i + "' data-j='" + j + "' tabindex='0'>" + fmt(x) + "</td>";
      }).join("") + "</tr>";
    }).join("") + "</tbody>";
    var tbl = $("#tbl-matrix"); tbl.innerHTML = head + body;
    matrixMap = M.create($("#map-matrix"));
    if (matrixMap) { matrixLayer = L.layerGroup().addTo(matrixMap); M.vertices(L.layerGroup().addTo(matrixMap), {}); }
    function pick(i, j) {
      $$("td", tbl).forEach(function (td) {
        var a = +td.dataset.i, b = +td.dataset.j;
        td.classList.toggle("is-hot", a === i && b === j); td.classList.toggle("is-mirror", a === j && b === i);
      });
      $$("th[data-row],th[data-col]", tbl).forEach(function (th) { th.classList.toggle("is-axis", +th.dataset.row === i || +th.dataset.col === j); });
      $("#matrix-badge").textContent = V(i) + " " + DC.name(i) + "  ↔  " + V(j) + " " + DC.name(j);
      $("#matrix-readout").innerHTML = "d(" + V(i) + "→" + V(j) + ") = <b>" + fmt(RUN.raw[i][j]) + "</b> · d(" + V(j) + "→" + V(i) + ") = <b>" + fmt(RUN.raw[j][i]) + "</b> · w = ½(" + fmt(RUN.raw[i][j]) + " + " + fmt(RUN.raw[j][i]) + ") = <b>" + fmt(w(i, j)) + " km</b>";
      if (!matrixMap) return;
      matrixLayer.clearLayers();
      var a = M.edge(matrixLayer, j, i, { cls: "rd--hover2", halo: true, arrow: true, arrowTone: "gold", arrowAt: 0.6 });
      var b = M.edge(matrixLayer, i, j, { cls: "rd--hover", halo: true, draw: true, arrow: true, arrowAt: 0.4, label: fmt(w(i, j)) + " km", labelCls: "wtag wtag--accent", labelAt: 0.5 });
      M.fitLatLngs(matrixMap, a.path.concat(b.path), [50, 50]);
    }
    tbl.addEventListener("mouseover", function (e) { var td = e.target.closest("td[data-i]"); if (td) pick(+td.dataset.i, +td.dataset.j); });
    tbl.addEventListener("focusin", function (e) { var td = e.target.closest("td[data-i]"); if (td) pick(+td.dataset.i, +td.dataset.j); });
    pick(0, 1);

    // google cross-check
    var G = RUN.google;
    $("#tbl-google tbody").innerHTML = G.legs.map(function (l) {
      return "<tr><td class='num'>" + l.leg + "</td><td class='num'>" + V(l.from) + " → " + V(l.to) + "</td><td class='num r'>" + fmt(l.matrix) + "</td><td class='num r'>" + fmt(l.google) +
        "</td><td class='num r'>" + DC.sgn(l.diff) + "</td><td class='num r'>" + DC.sgn(l.pct, 0) + "</td></tr>";
    }).join("") + "<tr class='is-total'><td></td><td>Total</td><td class='num r'>" + fmt(G.matrix_total) + "</td><td class='num r'>" + fmt(G.google_total) +
      "</td><td class='num r'>" + DC.sgn(G.google_total - G.matrix_total) + "</td><td class='num r'>" + DC.sgn(G.pct, 1) + "</td></tr>";

    // divide tree
    var splits = {}, bases = {};
    var key = function (c) { return c.slice().sort(function (a, b) { return a - b; }).join(","); };
    P.trace.forEach(function (e) { if (e.step === "split") splits[key(e.cities)] = e; if (e.step === "base") bases[key(e.cities)] = e; });
    var set = function (c) { return "{" + c.slice().sort(function (a, b) { return a - b; }).map(V).join(", ") + "}"; };
    function node(c) {
      var k = key(c);
      if (bases[k]) return "<li><span class='dnode dnode--leaf'><b>" + DC.cycleStr(bases[k].cities) + "</b><span class='muted'>" + fmt(bases[k].cost) + " km</span></span></li>";
      var s = splits[k];
      return "<li><span class='dnode'><b>" + set(c) + "</b><span class='note'>split by " + s.axis + " (" + (s.axis === "x" ? "longitude" : "latitude") + ")</span></span><ul>" + node(s.left) + node(s.right) + "</ul></li>";
    }
    $("#dtree").innerHTML = "<ul>" + node(P.trace[0].cities) + "</ul>";

    // trace table
    $("#tbl-trace tbody").innerHTML = merges.map(function (m) {
      return "<tr class='is-clickable' data-m='" + m.name + "'><td class='num'><strong>" + m.name + "</strong></td><td class='num'>" + DC.cycleStr(m.left_tour) + " (" + fmt(m.left_cost) + ")</td><td class='num'>" +
        DC.cycleStr(m.right_tour) + " (" + fmt(m.right_cost) + ")</td><td class='num'>" + (m.bridge ? edgeTxt(m.bridge) : "–") + "</td><td class='num'>" +
        (m.removed.map(edgeTxt).join(", ") || "–") + "</td><td class='num'>" + m.added.map(edgeTxt).join(", ") + "</td><td class='num r'>" + DC.sgn(m.delta) + "</td><td class='num r'>" + fmt(m.cost) + "</td></tr>";
    }).join("");
    $("#tbl-trace tbody").addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-m]"); if (!tr) return;
      DC.go("#/implementation/player");
      setTimeout(function () { DC.player && DC.player.setSeed(P.seed, false); DC.player && DC.player.jump(tr.dataset.m); }, 120);
    });

    // worked final merge
    var f = merges[merges.length - 1], a = f.bridge;
    $("#worked-name").textContent = f.name + " · level 1";
    $("#worked").innerHTML =
      "<p>The two halves return the sub-tours T₁ = <span class='mono'>" + DC.cycleStr(f.left_tour) + "</span> (" + fmt(f.left_cost) + " km) and T₂ = <span class='mono'>" + DC.cycleStr(f.right_tour) + "</span> (" + fmt(f.right_cost) + " km).</p>" +
      "<p>Checking all |T₁|·|T₂| = " + f.left_tour.length + "·" + f.right_tour.length + " = " + f.left_tour.length * f.right_tour.length + " cross pairs, the shortest bridge is <strong>" + V(a[0]) + "–" + V(a[1]) + "</strong> with w = " + fmt(w(a[0], a[1])) + " km.</p>" +
      "<p>Of the ways to open one edge next to each bridge endpoint and close the loop, the cheapest removes " + f.removed.map(function (e) { return V(e[0]) + "–" + V(e[1]); }).join(" and ") + " and adds " + f.added.map(function (e) { return V(e[0]) + "–" + V(e[1]); }).join(" and ") + ":</p>" +
      "<div class='tex-block' data-display data-tex='\\Delta = (" + f.added.map(function (e) { return fmt(w(e[0], e[1])); }).join(" + ") + ") - (" + f.removed.map(function (e) { return fmt(w(e[0], e[1])); }).join(" + ") + ") = " + DC.sgn(f.delta).replace("−", "-") + "\\text{ km}'></div>" +
      "<div class='tex-block' data-display data-tex='L(T) = L(T_1) + L(T_2) + \\Delta = " + fmt(f.left_cost) + " + " + fmt(f.right_cost) + (f.delta >= 0 ? " + " : " - ") + fmt(Math.abs(f.delta)) + " = " + fmt(f.cost) + "\\text{ km}'></div>" +
      "<p>The merged cycle is <span class='mono'>" + DC.cycleStr(f.tour) + "</span>, which visits all " + f.tour.length + " vertices once.</p>";
    DC.bind($("#worked"));
  });
  DC.onShow("graph", function () { M.refresh(matrixMap); });

  /* ======================= 04 implementation ======================= */
  var routeMap, routeHi;
  function extract(src, name) {
    var lines = src.split(/\r?\n/), out = [], on = false;
    for (var i = 0; i < lines.length; i++) {
      if (!on && new RegExp("^def " + name + "\\(").test(lines[i])) on = true;
      else if (on && /^(def |class |@|if __name__)/.test(lines[i])) break;
      if (on) out.push(lines[i]);
    }
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out.join("\n");
  }
  var KW = /\b(def|return|if|elif|else|for|in|not|and|or|is|None|True|False|import|from|as|while|lambda|yield|class|with|assert|continue|break|pass)\b/;
  function highlight(code) {
    var re = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|#[^\n]*|\b\d+(?:\.\d+)?(?:e-?\d+)?\b|\b[A-Za-z_]\w*\b)/g;
    var out = "", last = 0, m, prevDef = false;
    while ((m = re.exec(code))) {
      out += DC.esc(code.slice(last, m.index)); last = re.lastIndex;
      var t = m[0], c = t[0];
      if (c === "#") out += "<span class='tok-c'>" + DC.esc(t) + "</span>";
      else if (c === '"' || c === "'") out += "<span class='tok-s'>" + DC.esc(t) + "</span>";
      else if (/\d/.test(c)) out += "<span class='tok-n'>" + t + "</span>";
      else if (KW.test(t) && t.match(KW)[0] === t) { out += "<span class='tok-k'>" + t + "</span>"; prevDef = t === "def"; continue; }
      else if (prevDef) out += "<span class='tok-f'>" + t + "</span>";
      else out += t;
      prevDef = false;
    }
    return out + DC.esc(code.slice(last));
  }
  var FNS = [["split", "dc_tsp.py"], ["shortest_bridge", "dc_tsp.py"], ["merge", "dc_tsp.py"], ["solve", "dc_tsp.py"], ["divide_and_conquer_tsp", "dc_tsp.py"], ["check_route", "verify.py"], ["held_karp", "verify.py"]];
  function showCode(name) {
    var f = FNS.filter(function (x) { return x[0] === name; })[0] || FNS[0];
    $$("#code-tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.fn === f[0])); });
    $$("#components tr").forEach(function (tr) { tr.classList.toggle("is-sel", tr.dataset.fn === f[0]); });
    $("#code-view code").innerHTML = "<span class='tok-c'># code/" + f[1] + "</span>\n" + highlight(extract(RUN.source[f[1]], f[0]));
  }

  var termTimer;
  function termRender(n) {
    var lines = RUN.source.console.replace(/\s+$/, "").split(/\r?\n/);
    var shown = lines.slice(0, n == null ? lines.length : n).map(function (l) {
      var e = DC.esc(l);
      if (/^=+$/.test(l)) return "<span class='hd'>" + e + "</span>";
      if (/\[OK\]/.test(l)) return e.replace("[OK]", "<span class='ok'>[OK]</span>");
      if (/^(INPUT DATA|DIVIDE AND CONQUER|RESULTING ROUTE|VERIFICATION|HOW GOOD IS IT|REPEATED RUNS)/.test(l)) return "<span class='hd'>" + e + "</span>";
      if (/^TOTAL DISTANCE/.test(l)) return "<span class='ok'>" + e + "</span>";
      return e;
    });
    var pre = $("#term");
    pre.innerHTML = "<span class='ps'>$</span> python main.py --no-plot --export-web\n" + shown.join("\n") + (n != null && n < lines.length ? "\n<span class='cursor'></span>" : "\n<span class='ps'>$</span> <span class='cursor'></span>");
    pre.scrollTop = pre.scrollHeight;
    return lines.length;
  }
  function termPlay() {
    clearInterval(termTimer);
    var total = termRender(0), n = 0;
    if (DC.reduced) return termRender();
    termTimer = setInterval(function () { n += 1; termRender(n); if (n >= total) clearInterval(termTimer); }, 28);
  }

  DC.onPage("implementation", function () {
    // code viewer
    $("#code-tabs").innerHTML = FNS.map(function (f) { return "<button type='button' role='tab' data-fn='" + f[0] + "'>" + f[0] + "</button>"; }).join("");
    $("#code-tabs").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) showCode(b.dataset.fn); });
    $("#components").addEventListener("click", function (e) { var tr = e.target.closest("tr.is-clickable"); if (tr) showCode(tr.dataset.fn); });
    showCode("merge");

    // terminal: play once when it scrolls into view
    termRender(0);
    var started = false, term = $("#term");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en, obs) { if (en[0].isIntersecting && !started) { started = true; termPlay(); obs.disconnect(); } }, { threshold: 0.3 }).observe(term);
    } else termRender();
    $("#term-replay").addEventListener("click", termPlay);
    $("#term-skip").addEventListener("click", function () { clearInterval(termTimer); termRender(); });

    // route map + legs
    var cum = 0;
    $("#tbl-legs tbody").innerHTML = P.legs.map(function (l, k) {
      cum += l.w;
      return "<tr class='is-clickable' data-k='" + k + "'><td class='num'>" + (k + 1) + "</td><td><span class='num'>" + V(l.from) + "</span> <span class='muted'>" + DC.esc(DC.name(l.from)) + "</span></td><td><span class='num'>" + V(l.to) + "</span> <span class='muted'>" + DC.esc(DC.name(l.to)) + "</span></td><td class='num r'>" + fmt(l.w) + "</td><td class='num r'>" + fmt(cum) + "</td></tr>";
    }).join("") + "<tr class='is-total'><td colspan='3'>Total</td><td class='num r' colspan='2'>" + fmt(cum) + " km</td></tr>";
    routeMap = M.create($("#map-route"));
    if (routeMap) {
      var g = L.layerGroup().addTo(routeMap); routeHi = L.layerGroup().addTo(routeMap);
      P.legs.forEach(function (l, k) {
        var e = M.edge(g, l.from, l.to, { cls: "rd--route", halo: true, arrow: true, tip: "Leg " + (k + 1) + ": " + V(l.from) + " → " + V(l.to) + " · " + fmt(l.w) + " km" });
        M.tag(g, M.along(e.path, 0.5).ll, String(k + 1), "legno", 600);
      });
      M.vertices(L.layerGroup().addTo(routeMap), {});
    }
    $("#tbl-legs tbody").addEventListener("click", function (e) {
      var tr = e.target.closest("tr[data-k]"); if (!tr || !routeMap) return;
      $$("#tbl-legs tr").forEach(function (r) { r.classList.toggle("is-sel", r === tr); });
      var l = P.legs[+tr.dataset.k]; routeHi.clearLayers();
      var e2 = M.edge(routeHi, l.from, l.to, { cls: "rd--add", draw: true, label: fmt(l.w) + " km", labelCls: "wtag wtag--gold", labelAt: 0.5 });
      M.fitLatLngs(routeMap, e2.path, [70, 70]);
    });

    // verification
    $("#checks").innerHTML = P.checks.map(function (c) {
      return "<li class='chip " + (c.ok ? "chip--ok" : "chip--warn") + "' style='font-size:.85rem;padding:9px 12px'>" + (c.ok ? "✓ OK" : "✗ FAIL") + " · " + DC.esc(c.text) + "</li>";
    }).join("");
    $("#recompute").innerHTML = P.legs.map(function (l) { return fmt(l.w); }).join(" + ") + "\n= <span class='okc'>" + fmt(P.recomputed) + " km</span>  (reported " + fmt(P.total) + " km)";
  });
  DC.onShow("implementation", function () { M.refresh(routeMap); });

  /* ======================= 05 conclusion ======================= */
  var cmpMap, cmpLayer;
  function compare(mode) {
    $$("[data-cmp]").forEach(function (b) { b.classList.toggle("btn--ghost", b.dataset.cmp !== mode); });
    if (!cmpMap) return;
    cmpLayer.clearLayers();
    var two = RUN.two_opt, opt = RUN.optimum.route, note = $("#compare-note"), badge = $("#compare-badge");
    var legs = function (route, cls, tone, numCls) {
      for (var k = 0; k < route.length - 1; k++) {
        var e = M.edge(cmpLayer, route[k], route[k + 1], { cls: cls, halo: true, draw: true, arrow: true, arrowTone: tone, tip: V(route[k]) + " → " + V(route[k + 1]) + " · " + fmt(w(route[k], route[k + 1])) + " km" });
        if (numCls) M.tag(cmpLayer, M.along(e.path, 0.5).ll, String(k + 1), numCls, 600);
      }
    };
    if (mode === "dc") {
      legs(P.route, "rd--route", "accent", "legno");
      badge.textContent = "Divide & Conquer · seed " + P.seed + " · " + fmt(P.total) + " km";
      note.textContent = "The heuristic's route, " + DC.routeStr(P.route) + ".";
      M.fit(cmpMap, P.route);
    } else if (mode === "opt") {
      legs(opt, "rd--opt", "ok", "legno legno--ok");
      badge.textContent = "Held–Karp optimum · " + fmt(RUN.optimum.total) + " km";
      note.textContent = "The exact optimum, " + DC.routeStr(opt) + ". It is our route reversed, except for the order inside the V3/V4/V5 cluster.";
      M.fit(cmpMap, opt);
    } else {
      var removed = two.removed.map(function (e) { return e[0] + "-" + e[1]; }), r = P.route;
      for (var k = 0; k < r.length - 1; k++) {
        var key = r[k] + "-" + r[k + 1];
        if (removed.indexOf(key) >= 0 || r.slice(two.i, two.j + 1).indexOf(r[k]) >= 0 && r.slice(two.i, two.j + 1).indexOf(r[k + 1]) >= 0) continue;
        M.edge(cmpLayer, r[k], r[k + 1], { cls: "rd--faint" });
      }
      // the reversed segment keeps its edge(s), now driven the other way
      for (k = two.i; k < two.j; k++) M.edge(cmpLayer, r[k + 1], r[k], { cls: "rd--ink", arrow: true, arrowTone: "ink" });
      two.removed.forEach(function (e) { M.edge(cmpLayer, e[0], e[1], { cls: "rd--del", label: "−" + fmt(w(e[0], e[1])), labelCls: "wtag wtag--red", labelAt: 0.5 }); });
      M.edge(cmpLayer, two.added[0][0], two.added[0][1], { cls: "rd--add", halo: true, draw: true, arrow: true, arrowTone: "gold", label: "+" + fmt(w(two.added[0][0], two.added[0][1])), labelCls: "wtag wtag--gold", labelAt: 0.5 });
      M.edge(cmpLayer, two.added[1][0], two.added[1][1], { cls: "rd--add", halo: true, draw: true, arrow: true, arrowTone: "gold", label: "+" + fmt(w(two.added[1][0], two.added[1][1])), labelCls: "wtag wtag--gold", labelAt: 0.5 });
      badge.textContent = "2-opt: reverse " + two.reversed.map(V).join(" → ") + " · " + DC.sgn(two.delta) + " km → " + fmt(two.total) + " km";
      note.textContent = "Remove " + two.removed.map(function (e) { return V(e[0]) + "–" + V(e[1]); }).join(" and ") + " (red), add " + two.added.map(function (e) { return V(e[0]) + "–" + V(e[1]); }).join(" and ") +
        " (gold): Δ = (" + two.added.map(function (e) { return fmt(w(e[0], e[1])); }).join(" + ") + ") − (" + two.removed.map(function (e) { return fmt(w(e[0], e[1])); }).join(" + ") + ") = " + DC.sgn(two.delta) + " km, giving " + fmt(two.total) + " km, the optimum.";
      M.fit(cmpMap, [two.removed[0][0], two.removed[0][1], two.removed[1][0], two.removed[1][1]], { padding: [70, 70] });
    }
  }

  function dotplot() {
    var host = $("#dots"), R = RUN.experiments.rules, rows = [["bridge", "Shortest bridge (paper)"], ["best", "Best splice (variant)"]];
    // small multiples, one per merge rule: x = seed, y = tour length (one shared y scale)
    var runs = RUN.experiments.runs, opt = RUN.optimum.total;
    var all = R.bridge.lengths.concat(R.best.lengths), lo = Math.floor(Math.min(opt, Math.min.apply(null, all)) * 10) / 10, hi = Math.ceil(Math.max.apply(null, all) * 10) / 10;
    var W = 960, left = 52, right = 14, PH = 150, gap = 54, top = 30, r = 4.2, col = (W - left - right) / runs;
    var x = function (s) { return left + (s + 0.5) * col; };
    var parts = [], ticks = [];
    for (var t = lo; t <= hi + 1e-9; t += 0.2) ticks.push(+t.toFixed(1));
    rows.forEach(function (row, k) {
      var y0 = top + k * (PH + gap), y = function (v) { return y0 + PH - (v - lo) / (hi - lo) * PH; }, s = R[row[0]];
      parts.push("<text class='rowlbl rowlbl--ink' x='0' y='" + (y0 - 12) + "'>" + row[1] + "</text><text class='rowlbl' x='" + (W - right) + "' y='" + (y0 - 12) + "' text-anchor='end'>mean " + fmt(s.mean) + " km · optimal " + s.optimal_hits + "/" + runs + "</text>");
      parts.push("<g class='grid'>" + ticks.map(function (t) { return "<line x1='" + left + "' x2='" + (W - right) + "' y1='" + y(t) + "' y2='" + y(t) + "'/>"; }).join("") + "</g>");
      parts.push("<g class='axis'>" + ticks.map(function (t) { return "<text x='" + (left - 8) + "' y='" + (y(t) + 4) + "' text-anchor='end'>" + t.toFixed(1) + "</text>"; }).join("") + "</g>");
      parts.push("<line class='optline' x1='" + left + "' x2='" + (W - right) + "' y1='" + y(opt) + "' y2='" + y(opt) + "'/>");
      if (k === 0) parts.push("<text class='optlbl' x='" + (W - right) + "' y='" + (y(opt) + 16) + "' text-anchor='end'>optimum " + fmt(opt) + " km</text>");
      s.lengths.forEach(function (v, seed) {
        var pres = row[0] === P.rule && seed === P.seed;
        parts.push("<circle class='dot" + (pres ? " is-presented" : "") + "' cx='" + x(seed) + "' cy='" + y(v) + "' r='" + r + "'/><rect class='hit' data-rule='" + row[0] + "' data-seed='" + seed + "' x='" + (x(seed) - col / 2) + "' y='" + y0 + "' width='" + col + "' height='" + PH + "'/>");
        if (pres) parts.push("<text class='rowlbl rowlbl--ink prelbl' x='" + (x(seed) + 9) + "' y='" + (y(v) - 8) + "'>seed " + seed + " (presented) · " + fmt(v) + "</text>");
      });
    });
    var H = top + rows.length * (PH + gap) - gap;
    parts.push("<g class='axis'><line x1='" + left + "' x2='" + (W - right) + "' y1='" + (H + 6) + "' y2='" + (H + 6) + "'/>" + [0, 20, 40, 60, 80, runs - 1].map(function (s) { return "<text x='" + x(s) + "' y='" + (H + 22) + "' text-anchor='middle'>" + s + "</text>"; }).join("") + "<text x='" + (W - right) + "' y='" + (H + 40) + "' text-anchor='end'>random seed · y = tour length, km</text></g>");
    host.innerHTML = "<svg viewBox='0 0 " + W + " " + (H + 46) + "' role='img' aria-label='Tour length of each of " + runs + " seeds for both merge rules, with the optimum marked.'>" + parts.join("") + "</svg><div class='tip' id='dots-tip'></div>";
    var tip = $("#dots-tip");
    host.addEventListener("mousemove", function (e) {
      var h = e.target.closest(".hit");
      $$(".dot.is-hover", host).forEach(function (d) { d.classList.remove("is-hover"); });
      if (!h) return tip.classList.remove("is-on");
      h.previousSibling.classList.add("is-hover");
      var rule = h.dataset.rule, seed = +h.dataset.seed, v = R[rule].lengths[seed], hb = host.getBoundingClientRect(), rb = h.previousSibling.getBoundingClientRect();
      tip.innerHTML = "seed " + seed + " · " + fmt(v) + " km" + (Math.abs(v - RUN.optimum.total) < 1e-9 ? " · optimal" : " · +" + fmt(100 * (v - RUN.optimum.total) / RUN.optimum.total) + "%") + (rule === P.rule ? "<br>click to replay in 04" : "<br>variant rule (not replayed)");
      tip.style.left = (rb.left + rb.width / 2 - hb.left) + "px"; tip.style.top = (rb.top - hb.top) + "px"; tip.classList.add("is-on");
    });
    host.addEventListener("mouseleave", function () { tip.classList.remove("is-on"); });
    host.addEventListener("click", function (e) {
      var h = e.target.closest(".hit"); if (!h || h.dataset.rule !== P.rule) return;
      DC.go("#/implementation/player");
      var seed = +h.dataset.seed;
      setTimeout(function () { DC.player && DC.player.setSeed(seed, false); }, 120);
    });
  }

  DC.onPage("conclusion", function () {
    var two = RUN.two_opt, a = two.removed[0][0], seg = two.reversed, d = two.removed[1][1];
    var ours = [a].concat(seg, [d]), better = [a].concat(seg.slice().reverse(), [d]);
    var line = function (r) { var parts = []; for (var k = 0; k < r.length - 1; k++) parts.push(fmt(w(r[k], r[k + 1]))); return parts.join(" + ") + " = " + fmt(r.slice(1).reduce(function (s, v, k) { return s + w(r[k], v); }, 0)) + " km"; };
    $("#cluster-calc").innerHTML = "ours     " + ours.map(V).join(" → ") + "   " + line(ours) + "\n<span class='okc'>optimal  " + better.map(V).join(" → ") + "   " + line(better) + "</span>";
    var R = RUN.experiments.rules, opt = RUN.optimum.total;
    $("#tbl-exp tbody").innerHTML = [["bridge", "Shortest bridge (paper)"], ["best", "Best splice (variant)"]].map(function (x) {
      var s = R[x[0]];
      return "<tr><td>" + x[1] + "</td><td class='num r'>" + fmt(s.best) + "</td><td class='num r'>" + fmt(s.worst) + "</td><td class='num r'>" + fmt(s.mean) + "</td><td class='num r'>" + fmt(s.std) + "</td><td class='num r'>" + fmt(s.mean_gap_pct) + "%</td><td class='num r'>" + s.optimal_hits + "/" + RUN.experiments.runs + "</td></tr>";
    }).join("") + "<tr><td>Held–Karp (exact)</td><td class='num r'>" + fmt(opt) + "</td><td class='num r'>" + fmt(opt) + "</td><td class='num r'>" + fmt(opt) + "</td><td class='num r'>0.00</td><td class='num r'>0.00%</td><td class='num r'>–</td></tr>";
    cmpMap = M.create($("#map-compare"));
    if (cmpMap) { cmpLayer = L.layerGroup().addTo(cmpMap); M.vertices(L.layerGroup().addTo(cmpMap), {}); }
    $$("[data-cmp]").forEach(function (b) { b.addEventListener("click", function () { compare(b.dataset.cmp); }); });
    compare("dc");
    dotplot();
  });
  DC.onShow("conclusion", function () { M.refresh(cmpMap); });

  /* ======================= 02 algorithm ======================= */
  DC.onPage("algorithm", function () {
    var d = $("#mdiag"), b = $("#mdiag-btn");
    b.addEventListener("click", function () { var on = d.classList.toggle("is-merged"); b.textContent = on ? "↺ Reset" : "Merge →"; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en, o) {
      if (en[0].isIntersecting) { setTimeout(function () { d.classList.add("is-merged"); b.textContent = "↺ Reset"; }, 600); o.disconnect(); }
    }, { threshold: 0.6 }).observe(d);
  });
})();
