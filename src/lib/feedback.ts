// A light haptic tick on phones that support it (Android); silently does nothing elsewhere.
export function tap(ms = 8) {
  try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate?.(ms) } catch { /* unsupported */ }
}
