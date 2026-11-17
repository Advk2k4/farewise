// Offline metro / suburban-rail routing for cities the live transit service doesn't cover well.
// Networks come from OpenStreetMap (scripts/fetch-networks.mjs → public/networks/*.json): lines and
// their stations in order, but no timetables, so times are estimates from distance and typical waits.
import { addMin, hav, type LatLng } from './format'
import type { Place } from './api'
import type { Option, RoutingPrefs, Seg, Line } from './options'

type NetLine = { ref: string; name: string; colour: string | null; mode: 'metro' | 'rail' | 'monorail'; network: string; stops: [string, number, number][] }
type Network = { id: string; name: string; cc: string; bbox: [number, number, number, number]; updated: string; lines: NetLine[] }
type IndexEntry = { id: string; name: string; cc: string; bbox: [number, number, number, number] }

const BASE = `${import.meta.env.BASE_URL}networks/`
let indexP: Promise<IndexEntry[]> | null = null
const netP = new Map<string, Promise<Graph>>()
const inBox = (p: LatLng, [s, w, n, e]: number[]) => p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e

const SPEED = { metro: 33, monorail: 25, rail: 38 }   // km/h, stops included
const WAIT = { metro: 5, monorail: 8, rail: 6 }        // typical wait at boarding, min
const MODE_LABEL = { metro: 'Metro', monorail: 'Monorail', rail: 'Local train' }

type Node = { id: number; line: number; name: string; lat: number; lng: number }
type Edge = { to: number; min: number; km: number; kind: 'ride' | 'xfer'; walk?: number }
type Graph = { net: Network; nodes: Node[]; adj: Edge[][] }

function buildGraph(net: Network): Graph {
  const nodes: Node[] = [], adj: Edge[][] = []
  net.lines.forEach((l, li) => {
    let prev = -1
    for (const [raw, lat, lng] of l.stops) {
      const id = nodes.length
      const name = raw.replace(/\s*\([^)]*\b(line|metro|station|rrts)\b[^)]*\)\s*$/i, '').trim()
      nodes.push({ id, line: li, name, lat, lng }); adj.push([])
      if (prev >= 0) {
        const km = hav(nodes[prev], nodes[id]) * 1.1, min = km / SPEED[l.mode] * 60 + 0.5
        adj[prev].push({ to: id, min, km, kind: 'ride' }); adj[id].push({ to: prev, min, km, kind: 'ride' })
      }
      prev = id
    }
  })
  // interchanges: stations of different lines within 350 m (bucketed by ~1 km grid)
  const grid = new Map<string, number[]>()
  const cell = (n: Node) => `${Math.floor(n.lat * 100)}:${Math.floor(n.lng * 100)}`
  for (const n of nodes) { const k = cell(n); (grid.get(k) ?? grid.set(k, []).get(k)!).push(n.id) }
  for (const a of nodes) {
    const [ci, cj] = cell(a).split(':').map(Number)
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const bid of grid.get(`${ci + di}:${cj + dj}`) ?? []) {
      const b = nodes[bid]
      if (b.id <= a.id || b.line === a.line) continue
      const d = hav(a, b)
      if (d > 0.35) continue
      const walk = 3 + d * 1000 / 70
      adj[a.id].push({ to: b.id, min: walk + WAIT[net.lines[b.line].mode], km: 0, kind: 'xfer', walk })
      adj[b.id].push({ to: a.id, min: walk + WAIT[net.lines[a.line].mode], km: 0, kind: 'xfer', walk })
    }
  }
  return { net, nodes, adj }
}

async function graphFor(o: LatLng, d: LatLng): Promise<Graph | null> {
  indexP ??= fetch(`${BASE}index.json`).then(r => r.ok ? r.json() : []).catch(() => [])
  const hit = (await indexP).find(c => inBox(o, c.bbox) && inBox(d, c.bbox))
  if (!hit) return null
  if (!netP.has(hit.id)) netP.set(hit.id, fetch(`${BASE}${hit.id}.json`).then(r => r.json()).then(buildGraph))
  try { return await netP.get(hit.id)! } catch { netP.delete(hit.id); return null }
}

// India: distance-based fares (metro ≈ ₹10–60, suburban 2nd class ≈ ₹5–25); elsewhere one fare per ticket
function fare(mode: NetLine['mode'], km: number, cc: string, base: number) {
  if (cc === 'IN') {
    const slabs: [number, number][] = mode === 'rail' ? [[10, 5], [20, 10], [45, 15], [70, 20], [999, 25]] : [[2, 10], [5, 20], [12, 30], [21, 40], [32, 50], [999, 60]]
    return slabs.find(([k]) => km <= k)![1]
  }
  return base
}

class Heap { a: [number, number][] = []
  push(x: [number, number]) { const a = this.a; a.push(x); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p } }
  pop() { const a = this.a, top = a[0], last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m } } return top }
  get size() { return this.a.length } }

type Access = { mode: 'walk' | 'auto' | 'taxi'; min: number; cost: number; km: number }
function access(p: LatLng, n: Node, P: RoutingPrefs, walkOnly: boolean): Access | null {
  const straight = hav(p, n), walkKm = straight * 1.25
  if (walkKm <= 1.1) return { mode: 'walk', min: walkKm / 4.5 * 60, cost: 0, km: walkKm }
  if (walkOnly) return walkKm <= 2 ? { mode: 'walk', min: walkKm / 4.5 * 60, cost: 0, km: walkKm } : null
  const km = straight * 1.35, min = 4 + km / 18 * 60
  const R = P.rates
  if (R.autoBase != null && R.autoKm != null && !(p.lat >= 18.88 && p.lat <= 19.035 && p.lng >= 72.77 && p.lng <= 72.875)) return { mode: 'auto', min, km, cost: R.autoBase + R.autoKm * Math.max(0, km - 1.5) }
  return { mode: 'taxi', min, km, cost: R.taxiBase + R.taxiKm * km + R.taxiMin * (km / 18 * 60) }
}

export async function offlineTransit(o: Place, d: Place, when: Date, arriveBy: boolean, P: RoutingPrefs, cc: string): Promise<Option[]> {
  if (hav(o, d) < 1) return []
  const g = await graphFor(o, d)
  if (!g) return []
  const out: Option[] = [], seen = new Set<string>()
  const lam = { money: 25, balanced: 10, time: 3 }[P.priority] / Math.max(P.rates.fare, 1e-6)
  const variants: [boolean, (m: NetLine['mode']) => boolean][] = [[false, () => true], [false, m => m !== 'rail'], [false, m => m === 'rail'], [true, () => true]]
  for (const [walkOnly, allow] of variants) {
    const N = g.nodes.length, dist = new Float64Array(N).fill(Infinity)
    const prev: ({ from: number; e: Edge } | { from: -1; acc: Access } | null)[] = new Array(N).fill(null)
    const heap = new Heap()
    for (const n of g.nodes) {
      if (!allow(g.net.lines[n.line].mode) || hav(o, n) > 3) continue
      const acc = access(o, n, P, walkOnly); if (!acc) continue
      const w = acc.min + WAIT[g.net.lines[n.line].mode] + lam * acc.cost + (acc.mode === 'walk' ? Math.max(0, acc.min - 12) * 0.6 : 2)
      if (w < dist[n.id]) { dist[n.id] = w; prev[n.id] = { from: -1, acc }; heap.push([w, n.id]) }
    }
    const egress = new Map<number, Access>()
    for (const n of g.nodes) { if (!allow(g.net.lines[n.line].mode) || hav(d, n) > 3) continue; const acc = access(d, n, P, walkOnly); if (acc) egress.set(n.id, acc) }
    let best = Infinity, bestNode = -1
    while (heap.size) {
      const [w, u] = heap.pop()
      if (w > dist[u] || w >= best) continue
      const eg = egress.get(u), p = prev[u]
      if (eg && p && p.from !== -1) {
        const t = w + eg.min + lam * eg.cost + (eg.mode === 'walk' ? Math.max(0, eg.min - 12) * 0.6 : 2)
        if (t < best) { best = t; bestNode = u }
      }
      for (const e of g.adj[u]) {
        if (!allow(g.net.lines[g.nodes[e.to].line].mode)) continue
        const nw = w + e.min + (e.kind === 'xfer' ? 3 : 0)
        if (nw < dist[e.to]) { dist[e.to] = nw; prev[e.to] = { from: u, e }; heap.push([nw, e.to]) }
      }
    }
    if (bestNode < 0) continue
    // walk back the path
    const chain: number[] = []
    let v = bestNode, startAcc: Access | null = null
    while (v >= 0) { chain.unshift(v); const p = prev[v]!; if ('acc' in p) { startAcc = p.acc; break } v = p.from }
    const eg = egress.get(bestNode)!
    const segs: Seg[] = [], lines: Line[] = [], parts: Record<string, number> = {}
    const accSeg = (a: Access, from: string, to: string): Seg => ({ cat: a.mode === 'walk' ? 'walk' : 'taxi', label: a.mode === 'walk' ? 'Walk' : a.mode === 'auto' ? 'Auto' : 'Taxi', min: a.min, km: a.km, from, to })
    segs.push(accSeg(startAcc!, o.name, g.nodes[chain[0]].name))
    lines.push({ coords: [[o.lat, o.lng], [g.nodes[chain[0]].lat, g.nodes[chain[0]].lng]], cat: startAcc!.mode === 'walk' ? 'walk' : 'taxi' })
    if (startAcc!.mode !== 'walk') parts.taxi = (parts.taxi ?? 0) + startAcc!.cost
    let ride: { line: number; nodes: number[]; km: number; min: number } | null = null
    let cost = startAcc!.cost + (eg.mode === 'walk' ? 0 : eg.cost), transfers = -1, walkMin = (startAcc!.mode === 'walk' ? startAcc!.min : 0) + (eg.mode === 'walk' ? eg.min : 0)
    const flush = () => {
      if (!ride) return
      const L = g.net.lines[ride.line], f = fare(L.mode, ride.km, cc, P.rates.fare)
      cost += f; parts.transit = (parts.transit ?? 0) + f; transfers++
      const label = L.ref && L.ref.length <= 6 ? L.ref : L.name.replace(/\s*line$/i, '')
      segs.push({ cat: L.mode === 'rail' ? 'rail' : 'metro', label, min: ride.min + WAIT[L.mode], km: ride.km, mode: L.mode === 'rail' ? 'SUBURBAN' : 'SUBWAY',
        from: g.nodes[ride.nodes[0]].name, to: g.nodes[ride.nodes[ride.nodes.length - 1]].name, color: L.colour ? normColour(L.colour) : null, text: L.colour ? textOn(normColour(L.colour)) : null,
        head: lineTitle(L), stops: ride.nodes.length - 1 })
      lines.push({ coords: ride.nodes.map(i => [g.nodes[i].lat, g.nodes[i].lng]), cat: L.mode === 'rail' ? 'rail' : 'metro', color: L.colour ? normColour(L.colour) : null })
      ride = null
    }
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1], b = chain[i], e = g.adj[a].find(x => x.to === b)!
      if (e.kind === 'ride') {
        if (!ride) ride = { line: g.nodes[a].line, nodes: [a], km: 0, min: 0 }
        ride.nodes.push(b); ride.km += e.km; ride.min += e.min
      } else { flush(); segs.push({ cat: 'walk', label: 'Walk', min: e.walk!, km: 0, from: g.nodes[a].name, to: g.nodes[b].name }); walkMin += e.walk! }
    }
    flush()
    segs.push(accSeg(eg, g.nodes[bestNode].name, d.name))
    lines.push({ coords: [[g.nodes[bestNode].lat, g.nodes[bestNode].lng], [d.lat, d.lng]], cat: eg.mode === 'walk' ? 'walk' : 'taxi' })
    if (eg.mode !== 'walk') parts.taxi = (parts.taxi ?? 0) + eg.cost
    const rideSegs = segs.filter(s => s.cat === 'metro' || s.cat === 'rail')
    if (!rideSegs.length) continue
    const sig = rideSegs.map(s => s.label + s.from + s.to).join('>')
    if (seen.has(sig)) continue
    seen.add(sig)
    const min = segs.reduce((a, s) => a + s.min, 0)
    const depart = arriveBy ? addMin(when, -min) : when
    const names = [...new Set(rideSegs.map(s => s.head!))]
    out.push({
      key: `offline:${sig}`, kind: 'transit', title: names.join(' + '),
      sub: `${transfers ? `${transfers} change${transfers > 1 ? 's' : ''}` : 'No changes'} · estimated, no timetable`,
      min, cost, depart, arrive: addMin(depart, min), walkMin, transfers, segs, lines, parts,
      notes: [`Times are estimates from the ${g.net.name} network map (OpenStreetMap, ${g.net.updated}); check the operator for live times`, ...(cc === 'IN' ? ['Fare is a typical token fare for the distance'] : [])],
      mapsMode: 'transit', score: 0, tags: [], estimated: true,
    })
  }
  return out
}

/** "Yellow Line", "Western line local", "Metro Line 1": readable names from OSM refs and names. */
function lineTitle(L: NetLine) {
  const name = L.name.replace(/\s+/g, ' ').trim(), ref = L.ref.trim()
  if (L.mode === 'rail') return /line/i.test(name) && name.length <= 28 ? `${name} local` : ref ? `Local train ${ref}` : 'Local train'
  if (/^line\s/i.test(name)) return `${MODE_LABEL[L.mode]} ${name}`           // "Line 1" → "Metro Line 1"
  if (/\b(line|rapid|rrts|metro)\b/i.test(name) && name.length <= 28) return name  // "Yellow Line", "Delhi–Meerut RRTS"
  return `${MODE_LABEL[L.mode]} ${ref || name}`.trim()
}

function normColour(c: string) {
  if (c.startsWith('#')) return c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c
  const named: Record<string, string> = { aqua: '#00a8e1', gray: '#8a8a8a', grey: '#8a8a8a', red: '#e53935', blue: '#1e63c6', green: '#2e8b3d', yellow: '#f5c400', orange: '#f28c28', purple: '#7b3fa0', violet: '#7b3fa0', pink: '#e86aa0', magenta: '#c2338b', brown: '#8b5a2b', black: '#222222' }
  return named[c.toLowerCase()] ?? '#555555'
}
function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#ffffff'
}
