/// <reference types="node" />
// Run with `npm test`: rolldown (already installed with Vite) bundles this file, Node's built-in runner checks it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cycleInfo, cycleStartFor, nextCycleStart, shiftCycle } from './budget'
import { DEFAULT_PREFS, addTrips, getData, type Data, type Trip } from './store'
import { rank, type Option } from './options'
import { defaultRates } from './rates'

test('cycles start on the chosen day, clamped to short months', () => {
  assert.equal(cycleStartFor('2026-03-15', 1), '2026-03-01')
  assert.equal(cycleStartFor('2026-03-10', 31), '2026-02-28')
  assert.equal(nextCycleStart('2026-02-28', 31), '2026-03-31')
})

test('cycles roll over the year in both directions', () => {
  assert.equal(cycleStartFor('2026-01-10', 25), '2025-12-25')
  assert.equal(nextCycleStart('2025-12-25', 25), '2026-01-25')
  assert.equal(shiftCycle('2026-01-25', -1, 25), '2025-12-25')
  assert.equal(shiftCycle('2025-12-25', 2, 25), '2026-02-25')
})

const trip = (id: string, cost: number, cur = 'GBP'): Trip => ({ id, t: '09:00', mode: 'taxi', label: 'Taxi', cost, cur, parts: { taxi: cost } })

test('a closed cycle counts only home-currency trips and its own days', () => {
  const data: Data = {
    prefs: { ...DEFAULT_PREFS, country: 'GB', budget: 100, cycleDay: 1, workdays: 5 },
    days: { '2025-01-03': { trips: [trip('a', 20), trip('b', 50, 'EUR')] }, '2025-01-31': { trips: [trip('c', 5)] }, '2025-02-01': { trips: [trip('d', 99)] } },
    plans: {}, recent: [],
  }
  const mi = cycleInfo(data, '2025-01-01')
  assert.equal(mi.dates.length, 31)
  assert.equal(mi.total, 23)              // weekdays in January 2025
  assert.equal(mi.spent, 25)
  assert.equal(mi.other.length, 1)        // the EUR trip is listed, not counted
  assert.equal(mi.left, 75)
  assert.equal(mi.remaining, 0)
  assert.equal(mi.perDay, 0)
})

test('undo removes only the trips it logged', () => {
  const undoA = addTrips('2030-05-01', [trip('A', 1)])
  addTrips('2030-05-01', [trip('B', 2)])
  undoA()
  assert.deepEqual(getData().days['2030-05-01'].trips.map(t => t.id), ['B'])
})

test('Fastest is the shortest door-to-door time, not the earliest arrival', () => {
  // Arrive by 09:00: the bus arrives early but takes 45 min; the taxi takes 15 min and arrives on time
  const at = (hm: string) => new Date(`2030-05-01T${hm}:00`)
  const op = (key: string, kind: Option['kind'], min: number, cost: number, depart: string, arrive: string): Option =>
    ({ key, kind, title: key, sub: '', min, cost, depart: at(depart), arrive: at(arrive), segs: [], lines: [], notes: [], mapsMode: '', parts: {}, score: 0, tags: [] })
  const opts = [op('bus', 'transit', 45, 2.8, '08:00', '08:45'), op('taxi', 'taxi', 15, 18, '08:45', '09:00'), op('walk', 'walk', 70, 0, '07:50', '09:00')]
  rank(opts, { rates: defaultRates('GB'), cc: 'GB', priority: 'balanced', hasCar: false, hasBike: false, parkMin: 8 })
  assert.deepEqual(opts.filter(o => o.tags.includes('Fastest')).map(o => o.key), ['taxi'])
})
