import { useId } from 'react'
import { motion } from 'motion/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { setTheme, useTheme, type ThemeChoice } from '@/lib/theme'
import { tap } from '@/lib/feedback'
import { cn } from '@/lib/utils'

const OPTIONS: [ThemeChoice, string, typeof Sun][] = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'Match device', Monitor]]

/** Compact light / dark / system switch; the selected thumb slides between icons. */
export function ThemeToggle({ className, labels }: { className?: string; labels?: boolean }) {
  const id = useId()
  const { choice } = useTheme()
  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn('inline-flex items-center gap-0.5 rounded-full bg-secondary p-1', className)}
      onKeyDown={e => {
        const i = OPTIONS.findIndex(o => o[0] === choice)
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
        if (!d) return
        e.preventDefault()
        const next = OPTIONS[(i + d + OPTIONS.length) % OPTIONS.length][0]
        setTheme(next); tap()
        ;(e.currentTarget.querySelector(`[data-v="${next}"]`) as HTMLElement | null)?.focus()
      }}>
      {OPTIONS.map(([v, label, Icon]) => {
        const on = v === choice
        return (
          <motion.button key={v} type="button" role="radio" aria-checked={on} aria-label={label} title={label} data-v={v} tabIndex={on ? 0 : -1}
            onClick={() => { if (!on) { setTheme(v); tap() } }} whileTap={{ scale: 0.9 }} transition={{ type: 'spring', stiffness: 600, damping: 30 }}
            className={cn('relative grid h-9 place-items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40',
              labels ? 'px-3.5' : 'w-9', on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {on && <motion.span layoutId={`theme-${id}`} className="absolute inset-0 rounded-full bg-thumb shadow-float" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            <span className="relative flex items-center gap-1.5">
              <motion.span key={on ? 'on' : 'off'} initial={on ? { rotate: -40, scale: 0.6 } : false} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} className="grid place-items-center">
                <Icon className="size-[17px]" aria-hidden="true" />
              </motion.span>
              {labels && <span className="text-sm font-medium">{label}</span>}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
