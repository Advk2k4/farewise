import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ChevronDown, Circle, Clock3, MapPin, Plus, RotateCw, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlaceInput } from '@/components/PlaceInput'
import { OptionCard, RouteStrip, Tags, costText } from '@/components/OptionCard'
import { FeedbackButton } from '@/components/FeedbackButton'
import { RouteMap, type MapPoint } from '@/components/RouteMap'
import { clearNetCache, type Place } from '@/lib/api'
import { tripOptions, type Option, type RoutingPrefs } from '@/lib/options'
import { addMin, atLocal, fmtMin, hav, money, prettyDate, roundNice, timeOf, toHM, toMin, todayISO, uid } from '@/lib/format'
import { addTrips, autoCountry, homeCurrency, planFor, ratesFor, savePlan, tripCountry, useData, type Plan } from '@/lib/store'
import { cycleInfo, cycleStartFor } from '@/lib/budget'
import { routingPrefs } from './TripView'
import { cn } from '@/lib/utils'

type Leg = { key: string; from: Place; to: Place; opts: Option[]; chosen: Option | null; dep: Date }
type StopRes = { i: number; arr: Date; meet: Date | null; status: 'ok' | 'tight' | 'late' | null; end: Date; visit: number; leg: Leg }
type PlanRes = { legs: Leg[]; stops: StopRes[]; back: Leg | null; cost: number; travel: number; end: Date }

export function examplePlan(date: string): Plan {
  const P = (name: string, area: string, lat: number, lng: number): Place => ({ name, area, lat, lng, cc: 'GB' })
  return {
    date, start: P("King's Cross", 'London, United Kingdom', 51.5308, -0.1238), startTime: '09:15', ret: true, example: true, choice: {},
    stops: [
      { place: P('British Museum', 'Bloomsbury, London', 51.5194, -0.127), meet: '10:00', visit: 60 },
      { place: P('Tate Modern', 'Bankside, London', 51.5076, -0.0994), meet: '14:00', visit: 60 },
      { place: P('Borough Market', 'Southwark, London', 51.5055, -0.091), meet: '', visit: 45 },
    ],
  }
}

async function computePlan(plan: Plan, start: Place, rp: RoutingPrefs, defaultVisit: number): Promise<PlanRes> {
  let cur = start, t = atLocal(plan.date, plan.startTime)
  const legs: Leg[] = [], stops: StopRes[] = []
  const legFor = async (from: Place, to: Place, key: string): Promise<Leg> => {
    const r = await tripOptions(from, to, t, false, rp)
    return { key, from, to, opts: r.opts, chosen: r.opts.find(x => x.key === plan.choice[key]) ?? r.opts[0] ?? null, dep: t }
  }
  for (let i = 0; i < plan.stops.length; i++) {
    const st = plan.stops[i]
    const leg = await legFor(cur, st.place, String(i)); legs.push(leg)
    const arr = leg.chosen ? leg.chosen.arrive : t
    const meet = st.meet ? atLocal(plan.date, st.meet) : null
    const status = meet ? (arr <= addMin(meet, -5) ? 'ok' : arr <= meet ? 'tight' : 'late') : null
    const visit = st.visit ?? defaultVisit
    t = addMin(meet && meet > arr ? meet : arr, visit)
    stops.push({ i, arr, meet, status, end: t, visit, leg })
    cur = st.place
  }
  let back: Leg | null = null
  if (plan.ret && plan.stops.length) { back = await legFor(cur, start, 'ret'); legs.push(back); if (back.chosen) t = back.chosen.arrive }
  return { legs, stops, back, end: t, cost: legs.reduce((a, l) => a + (l.chosen?.cost ?? 0), 0), travel: legs.reduce((a, l) => a + (l.chosen?.min ?? 0), 0) }
}

function bestOrder(plan: Plan, start: Place): Plan {
  const timed = plan.stops.filter(s => toMin(s.meet) != null).sort((a, b) => toMin(a.meet)! - toMin(b.meet)!)
  const free = plan.stops.filter(s => toMin(s.meet) == null).sort((a, b) => hav(start, b.place) - hav(start, a.place))
  const seq = [...timed]
  for (const f of free) {
    let bi = 0, bc = Infinity
    for (let i = 0; i <= seq.length; i++) {
      const prev = i === 0 ? start : seq[i - 1].place, next = i === seq.length ? (plan.ret ? start : null) : seq[i].place
      const c = hav(prev, f.place) + (next ? hav(f.place, next) - hav(prev, next) : 0)
      if (c < bc) { bc = c; bi = i }
    }
    seq.splice(bi, 0, f)
  }
  return { ...plan, stops: seq, choice: {} }
}

const STATUS = {
  ok: (m: number) => <span className="inline-flex h-7 items-center rounded-full bg-ok-soft px-3 text-xs font-semibold text-ok">On time · {m} min spare</span>,
  tight: (m: number) => <span className="inline-flex h-7 items-center rounded-full bg-warn-soft px-3 text-xs font-semibold text-warn">Tight · {m} min spare</span>,
  late: (m: number) => <span className="inline-flex h-7 items-center rounded-full bg-bad-soft px-3 text-xs font-semibold text-bad">Late by {m} min</span>,
}
const spring = { type: 'spring', stiffness: 520, damping: 40 } as const
const stopKey = (p: Place) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)},${p.name}`

/** The travel between two stops: a quiet card on the timeline's rail, expandable to every option. */
function LegRow({ leg, cur, open, onToggle, onPick }: { leg: Leg; cur: string; open: boolean; onToggle: () => void; onPick: (k: string) => void }) {
  const c = leg.chosen
  return (
    <div className="grid gap-4 sm:grid-cols-[72px_1fr]">
      <div className="relative hidden sm:block" aria-hidden="true"><span className="absolute inset-y-0 right-[-17px] border-r-2 border-dotted border-border" /></div>
      <div className="py-2 pl-4 sm:py-3 sm:pl-0 border-l-2 border-dotted border-border sm:border-0">
        {!c ? <p className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">No route found for this leg.</p> : (
          <div className="rounded-2xl bg-secondary/70 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{c.title}</div>
                <div className="mt-0.5 text-sm text-muted-foreground tabular">{fmtMin(c.min)} · {costText(c, cur)} · {timeOf(c.depart)} → {timeOf(c.arrive)}</div>
              </div>
              <Button variant="outline" size="sm" onClick={onToggle} aria-expanded={open} className="shrink-0 bg-card">
                {open ? 'Done' : `${leg.opts.length} options`}
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring} className="grid place-items-center"><ChevronDown /></motion.span>
              </Button>
            </div>
            <RouteStrip op={c} className="mt-3" />
            {c.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5"><Tags op={c} /></div>}
          </div>
        )}
        <AnimatePresence initial={false}>
          {open && c && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
              <div className="flex flex-col gap-2 pt-3">
                {leg.opts.map(op => <OptionCard key={op.key} op={op} cur={cur} from={leg.from} to={leg.to} selected={op.key === c.key} open={op.key === c.key} onSelect={() => onPick(op.key)} />)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function PlanView() {
  const data = useData()
  const P = data.prefs
  const [plan, setPlanState] = useState<Plan>(() => new URLSearchParams(location.search).get('example') === 'plan' ? examplePlan(todayISO()) : planFor(todayISO()))
  const [res, setRes] = useState<PlanRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [openLeg, setOpenLeg] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [fresh, setFresh] = useState<string | null>(null)   // stop that was just added, briefly highlighted
  const freshT = useRef<ReturnType<typeof setTimeout>>(undefined)
  const start = plan.start ?? P.home
  // the plan is priced in the country where it starts
  const cc = tripCountry(P, start, plan.stops[0]?.place)
  const cur = ratesFor(P, cc).cur

  const setPlan = (p: Plan) => { setPlanState(p); savePlan(p) }
  useEffect(() => { if (plan.example) autoCountry(plan.start) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const rp = routingPrefs(P, cc)
  const key = start && plan.stops.length ? JSON.stringify([plan.date, plan.startTime, plan.ret, plan.stops, plan.choice, start.lat, start.lng, rp, P.visit, nonce]) : ''
  useEffect(() => {
    if (!key || !start) { setRes(null); return }
    let live = true
    setLoading(true); setError(false)
    computePlan(plan, start, rp, P.visit).then(r => { if (live) setRes(r) }).catch(() => { if (live) setError(true) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateStop = (i: number, patch: Partial<Plan['stops'][number]>) => setPlan({ ...plan, choice: {}, stops: plan.stops.map((s, j) => j === i ? { ...s, ...patch } : s) })
  const move = (i: number, d: number) => { const s = [...plan.stops]; [s[i], s[i + d]] = [s[i + d], s[i]]; setPlan({ ...plan, stops: s, choice: {} }) }
  const addStop = (p: Place) => {
    autoCountry(p)
    if (plan.stops.some(s => stopKey(s.place) === stopKey(p))) { toast(`${p.name} is already in the plan`); return }
    setPlan({ ...plan, stops: [...plan.stops, { place: p, meet: '', visit: null }], choice: {} })
    setFresh(stopKey(p)); clearTimeout(freshT.current); freshT.current = setTimeout(() => setFresh(null), 1800)
    toast(`Added ${p.name}`, { description: `Stop ${plan.stops.length + 1} of your day` })
  }
  const mi = P.budget ? cycleInfo(data, cycleStartFor(plan.date, P.cycleDay)) : null
  const allowance = mi && mi.remaining && cur === homeCurrency(P) ? mi.left / mi.remaining : null

  const logDay = () => {
    if (!res) return
    const trips = res.legs.filter(l => l.chosen).map(l => ({ id: uid(), t: toHM(l.chosen!.depart), from: l.from.name, to: l.to.name, mode: l.chosen!.kind, label: l.chosen!.title, cost: roundNice(l.chosen!.cost), cur, parts: l.chosen!.parts }))
    const undo = addTrips(plan.date, trips)
    toast(`Logged ${trips.length} trips · ${money(res.cost, cur)}`, { action: { label: 'Undo', onClick: undo } })
  }
  const points: MapPoint[] = [
    ...(start ? [{ ...start, label: plan.start ? plan.start.name : 'Home', kind: 'from' as const }] : []),
    ...plan.stops.map((s, i) => ({ ...s.place, label: `${i + 1}. ${s.place.name}`, kind: 'stop' as const, n: i + 1 })),
  ]
  const lines = res ? res.legs.flatMap(l => l.chosen?.lines ?? []) : []

  const setup = (
    <section aria-label="Plan settings" className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5"><Label htmlFor="plan-date">Date</Label>
          <Input id="plan-date" type="date" value={plan.date} onChange={e => { if (e.target.value) { setPlanState(planFor(e.target.value)); setOpenLeg(null) } }} /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="plan-time">Start at</Label>
          <Input id="plan-time" type="time" value={plan.startTime} onChange={e => e.target.value && setPlan({ ...plan, startTime: e.target.value, choice: {} })} /></div>
      </div>
      <PlaceInput id="plan-start" label="Start from" value={plan.start ?? (P.home ? { ...P.home, name: 'Home', area: P.home.name } : null)} placeholder={P.home ? 'Home' : 'e.g. your hotel or home…'}
        icon={<Circle className="size-3.5 fill-current" />} onPick={p => { autoCountry(p); setPlan({ ...plan, start: p.name === 'Home' && P.home && hav(p, P.home) < 0.01 ? null : p, choice: {} }) }} />
      <PlaceInput id="plan-add" label="Add a stop" value={null} placeholder="e.g. a museum, an office…" icon={<Plus className="size-4" />} bias={start} onPick={addStop} />
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
        <Label htmlFor="plan-ret" className="text-sm font-medium">Return to the start at the end</Label>
        <Switch id="plan-ret" checked={plan.ret} onCheckedChange={v => { setPlan({ ...plan, ret: v }); toast(v ? 'Trip back added' : 'Trip back removed') }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={plan.stops.length < 2 || !start} onClick={() => { setPlan(bestOrder(plan, start!)); toast('Stops reordered to cut travel') }}><Sparkles /> Best visit order</Button>
        <Button variant="ghost" disabled={!plan.stops.length} onClick={() => { const before = plan; setPlan({ ...plan, stops: [], choice: {} }); toast('Plan cleared', { action: { label: 'Undo', onClick: () => setPlan(before) } }) }}><Trash2 /> Clear</Button>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">Stops with a fixed time stay in time order. Best visit order fits the rest in where they add the least travel.</p>
    </section>
  )

  let body: React.ReactNode
  if (!start || !plan.stops.length) {
    body = (
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-secondary p-8">
        <span className="grid size-12 place-items-center rounded-full bg-card shadow-float"><MapPin className="size-5" /></span>
        <h2 className="text-2xl">{!start ? 'Where does your day start?' : 'Add the places you need to be'}</h2>
        <p className="max-w-[56ch] text-muted-foreground">{!start
          ? 'Choose a start place, or save your home in Settings so every plan starts there.'
          : 'Add stops and set a time for anything fixed, like a meeting, a booking or a class. Farewise works out how to get between them and whether you will make it.'}</p>
        <Button onClick={() => { const ex = examplePlan(plan.date); autoCountry(ex.start); setPlanState(ex) }}>See an example day in London</Button>
      </div>
    )
  } else if (error) {
    body = <div className="rounded-2xl bg-secondary p-8"><p className="font-medium">The routing services didn’t respond.</p><Button className="mt-4" onClick={() => { clearNetCache(); setNonce(n => n + 1) }}><RotateCw /> Try again</Button></div>
  } else if (!res) {
    body = <div className="flex flex-col gap-4" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" style={{ animationDelay: `${i * 120}ms` }} />)}<p className="text-sm text-muted-foreground">Working out {plan.stops.length + (plan.ret ? 1 : 0)} legs…</p></div>
  } else {
    const legs = res.legs.filter(l => l.chosen).length
    body = (
      <div className="flex flex-col gap-6">
        <section aria-label="Plan summary" className="rounded-2xl bg-foreground p-6 text-background sm:p-7">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {[['Travel time', fmtMin(res.travel)], ['Estimated cost', money(res.cost, cur)], ['Done by', timeOf(res.end)], ['Legs', `${legs}`]].map(([k, v]) => (
              <div key={k} className="min-w-0"><dt className="text-[13px] opacity-70">{k}</dt><dd className="mt-1.5 truncate text-2xl font-bold tabular sm:text-[26px]">{v}</dd></div>
            ))}
          </dl>
          {allowance != null && (
            <p className="mt-5 border-t border-background/15 pt-4 text-sm opacity-85">{res.cost <= allowance
              ? <>Within your daily budget, about {money(Math.max(0, allowance), cur)} a day left this cycle.</>
              : <>{money(res.cost - Math.max(0, allowance), cur)} over your daily budget of about {money(Math.max(0, allowance), cur)}.</>}</p>
          )}
        </section>

        <ol className={cn('flex flex-col transition-opacity duration-200', loading && 'opacity-60')} aria-busy={loading}>
          <li className="grid gap-4 sm:grid-cols-[72px_1fr]">
            <span className="hidden pt-5 text-right text-sm font-semibold tabular sm:block">{timeOf(atLocal(plan.date, plan.startTime))}</span>
            <div className="rounded-2xl bg-secondary p-5"><span className="mb-1 block text-xs font-semibold text-muted-foreground tabular sm:hidden">{timeOf(atLocal(plan.date, plan.startTime))}</span><div className="font-semibold">Start: {plan.start ? plan.start.name : 'Home'}</div><div className="mt-0.5 text-sm text-muted-foreground">{start.area || start.name}</div></div>
          </li>
          <AnimatePresence initial={false}>
            {res.stops.map(s => {
              const st = plan.stops[s.i]
              if (!st) return null
              const k = stopKey(st.place)
              const spare = s.meet ? Math.round((s.meet.getTime() - s.arr.getTime()) / 60000) : 0
              const fast = s.status === 'late' ? s.leg.opts.reduce((a, b) => b.arrive < a.arrive ? b : a) : null
              return (
                <motion.li key={k} layout initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }} transition={spring}>
                  <LegRow leg={s.leg} cur={cur} open={openLeg === s.leg.key} onToggle={() => setOpenLeg(o => o === s.leg.key ? null : s.leg.key)} onPick={k2 => setPlan({ ...plan, choice: { ...plan.choice, [s.leg.key]: k2 } })} />
                  <div className="grid gap-4 sm:grid-cols-[72px_1fr]">
                    <span className="hidden pt-5 text-right text-sm font-semibold tabular sm:block">{timeOf(s.arr)}</span>
                    <div className={cn('rounded-2xl border bg-card p-4 sm:p-5 transition-[border-color,box-shadow] duration-500', fresh === k ? 'border-foreground shadow-[0_0_0_4px_var(--secondary)]' : 'border-border')}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-bold text-background tabular">{s.i + 1}</span>
                          <div className="min-w-0">
                            <div className="text-[17px] font-semibold leading-6">{st.place.name}</div>
                            <div className="mt-0.5 text-sm text-muted-foreground">{st.place.area}</div>
                          </div>
                        </div>
                        {s.status && STATUS[s.status](Math.abs(spare))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Clock3 className="size-4" />Arrive {timeOf(s.arr)}{s.meet ? `, fixed at ${timeOf(s.meet)}` : ''}</span>
                        <span>Leave about {timeOf(s.end)}</span>
                      </div>
                      {fast && s.meet && (fast.key !== s.leg.chosen?.key && fast.arrive <= s.meet
                        ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm">{fast.title} gets you there by {timeOf(fast.arrive)}. <Button size="xs" onClick={() => setPlan({ ...plan, choice: { ...plan.choice, [s.leg.key]: fast.key } })}>Switch</Button></div>
                        : <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-sm">Start earlier, or move this to {timeOf(addMin(s.arr, 5))}.</p>)}
                      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                        <div className="flex flex-col gap-1.5"><Label htmlFor={`meet-${s.i}`} className="text-xs text-muted-foreground">Fixed time</Label>
                          <Input id={`meet-${s.i}`} type="time" value={st.meet} onChange={e => updateStop(s.i, { meet: e.target.value })} className="h-10 w-[148px]" /></div>
                        <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground" id={`visit-l-${s.i}`}>Time there</Label>
                          <Select value={String(s.visit)} onValueChange={v => updateStop(s.i, { visit: Number(v) })}>
                            <SelectTrigger aria-labelledby={`visit-l-${s.i}`} className="h-10 w-[120px] rounded-[8px] border-transparent bg-secondary data-[size=default]:h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>{[10, 15, 20, 30, 45, 60, 90, 120, 180].map(v => <SelectItem key={v} value={String(v)}>{v < 60 ? `${v} min` : `${v / 60} h`}</SelectItem>)}</SelectContent>
                          </Select></div>
                        <div className="ml-auto flex gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${st.place.name} earlier`} disabled={s.i === 0} onClick={() => move(s.i, -1)}><ArrowUp /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Move ${st.place.name} later`} disabled={s.i === plan.stops.length - 1} onClick={() => move(s.i, 1)}><ArrowDown /></Button>
                          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${st.place.name}`} onClick={() => { const before = plan; setPlan({ ...plan, stops: plan.stops.filter((_, j) => j !== s.i), choice: {} }); toast(`Removed ${st.place.name}`, { action: { label: 'Undo', onClick: () => setPlan(before) } }) }}><X /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {res.back && (
            <li>
              <LegRow leg={res.back} cur={cur} open={openLeg === 'ret'} onToggle={() => setOpenLeg(o => o === 'ret' ? null : 'ret')} onPick={k => setPlan({ ...plan, choice: { ...plan.choice, ret: k } })} />
              <div className="grid gap-4 sm:grid-cols-[72px_1fr]">
                <span className="hidden pt-5 text-right text-sm font-semibold tabular sm:block">{timeOf(res.end)}</span>
                <div className="rounded-2xl bg-secondary p-5 font-semibold"><span className="mb-1 block text-xs font-semibold text-muted-foreground tabular sm:hidden">{timeOf(res.end)}</span>Back at {plan.start ? plan.start.name : 'Home'}</div>
              </div>
            </li>
          )}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5">
          <p className="max-w-[46ch] text-sm text-muted-foreground">Did this plan? Log every leg to Spending in one tap. You can edit amounts later.</p>
          <FeedbackButton done="Logged" onClick={logDay}>Log {legs} trips · {money(res.cost, cur)}</FeedbackButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {plan.example && <div className="rounded-2xl bg-secondary px-5 py-3.5 text-sm"><b>Example day.</b> Edit it to make it yours, or clear it.</div>}
      <header>
        <h1 className="text-[36px] leading-[44px]">Day plan · {prettyDate(plan.date)}</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Line up your stops. Each leg gets the best way to travel, and you can change any of them.</p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(340px,400px)_1fr] lg:gap-10">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">{setup}<RouteMap points={points} lines={lines} className="h-64 lg:h-80" /></div>
        <div className="min-w-0">{body}</div>
      </div>
    </div>
  )
}
