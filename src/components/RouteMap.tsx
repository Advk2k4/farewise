import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Line } from '@/lib/options'
import { cn } from '@/lib/utils'

export type MapPoint = { lat: number; lng: number; label: string; kind: 'from' | 'to' | 'stop'; n?: number }

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#000'

/** Leaflet map with OpenStreetMap tiles; redraws only when its points or lines change. */
export function RouteMap({ points, lines, className }: { points: MapPoint[]; lines: Line[]; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const bounds = useRef<L.LatLngBounds | L.LatLng | null>(null)
  const userMoved = useRef(false)
  // Fit the map to what it shows, unless the user has panned or zoomed since the last fit
  const fit = (animate: boolean) => {
    const m = map.current, b = bounds.current
    if (!m || !b || userMoved.current) return
    m.stop()
    if (b instanceof L.LatLng) m.setView(b, 15, { animate })
    else m.fitBounds(b, { padding: [40, 40], maxZoom: 16, animate })
  }

  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([25, 10], 2)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    m.on('dragstart', () => { userMoved.current = true })
    for (const ev of ['wheel', 'touchmove', 'dblclick']) m.getContainer().addEventListener(ev, () => { userMoved.current = true }, { passive: true })
    m.zoomControl.getContainer()?.addEventListener('click', () => { userMoved.current = true })
    const ro = new ResizeObserver(() => { m.invalidateSize({ pan: false }); fit(false) })
    ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); map.current = null }
  }, [])

  const key = JSON.stringify([points.map(p => [p.lat, p.lng, p.label]), lines.map(l => [l.cat, l.color, l.coords.length, l.coords[0]])])
  useEffect(() => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const ink = css('--foreground'), canvas = css('--background'), faint = css('--faint')
    const pts: L.LatLngExpression[] = []
    for (const l of lines) {
      if (l.coords.length < 2) continue
      const walk = l.cat === 'walk'
      L.polyline(l.coords, { color: walk ? faint : l.color || ink, weight: walk ? 4 : 6, opacity: 0.95, dashArray: walk ? '1 9' : undefined, lineCap: 'round', lineJoin: 'round' }).addTo(g)
      pts.push(...l.coords)
    }
    for (const p of points) {
      const isEnd = p.kind !== 'stop'
      const html = isEnd
        ? `<span style="display:block;width:16px;height:16px;border-radius:${p.kind === 'from' ? '50%' : '3px'};background:${ink};box-shadow:0 0 0 3px ${canvas},0 2px 8px rgba(0,0,0,.3)"></span>`
        : `<span style="display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:${canvas};color:${ink};font:600 12px/1 system-ui;box-shadow:inset 0 0 0 2px ${ink},0 2px 8px rgba(0,0,0,.25)">${p.n ?? ''}</span>`
      const size = isEnd ? 16 : 24
      L.marker([p.lat, p.lng], { icon: L.divIcon({ html: `<span class="fw-pop">${html}</span>`, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), keyboard: false, title: p.label })
        .bindTooltip(p.label, { direction: 'top', offset: [0, -10] }).addTo(g)
      pts.push([p.lat, p.lng])
    }
    // a new trip always re-centres the map, even after the user moved it
    userMoved.current = false
    bounds.current = pts.length === 1 ? L.latLng(pts[0] as [number, number]) : pts.length ? L.latLngBounds(pts) : null
    fit(true)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={cn('isolate overflow-hidden rounded-2xl bg-muted', className)} role="region" aria-label="Map of the route" />
}
