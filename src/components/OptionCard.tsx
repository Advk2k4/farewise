import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Bike, Car, ChevronRight, Footprints, TramFront, CarTaxiFront } from 'lucide-react'
import { CAT_NAME, TRANSIT_LABEL, mapsUrl, type Option, type Seg } from '@/lib/options'
import type { Place } from '@/lib/api'
import { fmtDist, fmtMin, money, timeOf } from '@/lib/format'
import { cn } from '@/lib/utils'

const KIND_ICON = { walk: Footprints, bike: Bike, car: Car, taxi: CarTaxiFront, transit: TramFront }

/** A leg of a route as a compact chip. Transit lines keep their operator's colour; everything else stays monochrome. */
function Chip({ s }: { s: Seg }) {
  const m = Math.max(1, Math.round(s.min))
  if (s.cat === 'walk') return <span className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs font-medium text-muted-foreground"><Footprints className="size-3" />{m}</span>
  const style = s.color ? { background: s.color, color: s.text ?? '#fff' } : undefined
  return (
    <span style={style} className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold', !s.color && 'bg-foreground text-background')}>
      {s.label}<span className="font-normal opacity-80 tabular">{m}</span>
    </span>
  )
}
export function RouteStrip({ op, className }: { op: Option; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)} aria-label="Route">
      {op.segs.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1">{i > 0 && <ChevronRight className="size-3 text-faint" aria-hidden="true" />}<Chip s={s} /></span>
      ))}
    </div>
  )
}
export function costText(op: Option, cur: string) {
  if (!op.cost) return 'Free'
  return op.costLo != null && op.costHi != null ? `${money(op.costLo, cur)}–${money(op.costHi, cur)}` : `≈ ${money(op.cost, cur)}`
}
export function Tags({ op }: { op: Option }) {
  const tags = [...op.tags]
  return (
    <>
      {tags.map(t => (
        <span key={t} className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium', t === 'Recommended' ? 'bg-foreground text-background' : 'bg-secondary text-foreground')}>{t}</span>
      ))}
      {op.rush && <span className="inline-flex h-6 items-center rounded-full bg-warn-soft px-2.5 text-xs font-medium text-warn">Traffic</span>}
      {op.segs.some(s => s.realTime) && <span className="inline-flex h-6 items-center rounded-full bg-ok-soft px-2.5 text-xs font-medium text-ok">Live times</span>}
    </>
  )
}
function Steps({ op, cur }: { op: Option; cur: string }) {
  return (
    <ol className="space-y-3 border-t border-border pt-4 text-sm">
      {op.segs.map((s, i) => {
        let main: React.ReactNode, detail: React.ReactNode = null, right = fmtMin(s.min)
        if (s.cat === 'walk') main = <>Walk {s.km ? `${fmtDist(s.km)} ` : ''}to {s.to}</>
        else if (op.kind === 'transit') {
          main = <><b className="font-semibold">{(TRANSIT_LABEL[s.mode ?? ''] ?? 'Transit') + (s.label && s.label !== 'Transit' ? ` ${s.label}` : '')}</b>{s.head ? ` toward ${s.head}` : ''}</>
          detail = <>{s.from} → {s.to} · {s.stops} stop{s.stops! > 1 ? 's' : ''}{s.start ? ` · ${timeOf(s.start)}` : ''}{s.realTime ? ' · live' : ''}</>
        } else if (s.cat === 'taxi') { main = <>Taxi or ride-hail to {s.to}</>; right += ` · ${costText(op, cur)}` }
        else if (s.cat === 'car') { main = <>Drive {fmtDist(s.km)} to {s.to}</>; right += ` · fuel ${money(op.cost, cur)}` }
        else main = <>{CAT_NAME[s.cat]} {s.km ? `${fmtDist(s.km)} ` : ''}to {s.to}</>
        return (
          <li key={i} className="grid grid-cols-[10px_1fr_auto] items-baseline gap-3">
            <span className={cn('size-2.5 translate-y-0.5 rounded-full', s.cat === 'walk' ? 'border border-faint' : !s.color && 'bg-foreground')} style={s.color ? { background: s.color } : undefined} />
            <span className="min-w-0">{main}{detail && <span className="block text-xs text-muted-foreground">{detail}</span>}</span>
            <span className="text-xs whitespace-nowrap text-muted-foreground tabular">{right}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** One way to make the trip: headline numbers, route strip, tags; expands into steps and actions. */
export function OptionCard({ op, cur, selected, open, onSelect, from, to, actions }: {
  op: Option; cur: string; selected: boolean; open: boolean; onSelect: () => void; from: Place; to: Place; actions?: React.ReactNode
}) {
  const Icon = KIND_ICON[op.kind]
  return (
    <motion.div layout="position" transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className={cn('rounded-2xl border bg-card transition-[border-color,box-shadow] duration-150',
        selected ? 'border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]' : 'border-border hover:border-faint')}>
      <button type="button" onClick={onSelect} aria-expanded={open} className="flex w-full flex-col gap-3 rounded-2xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary" aria-hidden="true"><Icon className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold leading-6">{op.title}</div>
            <div className="truncate text-sm text-muted-foreground">{op.sub}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-bold leading-6 tabular">{fmtMin(op.min)}</div>
            <div className="text-sm text-muted-foreground tabular">{costText(op, cur)}</div>
          </div>
        </div>
        <RouteStrip op={op} />
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 items-center rounded-full bg-secondary px-2.5 text-xs font-medium tabular">{timeOf(op.depart)} → {timeOf(op.arrive)}</span>
          <Tags op={op} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
            <div className="space-y-4 px-4 pb-4">
              <Steps op={op} cur={cur} />
              {op.notes.length > 0 && <p className="text-xs text-muted-foreground">{op.notes.join(' · ')}</p>}
              <div className="flex flex-wrap gap-2">
                <a href={mapsUrl(from, to, op.mapsMode)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-sm font-medium transition-colors hover:bg-pressed focus-visible:ring-3 focus-visible:ring-ring/40 outline-none">
                  Open in Google Maps <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
                {actions}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
