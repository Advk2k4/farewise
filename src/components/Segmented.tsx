import { useId, useRef } from 'react'
import { motion } from 'motion/react'
import { tap } from '@/lib/feedback'
import { cn } from '@/lib/utils'

/** Pill segmented control: the selected thumb slides between options. Arrow keys move the selection. */
export function Segmented<T extends string>({ value, options, onChange, label, className, size = 'md' }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string; className?: string; size?: 'sm' | 'md'
}) {
  const id = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const idx = options.findIndex(([v]) => v === value)
  const choose = (i: number) => { const v = options[i][0]; if (v !== value) { tap(); onChange(v) } refs.current[i]?.focus() }
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex w-fit flex-wrap gap-0.5 rounded-[36px] bg-secondary p-1', className)}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose((idx + 1) % options.length) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose((idx - 1 + options.length) % options.length) }
      }}>
      {options.map(([v, l], i) => {
        const on = v === value
        return (
          <motion.button key={v} ref={el => { refs.current[i] = el }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => choose(i)} whileTap={{ scale: 0.94 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }}
            className={cn('relative rounded-[36px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40',
              size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-sm', on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[36px] bg-thumb shadow-float" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            <span className="relative">{l}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
