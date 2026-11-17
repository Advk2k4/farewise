/* Farewise: app state and persistence (this browser's localStorage, plus backup codes). */
'use strict';
const LS_KEY = 'farewise-v1';
const DEF_PREFS = {
  home: null,                 // {name, area, lat, lng, cc}
  country: null,              // ISO code whose default prices are in use (auto-set from your first trip)
  rates: defaultRates(FALLBACK_COUNTRY),
  priority: 'balanced',       // money | balanced | time
  hasCar: false, hasBike: false, parkMin: 8,
  budget: 0, cycleDay: 1, workdays: 7, visit: 30
};
const S = {
  tab: 'trip',
  prefs: JSON.parse(JSON.stringify(DEF_PREFS)),
  days: {},                   // 'YYYY-MM-DD' -> {trips:[...]}
  plans: {},                  // 'YYYY-MM-DD' -> plan
  recent: [],                 // recently used places
  trip: {from:null, to:null, timeMode:'now', date:todayISO(), time:'09:00', key:'', loading:false, result:null, error:null, sel:null, open:null},
  plan: null, planRes: null, planKey: '', planLoading: false,
  cycleOff: 0, ui: {openLeg:null}, sheet: null
};
const Store = {
  read(){ try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e){ return {}; } },
  save(){
    try { localStorage.setItem(LS_KEY, JSON.stringify({prefs:S.prefs, days:S.days, plans:S.plans, recent:S.recent})); }
    catch (e){ toast('Could not save in this browser (storage is full or blocked)'); }
  },
  load(){
    const o = this.read();
    if (o.prefs){ S.prefs = {...JSON.parse(JSON.stringify(DEF_PREFS)), ...o.prefs}; S.prefs.rates = {...defaultRates(S.prefs.country || FALLBACK_COUNTRY), ...(o.prefs.rates || {})}; }
    S.days = o.days || {}; S.plans = o.plans || {}; S.recent = o.recent || [];
  }
};
const saveSoon = debounce(() => Store.save(), 300);

function rememberPlace(p){
  if (!p || p.lat == null) return;
  S.recent = [p, ...S.recent.filter(x => hav(x, p) > 0.05 || x.name !== p.name)].slice(0, 8);
  saveSoon();
}
function setCountry(cc, keepCustom){
  S.prefs.country = cc;
  if (!keepCustom) S.prefs.rates = {...defaultRates(cc), lper100: S.prefs.rates.lper100 || 7.5};
  Store.save();
}
// First trip anywhere sets sensible local prices automatically
function autoCountry(p){ if (!S.prefs.country && p && p.cc && COUNTRIES[p.cc]) setCountry(p.cc); }

/* ---------- backup codes: move data between browsers ---------- */
function makeBackup(){ return 'FW1.' + btoa(unescape(encodeURIComponent(JSON.stringify({v:1, prefs:S.prefs, days:S.days, plans:S.plans, recent:S.recent})))); }
function readBackup(code){
  code = String(code || '').trim(); if (!code.startsWith('FW1.')) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(code.slice(4))))); } catch (e){ return null; }
}
function importBackup(o){
  let trips = 0;
  for (const [date, doc] of Object.entries(o.days || {})){
    const cur = S.days[date] || {trips:[]}; const ids = new Set(cur.trips.map(t => t.id));
    const add = (doc.trips || []).filter(t => !ids.has(t.id)); trips += add.length;
    S.days[date] = {trips:[...cur.trips, ...add]};
  }
  for (const [date, plan] of Object.entries(o.plans || {})) if (!S.plans[date]) S.plans[date] = plan;
  if (!S.prefs.home && o.prefs && o.prefs.home) S.prefs = {...S.prefs, ...o.prefs};
  for (const p of (o.recent || [])) rememberPlace(p);
  Store.save(); return trips;
}
