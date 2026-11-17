// Formatting, dates and geometry helpers.

export type LatLng = { lat: number; lng: number }

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

export const fmtMin = (m: number) => {
  m = Math.max(1, Math.round(m))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return `${h} h${r ? ` ${r} min` : ''}`
}
export const toMin = (s?: string | null) => {
  if (!s || !/^\d{1,2}:\d{2}/.test(s)) return null
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
export const toHM = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
export const timeOf = (d: Date) => TIME_FMT.format(d)
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
export const todayISO = () => isoDate(new Date())
export const atLocal = (dateISO: string, hm?: string) => new Date(`${dateISO}T${hm || '09:00'}:00`)
export const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000)
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDate(d) }
export const prettyDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export function hav(a: LatLng, b: LatLng) {
  const r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(s))
}

// Google encoded polyline (Transitous uses precision 6)
export function decodePolyline(str: string, precision = 5): [number, number][] {
  const f = 10 ** precision, out: [number, number][] = []
  let i = 0, lat = 0, lng = 0
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b: number
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      const v = result & 1 ? ~(result >> 1) : result >> 1
      if (k === 0) lat += v; else lng += v
    }
    out.push([lat / f, lng / f])
  }
  return out
}

const FMT: Record<string, Intl.NumberFormat> = {}
export function money(n: number, cur = 'USD') {
  try {
    const base = FMT[cur] ??= new Intl.NumberFormat(undefined, { style: 'currency', currency: cur })
    const digits = Math.abs(n) >= 50 ? 0 : (base.resolvedOptions().maximumFractionDigits ?? 2)
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
  } catch { return `${cur} ${Math.round(n)}` }
}
export const roundNice = (n: number) => n >= 1000 ? Math.round(n / 10) * 10 : n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 2) / 2 : Math.round(n * 10) / 10
export const fmtDist = (km: number) => km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`
export const ordinal = (n: number) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')
