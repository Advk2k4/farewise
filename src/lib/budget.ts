// Spending cycles: a cycle runs from a chosen day of the month to the day before it next month.
import { addDays, pad2, shortDate, todayISO } from './format'
import { homeCurrency, type Data, type Trip } from './store'

const dayIn = (cycleDay: number, y: number, m: number) => Math.min(Math.max(1, cycleDay || 1), new Date(y, m + 1, 0).getDate())
export function cycleStartFor(iso: string, cycleDay: number) {
  const d = new Date(`${iso}T12:00:00`)
  let y = d.getFullYear(), m = d.getMonth()
  if (d.getDate() < dayIn(cycleDay, y, m)) { m--; if (m < 0) { m = 11; y-- } }
  return `${y}-${pad2(m + 1)}-${pad2(dayIn(cycleDay, y, m))}`
}
export function nextCycleStart(start: string, cycleDay: number) {
  const d = new Date(`${start}T12:00:00`)
  let y = d.getFullYear(), m = d.getMonth() + 1
  if (m > 11) { m = 0; y++ }
  return `${y}-${pad2(m + 1)}-${pad2(dayIn(cycleDay, y, m))}`
}
export function shiftCycle(start: string, by: number, cycleDay: number) {
  let s = start
  for (let i = 0; i > by; i--) s = cycleStartFor(addDays(s, -1), cycleDay)
  for (let i = 0; i < by; i++) s = nextCycleStart(s, cycleDay)
  return s
}
export const cycleLabel = (start: string, cycleDay: number) => {
  const end = addDays(nextCycleStart(start, cycleDay), -1)
  return `${shortDate(start)} – ${shortDate(end)} ${end.slice(0, 4)}`
}

export type DatedTrip = Trip & { date: string }
export type CycleInfo = ReturnType<typeof cycleInfo>
export function cycleInfo(data: Data, start: string) {
  const { prefs } = data, cd = prefs.cycleDay, cur = homeCurrency(prefs)
  const endX = nextCycleStart(start, cd)
  const dates: string[] = []
  for (let d = start; d < endX; d = addDays(d, 1)) dates.push(d)
  const counts = (iso: string) => { const w = new Date(`${iso}T12:00:00`).getDay(); return prefs.workdays === 7 || (w !== 0 && (prefs.workdays === 6 || w !== 6)) }
  const today = todayISO(), isCur = today >= start && today < endX, past = today >= endX
  let total = 0, elapsed = 0, remaining = 0
  for (const iso of dates) {
    if (!counts(iso)) continue
    total++
    if (iso <= today) elapsed++
    if ((isCur && iso >= today) || (!isCur && !past)) remaining++
  }
  const trips: DatedTrip[] = [], other: DatedTrip[] = []
  for (const [date, doc] of Object.entries(data.days))
    if (date >= start && date < endX) for (const t of doc.trips) ((t.cur || cur) === cur ? trips : other).push({ ...t, date })
  const spent = trips.reduce((a, t) => a + (Number(t.cost) || 0), 0)
  const budget = Number(prefs.budget) || 0, left = budget - spent
  return {
    start, endX, dates, counts, isCur, past, total, elapsed, remaining, trips, other, spent, budget, left, currency: cur,
    perDay: remaining > 0 ? left / remaining : 0,
    projected: elapsed > 0 && isCur ? spent / elapsed * total : spent,
    label: cycleLabel(start, cd),
  }
}
