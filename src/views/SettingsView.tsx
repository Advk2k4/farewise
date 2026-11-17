import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, House } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PlaceInput } from '@/components/PlaceInput'
import { COUNTRIES, FALLBACK_COUNTRY, countryName, type Rates } from '@/lib/rates'
import { cycleLabel, cycleStartFor } from '@/lib/budget'
import { ordinal, todayISO } from '@/lib/format'
import { autoCountry, clearAll, importBackup, makeBackup, setCountry, update, useData, type Prefs } from '@/lib/store'

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-border py-6 md:grid-cols-[220px_1fr] md:gap-8">
      <h2 id={id} className="text-xl">{title}</h2>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  )
}
function Pills<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={v => v && onChange(v as T)} aria-label={label} className="w-fit flex-wrap rounded-[36px] bg-secondary p-1">
      {options.map(([v, l]) => <ToggleGroupItem key={v} value={v} className="h-9 rounded-[36px] px-3.5 text-sm font-medium data-[state=on]:bg-card data-[state=on]:shadow-float">{l}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}

export function SettingsView() {
  const { prefs: P } = useData()
  const R = P.rates, cc = P.country ?? FALLBACK_COUNTRY
  const [backup, setBackup] = useState('')
  const [paste, setPaste] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => update(d => { d.prefs[k] = v })
  const setRate = (k: keyof Rates, v: string) => { const n = Number(v); if (v !== '' && n >= 0) update(d => { (d.prefs.rates[k] as number) = n }) }

  const rate = (k: keyof Rates, label: string) => (
    <div className="flex flex-col gap-1.5"><Label htmlFor={`rate-${k}`}>{label}</Label>
      <Input id={`rate-${k}`} type="number" min={0} step="any" inputMode="decimal" defaultValue={R[k] as number} key={`${cc}-${R[k]}`} onBlur={e => setRate(k, e.target.value)} className="tabular" /></div>
  )

  return (
    <div className="flex max-w-4xl flex-col">
      <header className="pb-6">
        <h1 className="text-[36px] leading-[44px]">Settings</h1>
        <p className="mt-2 max-w-[60ch] text-muted-foreground">Saved in this browser only. Use a backup code to copy everything to another device.</p>
      </header>

      <Section title="Home" id="s-home">
        <PlaceInput id="home" label="Your home, the default start for day plans" value={P.home} placeholder="Search your address…" icon={<House className="size-4" />}
          onPick={p => { autoCountry(p); set('home', p.name === 'Home' ? P.home : p); toast('Home saved') }} />
        {P.home && <Button variant="ghost" size="sm" className="w-fit" onClick={() => set('home', null)}>Remove home</Button>}
      </Section>

      <Section title="Prices" id="s-prices">
        <div className="flex flex-col gap-1.5"><Label id="country-l">Country for default prices</Label>
          <Select value={cc} onValueChange={v => { setCountry(v); toast(`Now using ${countryName(v)} prices`) }}>
            <SelectTrigger aria-labelledby="country-l" className="h-12 w-full max-w-sm rounded-[8px] border-transparent bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">{Object.entries(COUNTRIES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, c]) => <SelectItem key={k} value={k}>{c.name} ({c.cur})</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rate('taxiBase', `Taxi flag fall (${R.cur})`)}{rate('taxiKm', `Taxi per km (${R.cur})`)}{rate('taxiMin', `Taxi per minute (${R.cur})`)}
          {rate('fare', `Transit fare per ride (${R.cur})`)}{rate('fuel', `Fuel per litre (${R.cur})`)}{rate('lper100', 'Car uses, L/100 km')}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => { setCountry(cc); toast('Prices reset') }}>Reset to {countryName(cc)} defaults</Button>
          <span className="text-xs text-muted-foreground">Defaults are rough big-city figures. Your own numbers give better estimates.</span>
        </div>
      </Section>

      <Section title="What matters most" id="s-priority">
        <Pills label="What matters most" value={P.priority} onChange={v => set('priority', v)} options={[['money', 'Save money'], ['balanced', 'Balanced'], ['time', 'Save time']]} />
        <p className="text-sm text-muted-foreground">Balanced treats one transit fare as worth about 10 minutes. Save money leans towards transit and walking; save time leans towards taxis.</p>
      </Section>

      <Section title="Getting around" id="s-modes">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary p-4">
          <Label htmlFor="has-car" className="text-base font-medium">I have a car</Label><Switch id="has-car" checked={P.hasCar} onCheckedChange={v => set('hasCar', v)} />
        </div>
        {P.hasCar && <div className="flex max-w-xs flex-col gap-1.5"><Label htmlFor="park">Minutes to park, on average</Label>
          <Input id="park" type="number" inputMode="numeric" min={0} step={1} defaultValue={P.parkMin} onBlur={e => { const n = Number(e.target.value); if (n >= 0) set('parkMin', n) }} /></div>}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary p-4">
          <Label htmlFor="has-bike" className="text-base font-medium">I have a bike</Label><Switch id="has-bike" checked={P.hasBike} onCheckedChange={v => set('hasBike', v)} />
        </div>
      </Section>

      <Section title="Spending" id="s-spend">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label htmlFor="budget">Budget per cycle ({R.cur}, 0 for none)</Label>
            <Input id="budget" type="number" inputMode="decimal" min={0} step="any" defaultValue={P.budget} onBlur={e => { const n = Number(e.target.value); if (n >= 0) set('budget', n) }} className="tabular" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="cycle">Cycle starts on day</Label>
            <Input id="cycle" type="number" inputMode="numeric" min={1} max={28} step={1} defaultValue={P.cycleDay} onBlur={e => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 28) set('cycleDay', n) }} /></div>
        </div>
        <p className="text-sm text-muted-foreground">Current cycle: {cycleLabel(cycleStartFor(todayISO(), P.cycleDay), P.cycleDay)}. It resets on the {ordinal(P.cycleDay)} of each month.</p>
        <div className="flex flex-col gap-2"><span className="text-sm font-medium">Days that count towards “per day”</span>
          <Pills label="Days that count" value={String(P.workdays) as '5' | '6' | '7'} onChange={v => set('workdays', Number(v) as 5 | 6 | 7)} options={[['7', 'Every day'], ['6', 'Mon–Sat'], ['5', 'Mon–Fri']]} /></div>
        <div className="flex max-w-xs flex-col gap-1.5"><Label id="visit-l">Default time at each stop</Label>
          <Select value={String(P.visit)} onValueChange={v => set('visit', Number(v))}>
            <SelectTrigger aria-labelledby="visit-l" className="h-12 w-full rounded-[8px] border-transparent bg-secondary"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 15, 20, 30, 45, 60, 90].map(v => <SelectItem key={v} value={String(v)}>{v} min</SelectItem>)}</SelectContent>
          </Select></div>
      </Section>

      <Section title="Your data" id="s-data">
        <p className="text-sm text-muted-foreground">Everything stays in this browser. The only things sent anywhere are the place names and coordinates needed to look up routes.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={async () => { const c = makeBackup(); setBackup(c); try { await navigator.clipboard.writeText(c); toast('Backup code copied') } catch { toast('Select the code below and copy it') } }}><Copy /> Copy backup code</Button>
        </div>
        {backup && <textarea readOnly value={backup} aria-label="Backup code" rows={3} className="w-full rounded-[8px] bg-secondary p-3 font-mono text-xs break-all" onFocus={e => e.currentTarget.select()} />}
        <div className="flex flex-col gap-1.5"><Label htmlFor="paste">Paste a backup code from another device</Label>
          <textarea id="paste" value={paste} onChange={e => setPaste(e.target.value)} rows={3} placeholder="FW2.…" className="w-full rounded-[8px] bg-secondary p-3 font-mono text-xs outline-none focus-visible:bg-background focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)]" /></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { const n = importBackup(paste); if (n == null) toast("That isn’t a Farewise backup code"); else { setPaste(''); toast(`Added ${n} trip${n === 1 ? '' : 's'}`) } }} disabled={!paste.trim()}>Add to this browser</Button>
          <Button variant={confirmClear ? 'destructive' : 'ghost'} onClick={() => { if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 5000); return } clearAll(); location.reload() }}>
            {confirmClear ? 'Tap again to delete everything' : 'Delete all data'}</Button>
        </div>
      </Section>
    </div>
  )
}
