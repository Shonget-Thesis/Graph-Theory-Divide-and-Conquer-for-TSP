/* Leaflet helpers. Every edge u→v is drawn along the street path OSRM drives from u to v
   (website/data/roads.js); the label always shows the model weight w(u,v) from the matrix. */
(function () {
  "use strict";
  var DC = window.DC, RUN = DC.RUN, ROADS = DC.ROADS;
  var M = (DC.map = {});
  // Basemap: OpenFreeMap vector tiles (OpenStreetMap data, the same data OSRM routes on), drawn by MapLibre
  // inside Leaflet. Free, no key, and no Referer requirement, so it also works when index.html is opened
  // from disk (tile.openstreetmap.org blocks those requests). Without WebGL, fall back to Esri raster tiles.
  var STYLES = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
  var ESRI = { light: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
               dark: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" };
  var OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
  var ROUTES = ' · roads: <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a>';
  var ATTR = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' + OSM + ROUTES;
  var ATTR_ESRI = "Tiles &copy; Esri" + ROUTES;
  var maps = [];
  M.ok = !!window.L;
  var vector = (function () {
    if (!window.L || !L.maplibreGL || !window.maplibregl) return false;
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  })();

  function basemap(theme) {
    if (vector) return L.maplibreGL({ style: STYLES[theme], attribution: ATTR, interactive: false });
    return L.tileLayer(ESRI[theme], { attribution: ATTR_ESRI, maxZoom: 19, maxNativeZoom: 16 });
  }
  document.addEventListener("dc:theme", function (e) {
    maps.forEach(function (m) {
      if (vector && m._dcTiles.getMaplibreMap) m._dcTiles.getMaplibreMap().setStyle(STYLES[e.detail]);
      else { m.removeLayer(m._dcTiles); m._dcTiles = basemap(e.detail).addTo(m); }
    });
  });

  M.create = function (el, opts) {
    if (!M.ok) { el.insertAdjacentHTML("beforeend", '<p class="note" style="padding:60px 20px;text-align:center">The map library could not load (offline?). The tables on this page still hold every value.</p>'); return null; }
    opts = opts || {};
    var map = L.map(el, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomSnap: 1, preferCanvas: false });
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: "topright" }).addTo(map);
    map._dcTiles = basemap(DC.theme()).addTo(map);
    // scroll-zoom only after the reader clicks the map, so the page keeps scrolling normally
    map.on("click", function () { map.scrollWheelZoom.enable(); });
    el.addEventListener("mouseleave", function () { map.scrollWheelZoom.disable(); });
    M.fit(map, RUN.locations.map(function (_, i) { return i; }), { animate: false, padding: opts.padding });
    maps.push(map);
    return map;
  };
  M.refresh = function (map) { if (map) setTimeout(function () { map.invalidateSize(false); }, 30); };

  M.ll = function (i) { var l = RUN.locations[i]; return [l.lat, l.lon]; };
  M.fit = function (map, cities, o) {
    o = o || {};
    var b = L.latLngBounds(cities.map(M.ll));
    var pad = o.padding || [48, 48];
    if (cities.length === 1) map.setView(M.ll(cities[0]), 17, { animate: o.animate !== false });
    else if (o.animate === false || DC.reduced) map.fitBounds(b, { padding: pad, animate: false });
    else map.flyToBounds(b, { padding: pad, duration: 0.7 });
  };
  M.fitLatLngs = function (map, lls, pad) {
    var b = L.latLngBounds(lls);
    if (DC.reduced) map.fitBounds(b, { padding: pad || [60, 60] }); else map.flyToBounds(b, { padding: pad || [60, 60], duration: 0.7 });
  };

  /* road path u→v, joined to the two pins (OSRM snaps each pin to the nearest road) */
  M.path = function (i, j) {
    var r = ROADS.pairs[i + "-" + j];
    return [M.ll(i)].concat(r ? r.path : []).concat([M.ll(j)]);
  };

  function along(path, frac) {
    // point and bearing at a fraction of the path length (equirectangular is fine at city scale)
    var k = Math.cos(path[0][0] * Math.PI / 180), seg = [], total = 0;
    for (var n = 1; n < path.length; n++) {
      var dx = (path[n][1] - path[n - 1][1]) * k, dy = path[n][0] - path[n - 1][0], d = Math.sqrt(dx * dx + dy * dy);
      seg.push(d); total += d;
    }
    var target = total * frac, acc = 0;
    for (n = 0; n < seg.length; n++) {
      if (acc + seg[n] >= target && seg[n] > 0) {
        var t = (target - acc) / seg[n], a = path[n], b = path[n + 1];
        var bearing = Math.atan2((b[1] - a[1]) * k, b[0] - a[0]) * 180 / Math.PI;
        return { ll: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: bearing };
      }
      acc += seg[n];
    }
    return { ll: path[path.length - 1], bearing: 0 };
  }
  M.along = along;

  var ARROW = '<svg viewBox="0 0 14 14"><path d="M7 1 L12.5 12 L7 9.2 L1.5 12 Z" fill="currentColor"/></svg>';
  M.arrow = function (group, path, frac, tone) {
    var a = along(path, frac);
    return L.marker(a.ll, { interactive: false, keyboard: false, icon: L.divIcon({
      className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      html: '<div class="arrowhead arrowhead--' + (tone || "accent") + '" style="transform:rotate(' + a.bearing.toFixed(1) + 'deg)">' + ARROW + "</div>"
    }) }).addTo(group);
  };
  M.tag = function (group, ll, html, cls, z) {
    return L.marker(ll, { interactive: false, keyboard: false, zIndexOffset: z || 500, icon: L.divIcon({ className: "", iconSize: [0, 0], html: '<span class="' + (cls || "wtag") + '">' + html + "</span>" }) }).addTo(group);
  };

  /* draw edge i→j: o = {cls, halo, draw, arrow, arrowTone, label, labelCls, labelAt, tip} */
  M.edge = function (group, i, j, o) {
    o = o || {};
    var path = M.path(i, j), out = { path: path };
    if (o.halo) L.polyline(path, { className: "rd rd--halo", interactive: false }).addTo(group);
    var line = L.polyline(path, { className: "rd " + (o.cls || "rd--ink"), interactive: !!o.tip, bubblingMouseEvents: false }).addTo(group);
    if (o.tip) line.bindTooltip(o.tip, { sticky: true, direction: "top" });
    if (o.draw && !DC.reduced && line._path && line._path.getTotalLength) {
      var len = line._path.getTotalLength();
      line._path.style.setProperty("--len", len.toFixed(1));
      line._path.classList.add("rd--draw");
    }
    out.line = line;
    if (o.arrow) M.arrow(group, path, o.arrowAt || 0.55, o.arrowTone);
    if (o.label != null) M.tag(group, along(path, o.labelAt || 0.42).ll, o.label, o.labelCls || "wtag");
    return out;
  };

  /* vertex pins: o = {cls(i) -> extra class, tip: bool, click(i)} */
  M.vertices = function (group, o) {
    o = o || {};
    return RUN.locations.map(function (l, i) {
      var extra = o.cls ? o.cls(i) : "";
      if (extra == null) return null;
      var start = l.role === "start";
      var m = L.marker([l.lat, l.lon], { keyboard: false, riseOnHover: true, zIndexOffset: 1000, icon: L.divIcon({
        className: "", iconSize: [30, 22], iconAnchor: [15, 11],
        html: '<div class="vx' + (start ? " vx--start" : "") + (extra ? " " + extra : "") + '">' + l.label + "</div>"
      }) }).addTo(group);
      if (o.tip !== false) m.bindTooltip("<strong>" + l.label + "</strong> · " + DC.esc(l.name) + (start ? " (start / end)" : ""), { direction: "top", offset: [0, -12] });
      if (o.click) m.on("click", function () { o.click(i); });
      return m;
    });
  };
  M.ring = function (group, i) {
    return L.marker(M.ll(i), { interactive: false, keyboard: false, zIndexOffset: 900, icon: L.divIcon({ className: "", iconSize: [40, 32], iconAnchor: [20, 16], html: '<div class="vx-ring"></div>' }) }).addTo(group);
  };

  /* a closed cycle drawn edge by edge in its own direction */
  M.cycle = function (group, tour, o) {
    if (tour.length < 2) return [];
    var out = [];
    for (var k = 0; k < tour.length; k++) {
      var a = tour[k], b = tour[(k + 1) % tour.length];
      out.push(M.edge(group, a, b, typeof o === "function" ? o(a, b, k) : o));
    }
    return out;
  };
})();
