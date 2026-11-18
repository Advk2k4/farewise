// Light / dark / system theme: saved per browser, applied as the `dark` class on <html>.
// index.html applies the saved choice before first paint, so there's no flash of the wrong theme.
import { useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'farewise-theme'
const mq = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system' } catch { return 'system' }
}
let choice: ThemeChoice = read()
const resolve = (c: ThemeChoice) => c === 'system' ? (mq.matches ? 'dark' : 'light') : c

function apply() {
  const dark = resolve(choice) === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  // browser chrome (mobile address bar) matches the page
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#000000' : '#ffffff'))
  listeners.forEach(l => l())
}

export function setTheme(c: ThemeChoice) {
  choice = c
  try { if (c === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, c) } catch { /* private mode */ }
  // cross-fade the colour change instead of snapping (skipped for reduced motion)
  const root = document.documentElement
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-fade')
    setTimeout(() => root.classList.remove('theme-fade'), 320)
  }
  apply()
}
export function initTheme() {
  apply()
  mq.addEventListener('change', () => { if (choice === 'system') apply() })
}
export function useTheme() {
  const snap = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => `${choice}|${resolve(choice)}`)
  const [c, r] = snap.split('|') as [ThemeChoice, 'light' | 'dark']
  return { choice: c, resolved: r }
}
