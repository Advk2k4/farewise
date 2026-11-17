/* Farewise: Spending view. Logged trips against an optional budget, per cycle. */
'use strict';
const SPEND_MODES = ['taxi','car','transit','bike','walk','other'];
const SPEND_COLOR = {taxi:'var(--m-taxi)', car:'var(--m-car)', transit:'var(--m-metro)', bike:'var(--m-bike)', walk:'var(--m-walk)', other:'var(--ink-3)'};
const SPEND_NAME = {taxi:'Taxi', car:'Driving', transit:'Transit', bike:'Bike', walk:'Walk', other:'Other'};
const spendCat = m => SPEND_NAME[m] ? m : 'other';

function spendChart(mi){
  const W = 640, H = 210, L = 56, Rr = 14, T = 14, B = 28;
  const byDay = new Array(mi.days + 1).fill(0); for (const t of mi.trips) byDay[mi.dates.indexOf(t.date) + 1] += Number(t.cost) || 0;
  const cum = []; let c = 0; const last = mi.cur ? mi.tday : mi.days; for (let d = 1; d <= mi.days; d++){ c += byDay[d]; cum[d] = c; }
  const ymax = Math.max(mi.budget || 0, c, mi.projected, 1) * 1.1;
  const x = d => L + (d - 1) / Math.max(1, mi.days - 1) * (W - L - Rr), y = v => T + (1 - v / ymax) * (H - T - B);
  const ticks = 4; let g = '';
  for (let k = 0; k <= ticks; k++){ const v = ymax / ticks * k; g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-2)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)" font-family="IBM Plex Mono,monospace">${esc(money(v, mi.currency))}</text>`; }
  for (const d of [1, Math.ceil(mi.days / 2), mi.days]) g += `<text x="${x(d)}" y="${H - 8}" text-anchor="${d === 1 ? 'start' : d === mi.days ? 'end' : 'middle'}" font-size="11" fill="var(--ink-3)" font-family="IBM Plex Mono,monospace">${shortDate(mi.dates[d - 1])}</text>`;
  if (mi.budget){
    let wd = 0; const ideal = []; for (let d = 1; d <= mi.days; d++){ if (mi.isWork(d)) wd++; ideal.push(`${x(d).toFixed(1)},${y(mi.budget * wd / Math.max(1, mi.total)).toFixed(1)}`); }
    g += `<polyline points="${ideal.join(' ')}" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="4 4"/>`;
    g += `<line x1="${L}" x2="${W - Rr}" y1="${y(mi.budget)}" y2="${y(mi.budget)}" stroke="var(--warn)"/><text x="${W - Rr}" y="${y(mi.budget) - 5}" text-anchor="end" font-size="11" fill="var(--warn)" font-weight="600">Budget ${esc(money(mi.budget, mi.currency))}</text>`;
  }
  if (last >= 1){
    const pts = []; for (let d = 1; d <= last; d++) pts.push(`${x(d).toFixed(1)},${y(cum[d]).toFixed(1)}`);
    g += `<polygon points="${x(1)},${y(0)} ${pts.join(' ')} ${x(last)},${y(0)}" fill="var(--accent)" opacity=".12"/><polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>`;
    g += `<circle cx="${x(last)}" cy="${y(cum[last])}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
    const lx = x(last), anc = lx > W - 120 ? 'end' : 'start';
    g += `<text x="${lx + (anc === 'end' ? -8 : 8)}" y="${y(cum[last]) - 8}" text-anchor="${anc}" font-size="12" font-weight="700" fill="var(--ink)" font-family="IBM Plex Mono,monospace">${esc(money(cum[last], mi.currency))}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative spending this cycle${mi.budget ? ' against budget pace' : ''}">${g}</svg>`;
}
function renderSpending(){
  const mi = cycleInfo(viewCycleStart()); const cur = mi.currency;
  const parts = {}; for (const t of mi.trips){ const p = t.parts && Object.keys(t.parts).length ? t.parts : {[spendCat(t.mode)]: Number(t.cost) || 0}; for (const [k, v] of Object.entries(p)) parts[spendCat(k)] = (parts[spendCat(k)] || 0) + v; }
  const ptot = Object.values(parts).reduce((a, b) => a + b, 0); const order = SPEND_MODES.filter(k => parts[k] > 0);
  const byDate = {}; for (const t of mi.trips.concat(mi.other)) (byDate[t.date] = byDate[t.date] || []).push(t);
  const dates = Object.keys(byDate).sort().reverse();
  const over = mi.budget && mi.projected > mi.budget;
  let advice = '';
  if (!mi.budget) advice = `<div class="banner info"><span>Set a budget to see how much you can spend per day and whether you're on pace.</span><button class="btn sm" data-act="tab" data-tab="settings">Set a budget</button></div>`;
  else if (mi.cur && mi.trips.length) advice = over ? `<div class="banner warn"><span>At this pace the cycle ends near <b>${money(mi.projected, cur)}</b>, about ${money(mi.projected - mi.budget, cur)} over budget.${(parts.taxi || 0) / (ptot || 1) > 0.35 ? ' Taxis are ' + Math.round(parts.taxi / ptot * 100) + '% of spending; swapping a few for transit closes most of the gap.' : ''}</span></div>` : `<div class="banner info"><span>On track: this cycle should end near <b>${money(mi.projected, cur)}</b>, under your ${money(mi.budget, cur)} budget.</span></div>`;
  return `<div class="pagehead"><div><h2>Spending</h2><p>Trips you log from Trip or Day plan land here. Edit any amount to what you actually paid.</p></div>
    <div class="row"><button class="btn sm" data-act="cycle" data-d="-1" aria-label="Previous cycle">‹</button><b>${esc(mi.label)}</b><button class="btn sm" data-act="cycle" data-d="1" aria-label="Next cycle" ${S.cycleOff >= 0 ? 'disabled' : ''}>›</button></div></div>
  <div class="stack" style="gap:16px">
    <div class="kpis">
      <div class="kpi"><span>Spent</span><b>${money(mi.spent, cur)}</b><small>${mi.trips.length} trip${mi.trips.length === 1 ? '' : 's'}</small></div>
      <div class="kpi"><span>Left</span><b style="color:${mi.budget && mi.left < 0 ? 'var(--bad)' : 'inherit'}">${mi.budget ? money(mi.left, cur) : '–'}</b><small>${mi.budget ? 'of ' + money(mi.budget, cur) : 'no budget set'}</small></div>
      <div class="kpi"><span>Per day</span><b>${mi.budget && !mi.past ? money(Math.max(0, mi.perDay), cur) : '–'}</b><small>${mi.cur ? mi.remaining + ' day' + (mi.remaining === 1 ? '' : 's') + ' left' : mi.past ? 'cycle closed' : 'upcoming'}</small></div>
      <div class="kpi"><span>Cycle-end pace</span><b style="color:${over ? 'var(--warn)' : 'inherit'}">${mi.cur && mi.elapsed ? money(mi.projected, cur) : '–'}</b><small>if you keep this up</small></div>
    </div>
    ${advice}
    <div class="card pad"><div class="sectionhead"><h2 style="font-size:18px">Spending so far${mi.budget ? ' vs. budget pace' : ''}</h2></div><div class="chartwrap">${spendChart(mi)}</div></div>
    ${ptot ? `<div class="card pad"><div class="sectionhead"><h2 style="font-size:18px">Where it went</h2></div>
      <div class="stack-bar">${order.map(k => `<i style="width:${(parts[k] / ptot * 100).toFixed(2)}%;background:${SPEND_COLOR[k]}" title="${SPEND_NAME[k]} ${esc(money(parts[k], cur))}"></i>`).join('')}</div>
      <div class="legend">${order.map(k => `<span><i style="background:${SPEND_COLOR[k]}"></i>${SPEND_NAME[k]} <b class="num">${money(parts[k], cur)}</b></span>`).join('')}</div></div>` : ''}
    <div class="card pad"><div class="sectionhead"><h2 style="font-size:18px">Logged trips</h2><button class="btn sm" data-act="add-exp">+ Add expense</button></div>
      ${dates.length ? `<div class="trips">${dates.map(dt => `<div class="tday"><div class="tday-h"><span>${prettyDate(dt)}</span><span class="num">${money(byDate[dt].filter(t => (t.cur || cur) === cur).reduce((a, t) => a + (Number(t.cost) || 0), 0), cur)}</span></div>
        ${byDate[dt].map(t => { const m = spendCat(t.mode); const tc = t.cur || cur; return `<div class="trip"><span class="mode" style="background:${SPEND_COLOR[m]};color:${m === 'taxi' ? 'var(--m-taxi-ink)' : '#fff'}">${SPEND_NAME[m]}</span>
          <span class="what">${t.t ? `<span class="mono faint">${timeOf(atLocal(dt, t.t))}</span> ` : ''}${esc(t.from ? t.from + ' → ' + t.to : (t.note || t.label || ''))}${tc !== cur ? ` <span class="pill">${esc(tc)}, not counted</span>` : ''}</span>
          <input class="in" type="number" min="0" step="any" inputmode="decimal" id="amt-${esc(t.id)}" data-ch="trip-amt" data-date="${dt}" data-id="${esc(t.id)}" value="${Number(t.cost) || 0}" aria-label="Amount paid in ${esc(tc)}">
          <button class="btn sm ghost" data-act="trip-rm" data-date="${dt}" data-id="${esc(t.id)}" aria-label="Delete trip">✕</button></div>`; }).join('')}</div>`).join('')}</div>`
      : `<div class="empty">Nothing logged for ${esc(mi.label)} yet. Use <b>I took this</b> on a trip, <b>Log trips</b> on a day plan, or add an expense by hand.</div>`}
    </div></div>`;
}
