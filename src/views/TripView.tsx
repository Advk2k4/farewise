import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { ArrowDownUp, Link2, Circle, Square, RotateCw, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/Segmented'
import { FeedbackButton } from '@/components/FeedbackButton'
import { HowItWorks } from '@/components/HowItWorks'
import { Marquee } from '@/components/ui/marquee'
import Threads from '@/components/fx/Threads'
import RotatingText from '@/components/fx/RotatingText'
import { useTheme } from '@/lib/theme'
import { Input } from '@/components/ui/input'
import { PlaceInput } from '@/components/PlaceInput'
import { OptionCard } from '@/components/OptionCard'
import { RouteMap, type MapPoint } from '@/components/RouteMap'
import type { Place } from '@/lib/api'
import { clearNetCache } from '@/lib/api'
import { tripOptions, mapsUrl, type TripResult } from '@/lib/options'
import { atLocal, isoDate, money, roundNice, toHM, todayISO, uid } from '@/lib/format'
import { addTrips, autoCountry, ratesFor, tripCountry, useData, type Prefs } from '@/lib/store'
import { countryName } from '@/lib/rates'

export type TripState = { from: Place | null; to: Place | null; mode: 'now' | 'leave' | 'arrive'; date: string; time: string }

export const EXAMPLES: { city: string; from: Place; to: Place }[] = [
  { city: 'London', from: { name: "King's Cross", area: 'London, United Kingdom', lat: 51.5308, lng: -0.1238, cc: 'GB' }, to: { name: 'Tower of London', area: 'London, United Kingdom', lat: 51.5081, lng: -0.0759, cc: 'GB' } },
  { city: 'New York', from: { name: 'Times Square', area: 'Manhattan, New York, United States', lat: 40.758, lng: -73.9855, cc: 'US' }, to: { name: 'Brooklyn Bridge Park', area: 'Brooklyn, New York, United States', lat: 40.7003, lng: -73.9967, cc: 'US' } },
  { city: 'Tokyo', from: { name: 'Shibuya Station', area: 'Shibuya, Tokyo, Japan', lat: 35.658, lng: 139.7016, cc: 'JP' }, to: { name: 'Tokyo Tower', area: 'Minato, Tokyo, Japan', lat: 35.6586, lng: 139.7454, cc: 'JP' } },
  { city: 'Berlin', from: { name: 'Brandenburger Tor', area: 'Mitte, Berlin, Germany', lat: 52.5163, lng: 13.3777, cc: 'DE' }, to: { name: 'East Side Gallery', area: 'Friedrichshain, Berlin, Germany', lat: 52.505, lng: 13.4397, cc: 'DE' } },
  { city: 'Sydney', from: { name: 'Bondi Beach', area: 'Sydney, Australia', lat: -33.8915, lng: 151.2767, cc: 'AU' }, to: { name: 'Sydney Opera House', area: 'Sydney, Australia', lat: -33.8568, lng: 151.2153, cc: 'AU' } },
]

/** Routing settings for a trip priced in country `cc`. */
export const routingPrefs = (p: Prefs, cc: string) => ({ rates: ratesFor(p, cc), cc, priority: p.priority, hasCar: p.hasCar, hasBike: p.hasBike, parkMin: p.parkMin })

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
  const P = data.prefs
  // prices follow the country the trip is in (where it starts), so currency switches automatically
  const cc = tripCountry(P, trip.from, trip.to)
  const cur = ratesFor(P, cc).cur
  const [spin, setSpin] = useState(0)
  const dark = useTheme().resolved === 'dark'
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
  const rp = routingPrefs(P, cc)
  const placeKey = trip.from && trip.to ? [trip.from.lat, trip.from.lng, trip.to.lat, trip.to.lng].join(',') : ''
  const lastPlaceKey = useRef('')
  const key = trip.from && trip.to ? JSON.stringify([trip.from.lat, trip.from.lng, trip.to.lat, trip.to.lng, when.getTime(), arriveBy, rp, nonce]) : ''

  useEffect(() => {
    if (!key || !trip.from || !trip.to) { setResult(null); return }
    let live = true
    setLoading(true); setError(false)
    // a different trip (not just a new time or setting) drops the old routes straight away
    setResult(r => r && r.opts[0] && placeKey === lastPlaceKey.current ? r : null)
    lastPlaceKey.current = placeKey
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

  const log = (key: string) => {
    const op = result?.opts.find(o => o.key === key)
    if (!op || !trip.from || !trip.to) return
    const undo = addTrips(isoDate(op.depart), [{ id: uid(), t: toHM(op.depart), from: trip.from.name, to: trip.to.name, mode: op.kind, label: op.title, cost: roundNice(op.cost), cur, parts: op.parts }])
    toast(`Logged ${money(roundNice(op.cost), cur)} · ${op.title}`, { description: P.country && cur !== ratesFor(P, P.country).cur ? `Saved in ${cur}; Spending totals only count ${ratesFor(P, P.country).cur}.` : undefined, action: { label: 'Undo', onClick: undo } })
  }
  const share = async () => {
    const url = tripLink(trip)
    try { await navigator.clipboard.writeText(url) } catch { toast(url) }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(360px,460px)_1fr] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <motion.header className="relative" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
          {/* The one ambient effect: React Bits Threads, drifting like route lines behind the headline (pauses off-screen and for reduced motion) */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-x-4 sm:-inset-x-10 -top-14 -bottom-10 -z-10 [mask-image:linear-gradient(180deg,transparent,#000_18%,#000_62%,transparent)]">
            <Threads color={dark ? '#ffffff' : '#000000'} accentColor="#f5c400" amplitude={1.7} distance={0.4} lineCount={70} thickness={0.55} angle={18} speed={0.3} opacity={dark ? 0.45 : 0.4} enableMouseInteraction={false} className="h-full w-full" />
          </div>
          <h1 className="text-[36px] leading-[44px] sm:text-[44px] sm:leading-[52px]">
            Every way from <span className="whitespace-nowrap">A to B,</span>{' '}
            <RotatingText texts={['priced.', 'by metro.', 'on foot.', 'by bike.', 'by taxi.', 'by bus.']} rotationInterval={2400} staggerDuration={0.012} staggerFrom="first" animatePresenceMode="popLayout" animatePresenceInitial={false}
              mainClassName="relative inline-flex overflow-hidden rounded-xl bg-foreground px-2.5 text-background align-bottom" splitLevelClassName="overflow-hidden pb-1" />
          </h1>
          <p className="mt-3 max-w-[52ch] text-base text-muted-foreground">Walking, cycling, transit, taxis and driving, compared for any trip in the world. Real timetables where cities publish them. Free, with no sign-up.</p>
        </motion.header>

        <motion.section aria-label="Trip" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.06, ease }}
          className="rounded-2xl bg-card p-4 shadow-card">
          <div className="group/card relative flex flex-col gap-2">
            <PlaceInput id="trip-from" label="From" value={trip.from} placeholder={['Search an address or place…', 'e.g. King’s Cross, London', 'e.g. Shibuya Station, Tokyo', 'e.g. Connaught Place, Delhi', 'Or use your current location']} icon={<Circle className="size-3.5 fill-current" />} onPick={pick('from')} />
            <PlaceInput id="trip-to" label="To" value={trip.to} placeholder={['Where to?', 'e.g. Tower of London', 'e.g. Times Square, New York', 'e.g. a hospital, an office, a station…']} icon={<Square className="size-3.5 fill-current" />} onPick={pick('to')} bias={trip.from} />
            <Button type="button" variant="outline" size="icon-sm" aria-label="Swap start and destination"
              className="absolute top-1/2 right-3 z-10 -translate-y-1/2 bg-card shadow-float transition-opacity group-focus-within/card:pointer-events-none group-focus-within/card:opacity-0"
              onClick={() => { setSpin(s => s + 1); setTrip(t => ({ ...t, from: t.to, to: t.from })) }}>
              <motion.span animate={{ rotate: spin * 180 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="grid place-items-center"><ArrowDownUp /></motion.span>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented label="When" value={trip.mode} onChange={v => setTrip(t => ({ ...t, mode: v }))}
              options={[['now', 'Leave now'], ['leave', 'Leave at'], ['arrive', 'Arrive by']]} />
            <AnimatePresence initial={false}>
              {trip.mode !== 'now' && (
                <motion.div key="when" className="flex gap-2" initial={{ opacity: 0, x: -8, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -8, scale: 0.96 }} transition={{ type: 'spring', stiffness: 500, damping: 34 }}>
                  <Input type="date" aria-label="Date" value={trip.date} onChange={e => e.target.value && setTrip(t => ({ ...t, date: e.target.value }))} className="h-11 w-[150px]" />
                  <Input type="time" aria-label="Time" value={trip.time} onChange={e => e.target.value && setTrip(t => ({ ...t, time: e.target.value }))} className="h-11 w-[116px]" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        <div className="lg:hidden"><RouteMap points={points} lines={selected?.lines ?? []} className="h-64" /></div>

        <section aria-label="Ways to get there" aria-live="polite" className="flex flex-col gap-3">
          {!trip.from || !trip.to ? (
            <div className="flex flex-col gap-4">
              <HowItWorks />
              <div className="flex items-baseline justify-between gap-3"><h2 className="text-xl">Try a trip</h2><span className="text-xs text-muted-foreground">Tap one to see it</span></div>
              {/* Magic UI marquee of example trips; pauses on hover so a trip is easy to pick */}
              <div className="relative -mx-1 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
                <Marquee pauseOnHover className="[--duration:38s] [--gap:0.5rem] py-1">
                  {EXAMPLES.map(x => (
                    <button key={x.city} type="button" onClick={e => { (e.currentTarget as HTMLElement).blur(); autoCountry(x.from); setTrip(t => ({ ...t, from: x.from, to: x.to })) }}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-[background-color,transform,border-color] hover:-translate-y-0.5 hover:border-foreground/40 active:scale-[0.97] outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                      <span className="text-muted-foreground">{x.city}</span>{x.from.name} → {x.to.name}
                    </button>
                  ))}
                </Marquee>
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
                  <OptionCard op={op} cur={cur} from={trip.from!} to={trip.to!} selected={sel === op.key} open={open === op.key} highlight={i === 0}
                    onSelect={() => { setSel(op.key); setOpen(o => o === op.key ? null : op.key) }}
                    actions={<FeedbackButton size="sm" done="Logged" celebrate onClick={() => log(op.key)}>I took this · log {op.cost ? money(roundNice(op.cost), cur) : 'it'}</FeedbackButton>} />
                </motion.div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <FeedbackButton variant="secondary" size="sm" done="Link copied" onClick={share}><Link2 /> Copy link to this trip</FeedbackButton>
                <span className="text-xs text-muted-foreground">{loading ? 'Updating… · ' : ''}Prices are estimates in {cur} for {countryName(cc)}. Driving assumes typical traffic for the hour.</span>
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
