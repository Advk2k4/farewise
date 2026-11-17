/* Farewise: Trip view. From → to, with every sensible way to get there. */
'use strict';
const EXAMPLES = [
  {city:'New York', from:{name:'Times Square', area:'Manhattan, New York, United States', lat:40.7580, lng:-73.9855, cc:'US'}, to:{name:'Brooklyn Bridge Park', area:'Brooklyn, New York, United States', lat:40.7003, lng:-73.9967, cc:'US'}},
  {city:'London', from:{name:"King's Cross", area:'London, United Kingdom', lat:51.5308, lng:-0.1238, cc:'GB'}, to:{name:'Tower of London', area:'London, United Kingdom', lat:51.5081, lng:-0.0759, cc:'GB'}},
  {city:'Tokyo', from:{name:'Shibuya Station', area:'Shibuya, Tokyo, Japan', lat:35.6580, lng:139.7016, cc:'JP'}, to:{name:'Tokyo Tower', area:'Minato, Tokyo, Japan', lat:35.6586, lng:139.7454, cc:'JP'}},
  {city:'Berlin', from:{name:'Brandenburger Tor', area:'Mitte, Berlin, Germany', lat:52.5163, lng:13.3777, cc:'DE'}, to:{name:'East Side Gallery', area:'Friedrichshain, Berlin, Germany', lat:52.5050, lng:13.4397, cc:'DE'}},
  {city:'Sydney', from:{name:'Bondi Beach', area:'Sydney, Australia', lat:-33.8915, lng:151.2767, cc:'AU'}, to:{name:'Sydney Opera House', area:'Sydney, Australia', lat:-33.8568, lng:151.2153, cc:'AU'}}
];
// Shareable link for the current trip: ?from=lat,lng&fn=Name&to=lat,lng&tn=Name
function tripLink(){
  const t = S.trip; const u = new URL(location.href.split('#')[0].split('?')[0]);
  const f = p => p.lat.toFixed(5) + ',' + p.lng.toFixed(5);
  u.searchParams.set('from', f(t.from)); u.searchParams.set('fn', t.from.name);
  u.searchParams.set('to', f(t.to)); u.searchParams.set('tn', t.to.name);
  const cc = t.from.cc || t.to.cc; if (cc) u.searchParams.set('cc', cc);
  return u.toString();
}
function readTripLink(){
  const q = new URLSearchParams(location.search); const pt = (v, n) => { const m = (v || '').match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/); return m ? {name: n || 'Dropped pin', area:'', lat:+m[1], lng:+m[2], cc:''} : null; };
  const from = pt(q.get('from'), q.get('fn')), to = pt(q.get('to'), q.get('tn'));
  const cc = (q.get('cc') || '').toUpperCase();
  if (from && to){ from.cc = to.cc = cc; S.trip.from = from; S.trip.to = to; S.tab = 'trip'; autoCountry(from); }
}
function tripWhen(){
  const t = S.trip;
  if (t.timeMode === 'now') return {when:new Date(), arriveBy:false};
  return {when:atLocal(t.date, t.time), arriveBy:t.timeMode === 'arrive'};
}
const prefsSig = () => [S.prefs.priority, S.prefs.hasCar, S.prefs.hasBike, S.prefs.parkMin, JSON.stringify(S.prefs.rates)].join('|');
function ensureTrip(){
  const t = S.trip; if (!t.from || !t.to) return;
  const {when, arriveBy} = tripWhen();
  const key = [t.from.lat, t.from.lng, t.to.lat, t.to.lng, Math.round(when.getTime() / 300000), arriveBy, prefsSig()].join('|');
  if (key === t.key) return;
  t.key = key; t.loading = true; t.error = null;
  tripOptions(t.from, t.to, when, arriveBy).then(r => {
    if (t.key !== key) return;
    t.result = r; t.loading = false;
    if (!r.opts.some(o => o.key === t.sel)) t.sel = r.opts.length ? r.opts[0].key : null;
    render();
  }).catch(e => { if (t.key !== key) return; t.loading = false; t.error = 'Could not reach the routing services. Check your connection and try again.'; render(); });
}
function renderTrip(){
  ensureTrip();
  const t = S.trip; const o = t.from, d = t.to;
  const form = `<div class="card pad formgrid">
    ${placeField('from', 'From', o, 'Search an address or place')}
    <button class="btn sm ghost swap" data-act="trip-swap" aria-label="Swap from and to">⇅ Swap</button>
    ${placeField('to', 'To', d, 'Where are you going?')}
    <div class="stack" style="gap:8px"><span class="eyebrow">When</span>
      <div class="seg" role="group" aria-label="When">
        <button data-act="trip-when" data-v="now" aria-pressed="${t.timeMode === 'now'}">Leave now</button>
        <button data-act="trip-when" data-v="leave" aria-pressed="${t.timeMode === 'leave'}">Leave at</button>
        <button data-act="trip-when" data-v="arrive" aria-pressed="${t.timeMode === 'arrive'}">Arrive by</button>
      </div>
      ${t.timeMode !== 'now' ? `<div class="two"><input class="in" type="date" id="trip-date" data-ch="trip-date" value="${esc(t.date)}" aria-label="Date"><input class="in" type="time" id="trip-time" data-ch="trip-time" value="${esc(t.time)}" aria-label="Time"></div>` : ''}
    </div>
  </div>`;
  let results = '';
  if (!o || !d){
    results = `<div class="card pad empty-state"><h3>Where to?</h3><p class="muted">Pick a start and a destination anywhere in the world. Farewise compares walking, cycling, public transit, taxis and driving, with an estimate of what each costs.</p>
      <div class="eyebrow" style="margin-top:6px">Or try an example</div>
      <div class="row" style="gap:6px">${EXAMPLES.map((x, i) => `<button class="btn sm" data-act="trip-example" data-i="${i}">${esc(x.city)}: ${esc(x.from.name)} → ${esc(x.to.name)}</button>`).join('')}</div></div>`;
  } else if (t.loading && !t.result){
    results = `<div class="card pad empty-state"><div class="spinner" aria-hidden="true"></div><p class="muted">Checking transit, roads and walking routes…</p></div>`;
  } else if (t.error){
    results = `<div class="card pad empty-state"><p>${esc(t.error)}</p><button class="btn" data-act="trip-retry">Try again</button></div>`;
  } else if (t.result){
    const r = t.result; const cc = o.cc || d.cc;
    const banner = (cc && S.prefs.country && cc !== S.prefs.country && COUNTRIES[cc]) ? `<div class="banner info"><span>Prices use your ${esc(countryName(S.prefs.country))} rates (${esc(S.prefs.rates.cur)}). This trip is in ${esc(countryName(cc))}.</span><button class="btn sm" data-act="use-country" data-cc="${cc}">Use ${esc(countryName(cc))} prices</button></div>` : '';
    const transitNote = r.status.transit === 'none' ? `<div class="banner warn"><span>No public transit found. Either the open transit data doesn't cover this area yet, or no service runs at this time.</span><a class="btn sm" href="${mapsUrl(o, d, 'transit')}" target="_blank" rel="noopener">Check transit in Google Maps ↗</a></div>`
      : r.status.transit === 'error' ? `<div class="banner warn"><span>The transit lookup didn't respond, so only road and walking options are shown.</span><button class="btn sm" data-act="trip-retry">Retry</button></div>` : '';
    results = `<div class="stack" style="gap:10px">${banner}${transitNote}
      ${r.opts.length ? `<div class="opts">${r.opts.map(op => optCard(op, {selected: t.sel === op.key, open: t.open === op.key, act:'trip-open', o, d,
        actions:`<button class="btn sm primary" data-act="trip-log" data-key="${esc(op.key)}">I took this · log ${op.cost ? money(roundNice(op.cost), S.prefs.rates.cur) : 'it'}</button>`})).join('')}</div>`
        : '<div class="card pad empty-state"><p>No routes found between these two places.</p></div>'}
      <div class="row"><button class="btn sm" data-act="trip-share">Copy link to this trip</button></div>
      <p class="small faint" style="margin:0">${t.loading ? 'Updating… · ' : ''}Prices are rough estimates for ${esc(countryName(S.prefs.country || FALLBACK_COUNTRY))}; adjust them in Settings. Driving times assume typical traffic for the hour.</p></div>`;
  }
  return `<div class="pagehead"><div><h2>Plan a trip</h2><p>Every sensible way from A to B, with time and an estimated cost for each.</p></div></div>
    <div class="trip-grid"><div class="stack" style="gap:14px">${form}<div class="trip-results">${results}</div></div>
    <div class="map-col"><div id="map-slot" class="map-slot"></div></div></div>`;
}
function drawTripMap(){
  const t = S.trip; const pts = [];
  if (t.from) pts.push({...t.from, label:t.from.name, kind:'from'});
  if (t.to) pts.push({...t.to, label:t.to.name, kind:'to'});
  const op = t.result && t.result.opts.find(x => x.key === t.sel);
  MapView.draw(pts, op ? op.lines : []);
}
