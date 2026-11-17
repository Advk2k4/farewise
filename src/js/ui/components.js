/* Farewise: shared UI pieces: place search fields, route strips, option cards. */
'use strict';

/* ---------- place field with live suggestions ---------- */
const SUG = {}, SUG_I = {};
function placeField(slot, label, place, placeholder){
  return `<div class="pf"><label class="f" for="pf-${slot}">${esc(label)}</label>
    <div class="pf-box"><input class="in" id="pf-${slot}" data-pf="${slot}" value="${esc(place ? place.name : '')}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="sug-${slot}">
    ${place && place.area ? `<div class="pf-sub">${esc(place.area)}</div>` : ''}
    <div class="sug" id="sug-${slot}" role="listbox" hidden></div></div></div>`;
}
function quickItems(){
  const items = [{kind:'loc'}];
  if (S.prefs.home) items.push({kind:'place', place:{...S.prefs.home, name:'Home', area:S.prefs.home.name + (S.prefs.home.area ? ', ' + S.prefs.home.area : '')}, icon:'home'});
  for (const p of S.recent) items.push({kind:'place', place:p, icon:'recent'});
  return items;
}
const ICON = {
  loc:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
  home:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  recent:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>'
};
function showSug(slot, items, note){
  const box = document.getElementById('sug-' + slot); if (!box) return;
  SUG[slot] = items; SUG_I[slot] = -1;
  box.innerHTML = items.length ? items.map((it, i) => it.kind === 'loc'
      ? `<button type="button" class="sug-i" role="option" data-sug="${slot}" data-i="${i}">${ICON.loc}<span><b>Use my current location</b></span></button>`
      : `<button type="button" class="sug-i" role="option" data-sug="${slot}" data-i="${i}">${ICON[it.icon || 'pin']}<span><b>${esc(it.place.name)}</b>${it.place.area ? `<small>${esc(it.place.area)}</small>` : ''}</span></button>`).join('')
    : `<div class="sug-empty">${esc(note || 'No places found. Try adding a city name.')}</div>`;
  box.hidden = false;
  const inp = document.getElementById('pf-' + slot); if (inp) inp.setAttribute('aria-expanded', 'true');
}
function hideSug(slot){ const box = document.getElementById('sug-' + slot); if (box) box.hidden = true; const inp = document.getElementById('pf-' + slot); if (inp) inp.setAttribute('aria-expanded', 'false'); }
const biasPoint = () => S.trip.from || S.prefs.home || S.recent[0] || null;
const runSearch = debounce(async (slot, q) => {
  try {
    const items = await searchPlaces(q, biasPoint());
    const inp = document.getElementById('pf-' + slot);
    if (inp && inp.value.trim() === q) showSug(slot, items.map(p => ({kind:'place', place:p})));
  } catch (e){ showSug(slot, [], 'Place search is unavailable right now. Try again in a moment.'); }
}, 350);
function geolocate(){
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser'));
    navigator.geolocation.getCurrentPosition(
      async pos => { try { resolve(await reversePlace(pos.coords.latitude, pos.coords.longitude)); } catch (e){ resolve({name:'My location', area:'', lat:pos.coords.latitude, lng:pos.coords.longitude, cc:''}); } },
      err => reject(new Error(err.code === 1 ? 'Location permission was denied' : 'Could not get your location')),
      {enableHighAccuracy:true, timeout:10000, maximumAge:60000});
  });
}

/* ---------- route strip, steps, option card ---------- */
function chip(s){
  const m = Math.max(1, Math.round(s.min));
  if (s.cat === 'walk') return `<span class="chip walk">Walk <span class="n">${m}</span></span>`;
  const bg = s.color || CAT_COLOR[s.cat] || CAT_COLOR.other; const fg = s.color ? (s.text || '#fff') : (s.cat === 'taxi' ? 'var(--m-taxi-ink)' : '#fff');
  return `<span class="chip" style="background:${bg};color:${fg}">${esc(s.label)} <span class="n">${m}</span></span>`;
}
const strip = op => `<div class="strip" aria-label="Route">${op.segs.map(chip).join('<span class="arr" aria-hidden="true">›</span>')}</div>`;
const fmtDist = km => km < 1 ? Math.round(km * 1000 / 10) * 10 + ' m' : km.toFixed(1) + ' km';
function stepList(op){
  const cur = S.prefs.rates.cur;
  return `<ul class="steps">${op.segs.map(s => {
    const col = s.color || CAT_COLOR[s.cat] || CAT_COLOR.other; let txt, right = fmtMin(s.min);
    if (s.cat === 'walk') txt = `Walk ${s.km ? fmtDist(s.km) + ' ' : ''}to ${esc(s.to)}`;
    else if (op.kind === 'transit') { txt = `<b>${esc((TRANSIT_LABEL[s.mode] || 'Transit') + (s.route ? ' ' + s.route : ''))}</b>${s.head ? ' toward ' + esc(s.head) : ''}<br><span class="faint">${esc(s.from)} → ${esc(s.to)} · ${s.stops} stop${s.stops > 1 ? 's' : ''}${s.start ? ' · ' + timeOf(s.start) : ''}${s.realTime ? ' · live' : ''}</span>`; }
    else if (s.cat === 'taxi') { txt = `Taxi or ride-hail to ${esc(s.to)}`; right += ' · ' + money(op.costLo, cur) + '–' + money(op.costHi, cur); }
    else if (s.cat === 'car') { txt = `Drive ${fmtDist(s.km)} to ${esc(s.to)}`; right += ' · fuel ' + money(op.cost, cur); }
    else txt = `${esc(CAT_NAME[s.cat] || 'Go')} ${s.km ? fmtDist(s.km) + ' ' : ''}to ${esc(s.to)}`;
    return `<li><span class="dot" style="background:${col}"></span><span>${txt}</span><span class="r">${right}</span></li>`;
  }).join('')}</ul>`;
}
function costText(op){ const cur = S.prefs.rates.cur; if (!op.cost) return 'Free'; return op.costLo ? money(op.costLo, cur) + '–' + money(op.costHi, cur) : '≈ ' + money(op.cost, cur); }
function tagPills(op){
  const t = (op.tags || []).map(x => `<span class="pill ${x === 'Recommended' ? 'rec' : 'acc'}">${x}</span>`);
  if (op.notes && op.notes.some(n => /Rush-hour/.test(n))) t.push('<span class="pill warn">Traffic</span>');
  if (op.segs.some(s => s.realTime)) t.push('<span class="pill good">Live times</span>');
  return t.join('');
}
// a = data-act for selecting; d = extra data attributes; o/d for Maps link; footer = extra action buttons html
function optCard(op, {selected, open, act, data, o, d, actions}){
  return `<div class="opt ${selected ? 'sel' : ''}" role="button" tabindex="0" data-act="${act}" data-key="${esc(op.key)}" ${data || ''} aria-expanded="${!!open}">
    <div class="opt-top"><div style="min-width:0"><div class="opt-title">${esc(op.title)}</div><div class="opt-sub">${esc(op.sub)}</div></div>
    <div class="opt-nums"><div class="t">${fmtMin(op.min)}</div><div class="c">${costText(op)}</div></div></div>
    ${strip(op)}
    <div class="row" style="gap:6px"><span class="pill">${timeOf(op.depart)} → ${timeOf(op.arrive)}</span>${tagPills(op)}</div>
    ${open ? `${stepList(op)}${op.notes.length ? `<p class="small muted" style="margin:0">${op.notes.map(esc).join(' · ')}</p>` : ''}
      <div class="opt-actions"><a class="btn sm" href="${mapsUrl(o, d, op.mapsMode)}" target="_blank" rel="noopener">Open in Google Maps ↗</a>${actions || ''}</div>` : ''}
  </div>`;
}
