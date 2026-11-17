#!/usr/bin/env node
// Downloads metro / suburban rail networks from OpenStreetMap (Overpass API) for cities that the
// live transit service (Transitous) doesn't cover well, and writes compact JSON to public/networks/.
// The app routes on these offline when a trip falls inside one of these cities.
//
//   node scripts/fetch-networks.mjs            # all cities
//   node scripts/fetch-networks.mjs delhi mumbai
//
// Data © OpenStreetMap contributors, ODbL. Re-run occasionally to pick up new lines.
import { mkdirSync, writeFileSync } from 'node:fs'

const CITIES = {
  delhi:     { name: 'Delhi NCR', cc: 'IN', bbox: [28.3, 76.8, 28.95, 77.75] },
  mumbai:    { name: 'Mumbai', cc: 'IN', bbox: [18.85, 72.75, 19.5, 73.25] },
  bengaluru: { name: 'Bengaluru', cc: 'IN', bbox: [12.75, 77.4, 13.2, 77.85] },
  chennai:   { name: 'Chennai', cc: 'IN', bbox: [12.75, 79.9, 13.3, 80.35] },
  kolkata:   { name: 'Kolkata', cc: 'IN', bbox: [22.35, 88.15, 22.8, 88.55] },
  hyderabad: { name: 'Hyderabad', cc: 'IN', bbox: [17.25, 78.25, 17.6, 78.7] },
  pune:      { name: 'Pune', cc: 'IN', bbox: [18.4, 73.7, 18.7, 74.0] },
  ahmedabad: { name: 'Ahmedabad', cc: 'IN', bbox: [22.9, 72.45, 23.3, 72.75] },
  kochi:     { name: 'Kochi', cc: 'IN', bbox: [9.85, 76.2, 10.15, 76.45] },
  jaipur:    { name: 'Jaipur', cc: 'IN', bbox: [26.75, 75.65, 27.05, 75.95] },
  lucknow:   { name: 'Lucknow', cc: 'IN', bbox: [26.7, 80.8, 27.0, 81.1] },
  nagpur:    { name: 'Nagpur', cc: 'IN', bbox: [21.0, 78.9, 21.3, 79.2] },
}
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const UA = 'Farewise-build/2 (https://github.com/Advk2k4/farewise)'

function query([s, w, n, e]) {
  const bb = `${s},${w},${n},${e}`
  return `[out:json][timeout:240];
(
  rel["type"="route"]["route"~"^(subway|light_rail|monorail)$"](${bb});
  rel["type"="route"]["route"="train"]["network"~"suburban|mrts|local|emu|rrts|rapidx",i](${bb});
  rel["type"="route"]["route"="train"]["name"~"local|suburban|mrts|emu",i](${bb});
)->.r;
.r out body;
node(r.r);
out body;`
}

async function overpass(q) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = SERVERS[attempt % SERVERS.length]
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(280000) })
      if (r.ok) return await r.json()
      console.warn(`  ${url} → HTTP ${r.status}, retrying`)
    } catch (e) { console.warn(`  ${url} → ${e.message}, retrying`) }
    await new Promise(res => setTimeout(res, 15000 * (attempt + 1)))
  }
  throw new Error('Overpass unavailable')
}

const STOP_ROLES = new Set(['stop', 'stop_entry_only', 'stop_exit_only'])
const round = x => Math.round(x * 1e5) / 1e5

function build(json) {
  const nodes = new Map(json.elements.filter(e => e.type === 'node').map(n => [n.id, n]))
  const rels = json.elements.filter(e => e.type === 'relation')
  const lines = [], seen = new Set()
  for (const r of rels) {
    const t = r.tags ?? {}
    let members = r.members.filter(m => m.type === 'node' && STOP_ROLES.has(m.role))
    if (members.length < 2) members = r.members.filter(m => m.type === 'node' && /station|halt|stop/.test(nodes.get(m.ref)?.tags?.railway ?? nodes.get(m.ref)?.tags?.public_transport ?? ''))
    const stops = []
    for (const m of members) {
      const n = nodes.get(m.ref)
      if (!n) continue
      const name = n.tags?.name ?? n.tags?.['name:en']
      if (!name) continue
      const clean = name.replace(/\s*\((metro|station|platform[^)]*)\)\s*$/i, '').trim()
      if (stops.length && stops[stops.length - 1][0] === clean) continue
      stops.push([clean, round(n.lat), round(n.lon)])
    }
    if (stops.length < 2) continue
    const sig = stops.map(s => s[0]).join('|')
    const rev = [...stops].reverse().map(s => s[0]).join('|')
    if (seen.has(sig) || seen.has(rev)) continue
    seen.add(sig)
    const mode = t.route === 'train' ? 'rail' : t.route === 'monorail' ? 'monorail' : 'metro'
    const base = (t.name ?? '').replace(/\s*[(:].*$/, '').trim()
    lines.push({ ref: t.ref ?? '', name: base || t.ref || 'Line', colour: t.colour ?? null, mode, network: t.network ?? '', stops })
  }
  return lines
}

const pick = process.argv.slice(2)
mkdirSync('public/networks', { recursive: true })
const index = []
for (const [id, c] of Object.entries(CITIES)) {
  if (pick.length && !pick.includes(id)) continue
  console.log(`${c.name}…`)
  try {
    const lines = build(await overpass(query(c.bbox)))
    writeFileSync(`public/networks/${id}.json`, JSON.stringify({ id, name: c.name, cc: c.cc, bbox: c.bbox, updated: new Date().toISOString().slice(0, 10), lines }))
    console.log(`  ${lines.length} line variants, ${new Set(lines.flatMap(l => l.stops.map(s => s[0]))).size} stations`)
    index.push({ id, name: c.name, cc: c.cc, bbox: c.bbox })
  } catch (e) { console.error(`  failed: ${e.message}`) }
  await new Promise(res => setTimeout(res, 5000))
}
if (!pick.length) writeFileSync('public/networks/index.json', JSON.stringify(index))
console.log('done')
