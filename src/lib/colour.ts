// Small colour helpers so operator line colours stay visible on both light and dark surfaces.
const hex = (c: string) => { let h = c.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
export const luminance = (c: string) => { try { const [r, g, b] = hex(c); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) } catch { return 0.5 } }
const mix = (c: string, to: number, k: number) => { const [r, g, b] = hex(c); const m = (v: number) => Math.round(v + (to - v) * k); return `#${[m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('')}` }
/** A line colour adjusted to stand out against the page: lighter on dark, darker on light, only when needed. */
export function lineColour(c: string, dark: boolean) {
  const L = luminance(c)
  if (dark && L < 0.06) return mix(c, 255, 0.55)
  if (!dark && L > 0.75) return mix(c, 0, 0.35)
  return c
}
/** True when a chip of this colour would blend into the background, so it needs an outline. */
export const needsOutline = (c: string, dark: boolean) => dark ? luminance(c) < 0.03 : luminance(c) > 0.85
