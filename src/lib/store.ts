// App data, persisted to this browser's localStorage, shared through a tiny external store.
import { useSyncExternalStore } from 'react'
import type { Place } from './api'
import { COUNTRIES, FALLBACK_COUNTRY, defaultRates, type Rates } from './rates'
import { hav, todayISO } from './format'

export type Prefs = {
  home: Place | null
  country: string | null      // whose default prices are in use (auto-set from your first trip)
  rates: Rates
  priority: 'money' | 'balanced' | 'time'
  hasCar: boolean; hasBike: boolean; parkMin: number
  budget: number; cycleDay: number; workdays: 5 | 6 | 7; visit: number
}
export type Trip = { id: string; t: string; from?: string; to?: string; mode: string; label: string; note?: string; cost: number; cur: string; parts: Record<string, number> }
export type Stop = { place: Place; meet: string; visit: number | null }
export type Plan = { date: string; start: Place | null; startTime: string; ret: boolean; stops: Stop[]; choice: Record<string, string>; example?: boolean }
export type Data = { prefs: Prefs; days: Record<string, { trips: Trip[] }>; plans: Record<string, Plan>; recent: Place[] }

const KEY = 'farewise-v2'
const LEGACY_KEY = 'farewise-v1'
export const DEFAULT_PREFS: Prefs = {
  home: null, country: null, rates: defaultRates(FALLBACK_COUNTRY), priority: 'balanced',
  hasCar: false, hasBike: false, parkMin: 8, budget: 0, cycleDay: 1, workdays: 7, visit: 30,
}

function load(): Data {
  const empty: Data = { prefs: structuredClone(DEFAULT_PREFS), days: {}, plans: {}, recent: [] }
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return empty
    const o = JSON.parse(raw)
    const prefs = { ...empty.prefs, ...(o.prefs ?? {}) }
    prefs.rates = { ...defaultRates(prefs.country ?? FALLBACK_COUNTRY), ...(o.prefs?.rates ?? {}) }
    return { prefs, days: o.days ?? {}, plans: o.plans ?? {}, recent: o.recent ?? [] }
  } catch { return empty }
}

let data: Data = load()
const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined
let saveFailed = false
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); saveFailed = false }
    catch { saveFailed = true }
  }, 250)
}
export const lastSaveFailed = () => saveFailed

/** Mutate a copy of the data, then publish and save it. */
export function update(fn: (d: Data) => void) {
  const next = structuredClone(data)
  fn(next)
  data = next
  persist()
  listeners.forEach(l => l())
}
export const getData = () => data
export function useData() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => data)
}

/* ---------- helpers that change data ---------- */
export function rememberPlace(p: Place) {
  update(d => { d.recent = [p, ...d.recent.filter(x => x.name !== p.name || hav(x, p) > 0.05)].slice(0, 8) })
}
export function setCountry(cc: string) {
  update(d => { d.prefs.country = cc; d.prefs.rates = { ...defaultRates(cc), lper100: d.prefs.rates.lper100 || 7.5 } })
}
/** The first trip anywhere sets local prices automatically. */
export function autoCountry(p?: Place | null) {
  if (!data.prefs.country && p?.cc && COUNTRIES[p.cc]) setCountry(p.cc)
}
export function addTrips(date: string, trips: Trip[]) {
  const before = structuredClone(data.days[date]?.trips ?? [])
  update(d => { d.days[date] = { trips: [...(d.days[date]?.trips ?? []), ...trips] } })
  return () => update(d => { d.days[date] = { trips: before } })
}
export function blankPlan(date: string): Plan { return { date, start: null, startTime: '09:00', ret: true, stops: [], choice: {} } }
export const planFor = (date: string) => data.plans[date] ?? blankPlan(date)
export function savePlan(p: Plan) { update(d => { const { example: _, ...rest } = p; d.plans[p.date] = rest }) }

/* ---------- backup codes: move data between browsers ---------- */
export const makeBackup = () => 'FW2.' + btoa(unescape(encodeURIComponent(JSON.stringify(data))))
export function importBackup(code: string): number | null {
  code = code.trim()
  if (!/^FW[12]\./.test(code)) return null
  let o: Partial<Data>
  try { o = JSON.parse(decodeURIComponent(escape(atob(code.slice(4))))) } catch { return null }
  let added = 0
  update(d => {
    for (const [date, doc] of Object.entries(o.days ?? {})) {
      const cur = d.days[date]?.trips ?? []
      const ids = new Set(cur.map(t => t.id))
      const add = (doc.trips ?? []).filter(t => !ids.has(t.id))
      added += add.length
      d.days[date] = { trips: [...cur, ...add] }
    }
    for (const [date, plan] of Object.entries(o.plans ?? {})) if (!d.plans[date]) d.plans[date] = plan
    if (!d.prefs.home && o.prefs?.home) d.prefs = { ...d.prefs, ...o.prefs }
    for (const p of o.recent ?? []) if (!d.recent.some(x => x.name === p.name)) d.recent.push(p)
    d.recent = d.recent.slice(0, 8)
  })
  return added
}
export function clearAll() { try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ } }
export const today = todayISO
