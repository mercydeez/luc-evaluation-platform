import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'luc.invariant.theme'
const listeners = new Set<() => void>()
let current: Theme = 'light'

function preferred(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Private browsing. Fall through to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Called once from the entry point, before React renders, so the first paint is
 * already in the right theme. A dark-mode user should never see a white flash.
 */
export function initTheme(): void {
  current = preferred()
  document.documentElement.dataset.theme = current
}

export function setTheme(theme: Theme): void {
  current = theme
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // The theme still applies for this session; it just will not be remembered.
  }
  listeners.forEach((l) => l())
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
    () => 'light' as Theme,
  )
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), [])
  return [theme, toggle]
}
