/* Farewise: Day planner. Several stops with times; each leg gets the best way to travel. */
'use strict';
function examplePlan(date){
  const P = (name, area, lat, lng) => ({name, area, lat, lng, cc:'GB'});
  return {date, start:P("King's Cross", 'London, United Kingdom', 51.5308, -0.1238), startTime:'09:15', ret:true, example:true, choice:{}, stops:[
    {place:P('British Museum', 'Bloomsbury, London', 51.5194, -0.1270), meet:'10:00', visit:60},
    {place:P('Tate Modern', 'Bankside, London', 51.5076, -0.0994), meet:'14:00', visit:60},
    {place:P('Borough Market', 'Southwark, London', 51.5055, -0.0910), meet:'', visit:45}]};
}
function blankPlan(date){ return {date, start:null, startTime:'09:00', ret:true, stops:[], choice:{}}; }
function loadPlan(date){ S.plan = S.plans[date] ? JSON.parse(JSON.stringify(S.plans[date])) : blankPlan(date); S.planKey = ''; S.planRes = null; }
function touchPlan(){ delete S.plan.example; S.plans[S.plan.date] = JSON.parse(JSON.stringify(S.plan)); saveSoon(); }
const planStart = () => S.plan.start || S.prefs.home;

async function computePlan(plan){
  const start = plan.start || S.prefs.home; if (!start) return {needStart:true};
  let cur = start, t = atLocal(plan.date, plan.startTime); const legs = [], stops = [];
  const legFor = async (from, to, key) => {
    const r = await tripOptions(from, to, t, false);
    const chosen = r.opts.find(x => x.key === plan.choice[key]) || r.opts[0] || null;
    return {key, from, to, opts:r.opts, status:r.status, chosen, dep:t};
  };
  for (let i = 0; i < plan.stops.length; i++){
    const st = plan.stops[i]; const leg = await legFor(cur, st.place, i); legs.push(leg);
    const arr = leg.chosen ? leg.chosen.arrive : t; const meet = st.meet ? atLocal(plan.date, st.meet) : null;
    let status = null; if (meet) status = arr <= addMin(meet, -5) ? 'ok' : arr <= meet ? 'tight' : 'late';
    const begin = meet && meet > arr ? meet : arr; const visit = Number(st.visit) || Number(S.prefs.visit) || 30;
    t = addMin(begin, visit);
    stops.push({i, st, leg, arr, meet, status, begin, end:t, visit});
    cur = st.place;
  }
  let back = null;
  if (plan.ret && plan.stops.length){ back = await legFor(cur, start, 'ret'); legs.push(back); if (back.chosen) t = back.chosen.arrive; }
  const cost = legs.reduce((a, l) => a + (l.chosen ? l.chosen.cost : 0), 0);
  const travel = legs.reduce((a, l) => a + (l.chosen ? l.chosen.min : 0), 0);
  return {start, legs, stops, back, cost, travel, end:t};
}
function ensurePlan(){
  const key = JSON.stringify([S.plan, S.prefs.home && [S.prefs.home.lat, S.prefs.home.lng], prefsSig()]);
  if (key === S.planKey) return; S.planKey = key; S.planLoading = true;
  computePlan(JSON.parse(JSON.stringify(S.plan))).then(r => { if (S.planKey !== key) return; S.planRes = r; S.planLoading = false; render(); })
    .catch(() => { if (S.planKey !== key) return; S.planLoading = false; S.planRes = {error:true}; render(); });
}
function bestOrder(){
  const P = S.plan; const start = planStart(); if (!start) return;
  const timed = P.stops.filter(s => toMin(s.meet) != null).sort((a, b) => toMin(a.meet) - toMin(b.meet));
  const free = P.stops.filter(s => toMin(s.meet) == null).sort((a, b) => hav(start, b.place) - hav(start, a.place));
  const seq = [...timed];
  for (const f of free){
    let bi = 0, bc = Infinity;
    for (let i = 0; i <= seq.length; i++){
      const prev = i === 0 ? start : seq[i - 1].place; const next = i === seq.length ? (P.ret ? start : null) : seq[i].place;
      const c = hav(prev, f.place) + (next ? hav(f.place, next) - hav(prev, next) : 0);
      if (c < bc){ bc = c; bi = i; }
    }
    seq.splice(bi, 0, f);
  }
  P.stops = seq; P.choice = {};
}
function legBlock(leg){
  const k = String(leg.key); const open = S.ui.openLeg === k; const c = leg.chosen;
  if (!c) return `<div class="leg"><div class="rail"></div><div class="lbody"><span class="pill bad">No route found</span> <a class="btn sm ghost" href="${mapsUrl(leg.from, leg.to, 'transit')}" target="_blank" rel="noopener">Google Maps ↗</a></div></div>`;
  return `<div class="leg"><div class="rail"></div><div class="lbody">
    <div class="legline">${strip(c)}<span class="t">${fmtMin(c.min)}</span><span class="mono faint">${costText(c)}</span>${tagPills(c)}
      <button class="btn sm ghost" data-act="leg-open" data-leg="${k}" aria-expanded="${open}">${open ? 'Close' : 'Change · ' + leg.opts.length + ' options'}</button></div>
    ${open ? `<div class="opts" style="margin-top:10px">${leg.opts.map(op => optCard(op, {selected: op.key === c.key, open: op.key === c.key, act:'leg-pick', data:`data-leg="${k}"`, o:leg.from, d:leg.to})).join('')}</div>` : ''}
  </div></div>`;
}
function renderPlan(){
  if (!S.plan || S.plan.date === undefined) loadPlan(todayISO());
  const P = S.plan; const start = planStart();
  if (start && P.stops.length) ensurePlan();
  const R = S.planRes && !S.planRes.needStart && !S.planRes.error ? S.planRes : null;
  const side = `<div class="card pad formgrid">
    <div class="two"><label class="f" for="plan-date">Date<input class="in" type="date" id="plan-date" data-ch="plan-date" value="${esc(P.date)}"></label>
      <label class="f" for="plan-time">Start at<input class="in" type="time" id="plan-time" data-ch="plan-time" value="${esc(P.startTime)}"></label></div>
    ${placeField('pstart', 'Start from', P.start || (S.prefs.home ? {...S.prefs.home, name:'Home', area:S.prefs.home.name} : null), S.prefs.home ? 'Home' : 'Where does your day start?')}
    <label class="row small" style="gap:8px;font-weight:600"><input type="checkbox" id="plan-ret" data-ch="plan-ret" ${P.ret ? 'checked' : ''}> Return to the start at the end</label>
    ${placeField('padd', 'Add a stop', null, 'Search a place to visit')}
    <div class="row"><button class="btn" data-act="plan-order" ${P.stops.length < 2 || !start ? 'disabled' : ''}>Best visit order</button><button class="btn ghost" data-act="plan-clear" ${!P.stops.length ? 'disabled' : ''}>Clear</button></div>
    <p class="small faint" style="margin:0">Stops with a set time stay in time order. <b>Best visit order</b> slots the rest in where they add the least travel.</p>
  </div>`;
  let body;
  if (!start) body = `<div class="card pad empty-state"><h3>Where does your day start?</h3><p class="muted">Choose a start place on the left, or save your home in Settings so every plan starts there.</p><button class="btn" data-act="plan-example">See an example day in London</button></div>`;
  else if (!P.stops.length) body = `<div class="card pad empty-state"><h3>Add the places you need to be</h3><p class="muted">Add stops, set a time for anything fixed (a meeting, a booking, a class), and Farewise works out how to get between them and whether you'll make it.</p><button class="btn" data-act="plan-example">See an example day in London</button></div>`;
  else if (!R) body = `<div class="card pad empty-state">${S.planRes && S.planRes.error ? '<p>Could not reach the routing services.</p><button class="btn" data-act="plan-retry">Try again</button>' : `<div class="spinner" aria-hidden="true"></div><p class="muted">Working out ${P.stops.length + (P.ret ? 1 : 0)} legs…</p>`}</div>`;
  else {
    const cur = S.prefs.rates.cur;
    let tl = `<div class="stop home"><div class="clock">${timeOf(atLocal(P.date, P.startTime))}</div><div class="body"><div class="stop-name">Start: ${esc(P.start ? P.start.name : 'Home')}</div><div class="stop-meta">${esc(start.area || start.name || '')}</div></div></div>`;
    for (const s of R.stops){
      tl += legBlock(s.leg);
      const st = s.status === 'ok' ? `<span class="pill good">On time · ${Math.round((s.meet - s.arr) / 60000)} min spare</span>` : s.status === 'tight' ? `<span class="pill warn">Tight · ${Math.round((s.meet - s.arr) / 60000)} min spare</span>` : s.status === 'late' ? `<span class="pill bad">Late by ${Math.round((s.arr - s.meet) / 60000)} min</span>` : '';
      let tip = '';
      if (s.status === 'late' && s.leg.opts.length){
        const fast = s.leg.opts.reduce((a, b) => b.arrive < a.arrive ? b : a);
        tip = fast.key !== s.leg.chosen.key && fast.arrive <= s.meet ? `<div class="small muted" style="margin-top:6px">${esc(fast.title)} gets you there by ${timeOf(fast.arrive)}. <button class="btn sm" data-act="leg-pick" data-leg="${s.i}" data-key="${esc(fast.key)}">Switch</button></div>` : `<div class="small muted" style="margin-top:6px">Start earlier, or move this to ${timeOf(addMin(s.arr, 5))}.</div>`;
      }
      tl += `<div class="stop"><div class="clock">${timeOf(s.arr)}</div><div class="body">
        <div class="row" style="justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><div class="stop-name">${esc(s.st.place.name)}</div>
        <div class="stop-meta"><span>${esc(s.st.place.area || '')}</span>${s.meet ? `<span>At ${timeOf(s.meet)}</span>` : ''}<span>Leave ~${timeOf(s.end)}</span></div></div>${st}</div>${tip}
        <div class="stopctl">
          <label class="f" for="meet-${s.i}">Fixed time<input class="in" type="time" id="meet-${s.i}" data-ch="stop-meet" data-i="${s.i}" value="${esc(s.st.meet || '')}"></label>
          <label class="f" for="visit-${s.i}">Time there<select class="in" id="visit-${s.i}" data-ch="stop-visit" data-i="${s.i}">${[10,15,20,30,45,60,90,120,180].map(v => `<option value="${v}" ${v === s.visit ? 'selected' : ''}>${v < 60 ? v + ' min' : (v / 60) + ' h'}</option>`).join('')}</select></label>
          <div class="row" style="gap:4px;margin-left:auto"><button class="btn sm ghost" data-act="stop-up" data-i="${s.i}" aria-label="Move up" ${s.i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm ghost" data-act="stop-down" data-i="${s.i}" aria-label="Move down" ${s.i === P.stops.length - 1 ? 'disabled' : ''}>↓</button><button class="btn sm ghost" data-act="stop-rm" data-i="${s.i}">Remove</button></div>
        </div></div></div>`;
    }
    if (R.back){ tl += legBlock(R.back) + `<div class="stop home"><div class="clock">${timeOf(R.end)}</div><div class="body"><div class="stop-name">Back at ${esc(P.start ? P.start.name : 'Home')}</div></div></div>`; }
    const mi = S.prefs.budget ? cycleInfo(cycleStartFor(P.date)) : null;
    const allow = mi && mi.remaining ? mi.left / mi.remaining : null;
    body = `<div class="stack" style="gap:14px">
      <div class="totals"><div><span>Travel</span><b>${fmtMin(R.travel)}</b></div><div><span>Est. cost</span><b>${money(R.cost, cur)}</b></div><div><span>Done by</span><b>${timeOf(R.end)}</b></div></div>
      ${allow != null ? `<div class="row">${R.cost <= allow ? '<span class="pill good">Within your daily budget</span>' : `<span class="pill warn">${money(R.cost - Math.max(0, allow), cur)} over your daily budget</span>`}<span class="small faint">About ${money(Math.max(0, allow), cur)} a day left this cycle</span></div>` : ''}
      ${S.planLoading ? '<p class="small faint" style="margin:0">Updating…</p>' : ''}
      <div class="timeline">${tl}</div>
      <div class="card pad row" style="justify-content:space-between"><span class="small muted">Did this plan? Log every leg to Spending in one tap; you can edit amounts later.</span><button class="btn primary" data-act="plan-log">Log ${R.legs.filter(l => l.chosen).length} trips · ${money(R.cost, cur)}</button></div>
    </div>`;
  }
  const exampleNote = P.example ? `<div class="banner info"><span><b>Example day.</b> Edit it to make it yours, or clear it.</span></div>` : '';
  return `${exampleNote}<div class="pagehead"><div><h2>Day plan · ${prettyDate(P.date)}</h2><p>Line up your stops. Each leg gets the best way to travel, and you can change any of them.</p></div></div>
    <div class="split"><div class="side stack" style="gap:14px">${side}<div class="map-slot short" id="map-slot"></div></div><div>${body}</div></div>`;
}
function drawPlanMap(){
  const P = S.plan; const start = planStart(); const pts = [];
  if (start) pts.push({...start, label:P.start ? P.start.name : 'Home', kind:'from'});
  P.stops.forEach((s, i) => pts.push({...s.place, label:(i + 1) + '. ' + s.place.name, kind:'stop'}));
  const lines = []; const R = S.planRes;
  if (R && R.legs) for (const l of R.legs) if (l.chosen) lines.push(...l.chosen.lines);
  MapView.draw(pts, lines);
}
