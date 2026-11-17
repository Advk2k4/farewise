import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Clock, House, LocateFixed, MapPin, X } from 'lucide-react'
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { reversePlace, searchPlaces, type Place } from '@/lib/api'
import { rememberPlace, useData } from '@/lib/store'
import { cn } from '@/lib/utils'

type Item = { kind: 'loc' } | { kind: 'place'; place: Place; icon: 'home' | 'recent' | 'pin' }

function geolocate(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available in this browser'))
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try { resolve(await reversePlace(pos.coords.latitude, pos.coords.longitude)) }
        catch { resolve({ name: 'My location', area: '', lat: pos.coords.latitude, lng: pos.coords.longitude, cc: '' }) }
      },
      err => reject(new Error(err.code === 1 ? 'Location permission was denied' : 'Could not get your location')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
  })
}

/** Search box for any place in the world, with current location, home and recent places. */
export function PlaceInput({ id, label, value, placeholder, icon, onPick, bias, className }: {
  id: string; label: string; value: Place | null; placeholder: string
  icon?: React.ReactNode; onPick: (p: Place) => void; bias?: Place | null; className?: string
}) {
  const data = useData()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value?.name ?? '')
  const [results, setResults] = useState<Place[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [locating, setLocating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const justFocused = useRef(false)
  // select everything on focus so typing replaces the old place (the mouseup after a click would otherwise undo it)
  const selectAll = () => requestAnimationFrame(() => { const el = inputRef.current; if (el && document.activeElement === el) el.setSelectionRange(0, el.value.length) })
  const seq = useRef(0)

  useEffect(() => { if (!open) setText(value?.name ?? '') }, [value, open])

  // live search, 350 ms after typing stops, 3+ characters
  useEffect(() => {
    const q = text.trim()
    if (!open || q.length < 3 || q === value?.name) { setResults(null); setState('idle'); return }
    const mine = ++seq.current
    setState('loading')
    const t = setTimeout(() => {
      searchPlaces(q, bias ?? data.prefs.home ?? data.recent[0] ?? null)
        .then(r => { if (seq.current === mine) { setResults(r); setState('idle') } })
        .catch(() => { if (seq.current === mine) { setResults([]); setState('error') } })
    }, 350)
    return () => clearTimeout(t)
  }, [text, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const quick: Item[] = [{ kind: 'loc' }]
  if (data.prefs.home) quick.push({ kind: 'place', icon: 'home', place: { ...data.prefs.home, name: 'Home', area: [data.prefs.home.name, data.prefs.home.area].filter(Boolean).join(', ') } })
  for (const p of data.recent) quick.push({ kind: 'place', icon: 'recent', place: p })
  const items: Item[] = results ? results.map(p => ({ kind: 'place' as const, icon: 'pin' as const, place: p })) : quick

  const choose = async (it: Item) => {
    if (it.kind === 'loc') {
      setLocating(true)
      try { const p = await geolocate(); rememberPlace(p); onPick(p) }
      catch (e) { toast((e as Error).message) }
      finally { setLocating(false) }
    } else { rememberPlace(it.place); onPick(it.place) }
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false} className={cn('overflow-visible bg-transparent', className)}>
        <PopoverAnchor asChild>
          <div className="group relative flex items-center gap-3 rounded-[8px] bg-secondary px-4 transition-shadow focus-within:bg-background focus-within:shadow-[inset_0_0_0_2px_var(--foreground)]">
            <span className="shrink-0 text-foreground" aria-hidden="true">{icon}</span>
            <div className="min-w-0 flex-1 py-2">
              <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">{label}</label>
              <input
                ref={inputRef} id={id} name={id} value={locating ? 'Finding you…' : text} placeholder={placeholder} autoComplete="off" spellCheck={false}
                role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
                className="w-full truncate bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-faint"
                onFocus={() => { setOpen(true); justFocused.current = true; selectAll() }}
                onMouseUp={e => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; selectAll() } }}
                onBlur={() => { justFocused.current = false }}
                onChange={e => { setText(e.target.value); setOpen(true) }}
                onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setText(value?.name ?? '') } }}
              />
              {value?.area && !open && <div className="truncate text-xs text-muted-foreground">{value.area}</div>}
            </div>
            {open && text && (
              <button type="button" aria-label={`Clear ${label}`} onMouseDown={e => e.preventDefault()}
                onClick={() => { setText(''); setResults(null); inputRef.current?.focus() }}
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-[background-color,transform] hover:bg-pressed active:scale-90 outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
                <X className="size-4" />
              </button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" sideOffset={6} className="w-(--radix-popover-trigger-width) min-w-72 rounded-2xl p-1.5 shadow-card"
          onOpenAutoFocus={e => e.preventDefault()} onInteractOutside={e => { if (e.target === inputRef.current) e.preventDefault() }}>
          <CommandList id={`${id}-list`} className="max-h-80 overscroll-contain">
            {state === 'loading' && !results && <div className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</div>}
            {state === 'error' && <div className="px-3 py-2.5 text-sm text-muted-foreground">Place search isn’t responding. Try again in a moment.</div>}
            {results && !results.length && state !== 'error' && <div className="px-3 py-2.5 text-sm text-muted-foreground">No places found. Try adding a city name.</div>}
            <CommandGroup>
              {items.map((it, i) => (
                <CommandItem key={i} value={`${i}`} onSelect={() => choose(it)} className="gap-3 rounded-xl px-3 py-2.5">
                  {it.kind === 'loc' ? <LocateFixed className="size-4" /> : it.icon === 'home' ? <House className="size-4" /> : it.icon === 'recent' ? <Clock className="size-4" /> : <MapPin className="size-4" />}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{it.kind === 'loc' ? 'Use my current location' : it.place.name}</span>
                    {it.kind === 'place' && it.place.area && <span className="block truncate text-xs text-muted-foreground">{it.place.area}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  )
}
