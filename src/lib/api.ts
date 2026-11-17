// Clients for the free, keyless services Farewise is built on.
//   Search   Photon (Komoot), built on OpenStreetMap ........ https://photon.komoot.io
//   Roads    OSRM servers run by FOSSGIS (car / bike / foot) . https://routing.openstreetmap.de
//   Transit  Transitous (MOTIS 2), community-run, worldwide .. https://transitous.org
// All are volunteer or community services: responses are cached, and routing only runs once both
// ends of a trip are chosen (never per keystroke).
import { decodePolyline } from './format'

export type Place = { name: string; area: string; lat: number; lng: number; cc: string }

const API = {
  photon: 'https://photon.komoot.io',
  osrm: 'https://routing.openstreetmap.de',
  transit: 'https://api.transitous.org/api/v5',
}

const cache = new Map<string, Promise<any>>()
export const clearNetCache = () => cache.clear()
function getJSON(url: string, timeoutMs = 15000): Promise<any> {
  const hit = cache.get(url)
  if (hit) return hit
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const p = fetch(url, { signal: ctl.signal })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
    .finally(() => clearTimeout(timer))
  cache.set(url, p)
  p.catch(() => cache.delete(url))
  if (cache.size > 300) cache.delete(cache.keys().next().value!)
  return p
}

/* ---------- places ---------- */
function photonToPlace(f: any): Place {
  const p = f.properties ?? {}
  const [lng, lat] = f.geometry.coordinates
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const name = p.name || street || p.city || p.state || p.country || 'Dropped pin'
  const parts = [p.name && street ? street : '', p.district || p.locality || '', p.city || p.county || '', p.country || '']
  const area = [...new Set(parts.filter(x => x && x !== name))].slice(0, 3).join(', ')
  return { name, area, lat, lng, cc: String(p.countrycode || '').toUpperCase() }
}
export async function searchPlaces(q: string, bias?: { lat: number; lng: number } | null): Promise<Place[]> {
  const u = new URL(`${API.photon}/api/`)
  u.searchParams.set('q', q)
  u.searchParams.set('limit', '6')
  if (bias) { u.searchParams.set('lat', bias.lat.toFixed(3)); u.searchParams.set('lon', bias.lng.toFixed(3)) }
  const j = await getJSON(u.toString(), 8000)
  return (j.features ?? []).map(photonToPlace)
}
export async function reversePlace(lat: number, lng: number): Promise<Place> {
  const j = await getJSON(`${API.photon}/reverse?lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&limit=1`, 8000)
  const f = (j.features ?? [])[0]
  const p = f ? photonToPlace(f) : { name: 'My location', area: '', cc: '', lat, lng }
  return { ...p, name: p.name || 'My location', lat, lng }
}

/* ---------- roads ---------- */
export type RoadRoute = { km: number; min: number; line: [number, number][] }
const PROFILE = { car: 'routed-car', bike: 'routed-bike', foot: 'routed-foot' } as const
export async function roadRoute(kind: keyof typeof PROFILE, o: Place, d: Place): Promise<RoadRoute | null> {
  const url = `${API.osrm}/${PROFILE[kind]}/route/v1/driving/${o.lng.toFixed(6)},${o.lat.toFixed(6)};${d.lng.toFixed(6)},${d.lat.toFixed(6)}?overview=full&geometries=geojson&steps=false`
  const j = await getJSON(url, 12000)
  if (j.code !== 'Ok' || !j.routes?.length) return null
  const r = j.routes[0]
  return { km: r.distance / 1000, min: r.duration / 60, line: r.geometry.coordinates.map(([x, y]: [number, number]) => [y, x]) }
}

/* ---------- public transit ---------- */
export type TransitLeg = {
  mode: string; from: string; to: string; start: Date; end: Date; min: number; km: number
  route: string; color: string | null; text: string | null; head: string; agency: string; stops: number; realTime: boolean
  line: [number, number][]
}
export type Itinerary = { start: Date; end: Date; min: number; transfers: number; legs: TransitLeg[] }

export async function transitPlan(o: Place, d: Place, when: Date, arriveBy: boolean): Promise<Itinerary[]> {
  const u = new URL(`${API.transit}/plan`)
  u.searchParams.set('fromPlace', `${o.lat.toFixed(6)},${o.lng.toFixed(6)}`)
  u.searchParams.set('toPlace', `${d.lat.toFixed(6)},${d.lng.toFixed(6)}`)
  // round to 5 minutes so repeated lookups hit the cache
  u.searchParams.set('time', new Date(Math.round(when.getTime() / 300000) * 300000).toISOString())
  if (arriveBy) u.searchParams.set('arriveBy', 'true')
  const j = await getJSON(u.toString(), 20000)
  return (j.itineraries ?? []).map((it: any): Itinerary => ({
    start: new Date(it.startTime), end: new Date(it.endTime), min: it.duration / 60, transfers: it.transfers || 0,
    legs: it.legs.map((l: any): TransitLeg => ({
      mode: l.mode,
      from: l.from.name === 'START' ? o.name : l.from.name,
      to: l.to.name === 'END' ? d.name : l.to.name,
      start: new Date(l.startTime), end: new Date(l.endTime), min: l.duration / 60, km: (l.distance || 0) / 1000,
      route: l.routeShortName || l.displayName || l.routeLongName || '',
      color: l.routeColor ? `#${l.routeColor}` : null, text: l.routeTextColor ? `#${l.routeTextColor}` : null,
      head: l.headsign || '', agency: l.agencyName || '', stops: (l.intermediateStops ?? []).length + 1, realTime: !!l.realTime,
      line: l.legGeometry ? decodePolyline(l.legGeometry.points, l.legGeometry.precision || 6) : [],
    })),
  }))
}
