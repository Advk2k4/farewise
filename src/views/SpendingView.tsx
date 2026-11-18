import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberTicker } from '@/components/ui/number-ticker'
import { AnimatedCircularProgressBar } from '@/components/ui/animated-circular-progress-bar'
import { useTheme } from '@/lib/theme'
import { AddExpenseDialog } from '@/components/AddExpenseDialog'
import { cycleInfo, cycleStartFor, shiftCycle, type CycleInfo } from '@/lib/budget'
import { atLocal, money, prettyDate, shortDate, todayISO } from '@/lib/format'
import { update, useData } from '@/lib/store'
import { cn } from '@/lib/utils'

const MODES = ['taxi', 'car', 'transit', 'bike', 'walk', 'other'] as const
type Mode = typeof MODES[number]
export const MODE_NAME: Record<Mode, string> = { taxi: 'Taxi', car: 'Driving', transit: 'Transit', bike: 'Bike', walk: 'Walk', other: 'Other' }
const MODE_SHADE: Record<Mode, string> = { taxi: 'var(--chart-1)', transit: 'var(--chart-2)', car: 'var(--chart-3)', bike: 'var(--chart-4)', walk: 'var(--chart-5)', other: 'var(--chart-4)' }
const cat = (m: string): Mode => (MODES as readonly string[]).includes(m) ? m as Mode : 'other'

function symbolOf(cur: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).formatToParts(0).find(p => p.type === 'currency')?.value ?? cur } catch { return cur }
}
function Money({ n, cur }: { n: number; cur: string }) {
  const digits = n === 0 || Math.abs(n) >= 50 ? 0 : 2
  return <span className="tabular">{symbolOf(cur)}<NumberTicker value={Math.max(0, n)} decimalPlaces={digits} className="tracking-normal text-current" /></span>
}

function Chart({ mi }: { mi: CycleInfo }) {
  const W = 640, H = 220, L = 60, R = 16, T = 16, B = 30
  const byDay = new Array(mi.dates.length + 1).fill(0)
  for (const t of mi.trips) byDay[mi.dates.indexOf(t.date) + 1] += Number(t.cost) || 0
  const cum: number[] = []; let c = 0
  for (let d = 1; d <= mi.dates.length; d++) { c += byDay[d]; cum[d] = c }
  const last = mi.isCur ? mi.dates.indexOf(todayISO()) + 1 : mi.dates.length
  const ymax = Math.max(mi.budget, c, mi.projected, 1) * 1.1
  const x = (d: number) => L + (d - 1) / Math.max(1, mi.dates.length - 1) * (W - L - R)
  const y = (v: number) => T + (1 - v / ymax) * (H - T - B)
  const ideal: string[] = []; let n = 0
  mi.dates.forEach((iso, i) => { if (mi.counts(iso)) n++; ideal.push(`${x(i + 1).toFixed(1)},${y(mi.budget * n / Math.max(1, mi.total)).toFixed(1)}`) })
  const pts = Array.from({ length: Math.max(0, last) }, (_, i) => `${x(i + 1).toFixed(1)},${y(cum[i + 1]).toFixed(1)}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[520px]" role="img" aria-label={`Cumulative spending this cycle${mi.budget ? ' against budget pace' : ''}`}>
      {[0, 1, 2, 3, 4].map(k => { const v = ymax / 4 * k; return (
        <g key={k}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border)" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)" className="tabular">{money(v, mi.currency)}</text></g>) })}
      {[1, Math.ceil(mi.dates.length / 2), mi.dates.length].map((d, i) => (
        <text key={i} x={x(d)} y={H - 8} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize="11" fill="var(--muted-foreground)">{shortDate(mi.dates[d - 1])}</text>))}
      {mi.budget > 0 && <>
        <polyline points={ideal.join(' ')} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 5" />
        <line x1={L} x2={W - R} y1={y(mi.budget)} y2={y(mi.budget)} stroke="var(--foreground)" strokeWidth="1" />
        <text x={W - R} y={y(mi.budget) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--foreground)">Budget {money(mi.budget, mi.currency)}</text>
      </>}
      {last >= 1 && <>
        <polygon points={`${x(1)},${y(0)} ${pts.join(' ')} ${x(last)},${y(0)}`} fill="var(--foreground)" opacity="0.06" />
        <polyline points={pts.join(' ')} fill="none" stroke="var(--foreground)" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={x(last)} cy={y(cum[last])} r="5" fill="var(--foreground)" stroke="var(--background)" strokeWidth="2" />
      </>}
    </svg>
  )
}

export function SpendingView({ goSettings }: { goSettings: () => void }) {
  const data = useData()
  const P = data.prefs
  const dark = useTheme().resolved === 'dark'
  const [off, setOff] = useState(0)
  const [adding, setAdding] = useState(false)
  const start = shiftCycle(cycleStartFor(todayISO(), P.cycleDay), off, P.cycleDay)
  const mi = cycleInfo(data, start), cur = mi.currency
  const parts: Partial<Record<Mode, number>> = {}
  for (const t of mi.trips) for (const [k, v] of Object.entries(t.parts && Object.keys(t.parts).length ? t.parts : { [t.mode]: t.cost })) parts[cat(k)] = (parts[cat(k)] ?? 0) + Number(v)
  const total = Object.values(parts).reduce((a, b) => a + (b ?? 0), 0)
  const order = MODES.filter(k => (parts[k] ?? 0) > 0)
  const byDate: Record<string, typeof mi.trips> = {}
  for (const t of [...mi.trips, ...mi.other]) (byDate[t.date] ??= []).push(t)
  const dates = Object.keys(byDate).sort().reverse()
  const over = mi.budget > 0 && mi.projected > mi.budget

  const removeTrip = (date: string, id: string) => {
    const before = structuredClone(data.days[date]?.trips ?? [])
    update(d => { d.days[date].trips = d.days[date].trips.filter(t => t.id !== id) })
    toast('Trip deleted', { action: { label: 'Undo', onClick: () => update(d => { d.days[date] = { trips: before } }) } })
  }
  const setAmount = (date: string, id: string, v: number) => update(d => {
    const t = d.days[date]?.trips.find(x => x.id === id); if (!t) return
    t.cost = Math.max(0, v); t.parts = { [cat(t.mode)]: t.cost }
  })

  const kpis: [string, React.ReactNode, string][] = [
    ['Spent', <Money n={mi.spent} cur={cur} />, `${mi.trips.length} trip${mi.trips.length === 1 ? '' : 's'}`],
    ['Left', mi.budget ? <span className={cn(mi.left < 0 && 'text-bad')}>{money(mi.left, cur)}</span> : '–', mi.budget ? `of ${money(mi.budget, cur)}` : 'No budget set'],
    ['Per day', mi.budget && !mi.past ? money(Math.max(0, mi.perDay), cur) : '–', mi.isCur ? `${mi.remaining} day${mi.remaining === 1 ? '' : 's'} left` : mi.past ? 'Cycle closed' : 'Upcoming'],
    ['Cycle-end pace', mi.isCur && mi.elapsed && mi.trips.length ? <span className={cn(over && 'text-warn')}>{money(mi.projected, cur)}</span> : '–', 'If you keep this up'],
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[36px] leading-[44px]">Spending</h1>
          <p className="mt-2 max-w-[60ch] text-muted-foreground">Trips you log from Trip or Day plan land here. Edit any amount to what you actually paid.</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous cycle" onClick={() => setOff(o => o - 1)}><ChevronLeft /></Button>
          <span className="px-2 text-sm font-medium tabular">{mi.label}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Next cycle" disabled={off >= 0} onClick={() => setOff(o => o + 1)}><ChevronRight /></Button>
        </div>
      </header>

      {mi.budget > 0 && (
        <section aria-label="Budget used" className="flex flex-wrap items-center gap-6 rounded-2xl border border-border p-5">
          {/* Magic UI animated ring: share of this cycle's budget already spent */}
          <AnimatedCircularProgressBar max={100} min={0} value={Math.min(100, Math.round(mi.spent / mi.budget * 100))}
            gaugePrimaryColor={mi.spent > mi.budget ? (dark ? '#ff8a7f' : '#b3261e') : over ? '#f5c400' : (dark ? '#ffffff' : '#000000')}
            gaugeSecondaryColor={dark ? '#2e2e2e' : '#e2e2e2'} className="size-28 text-xl font-bold" />
          <div className="min-w-0">
            <div className="text-xl font-bold">{mi.spent > mi.budget ? 'Over budget' : `${money(Math.max(0, mi.left), cur)} left`}</div>
            <p className="mt-1 max-w-[46ch] text-sm text-muted-foreground">{money(mi.spent, cur)} of {money(mi.budget, cur)} spent this cycle{mi.isCur && mi.remaining ? `, with ${mi.remaining} day${mi.remaining === 1 ? '' : 's'} to go` : ''}.</p>
          </div>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {kpis.map(([k, v, s]) => (
          <div key={k} className="bg-card p-4"><dt className="text-xs font-medium text-muted-foreground">{k}</dt><dd className="mt-1 text-2xl font-bold tabular">{v}</dd><div className="text-xs text-muted-foreground">{s}</div></div>
        ))}
      </dl>

      {!mi.budget ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-sm">
          <span>Set a budget to see what you can spend per day and whether you’re on pace.</span>
          <Button size="sm" onClick={goSettings}>Set a budget</Button>
        </div>
      ) : mi.isCur && mi.trips.length > 0 && (
        <div className={cn('rounded-2xl p-4 text-sm', over ? 'bg-warn-soft text-warn' : 'bg-secondary')}>
          {over
            ? <>At this pace the cycle ends near <b>{money(mi.projected, cur)}</b>, about {money(mi.projected - mi.budget, cur)} over budget.{(parts.taxi ?? 0) / (total || 1) > 0.35 && <> Taxis are {Math.round((parts.taxi ?? 0) / total * 100)}% of spending; swapping a few for transit closes most of the gap.</>}</>
            : <>On track: this cycle should end near <b>{money(mi.projected, cur)}</b>, under your {money(mi.budget, cur)} budget.</>}
        </div>
      )}

      {(mi.trips.length > 0 || mi.budget > 0) && (
        <section className="rounded-2xl border border-border p-5" aria-labelledby="chart-h">
          <h2 id="chart-h" className="mb-3 text-xl">Spending so far{mi.budget ? ' against budget pace' : ''}</h2>
          <div className="-mx-1 overflow-x-auto px-1"><Chart mi={mi} /></div>
        </section>
      )}

      {total > 0 && (
        <section className="rounded-2xl border border-border p-5" aria-labelledby="split-h">
          <h2 id="split-h" className="mb-3 text-xl">Where it went</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
            {order.map(k => <i key={k} style={{ width: `${(parts[k]! / total * 100).toFixed(2)}%`, background: MODE_SHADE[k] }} title={`${MODE_NAME[k]} ${money(parts[k]!, cur)}`} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {order.map(k => <li key={k} className="flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: MODE_SHADE[k] }} />{MODE_NAME[k]} <b className="tabular">{money(parts[k]!, cur)}</b></li>)}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-border p-5" aria-labelledby="trips-h">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="trips-h" className="text-xl">Logged trips</h2>
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus /> Add expense</Button>
        </div>
        {dates.length ? dates.map(dt => (
          <div key={dt} className="border-b border-border py-3 last:border-0">
            <div className="mb-1 flex justify-between text-sm font-semibold"><span>{prettyDate(dt)}</span>
              <span className="tabular">{money(byDate[dt].filter(t => (t.cur || cur) === cur).reduce((a, t) => a + (Number(t.cost) || 0), 0), cur)}</span></div>
            {byDate[dt].map(t => {
              const m = cat(t.mode), tc = t.cur || cur
              return (
                <div key={t.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-1.5 text-sm">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{MODE_NAME[m]}</span>
                  <span className="min-w-0 break-words">{t.t && <span className="text-muted-foreground tabular">{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(atLocal(dt, t.t))} </span>}
                    {t.from ? `${t.from} → ${t.to}` : t.note || t.label}{tc !== cur && <span className="ml-1 text-xs text-muted-foreground">({tc}, not counted)</span>}</span>
                  <Input type="number" min={0} step="any" inputMode="decimal" aria-label={`Amount paid in ${tc}`} defaultValue={t.cost}
                    onBlur={e => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== t.cost) setAmount(dt, t.id, v) }}
                    className="h-9 w-24 text-right tabular" />
                  <Button variant="ghost" size="icon-sm" aria-label="Delete trip" onClick={() => removeTrip(dt, t.id)}><X /></Button>
                </div>
              )
            })}
          </div>
        )) : <p className="py-6 text-center text-sm text-muted-foreground">Nothing logged for {mi.label} yet. Use <b>I took this</b> on a trip, <b>Log trips</b> on a day plan, or add an expense by hand.</p>}
      </section>
      <AddExpenseDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
