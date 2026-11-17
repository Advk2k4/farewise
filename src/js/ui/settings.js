/* Farewise: Settings. Home, prices, travel preferences, budget, data. */
'use strict';
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
let confirmClear = false;
function renderSettings(){
  const P = S.prefs, R = P.rates;
  const seg = (key, vals) => `<div class="seg" role="group">${vals.map(([v, l]) => `<button data-act="pref" data-k="${key}" data-v="${v}" aria-pressed="${String(P[key]) === String(v)}">${l}</button>`).join('')}</div>`;
  const rate = (k, label, step) => `<label class="f" for="rate-${k}">${label}<input class="in" type="number" min="0" step="${step || 'any'}" inputmode="decimal" id="rate-${k}" data-ch="rate" data-k="${k}" value="${R[k]}"></label>`;
  const cc = P.country || FALLBACK_COUNTRY;
  return `<div class="pagehead"><div><h2>Settings</h2><p>Saved in this browser. Use a backup code to copy everything to another device.</p></div></div>
  <div class="stack" style="gap:14px;max-width:780px">
    <div class="card pad stack"><span class="eyebrow">Home</span>${placeField('home', 'Your home (used as the default start for day plans)', P.home, 'Search your address')}
      ${P.home ? '<div><button class="btn sm ghost" data-act="home-clear">Remove home</button></div>' : ''}</div>
    <div class="card pad stack"><span class="eyebrow">Prices</span>
      <label class="f" for="pref-country">Country for default prices<select class="in" id="pref-country" data-ch="country">${Object.entries(COUNTRIES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, c]) => `<option value="${k}" ${k === cc ? 'selected' : ''}>${esc(c.name)} (${c.cur})</option>`).join('')}</select></label>
      <div class="rates">${rate('taxiBase', `Taxi flag fall (${R.cur})`)}${rate('taxiKm', `Taxi per km (${R.cur})`)}${rate('taxiMin', `Taxi per minute (${R.cur})`)}${rate('fare', `Transit fare per ride (${R.cur})`)}${rate('fuel', `Fuel per litre (${R.cur})`)}${rate('lper100', 'Car uses (L/100 km)')}</div>
      <div class="row"><button class="btn sm" data-act="rates-reset">Reset to ${esc(countryName(cc))} defaults</button><span class="small faint">Defaults are rough big-city figures. Set your own for better estimates.</span></div></div>
    <div class="card pad stack"><span class="eyebrow">What matters most</span>${seg('priority', [['money','Save money'],['balanced','Balanced'],['time','Save time']])}
      <p class="small muted" style="margin:0">Balanced treats one transit fare as worth about 10 minutes. Save money leans towards transit and walking; save time leans towards taxis.</p></div>
    <div class="card pad stack"><span class="eyebrow">How you get around</span>
      <div class="row">${seg('hasCar', [['false','No car'],['true','I have a car']])}${seg('hasBike', [['false','No bike'],['true','I have a bike']])}</div>
      ${P.hasCar ? `<label class="f" for="pref-park" style="max-width:240px">Minutes to park, on average<input class="in" type="number" min="0" step="1" id="pref-park" data-ch="pref-num" data-k="parkMin" value="${P.parkMin}"></label>` : ''}</div>
    <div class="card pad stack"><span class="eyebrow">Spending</span>
      <div class="two"><label class="f" for="pref-budget">Budget per cycle (${R.cur}, 0 for none)<input class="in" type="number" min="0" step="any" id="pref-budget" data-ch="pref-num" data-k="budget" value="${P.budget}"></label>
        <label class="f" for="pref-cycle">Cycle starts on day<input class="in" type="number" min="1" max="28" step="1" id="pref-cycle" data-ch="pref-cycle" value="${P.cycleDay}"></label></div>
      <p class="small muted" style="margin:0">Current cycle: ${esc(cycleLabel(cycleStartFor(todayISO())))}. It resets on the ${ordinal(Number(P.cycleDay) || 1)} of each month.</p>
      <span class="eyebrow" style="margin-top:4px">Days that count towards "per day"</span>${seg('workdays', [['7','Every day'],['6','Mon–Sat'],['5','Mon–Fri']])}
      <label class="f" for="pref-visit" style="max-width:240px">Default time at each stop<select class="in" id="pref-visit" data-ch="pref-num" data-k="visit">${[10,15,20,30,45,60,90].map(v => `<option value="${v}" ${v === Number(P.visit) ? 'selected' : ''}>${v} min</option>`).join('')}</select></label></div>
    <div class="card pad stack"><span class="eyebrow">Your data</span>
      <p class="small muted" style="margin:0">Everything stays in this browser; nothing is sent anywhere except the place names and coordinates needed to look up routes. To use Farewise on another device, copy a backup code here and paste it there.</p>
      <div class="row"><button class="btn sm" data-act="backup-copy">Copy backup code</button></div>
      <textarea class="in" id="backup-out" rows="3" readonly hidden style="font-family:var(--f-mono);font-size:12px"></textarea>
      <label class="f" for="backup-in">Paste a backup code<textarea class="in" id="backup-in" rows="3" style="font-family:var(--f-mono);font-size:12px" placeholder="FW1.…"></textarea></label>
      <div class="row"><button class="btn sm primary" data-act="backup-restore">Add to this browser</button>
        <button class="btn sm ${confirmClear ? 'danger' : 'ghost'}" data-act="clear-all">${confirmClear ? 'Tap again to delete everything' : 'Delete all data'}</button></div></div>
    <details class="card pad details" style="margin:0"><summary>How the estimates work</summary><ul>
      <li><b>Transit</b> comes from <a href="https://transitous.org" target="_blank" rel="noopener">Transitous</a>, built on published timetables. Times are real schedules (live where the operator shares it). Some regions have no open transit data yet.</li>
      <li><b>Walking, cycling and driving</b> routes come from OpenStreetMap routing servers run by FOSSGIS. Driving time adds typical traffic: up to +45% in weekday rush hours (7–10, 16–19).</li>
      <li><b>Prices</b> are estimates from the rates above. Taxi = flag fall + per km + per minute. Transit = one fare per ride, counting at most two. Driving = fuel only.</li>
      <li><b>Recommended</b> balances time against cost according to <i>What matters most</i>, with small penalties for long walks and changes.</li></ul></details>
  </div>`;
}
