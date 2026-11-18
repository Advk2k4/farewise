import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { celebrate as burst } from '@/lib/celebrate'

/** A button that briefly turns into a confirmation ("Logged ✓", "Copied ✓") after it is pressed. */
export function FeedbackButton({ onClick, done, celebrate, children, ...props }: Omit<React.ComponentProps<typeof Button>, 'onClick'> & { onClick: () => void | Promise<unknown>; done: string; celebrate?: boolean }) {
  const self = useRef<HTMLButtonElement>(null)
  const [ok, setOk] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(t.current), [])
  return (
    <Button {...props} ref={self} aria-live="polite" onClick={async () => { await onClick(); if (celebrate) burst(self.current); setOk(true); clearTimeout(t.current); t.current = setTimeout(() => setOk(false), 1600) }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={ok ? 'ok' : 'idle'} className="inline-flex items-center gap-1.5"
          initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.9 }} transition={{ duration: 0.18 }}>
          {ok ? <><motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 18 }}><Check className="size-4" /></motion.span>{done}</> : children}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
