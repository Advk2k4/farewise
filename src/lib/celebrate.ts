// A short confetti burst from an element (Magic UI's confetti, via canvas-confetti). Skipped under reduced motion.
import confetti from 'canvas-confetti'

export function celebrate(from?: Element | null) {
  const dark = document.documentElement.classList.contains('dark')
  const r = from?.getBoundingClientRect()
  const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.7 }
  confetti({
    particleCount: 70, spread: 75, startVelocity: 30, gravity: 1.1, ticks: 170, scalar: 0.85, origin, zIndex: 60,
    // the app's own palette: ink, transit amber, on-time green, grey
    colors: dark ? ['#ffffff', '#f5c400', '#5fd58e', '#9a9a9a'] : ['#000000', '#f5c400', '#0e7a3b', '#8c8c8c'],
    disableForReducedMotion: true,
  })
}
