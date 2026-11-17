/* Farewise: spending cycles (start on any day of the month) and trip logging. */
'use strict';
const cycleDayIn = (y, m) => Math.min(Math.max(1, Number(S.prefs.cycleDay) || 1), new Date(y, m + 1, 0).getDate());
function cycleStartFor(iso){ const d = new Date(iso + 'T12:00:00'); let y = d.getFullYear(), m = d.getMonth(); if (d.getDate() < cycleDayIn(y, m)){ m--; if (m < 0){ m = 11; y--; } } return y + '-' + pad2(m + 1) + '-' + pad2(cycleDayIn(y, m)); }
function nextCycleStart(start){ const d = new Date(start + 'T12:00:00'); let y = d.getFullYear(), m = d.getMonth() + 1; if (m > 11){ m = 0; y++; } return y + '-' + pad2(m + 1) + '-' + pad2(cycleDayIn(y, m)); }
function viewCycleStart(){ let s = cycleStartFor(todayISO()); for (let i = 0; i > S.cycleOff; i--) s = cycleStartFor(addDays(s, -1)); for (let i = 0; i < S.cycleOff; i++) s = nextCycleStart(s); return s; }
const cycleLabel = start => { const end = addDays(nextCycleStart(start), -1); return shortDate(start) + ' – ' + shortDate(end) + ' ' + end.slice(0, 4); };

function cycleInfo(start){
  const endX = nextCycleStart(start); const dates = []; for (let d = start; d < endX; d = addDays(d, 1)) dates.push(d);
  const wd = Number(S.prefs.workdays) || 7; const cur = S.prefs.rates.cur;
  const isWork = i => { const w = new Date(dates[i - 1] + 'T12:00:00').getDay(); return wd === 7 || (w !== 0 && (wd === 6 || w !== 6)); };
  const today = todayISO(); const isCur = today >= start && today < endX; const past = today >= endX;
  const tday = isCur ? dates.indexOf(today) + 1 : (past ? dates.length : 0);
  let total = 0, elapsed = 0, remaining = 0;
  for (let d = 1; d <= dates.length; d++){ if (!isWork(d)) continue; total++; if (d <= tday) elapsed++; if ((isCur && d >= tday) || (!isCur && !past)) remaining++; }
  const trips = [], other = [];
  for (const [date, doc] of Object.entries(S.days)) if (date >= start && date < endX) for (const t of (doc.trips || [])) ((t.cur || cur) === cur ? trips : other).push({...t, date});
  const spent = trips.reduce((a, t) => a + (Number(t.cost) || 0), 0);
  const budget = Number(S.prefs.budget) || 0; const left = budget - spent;
  return {start, endX, dates, days:dates.length, isWork, tday, cur:isCur, past, total, elapsed, remaining, trips, other, spent, budget, left,
    perDay: remaining > 0 ? left / remaining : 0, projected: elapsed > 0 && isCur ? spent / elapsed * total : spent, label:cycleLabel(start), currency:cur};
}

let lastUndo = null;
function logTrips(date, list, msg){
  const d = S.days[date] || {trips:[]}; const before = JSON.parse(JSON.stringify(d.trips));
  d.trips = [...d.trips, ...list]; S.days[date] = d; Store.save(); render();
  lastUndo = () => { S.days[date].trips = before; Store.save(); render(); };
  toast(msg, true);
}
const tripFromOption = (o, d, op) => ({id:uid(), t:toHM(op.depart.getHours() * 60 + op.depart.getMinutes()), from:o.name, to:d.name, mode:op.kind, label:op.title, cost:roundNice(op.cost), cur:S.prefs.rates.cur, parts:op.parts});
