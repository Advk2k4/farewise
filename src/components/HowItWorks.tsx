import { useRef } from 'react'
import { Bike, BusFront, CarTaxiFront, Footprints, TrainFront } from 'lucide-react'
import { AnimatedBeam } from '@/components/ui/animated-beam'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const MODES = [
  { label: 'Walk', Icon: Footprints },
  { label: 'Cycle', Icon: Bike },
  { label: 'Metro & train', Icon: TrainFront },
  { label: 'Bus', Icon: BusFront },
  { label: 'Taxi', Icon: CarTaxiFront },
]

/** "From → every mode → To": Magic UI animated beams show what Farewise does before you type anything. */
export function HowItWorks({ className }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const from = useRef<HTMLDivElement>(null)
  const to = useRef<HTMLDivElement>(null)
  const modes = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
  const dark = useTheme().resolved === 'dark'
  const ink = dark ? '#ffffff' : '#000000', amber = '#f5c400'
  const node = 'relative z-10 grid place-items-center rounded-full border border-border bg-card shadow-float'
  return (
    <div ref={box} className={cn('relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border bg-card px-6 py-7 sm:px-10', className)} aria-label="Farewise checks walking, cycling, metro and train, bus and taxi between your two places">
      <div className="flex flex-col items-center gap-2">
        <div ref={from} className={cn(node, 'size-14')}><span className="size-4 rounded-full bg-foreground" /></div>
        <span className="text-xs font-medium text-muted-foreground">From</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {MODES.map(({ label, Icon }, i) => (
          <div key={label} ref={modes[i]} className={cn(node, 'size-11')} title={label}><Icon className="size-[18px]" aria-hidden="true" /></div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div ref={to} className={cn(node, 'size-14')}><span className="size-4 rounded-[3px] bg-foreground" /></div>
        <span className="text-xs font-medium text-muted-foreground">To</span>
      </div>
      {modes.map((m, i) => (
        <AnimatedBeam key={`a${i}`} containerRef={box} fromRef={from} toRef={m} curvature={(2 - i) * 18} duration={2.2} delay={i * 0.45} repeatDelay={0.8} pathWidth={3}
          pathColor={ink} pathOpacity={0.1} gradientStartColor={ink} gradientStopColor={ink} />
      ))}
      {modes.map((m, i) => (
        <AnimatedBeam key={`b${i}`} containerRef={box} fromRef={m} toRef={to} curvature={(2 - i) * -18} duration={2.2} delay={1.2 + i * 0.45} repeatDelay={0.8} pathWidth={3}
          pathColor={ink} pathOpacity={0.1} gradientStartColor={amber} gradientStopColor={amber} />
      ))}
    </div>
  )
}
