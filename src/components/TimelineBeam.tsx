import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'

/** A beam that fills down the day-plan timeline as you scroll it, after Aceternity's Tracing Beam:
 *  re-measured live (the timeline changes as routes load) and coloured from the theme instead of fixed hues. */
export function TimelineBeam({ children, left = 87 }: { children: React.ReactNode; left?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 70%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 260, damping: 40, mass: 0.4 })
  const height = useTransform(fill, v => `${Math.max(0, Math.min(1, v)) * 100}%`)
  return (
    <div ref={ref} className="relative">
      <div aria-hidden="true" className="pointer-events-none absolute top-6 bottom-6 hidden w-[2px] sm:block" style={{ left }}>
        <motion.div className="relative w-full rounded-full bg-gradient-to-b from-foreground/0 via-foreground to-[#f5c400]" style={{ height }}>
          <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#f5c400] shadow-[0_0_0_4px_color-mix(in_srgb,#f5c400_25%,transparent),0_0_14px_#f5c400]" />
        </motion.div>
      </div>
      {children}
    </div>
  )
}
