/* Farewise: one persistent Leaflet map that moves between views. Fails soft if Leaflet can't load. */
'use strict';
const MapView = {
  map: null, layer: null, el: null, drawn: '',
  ensure(){
    if (this.map || !window.L) return !!this.map;
    this.el = document.createElement('div'); this.el.id = 'map'; this.el.setAttribute('aria-label', 'Map of the route');
    this.map = L.map(this.el, {zoomControl:true, scrollWheelZoom:false}).setView([25, 10], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(this.map);
    this.layer = L.layerGroup().addTo(this.map);
    return true;
  },
  // Put the map into the placeholder rendered by the current view
  mount(){
    const slot = document.getElementById('map-slot'); if (!slot) return;
    if (!this.ensure()){ slot.innerHTML = '<div class="map-off">Map unavailable offline</div>'; return; }
    slot.appendChild(this.el); this.map.invalidateSize();
    requestAnimationFrame(() => { this.map.invalidateSize(); this.fit(); });
  },
  cssColor(v){ if (!v) return '#5a6b70'; if (v.startsWith('#')) return v; const m = v.match(/var\((--[^)]+)\)/); return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#5a6b70' : v; },
  // points: [{lat,lng,label,kind:'from'|'to'|'stop'}]; lines: [{coords,cat,color}]
  draw(points, lines){
    if (!this.map) return;
    const key = JSON.stringify([points.map(p => [p.lat, p.lng, p.label]), lines.map(l => [l.cat, l.coords.length, l.coords[0]])]);
    if (key === this.drawn) return; this.drawn = key;
    this.layer.clearLayers(); const bounds = [];
    for (const l of lines){
      if (!l.coords || l.coords.length < 2) continue;
      const color = this.cssColor(l.color || CAT_COLOR[l.cat]);
      L.polyline(l.coords, {color, weight: l.cat === 'walk' ? 4 : 6, opacity: .9, dashArray: l.cat === 'walk' ? '2 8' : null, lineCap:'round'}).addTo(this.layer);
      l.coords.forEach(c => bounds.push(c));
    }
    points.forEach((p, i) => {
      const fill = p.kind === 'from' ? '#0E5A61' : p.kind === 'to' ? '#C8372D' : '#C99A06';
      L.circleMarker([p.lat, p.lng], {radius: p.kind === 'stop' ? 8 : 9, color:'#fff', weight:3, fillColor:fill, fillOpacity:1}).bindTooltip(esc(p.label), {direction:'top', offset:[0, -8]}).addTo(this.layer);
      bounds.push([p.lat, p.lng]);
    });
    this.bounds = bounds; this.fit();
  },
  fit(){
    const b = this.bounds; if (!this.map || !b || !b.length) return;
    if (b.length === 1) this.map.setView(b[0], 14); else this.map.fitBounds(b, {padding:[28, 28], maxZoom:16});
  }
};
