// Turns route lookups into comparable options: time, estimated cost, ranking and tags.
import { addMin, hav, timeOf } from './format'
import { roadRoute, transitPlan, type Place } from './api'
import type { Rates } from './rates'

export type Cat = 'walk' | 'bike' | 'car' | 'taxi' | 'bus' | 'tram' | 'metro' | 'rail' | 'ferry'
export type Kind = 'walk' | 'bike' | 'car' | 'taxi' | 'transit'
export type Seg = {
  cat: Cat; label: string; min: number; km: number; from: string; to: string
  color?: string | null; text?: string | null; head?: string; stops?: number; mode?: string; start?: Date; realTime?: boolean
}
export type Line = { coords: [number, number][]; cat: Cat; color?: string | null }
export type Option = {
  key: string; kind: Kind; title: string; sub: string
  min: number; cost: number; costLo?: number; costHi?: number
  depart: Date; arrive: Date; walkMin?: number; transfers?: number
  segs: Seg[]; lines: Line[]; notes: string[]; mapsMode: string; parts: Record<string, number>
  score: number; tags: string[]; rush?: boolean
}
export type TripResult = { opts: Option[]; status: { transit: 'ok' | 'none' | 'error'; road: 'ok' | 'error' } }
export type RoutingPrefs = { rates: Rates; priority: 'money' | 'balanced' | 'time'; hasCar: boolean; hasBike: boolean; parkMin: number }

export const TRANSIT_LABEL: Record<string, string> = {
  BUS: 'Bus', COACH: 'Coach', TRAM: 'Tram', SUBWAY: 'Metro', METRO: 'Metro', RAIL: 'Train', REGIONAL_RAIL: 'Train',
  REGIONAL_FAST_RAIL: 'Train', SUBURBAN: 'Suburban train', HIGHSPEED_RAIL: 'High-speed train', LONG_DISTANCE: 'Train',
  NIGHT_RAIL: 'Night train', FERRY: 'Ferry', AIRPLANE: 'Flight', FUNICULAR: 'Funicular', AERIAL_LIFT: 'Cable car',
  CABLE_CAR: 'Cable car', ODM: 'On-demand ride', OTHER: 'Transit',
}
export const modeCat = (m: string): Cat =>
  m === 'WALK' ? 'walk' : m === 'BIKE' ? 'bike' : m === 'CAR' ? 'car'
  : m === 'BUS' || m === 'COACH' || m === 'ODM' ? 'bus' : m === 'FERRY' ? 'ferry' : m === 'TRAM' ? 'tram'
  : m === 'SUBWAY' || m === 'METRO' ? 'metro' : 'rail'
export const CAT_NAME: Record<Cat, string> = { walk: 'Walk', bike: 'Bike', car: 'Drive', taxi: 'Taxi', bus: 'Bus', tram: 'Tram', metro: 'Metro', rail: 'Train', ferry: 'Ferry' }
const PRIORITY_K = { money: 25, balanced: 10, time: 3 } // minutes one local transit fare is "worth"

// OSRM has no live traffic, so driving time is scaled by typical traffic for the hour.
export function trafficFactor(d: Date) {
  const day = d.getDay(), h = d.getHours() + d.getMinutes() / 60
  if (h >= 22 || h < 6) return 1.0
  if (day === 0 || day === 6) return h >= 11 && h < 20 ? 1.15 : 1.05
  if ((h >= 7 && h < 10) || (h >= 16 && h < 19)) return 1.45
  return 1.2
}

export async function tripOptions(o: Place, d: Place, when: Date, arriveBy: boolean, P: RoutingPrefs): Promise<TripResult> {
  const R = P.rates, km = hav(o, d)
  const [tr, foot, bike, car] = await Promise.allSettled([
    km > 0.5 ? transitPlan(o, d, when, arriveBy) : Promise.resolve([]),
    km <= 8 ? roadRoute('foot', o, d) : Promise.resolve(null),
    P.hasBike && km <= 30 ? roadRoute('bike', o, d) : Promise.resolve(null),
    km > 0.6 ? roadRoute('car', o, d) : Promise.resolve(null),
  ])
  const opts: Option[] = []
  const status: TripResult['status'] = {
    transit: tr.status === 'rejected' ? 'error' : km > 0.5 && !tr.value.length ? 'none' : 'ok',
    road: car.status === 'rejected' ? 'error' : 'ok',
  }
  const timing = (min: number) => arriveBy ? { depart: addMin(when, -min), arrive: when } : { depart: when, arrive: addMin(when, min) }
  const base = { score: 0, tags: [] as string[], notes: [] as string[], parts: {} as Record<string, number> }

  if (foot.status === 'fulfilled' && foot.value && foot.value.min <= 100) {
    const f = foot.value
    opts.push({ ...base, key: 'walk', kind: 'walk', title: 'Walk', sub: `${f.km.toFixed(1)} km on foot`, min: f.min, cost: 0, ...timing(f.min), walkMin: f.min,
      segs: [{ cat: 'walk', label: 'Walk', min: f.min, km: f.km, from: o.name, to: d.name }], lines: [{ coords: f.line, cat: 'walk' }], mapsMode: 'walking' })
  }
  if (bike.status === 'fulfilled' && bike.value && bike.value.min <= 120) {
    const b = bike.value
    opts.push({ ...base, key: 'bike', kind: 'bike', title: 'Cycle', sub: `${b.km.toFixed(1)} km on your own bike`, min: b.min + 2, cost: 0, ...timing(b.min + 2),
      segs: [{ cat: 'bike', label: 'Bike', min: b.min, km: b.km, from: o.name, to: d.name }], lines: [{ coords: b.line, cat: 'bike' }], mapsMode: 'bicycling' })
  }
  if (car.status === 'fulfilled' && car.value) {
    const c = car.value
    const tf = trafficFactor(arriveBy ? addMin(when, -c.min) : when), drive = c.min * tf, rush = tf >= 1.4
    const taxiMin = drive + 5, tc = R.taxiBase + R.taxiKm * c.km + R.taxiMin * drive
    opts.push({ ...base, key: 'taxi', kind: 'taxi', title: 'Taxi or ride-hail', sub: `${c.km.toFixed(1)} km, door to door`, min: taxiMin, cost: tc, costLo: tc * 0.85, costHi: tc * (rush ? 1.5 : 1.2), ...timing(taxiMin), rush,
      segs: [{ cat: 'taxi', label: 'Taxi', min: taxiMin, km: c.km, from: o.name, to: d.name }], lines: [{ coords: c.line, cat: 'taxi' }],
      notes: [...(rush ? ['Rush-hour traffic is likely'] : []), 'Includes about 5 min to get picked up'], mapsMode: 'driving', parts: { taxi: tc } })
    if (P.hasCar) {
      const dm = drive + P.parkMin, fc = c.km * R.lper100 / 100 * R.fuel
      opts.push({ ...base, key: 'car', kind: 'car', title: 'Drive', sub: `${c.km.toFixed(1)} km, fuel only`, min: dm, cost: fc, ...timing(dm), rush,
        segs: [{ cat: 'car', label: 'Drive', min: dm, km: c.km, from: o.name, to: d.name }], lines: [{ coords: c.line, cat: 'car' }],
        notes: [...(rush ? ['Rush-hour traffic is likely'] : []), `Includes ${P.parkMin} min to park; parking fees not included`], mapsMode: 'driving', parts: { car: fc } })
    }
  }
  if (tr.status === 'fulfilled') {
    const seen = new Set<string>()
    for (const it of tr.value) {
      const rides = it.legs.filter(l => l.mode !== 'WALK')
      if (!rides.length) continue
      const sig = rides.map(l => `${l.mode}:${l.route}`).join('>')
      if (seen.has(sig)) continue
      seen.add(sig)
      const cost = R.fare * Math.min(rides.length, 2)
      const walkMin = it.legs.filter(l => l.mode === 'WALK').reduce((a, l) => a + l.min, 0)
      const doorMin = arriveBy ? it.min : (it.end.getTime() - when.getTime()) / 60000 // includes waiting for the first departure
      const names = [...new Set(rides.map(l => l.route ? `${TRANSIT_LABEL[l.mode] ?? 'Transit'} ${l.route}` : TRANSIT_LABEL[l.mode] ?? 'Transit'))]
      opts.push({ ...base, key: `transit:${sig}`, kind: 'transit', title: names.join(' + '),
        sub: `${it.transfers ? `${it.transfers} change${it.transfers > 1 ? 's' : ''}` : 'No changes'} · leaves ${timeOf(it.start)}`,
        min: Math.max(doorMin, it.min), cost, depart: it.start, arrive: it.end, walkMin, transfers: it.transfers,
        segs: it.legs.map(l => ({ cat: modeCat(l.mode), label: l.mode === 'WALK' ? 'Walk' : l.route || TRANSIT_LABEL[l.mode] || 'Transit', min: l.min, km: l.km,
          from: l.from, to: l.to, color: l.color, text: l.text, head: l.head, stops: l.stops, mode: l.mode, start: l.start, realTime: l.realTime })),
        lines: it.legs.map(l => ({ coords: l.line, cat: modeCat(l.mode), color: l.color })),
        notes: [rides.length > 1 ? 'Price assumes a fare per ride (up to 2); transfers are often free' : 'Price is a typical single fare',
          ...(walkMin >= 15 ? [`About ${Math.round(walkMin)} min on foot`] : [])],
        mapsMode: 'transit', parts: { transit: cost } })
      if (opts.filter(x => x.kind === 'transit').length >= 4) break
    }
  }
  rank(opts, P)
  return { opts, status }
}

function rank(opts: Option[], P: RoutingPrefs) {
  const lam = PRIORITY_K[P.priority] / Math.max(P.rates.fare, 1e-6)
  for (const op of opts) {
    let s = op.min + lam * op.cost + (op.transfers ?? 0) * 3
    const w = op.walkMin ?? 0
    if (w > 15) s += (w - 15) * (op.kind === 'walk' ? 0.4 : 0.6)
    if (op.kind === 'bike' && op.min > 40) s += (op.min - 40) * 0.5
    op.score = s
  }
  // drop transit options another transit option clearly beats
  for (let i = opts.length - 1; i >= 0; i--) {
    const a = opts[i]
    if (a.kind !== 'transit') continue
    if (opts.some(b => b !== a && b.kind === 'transit' && b.arrive <= a.arrive && (b.transfers ?? 0) <= (a.transfers ?? 0) && (b.walkMin ?? 0) <= (a.walkMin ?? 0) + 3 && b.score < a.score - 5)) opts.splice(i, 1)
  }
  opts.sort((a, b) => a.score - b.score)
  if (!opts.length) return
  opts.forEach(o => (o.tags = []))
  opts[0].tags.push('Recommended')
  const usable = opts.filter(x => x.kind !== 'walk' || x.min <= 40)
  const cheapest = (usable.length ? usable : opts).reduce((a, b) => b.cost < a.cost - 0.001 || (Math.abs(b.cost - a.cost) < 0.001 && b.min < a.min) ? b : a)
  cheapest.tags.push('Cheapest')
  opts.reduce((a, b) => b.arrive < a.arrive ? b : a).tags.push('Fastest')
}

export const mapsUrl = (o: Place, d: Place, mode: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${o.lat.toFixed(6)},${o.lng.toFixed(6)}&destination=${d.lat.toFixed(6)},${d.lng.toFixed(6)}&travelmode=${mode}`
