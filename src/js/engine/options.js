/* Farewise: turns route lookups into comparable options (time, estimated cost, tags). */
'use strict';
const TRANSIT_LABEL = {BUS:'Bus', COACH:'Coach', TRAM:'Tram', SUBWAY:'Metro', METRO:'Metro', RAIL:'Train', REGIONAL_RAIL:'Train', REGIONAL_FAST_RAIL:'Train', SUBURBAN:'Suburban train', HIGHSPEED_RAIL:'High-speed train', LONG_DISTANCE:'Train', NIGHT_RAIL:'Night train', FERRY:'Ferry', AIRPLANE:'Flight', FUNICULAR:'Funicular', AERIAL_LIFT:'Cable car', CABLE_CAR:'Cable car', ODM:'On-demand ride', OTHER:'Transit'};
const modeCat = m => m === 'WALK' ? 'walk' : m === 'BIKE' ? 'bike' : m === 'CAR' ? 'car'
  : (m === 'BUS' || m === 'COACH' || m === 'ODM') ? 'bus' : m === 'FERRY' ? 'ferry' : m === 'TRAM' ? 'tram'
  : (m === 'SUBWAY' || m === 'METRO') ? 'metro' : 'rail';
const CAT_COLOR = {walk:'var(--m-walk)', bike:'var(--m-bike)', car:'var(--m-car)', taxi:'var(--m-taxi)', bus:'var(--m-bus)', tram:'var(--m-tram)', metro:'var(--m-metro)', rail:'var(--m-rail)', ferry:'var(--m-ferry)', transit:'var(--m-metro)', other:'var(--ink-3)'};
const CAT_NAME = {walk:'Walk', bike:'Bike', car:'Drive', taxi:'Taxi', bus:'Bus', tram:'Tram', metro:'Metro', rail:'Train', ferry:'Ferry', transit:'Transit', other:'Other'};
const PRIORITY_K = {money:25, balanced:10, time:3};   // minutes one transit fare is "worth"

// Typical traffic on top of free-flow driving time (OSRM has no live traffic)
function trafficFactor(d){
  const day = d.getDay(), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 22 || h < 6) return 1.0;
  if (day === 0 || day === 6) return (h >= 11 && h < 20) ? 1.15 : 1.05;
  if ((h >= 7 && h < 10) || (h >= 16 && h < 19)) return 1.45;
  return 1.2;
}
const isRush = d => trafficFactor(d) >= 1.4;
const rates = () => S.prefs.rates;

function taxiCost(km, min){ const r = rates(); return r.taxiBase + r.taxiKm * km + r.taxiMin * min; }
function transitCost(boardings){ const r = rates(); return r.fare * Math.min(boardings, 2); }
function fuelCost(km){ const r = rates(); return km * r.lper100 / 100 * r.fuel; }

/* Ask every service in parallel and build the option list.
 * when: Date of departure (or of arrival when arriveBy). */
async function tripOptions(o, d, when, arriveBy){
  const P = S.prefs; const km = hav(o, d);
  const [tr, foot, bike, car] = await Promise.allSettled([
    km > 0.5 ? transitPlan(o, d, when, arriveBy) : Promise.resolve([]),
    km <= 8 ? roadRoute('foot', o, d) : Promise.resolve(null),
    P.hasBike && km <= 30 ? roadRoute('bike', o, d) : Promise.resolve(null),
    km > 0.6 ? roadRoute('car', o, d) : Promise.resolve(null)
  ]);
  const opts = []; const status = {transit: tr.status === 'rejected' ? 'error' : (km > 0.5 && !tr.value.length ? 'none' : 'ok'), road: car.status === 'rejected' ? 'error' : 'ok'};
  const place = (dep, min) => arriveBy ? {depart: addMin(when, -min), arrive: when} : {depart: dep, arrive: addMin(dep, min)};

  if (foot.status === 'fulfilled' && foot.value && foot.value.min <= 100){
    const f = foot.value; const t = place(when, f.min);
    opts.push({key:'walk', kind:'walk', title:'Walk', sub:f.km.toFixed(1) + ' km', min:f.min, cost:0, ...t, walkMin:f.min,
      segs:[{cat:'walk', label:'Walk', min:f.min, km:f.km, from:o.name, to:d.name}], lines:[{coords:f.line, cat:'walk'}], notes:[], mapsMode:'walking', parts:{}});
  }
  if (bike.status === 'fulfilled' && bike.value && bike.value.min <= 120){
    const b = bike.value; const t = place(when, b.min + 2);
    opts.push({key:'bike', kind:'bike', title:'Cycle', sub:b.km.toFixed(1) + ' km on your own bike', min:b.min + 2, cost:0, ...t,
      segs:[{cat:'bike', label:'Bike', min:b.min, km:b.km, from:o.name, to:d.name}], lines:[{coords:b.line, cat:'bike'}], notes:[], mapsMode:'bicycling', parts:{}});
  }
  if (car.status === 'fulfilled' && car.value){
    const c = car.value; const tf = trafficFactor(arriveBy ? addMin(when, -c.min) : when); const drive = c.min * tf;
    const rush = tf >= 1.4 ? ['Rush-hour traffic is likely'] : [];
    const taxiMin = drive + 5; const tc = taxiCost(c.km, drive); const tt = place(when, taxiMin);
    opts.push({key:'taxi', kind:'taxi', title:'Taxi / ride-hail', sub:c.km.toFixed(1) + ' km, door to door', min:taxiMin, cost:tc, costLo:tc * 0.85, costHi:tc * (tf >= 1.4 ? 1.5 : 1.2), ...tt,
      segs:[{cat:'taxi', label:'Taxi', min:taxiMin, km:c.km, from:o.name, to:d.name}], lines:[{coords:c.line, cat:'taxi'}], notes:rush.concat(['Includes ~5 min to get picked up']), mapsMode:'driving', parts:{taxi:tc}});
    if (P.hasCar){
      const dm = drive + P.parkMin; const fc = fuelCost(c.km); const td = place(when, dm);
      opts.push({key:'car', kind:'car', title:'Drive', sub:c.km.toFixed(1) + ' km, fuel only', min:dm, cost:fc, ...td,
        segs:[{cat:'car', label:'Drive', min:dm, km:c.km, from:o.name, to:d.name}], lines:[{coords:c.line, cat:'car'}], notes:rush.concat([`Includes ${P.parkMin} min to park; parking fees not included`]), mapsMode:'driving', parts:{car:fc}});
    }
  }
  if (tr.status === 'fulfilled'){
    const seen = new Set();
    for (const it of tr.value){
      const rides = it.legs.filter(l => l.mode !== 'WALK');
      if (!rides.length) continue;
      const sig = rides.map(l => l.mode + ':' + l.route).join('>');
      if (seen.has(sig)) continue; seen.add(sig);
      const cost = transitCost(rides.length);
      const walkMin = it.legs.filter(l => l.mode === 'WALK').reduce((a, l) => a + l.min, 0);
      const doorMin = arriveBy ? it.min : (it.end - when) / 60000;   // includes waiting before the first departure
      const names = [...new Set(rides.map(l => l.route ? `${TRANSIT_LABEL[l.mode] || 'Transit'} ${l.route}` : (TRANSIT_LABEL[l.mode] || 'Transit')))];
      opts.push({key:'transit:' + sig, kind:'transit', title:names.join(' + '), sub:(it.transfers ? it.transfers + (it.transfers > 1 ? ' changes' : ' change') : 'No changes') + ' · leaves ' + timeOf(it.start),
        min:Math.max(doorMin, it.min), ride:it.min, cost, depart:it.start, arrive:it.end, walkMin, transfers:it.transfers,
        segs:it.legs.map(l => ({cat:modeCat(l.mode), label: l.mode === 'WALK' ? 'Walk' : (l.route || TRANSIT_LABEL[l.mode] || 'Transit'), min:l.min, km:l.km, from:l.from, to:l.to, color:l.color, text:l.text, head:l.head, stops:l.stops, mode:l.mode, start:l.start, realTime:l.realTime})),
        lines:it.legs.map(l => ({coords:l.line, cat:modeCat(l.mode), color:l.color})),
        notes:[rides.length > 1 ? 'Price assumes a fare per ride (up to 2); transfers are often free' : 'Price is a typical single fare'].concat(walkMin >= 15 ? ['About ' + Math.round(walkMin) + ' min on foot'] : []),
        mapsMode:'transit', parts:{transit:cost}});
      if (opts.filter(x => x.kind === 'transit').length >= 4) break;
    }
  }
  scoreOptions(opts);
  return {opts, status};
}

function scoreOptions(opts){
  const lam = (PRIORITY_K[S.prefs.priority] || 10) / Math.max(rates().fare, 1e-6);
  for (const op of opts){
    let s = op.min + lam * op.cost + (op.transfers || 0) * 3;
    const w = op.walkMin || 0; if (w > 15) s += (w - 15) * (op.kind === 'walk' ? 0.4 : 0.6);
    if (op.kind === 'bike' && op.min > 40) s += (op.min - 40) * 0.5;
    op.score = s;
  }
  // drop transit options another transit option beats on time and transfers
  for (let i = opts.length - 1; i >= 0; i--){
    const a = opts[i]; if (a.kind !== 'transit') continue;
    if (opts.some(b => b !== a && b.kind === 'transit' && b.arrive <= a.arrive && (b.transfers || 0) <= (a.transfers || 0) && (b.walkMin || 0) <= (a.walkMin || 0) + 3 && b.score < a.score - 5)) opts.splice(i, 1);
  }
  opts.sort((a, b) => a.score - b.score);
  if (!opts.length) return;
  opts.forEach(o => o.tags = []);
  opts[0].tags.push('Recommended');
  const usable = opts.filter(x => x.kind !== 'walk' || x.min <= 40);
  const cheapest = (usable.length ? usable : opts).reduce((a, b) => (b.cost < a.cost - 0.001 || (Math.abs(b.cost - a.cost) < 0.001 && b.min < a.min)) ? b : a);
  const fastest = opts.reduce((a, b) => b.arrive < a.arrive ? b : a);
  if (cheapest !== opts[0]) cheapest.tags.push('Cheapest'); else opts[0].tags.push('Cheapest');
  fastest.tags.push('Fastest');
}

function mapsUrl(o, d, mode){
  const p = x => x.lat.toFixed(6) + ',' + x.lng.toFixed(6);
  return `https://www.google.com/maps/dir/?api=1&origin=${p(o)}&destination=${p(d)}&travelmode=${mode}`;
}
