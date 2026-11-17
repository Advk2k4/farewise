/* Farewise: app shell. Navigation, rendering, events and boot. */
'use strict';
const TABS = [
  ['trip', 'Trip', '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'],
  ['plan', 'Day plan', '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h3M7.5 17h6"/>'],
  ['spending', 'Spending', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>']
];
function renderChrome(){
  const btn = ([k, l, ic], small) => `<button data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${small ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic}</svg>` : ''}${l}</button>`;
  $('#toptabs').innerHTML = TABS.map(t => btn(t, false)).join('');
  $('#bottomnav').innerHTML = TABS.map(t => btn(t, true)).join('');
  const g = $('#gear'); if (S.tab === 'settings') g.setAttribute('aria-current', 'page'); else g.removeAttribute('aria-current');
  $('#curpill').textContent = S.prefs.country ? S.prefs.country + ' · ' + S.prefs.rates.cur : 'Prices: ' + S.prefs.rates.cur;
}
const credits = () => `<footer class="credits"><span>Transit: <a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous and its data sources</a> (<a href="https://transitous.org/donate/" target="_blank" rel="noopener">donate</a>)</span>
  <span>Roads: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener">FOSSGIS OSRM</a></span><span>Search: <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon by Komoot</a></span>
  <span>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a></span>
  <span>Prices are estimates · <a href="https://github.com/Advk2k4/farewise" target="_blank" rel="noopener">Source &amp; contact</a></span></footer>`;

let rafPending = false;
function render(){ if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; doRender(); }); }
function doRender(){
  // keep what the user is typing in a place field when async results re-render the page
  const ae = document.activeElement; const keep = ae && ae.dataset && ae.dataset.pf ? {id:ae.id, v:ae.value, s:ae.selectionStart, e:ae.selectionEnd} : null;
  renderChrome();
  const view = {trip:renderTrip, plan:renderPlan, spending:renderSpending, settings:renderSettings}[S.tab] || renderTrip;
  $('#main').innerHTML = view() + credits();
  if (keep){ const el = document.getElementById(keep.id); if (el){ el.value = keep.v; el.focus({preventScroll:true}); try { el.setSelectionRange(keep.s, keep.e); } catch (e){} } }
  if (document.getElementById('map-slot')){ MapView.mount(); if (S.tab === 'trip') drawTripMap(); else if (S.tab === 'plan') drawPlanMap(); }
}
let toastTimer = null;
function toast(msg, undo){
  const el = $('#toast'); clearTimeout(toastTimer);
  el.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${undo ? '<button data-act="undo">Undo</button>' : ''}</div>`;
  toastTimer = setTimeout(() => { el.innerHTML = ''; lastUndo = null; }, 6000);
}

/* ---------- choosing a place in any field ---------- */
function pickPlace(slot, p){
  rememberPlace(p); hideSug(slot);
  if (slot === 'from'){ S.trip.from = p; autoCountry(p); S.trip.open = null; }
  else if (slot === 'to'){ S.trip.to = p; autoCountry(p); S.trip.open = null; }
  else if (slot === 'pstart'){ S.plan.start = p.name === 'Home' && S.prefs.home && hav(p, S.prefs.home) < 0.01 ? null : p; touchPlan(); }
  else if (slot === 'padd'){ S.plan.stops.push({place:p, meet:'', visit:null}); S.plan.choice = {}; touchPlan(); autoCountry(p); }
  else if (slot === 'home'){ S.prefs.home = {...p, name: p.name === 'Home' ? S.prefs.home.name : p.name}; autoCountry(p); Store.save(); toast('Home saved'); }
  render();
}
async function chooseSug(slot, i){
  const it = (SUG[slot] || [])[i]; if (!it) return;
  if (it.kind === 'loc'){
    const inp = document.getElementById('pf-' + slot); if (inp) inp.value = 'Finding you…';
    try { pickPlace(slot, await geolocate()); } catch (e){ toast(e.message); render(); }
  } else pickPlace(slot, it.place);
}
function findTripOption(key){ const r = S.trip.result; return r && r.opts.find(x => x.key === key); }

const ACT = {
  tab(b){ S.tab = b.dataset.tab; S.ui.openLeg = null; confirmClear = false; history.replaceState(null, '', '#' + S.tab); render(); window.scrollTo({top:0}); },
  'trip-swap'(){ const t = S.trip; [t.from, t.to] = [t.to, t.from]; t.open = null; render(); },
  'trip-when'(b){ S.trip.timeMode = b.dataset.v; if (b.dataset.v !== 'now' && !S.trip.time) S.trip.time = nowHM(); render(); },
  'trip-example'(b){ const x = EXAMPLES[+b.dataset.i]; S.trip.from = x.from; S.trip.to = x.to; autoCountry(x.from); render(); },
  'trip-retry'(){ NET_CACHE.clear(); S.trip.key = ''; render(); },
  'trip-open'(b, e){ if (e.target.closest('a,button')) return; const k = b.dataset.key; S.trip.sel = k; S.trip.open = S.trip.open === k ? null : k; render(); },
  'trip-log'(b){ const op = findTripOption(b.dataset.key); if (!op) return; logTrips(isoDate(op.depart), [tripFromOption(S.trip.from, S.trip.to, op)], `Logged ${money(roundNice(op.cost), S.prefs.rates.cur)} · ${op.title}`); },
  'use-country'(b){ setCountry(b.dataset.cc); toast('Now using ' + countryName(b.dataset.cc) + ' prices'); render(); },
  'leg-open'(b){ S.ui.openLeg = S.ui.openLeg === b.dataset.leg ? null : b.dataset.leg; render(); },
  'leg-pick'(b, e){ if (e.target.closest('a')) return; S.plan.choice[b.dataset.leg] = b.dataset.key; touchPlan(); render(); },
  'stop-rm'(b){ S.plan.stops.splice(+b.dataset.i, 1); S.plan.choice = {}; touchPlan(); render(); },
  'stop-up'(b){ const i = +b.dataset.i, s = S.plan.stops; if (i < 1) return; [s[i - 1], s[i]] = [s[i], s[i - 1]]; S.plan.choice = {}; touchPlan(); render(); },
  'stop-down'(b){ const i = +b.dataset.i, s = S.plan.stops; if (i >= s.length - 1) return; [s[i + 1], s[i]] = [s[i], s[i + 1]]; S.plan.choice = {}; touchPlan(); render(); },
  'plan-order'(){ bestOrder(); touchPlan(); render(); toast('Stops reordered to cut travel'); },
  'plan-clear'(){ const before = JSON.parse(JSON.stringify(S.plan)); S.plan.stops = []; S.plan.choice = {}; touchPlan(); render(); lastUndo = () => { S.plan = before; touchPlan(); render(); }; toast('Plan cleared', true); },
  'plan-example'(){ S.plan = examplePlan(S.plan.date); autoCountry(S.plan.start); S.planKey = ''; render(); },
  'trip-share'(){ const url = tripLink(); try { navigator.clipboard.writeText(url).then(() => toast('Link copied'), () => toast(url)); } catch (e){ toast(url); } },
  'plan-retry'(){ NET_CACHE.clear(); S.planKey = ''; render(); },
  'plan-log'(){ const R = S.planRes; if (!R || !R.legs) return; const list = R.legs.filter(l => l.chosen).map(l => tripFromOption(l.from, l.to, l.chosen)); logTrips(S.plan.date, list, `Logged ${list.length} trips · ${money(R.cost, S.prefs.rates.cur)}`); },
  cycle(b){ S.cycleOff = Math.min(0, S.cycleOff + Number(b.dataset.d)); render(); },
  'trip-rm'(b){ const {date, id} = b.dataset; const d = S.days[date]; if (!d) return; const before = JSON.parse(JSON.stringify(d.trips)); d.trips = d.trips.filter(t => t.id !== id); Store.save(); render(); lastUndo = () => { S.days[date].trips = before; Store.save(); render(); }; toast('Trip deleted', true); },
  'add-exp'(){ S.sheet = {type:'exp'}; renderSheet(); },
  'sheet-close'(){ S.sheet = null; renderSheet(); },
  'sheet-bg'(b, e){ if (e.target === b){ S.sheet = null; renderSheet(); } },
  pref(b){ const k = b.dataset.k; let v = b.dataset.v; if (v === 'true' || v === 'false') v = v === 'true'; else if (k === 'workdays') v = Number(v); S.prefs[k] = v; Store.save(); render(); },
  'rates-reset'(){ setCountry(S.prefs.country || FALLBACK_COUNTRY); toast('Prices reset'); render(); },
  'home-clear'(){ S.prefs.home = null; Store.save(); render(); },
  'backup-copy'(){ const code = makeBackup(); const box = $('#backup-out'); if (box){ box.value = code; box.hidden = false; box.select(); } try { navigator.clipboard.writeText(code).then(() => toast('Backup code copied'), () => toast('Select the code and copy it')); } catch (e){ toast('Select the code and copy it'); } },
  'backup-restore'(){ const o = readBackup(($('#backup-in') || {}).value); if (!o){ toast("That isn't a Farewise backup code"); return; } const n = importBackup(o); render(); toast(`Added ${n} trip${n === 1 ? '' : 's'}`); },
  'clear-all'(){ if (!confirmClear){ confirmClear = true; render(); setTimeout(() => { if (confirmClear){ confirmClear = false; render(); } }, 5000); return; } confirmClear = false; try { localStorage.removeItem(LS_KEY); } catch (e){} location.reload(); },
  undo(){ if (lastUndo){ lastUndo(); lastUndo = null; } $('#toast').innerHTML = ''; }
};
const CH = {
  'trip-date'(el){ if (el.value){ S.trip.date = el.value; render(); } },
  'trip-time'(el){ if (el.value){ S.trip.time = el.value; render(); } },
  'plan-date'(el){ if (el.value){ loadPlan(el.value); render(); } },
  'plan-time'(el){ if (el.value){ S.plan.startTime = el.value; S.plan.choice = {}; touchPlan(); render(); } },
  'plan-ret'(el){ S.plan.ret = el.checked; touchPlan(); render(); },
  'stop-meet'(el){ S.plan.stops[+el.dataset.i].meet = el.value; S.plan.choice = {}; touchPlan(); render(); },
  'stop-visit'(el){ S.plan.stops[+el.dataset.i].visit = Number(el.value); touchPlan(); render(); },
  'trip-amt'(el){ const d = S.days[el.dataset.date]; const t = d && d.trips.find(x => x.id === el.dataset.id); if (!t) return; const v = Math.max(0, Number(el.value) || 0); t.cost = v; const m = spendCat(t.mode); t.parts = {[m === 'other' ? 'other' : m]: v}; Store.save(); render(); },
  country(el){ setCountry(el.value); render(); },
  rate(el){ const v = Number(el.value); if (el.value !== '' && v >= 0){ S.prefs.rates[el.dataset.k] = v; Store.save(); render(); } },
  'pref-num'(el){ const v = Number(el.value); if (el.value !== '' && v >= 0){ S.prefs[el.dataset.k] = v; Store.save(); render(); } },
  'pref-cycle'(el){ const v = Math.round(Number(el.value)); if (v >= 1 && v <= 28){ S.prefs.cycleDay = v; S.cycleOff = 0; Store.save(); render(); } }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b, e); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset && CH[el.dataset.ch]) CH[el.dataset.ch](el); });
// place fields: suggestions on focus / typing, choose with mouse or keyboard
document.addEventListener('focusin', e => { const slot = e.target.dataset && e.target.dataset.pf; if (slot){ e.target.select(); showSug(slot, quickItems()); } });
document.addEventListener('focusout', e => { const slot = e.target.dataset && e.target.dataset.pf; if (slot) setTimeout(() => { if (document.activeElement !== e.target) hideSug(slot); }, 150); });
document.addEventListener('input', e => {
  const slot = e.target.dataset && e.target.dataset.pf; if (!slot) return;
  const q = e.target.value.trim();
  if (q.length >= 3) runSearch(slot, q); else showSug(slot, quickItems());
});
document.addEventListener('mousedown', e => { const b = e.target.closest('.sug-i'); if (b){ e.preventDefault(); chooseSug(b.dataset.sug, +b.dataset.i); } });
document.addEventListener('keydown', e => {
  const slot = e.target.dataset && e.target.dataset.pf;
  if (slot && SUG[slot] && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)){
    const box = document.getElementById('sug-' + slot); if (!box || box.hidden) return;
    const items = [...box.querySelectorAll('.sug-i')];
    if (e.key === 'Escape'){ hideSug(slot); return; }
    if (e.key === 'Enter'){ e.preventDefault(); const i = SUG_I[slot] >= 0 ? SUG_I[slot] : 0; if (items[i]) chooseSug(slot, +items[i].dataset.i); return; }
    e.preventDefault(); SUG_I[slot] = Math.max(0, Math.min(items.length - 1, (SUG_I[slot] ?? -1) + (e.key === 'ArrowDown' ? 1 : -1)));
    items.forEach((x, i) => x.classList.toggle('active', i === SUG_I[slot])); if (items[SUG_I[slot]]) items[SUG_I[slot]].scrollIntoView({block:'nearest'});
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.opt[role=button]')){ e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape' && S.sheet){ S.sheet = null; renderSheet(); }
});
document.addEventListener('submit', e => {
  e.preventDefault(); if (e.target.id !== 'exp-form') return;
  const amt = Number($('#exp-amt').value); if (!(amt > 0)) return;
  const mode = $('#exp-mode').value, note = $('#exp-note').value.trim(), date = $('#exp-date').value || todayISO();
  S.sheet = null; renderSheet();
  logTrips(date, [{id:uid(), t:'', mode, label:SPEND_NAME[mode], note: note || SPEND_NAME[mode], cost:amt, cur:S.prefs.rates.cur, parts:{[mode]:amt}}], `Added ${money(amt, S.prefs.rates.cur)}`);
});

/* ---------- boot ---------- */
Store.load();
loadPlan(todayISO());
{ const h = location.hash.slice(1); if (['trip', 'plan', 'spending', 'settings'].includes(h)) S.tab = h; }
readTripLink();
if (new URLSearchParams(location.search).get('example') === 'plan'){ S.plan = examplePlan(todayISO()); autoCountry(S.plan.start); S.tab = 'plan'; }
render();
