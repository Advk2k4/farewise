/* Farewise: clients for the free, keyless services the app is built on.
 *
 *   Search     Photon (Komoot), built on OpenStreetMap ........ https://photon.komoot.io
 *   Roads      OSRM servers run by FOSSGIS (car / bike / foot) . https://routing.openstreetmap.de
 *   Transit    Transitous (MOTIS 2), community-run, worldwide .. https://transitous.org
 *
 * All three are volunteer or community services: requests are cached, made only on explicit
 * user actions (never per keystroke for routing), and the app credits them in the footer.
 */
'use strict';
const API = {
  photon: 'https://photon.komoot.io',
  osrm: 'https://routing.openstreetmap.de',
  transit: 'https://api.transitous.org/api/v5'
};
const NET_CACHE = new Map();
function getJSON(url, timeoutMs){
  if (NET_CACHE.has(url)) return NET_CACHE.get(url);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs || 15000);
  const p = fetch(url, {signal: ctl.signal})
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .finally(() => clearTimeout(timer));
  NET_CACHE.set(url, p);
  p.catch(() => NET_CACHE.delete(url));
  if (NET_CACHE.size > 300) NET_CACHE.delete(NET_CACHE.keys().next().value);
  return p;
}

/* ---------- places ---------- */
function photonToPlace(f){
  const p = f.properties || {}; const [lng, lat] = f.geometry.coordinates;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = p.name || street || p.city || p.state || p.country || 'Dropped pin';
  const parts = [p.name && street ? street : '', p.district || p.locality || '', p.city || p.county || '', p.country || ''];
  const area = [...new Set(parts.filter(x => x && x !== name))].slice(0, 3).join(', ');
  return {name, area, lat, lng, cc:(p.countrycode || '').toUpperCase()};
}
async function searchPlaces(q, bias){
  const u = new URL(API.photon + '/api/');
  u.searchParams.set('q', q); u.searchParams.set('limit', '6');
  if (bias){ u.searchParams.set('lat', bias.lat.toFixed(3)); u.searchParams.set('lon', bias.lng.toFixed(3)); }
  const j = await getJSON(u.toString(), 8000);
  return (j.features || []).map(photonToPlace);
}
async function reversePlace(lat, lng){
  const j = await getJSON(`${API.photon}/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&limit=1`, 8000);
  const f = (j.features || [])[0];
  const p = f ? photonToPlace(f) : {name:'My location', area:'', cc:''};
  return {...p, name: p.name || 'My location', lat, lng};
}

/* ---------- roads: car / bike / foot ---------- */
const OSRM_PROFILE = {car:'routed-car', bike:'routed-bike', foot:'routed-foot'};
async function roadRoute(kind, o, d){
  const url = `${API.osrm}/${OSRM_PROFILE[kind]}/route/v1/driving/${o.lng.toFixed(6)},${o.lat.toFixed(6)};${d.lng.toFixed(6)},${d.lat.toFixed(6)}?overview=full&geometries=geojson&steps=false`;
  const j = await getJSON(url, 12000);
  if (j.code !== 'Ok' || !j.routes || !j.routes.length) return null;
  const r = j.routes[0];
  return {km: r.distance / 1000, min: r.duration / 60, line: r.geometry.coordinates.map(([x, y]) => [y, x])};
}

/* ---------- public transit ---------- */
async function transitPlan(o, d, when, arriveBy){
  const u = new URL(API.transit + '/plan');
  u.searchParams.set('fromPlace', o.lat.toFixed(6) + ',' + o.lng.toFixed(6));
  u.searchParams.set('toPlace', d.lat.toFixed(6) + ',' + d.lng.toFixed(6));
  // round to 5 minutes so repeated lookups hit the cache
  const t = new Date(Math.round(when.getTime() / 300000) * 300000);
  u.searchParams.set('time', t.toISOString());
  if (arriveBy) u.searchParams.set('arriveBy', 'true');
  const j = await getJSON(u.toString(), 20000);
  return (j.itineraries || []).map(it => ({
    start: new Date(it.startTime), end: new Date(it.endTime), min: it.duration / 60, transfers: it.transfers || 0,
    legs: it.legs.map(l => ({
      mode: l.mode,
      from: l.from.name === 'START' ? o.name : l.from.name,
      to: l.to.name === 'END' ? d.name : l.to.name,
      start: new Date(l.startTime), end: new Date(l.endTime), min: l.duration / 60, km: (l.distance || 0) / 1000,
      route: l.routeShortName || l.displayName || l.routeLongName || '',
      color: l.routeColor ? '#' + l.routeColor : null, text: l.routeTextColor ? '#' + l.routeTextColor : null,
      head: l.headsign || '', agency: l.agencyName || '', stops: (l.intermediateStops || []).length + 1, realTime: !!l.realTime,
      line: l.legGeometry ? decodePolyline(l.legGeometry.points, l.legGeometry.precision || 6) : []
    }))
  }));
}
