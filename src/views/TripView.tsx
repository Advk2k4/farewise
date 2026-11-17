import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { ArrowDownUp, Link2, Circle, Square, RotateCw, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { PlaceInput } from '@/components/PlaceInput'
import { OptionCard } from '@/components/OptionCard'
import { RouteMap, type MapPoint } from '@/components/RouteMap'
import type { Place } from '@/lib/api'
import { clearNetCache } from '@/lib/api'
import { tripOptions, mapsUrl, type TripResult } from '@/lib/options'
import { atLocal, isoDate, money, roundNice, toHM, todayISO, uid } from '@/lib/format'
import { addTrips, autoCountry, setCountry, useData, type Prefs } from '@/lib/store'
import { COUNTRIES, countryName } from '@/lib/rates'

export type TripState = { from: Place | null; to: Place | null; mode: 'now' | 'leave' | 'arrive'; date: string; time: string }

export const EXAMPLES: { city: string; from: Place; to: Place }[] = [
  { city: 'London', from: { name: "King's Cross", area: 'London, United Kingdom', lat: 51.5308, lng: -0.1238, cc: 'GB' }, to: { name: 'Tower of London', area: 'London, United Kingdom', lat: 51.5081, lng: -0.0759, cc: 'GB' } },
  { city: 'New York', from: { name: 'Times Square', area: 'Manhattan, New York, United States', lat: 40.758, lng: -73.9855, cc: 'US' }, to: { name: 'Brooklyn Bridge Park', area: 'Brooklyn, New York, United States', lat: 40.7003, lng: -73.9967, cc: 'US' } },
  { city: 'Tokyo', from: { name: 'Shibuya Station', area: 'Shibuya, Tokyo, Japan', lat: 35.658, lng: 139.7016, cc: 'JP' }, to: { name: 'Tokyo Tower', area: 'Minato, Tokyo, Japan', lat: 35.6586, lng: 139.7454, cc: 'JP' } },
  { city: 'Berlin', from: { name: 'Brandenburger Tor', area: 'Mitte, Berlin, Germany', lat: 52.5163, lng: 13.3777, cc: 'DE' }, to: { name: 'East Side Gallery', area: 'Friedrichshain, Berlin, Germany', lat: 52.505, lng: 13.4397, cc: 'DE' } },
  { city: 'Sydney', from: { name: 'Bondi Beach', area: 'Sydney, Australia', lat: -33.8915, lng: 151.2767, cc: 'AU' }, to: { name: 'Sydney Opera House', area: 'Sydney, Australia', lat: -33.8568, lng: 151.2153, cc: 'AU' } },
]

export const routingPrefs = (p: Prefs) => ({ rates: p.rates, priority: p.priority, hasCar: p.hasCar, hasBike: p.hasBike, parkMin: p.parkMin })

/** ?from=lat,lng&fn=Name&to=lat,lng&tn=Name&cc=GB */
export function readTripLink(): Partial<TripState> | null {
  const q = new URLSearchParams(location.search)
  const pt = (v: string | null, n: string | null, cc: string): Place | null => {
    const m = (v ?? '').match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/)
    return m ? { name: n || 'Dropped pin', area: '', lat: +m[1], lng: +m[2], cc } : null
  }
  const cc = (q.get('cc') ?? '').toUpperCase()
  const from = pt(q.get('from'), q.get('fn'), cc), to = pt(q.get('to'), q.get('tn'), cc)
  return from && to ? { from, to } : null
}
function tripLink(t: TripState) {
  const u = new URL(location.href.split('#')[0].split('?')[0])
  const f = (p: Place) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
  u.searchParams.set('from', f(t.from!)); u.searchParams.set('fn', t.from!.name)
  u.searchParams.set('to', f(t.to!)); u.searchParams.set('tn', t.to!.name)
  const cc = t.from!.cc || t.to!.cc
  if (cc) u.searchParams.set('cc', cc)
  return u.toString()
}

const ease = [0.2, 0, 0, 1] as const

export function TripView({ trip, setTrip }: { trip: TripState; setTrip: (fn: (t: TripState) => TripState) => void }) {
  const data = useData()
  const P = data.prefs, cur = P.rates.cur
  const [result, setResult] = useState<TripResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [minuteTick, setMinuteTick] = useState(0)

  useEffect(() => { const t = setInterval(() => setMinuteTick(x => x + 1), 5 * 60000); return () => clearInterval(t) }, [])

  const { when, arriveBy } = useMemo(() => trip.mode === 'now'
    ? { when: new Date(), arriveBy: false }
    : { when: atLocal(trip.date, trip.time), arriveBy: trip.mode === 'arrive' }, [trip.mode, trip.date, trip.time, minuteTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const rp = routingPrefs(P)
  const key = trip.from && trip.to ? JSON.stringify([trip.from.lat, trip.from.lng, trip.to.lat, trip.to.lng, when.getTime(), arriveBy, rp, nonce]) : ''

  useEffect(() => {
    if (!key || !trip.from || !trip.to) { setResult(null); return }
    let live = true
    setLoading(true); setError(false)
    tripOptions(trip.from, trip.to, when, arriveBy, rp)
      .then(r => { if (!live) return; setResult(r); setSel(s => r.opts.some(o => o.key === s) ? s : r.opts[0]?.key ?? null) })
      .catch(() => { if (live) setError(true) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (slot: 'from' | 'to') => (p: Place) => { autoCountry(p); setTrip(t => ({ ...t, [slot]: p })); setOpen(null) }
  const selected = result?.opts.find(o => o.key === sel) ?? null
  const points: MapPoint[] = [
    ...(trip.from ? [{ ...trip.from, label: trip.from.name, kind: 'from' as const }] : []),
    ...(trip.to ? [{ ...trip.to, label: trip.to.name, kind: 'to' as const }] : []),
  ]
  const tripCC = trip.from?.cc || trip.to?.cc
  const otherCountry = tripCC && P.country && tripCC !== P.country && COUNTRIES[tripCC] ? tripCC : null

  const log = (key: string) => {
    const op = result?.opts.find(o => o.key === key)
    if (!op || !trip.from || !trip.to) return
    const undo = addTrips(isoDate(op.depart), [{ id: uid(), t: toHM(op.depart), from: trip.from.name, to: trip.to.name, mode: op.kind, label: op.title, cost: roundNice(op.cost), cur, parts: op.parts }])
    toast(`Logged ${money(roundNice(op.cost), cur)} · ${op.title}`, { action: { label: 'Undo', onClick: undo } })
  }
  const share = async () => {
    const url = tripLink(trip)
    try { await navigator.clipboard.writeText(url); toast('Link copied') } catch { toast(url) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(360px,460px)_1fr] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
          <h1 className="text-[36px] leading-[44px] sm:text-[44px] sm:leading-[52px]">Every way from A to B, priced.</h1>
          <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">Walking, cycling, transit, taxis and driving, compared for any trip in the world. Real timetables where cities publish them. Free, with no sign-up.</p>
        </motion.header>

        <motion.section aria-label="Trip" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06, ease }}
          className="rounded-2xl bg-card p-4 shadow-card">
          <div className="relative flex flex-col gap-2">
            <PlaceInput id="trip-from" label="From" value={trip.from} placeholder="Search an address or place…" icon={<Circle className="size-3.5 fill-current" />} onPick={pick('from')} />
            <PlaceInput id="trip-to" label="To" value={trip.to} placeholder="Where to? e.g. a station…" icon={<Square className="size-3.5 fill-current" />} onPick={pick('to')} bias={trip.from} />
            <Button type="button" variant="outline" size="icon-sm" aria-label="Swap start and destination"
              className="absolute top-1/2 right-3 z-10 -translate-y-1/2 bg-card shadow-float"
              onClick={() => setTrip(t => ({ ...t, from: t.to, to: t.from }))}><ArrowDownUp /></Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ToggleGroup type="single" value={trip.mode} onValueChange={v => v && setTrip(t => ({ ...t, mode: v as TripState['mode'] }))} aria-label="When"
              className="rounded-[36px] bg-secondary p-1">
              {[['now', 'Leave now'], ['leave', 'Leave at'], ['arrive', 'Arrive by']].map(([v, l]) => (
                <ToggleGroupItem key={v} value={v} className="h-9 rounded-[36px] px-3.5 text-sm font-medium data-[state=on]:bg-card data-[state=on]:shadow-float">{l}</ToggleGroupItem>
              ))}
            </ToggleGroup>
            {trip.mode !== 'now' && (
              <div className="flex gap-2">
                <Input type="date" aria-label="Date" value={trip.date} onChange={e => e.target.value && setTrip(t => ({ ...t, date: e.target.value }))} className="h-11 w-[150px]" />
                <Input type="time" aria-label="Time" value={trip.time} onChange={e => e.target.value && setTrip(t => ({ ...t, time: e.target.value }))} className="h-11 w-[116px]" />
              </div>
            )}
          </div>
        </motion.section>

        <div className="lg:hidden"><RouteMap points={points} lines={selected?.lines ?? []} className="h-64" /></div>

        <section aria-label="Ways to get there" aria-live="polite" className="flex flex-col gap-3">
          {!trip.from || !trip.to ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl">Try a trip</h2>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map(x => (
                  <button key={x.city} type="button" onClick={() => { autoCountry(x.from); setTrip(t => ({ ...t, from: x.from, to: x.to })) }}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium transition-[background-color,transform] hover:bg-pressed active:scale-[0.97] outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                    <span className="text-muted-foreground">{x.city}</span>{x.from.name} → {x.to.name}
                  </button>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-secondary p-5">
              <p className="font-medium">The routing services didn’t respond.</p>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection, then try again.</p>
              <Button className="mt-4" onClick={() => { clearNetCache(); setNonce(n => n + 1) }}><RotateCw /> Try again</Button>
            </div>
          ) : !result ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              {[0, 1, 2].map(i => <div key={i} className="h-[132px] animate-pulse rounded-2xl bg-secondary" style={{ animationDelay: `${i * 120}ms` }} />)}
              <p className="text-sm text-muted-foreground">Checking transit, roads and walking routes…</p>
            </div>
          ) : (
            <>
              {otherCountry && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-sm">
                  <span>Prices use your {countryName(P.country)} rates ({cur}). This trip is in {countryName(otherCountry)}.</span>
                  <Button size="sm" onClick={() => { setCountry(otherCountry); toast(`Now using ${countryName(otherCountry)} prices`) }}>Use {countryName(otherCountry)} prices</Button>
                </div>
              )}
              {result.status.transit === 'none' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-sm">
                  <span>No public transit found. The open timetable data may not cover this area yet, or nothing runs at this time.</span>
                  <a className="inline-flex h-9 items-center gap-1 rounded-full bg-card px-3.5 font-medium hover:bg-pressed" href={mapsUrl(trip.from, trip.to, 'transit')} target="_blank" rel="noopener noreferrer">Transit in Google Maps <ArrowUpRight className="size-4" /></a>
                </div>
              )}
              {result.status.transit === 'error' && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-sm">
                  <span>The transit lookup didn’t respond, so only road and walking options are shown.</span>
                  <Button size="sm" variant="outline" onClick={() => { clearNetCache(); setNonce(n => n + 1) }}>Retry transit</Button>
                </div>
              )}
              {result.opts.length === 0 && <div className="rounded-2xl bg-secondary p-5">No routes found between these two places.</div>}
              {result.opts.map((op, i) => (
                <motion.div key={op.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: i * 0.04, ease }}>
                  <OptionCard op={op} cur={cur} from={trip.from!} to={trip.to!} selected={sel === op.key} open={open === op.key}
                    onSelect={() => { setSel(op.key); setOpen(o => o === op.key ? null : op.key) }}
                    actions={<Button size="sm" onClick={() => log(op.key)}>I took this · log {op.cost ? money(roundNice(op.cost), cur) : 'it'}</Button>} />
                </motion.div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button variant="secondary" size="sm" onClick={share}><Link2 /> Copy link to this trip</Button>
                <span className="text-xs text-muted-foreground">{loading ? 'Updating… · ' : ''}Prices are estimates for {countryName(P.country ?? 'US')}. Driving assumes typical traffic for the hour.</span>
              </div>
            </>
          )}
        </section>
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-24"><RouteMap points={points} lines={selected?.lines ?? []} className="h-[calc(100dvh-8rem)] min-h-[480px]" /></div>
      </div>
    </div>
  )
}

export const initialTrip = (): TripState => ({ from: null, to: null, mode: 'now', date: todayISO(), time: '09:00', ...(readTripLink() ?? {}) })
