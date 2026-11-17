import { Suspense, lazy, useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { CalendarDays, Navigation, Settings, Wallet } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TripView, initialTrip, readTripLink, type TripState } from '@/views/TripView'
const PlanView = lazy(() => import('@/views/PlanView').then(m => ({ default: m.PlanView })))
const SpendingView = lazy(() => import('@/views/SpendingView').then(m => ({ default: m.SpendingView })))
const SettingsView = lazy(() => import('@/views/SettingsView').then(m => ({ default: m.SettingsView })))
import { autoCountry, homeCurrency, ratesFor, tripCountry, useData } from '@/lib/store'
import { cn } from '@/lib/utils'

type Tab = 'trip' | 'plan' | 'spending' | 'settings'
const TABS: { id: Tab; label: string; Icon: typeof Navigation }[] = [
  { id: 'trip', label: 'Trip', Icon: Navigation },
  { id: 'plan', label: 'Day plan', Icon: CalendarDays },
  { id: 'spending', label: 'Spending', Icon: Wallet },
]
const initialTab = (): Tab => {
  if (new URLSearchParams(location.search).get('example') === 'plan') return 'plan'
  if (readTripLink()) return 'trip'
  const h = location.hash.slice(1)
  return (['trip', 'plan', 'spending', 'settings'] as Tab[]).includes(h as Tab) ? h as Tab : 'trip'
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5" aria-label="Farewise">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" className="fill-foreground" />
        <path d="M9 19.5h7.5a3.25 3.25 0 0 0 0-6.5h-5a3.25 3.25 0 0 1 0-6.5H19" fill="none" className="stroke-background" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="9" cy="19.5" r="2" className="fill-background" /><rect x="17.5" y="5" width="3.5" height="3.5" rx="0.8" className="fill-background" /></svg>
      <span className="text-[19px] font-bold" translate="no">Farewise</span>
    </span>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [trip, setTrip] = useState<TripState>(initialTrip)
  const { prefs } = useData()

  useEffect(() => { if (trip.from) autoCountry(trip.from) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // keep the current trip in the address bar so it can be bookmarked or shared
  useEffect(() => {
    if (!trip.from || !trip.to) return
    const u = new URL(location.href)
    const f = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`
    u.searchParams.set('from', f(trip.from)); u.searchParams.set('fn', trip.from.name)
    u.searchParams.set('to', f(trip.to)); u.searchParams.set('tn', trip.to.name)
    const cc = trip.from.cc || trip.to.cc; if (cc) u.searchParams.set('cc', cc); else u.searchParams.delete('cc')
    u.searchParams.delete('example')
    history.replaceState(null, '', u)
  }, [trip.from, trip.to])
  // back / forward and edited #hash links switch tabs too
  useEffect(() => {
    const onHash = () => { const h = location.hash.slice(1) as Tab; if (['trip', 'plan', 'spending', 'settings'].includes(h)) setTab(h) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (t: Tab) => { setTab(t); if (location.hash !== `#${t}`) history.pushState(null, '', `${location.pathname}#${t}`); window.scrollTo({ top: 0 }) }

  return (
    <MotionConfig reducedMotion="user">
    <TooltipProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-8">
          <button type="button" onClick={() => go('trip')} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/40"><Logo /></button>
          <nav aria-label="Sections" className="hidden gap-1 md:flex">
            {TABS.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}
                className={cn('relative h-10 rounded-full px-4 text-[15px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40', tab === id ? 'text-background' : 'hover:bg-secondary')}>
                {tab === id && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-foreground" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className="relative">{label}</span>
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => go('settings')} title="Prices follow the country you search in. Change rates in Settings"
              className="hidden h-10 items-center rounded-full bg-secondary px-3.5 text-sm font-medium tabular transition-colors hover:bg-pressed sm:inline-flex outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
              {tab === 'trip' && trip.from ? (() => { const cc = tripCountry(prefs, trip.from, trip.to); return `${cc} · ${ratesFor(prefs, cc).cur}` })() : `Spending in ${homeCurrency(prefs)}`}
            </button>
            <button type="button" onClick={() => go('settings')} aria-label="Settings" aria-current={tab === 'settings' ? 'page' : undefined}
              className={cn('grid size-11 place-items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40', tab === 'settings' ? 'bg-foreground text-background' : 'bg-secondary hover:bg-pressed')}>
              <Settings className="size-5" /></button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] px-4 pt-8 pb-28 sm:px-8 md:pb-16">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
              {tab === 'trip' && <TripView trip={trip} setTrip={setTrip} />}
              {tab === 'plan' && <PlanView />}
              {tab === 'spending' && <SpendingView goSettings={() => go('settings')} />}
              {tab === 'settings' && <SettingsView />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-[#000] text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-10 pb-28 sm:px-8 md:flex-row md:items-end md:justify-between md:pb-10">
          <div>
            <div className="text-lg font-bold">Farewise</div>
            <p className="mt-1 max-w-sm text-sm text-[#afafaf]">The best way from A to B, anywhere. Prices are estimates. Open source under the MIT licence.</p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#afafaf]">
            <li>Transit: <a className="text-white underline-offset-4 hover:underline" href="https://transitous.org/sources/" target="_blank" rel="noopener noreferrer">Transitous and its sources</a> (<a className="text-white underline-offset-4 hover:underline" href="https://transitous.org/donate/" target="_blank" rel="noopener noreferrer">donate</a>)</li>
            <li>Roads: <a className="text-white underline-offset-4 hover:underline" href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSSGIS OSRM</a></li>
            <li>Search: <a className="text-white underline-offset-4 hover:underline" href="https://photon.komoot.io" target="_blank" rel="noopener noreferrer">Photon by Komoot</a></li>
            <li>Map data © <a className="text-white underline-offset-4 hover:underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a></li>
            <li><a className="text-white underline-offset-4 hover:underline" href="https://github.com/Advk2k4/farewise" target="_blank" rel="noopener noreferrer">Source and contact</a></li>
          </ul>
        </div>
      </footer>

      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-background/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined}
            className={cn('flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium outline-none focus-visible:bg-secondary', tab === id ? 'text-foreground' : 'text-muted-foreground')}>
            <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', tab === id && 'bg-foreground text-background')}><Icon className="size-[18px]" /></span>{label}
          </button>
        ))}
      </nav>
      <Toaster position="bottom-center" offset={{ bottom: 88 }} mobileOffset={{ bottom: 88 }} />
    </TooltipProvider>
    </MotionConfig>
  )
}
