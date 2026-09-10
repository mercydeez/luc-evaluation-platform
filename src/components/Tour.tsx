import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { STEPS } from '../steps'
import { Badge } from './ui'

export interface TourState {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

export function useTour(): TourState {
  const [isOpen, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])
  return useMemo(() => ({ isOpen, toggle, close }), [isOpen, toggle, close])
}

const SHORTCUTS: [string, string][] = [
  ['←  →', 'Move through the nine steps'],
  ['/', 'Ask the record'],
  ['t', 'Switch theme'],
  ['?', 'This panel'],
]

export function Tour({ state }: { state: TourState }) {
  useEffect(() => {
    if (!state.isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && state.close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  if (!state.isOpen) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={state.close}
        className="fixed inset-0 bg-ink-deep/45 backdrop-blur-[3px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to read this demo"
        className="relative my-auto w-full max-w-2xl rounded-lg border border-line bg-surface shadow-pop"
        style={{ animation: 'stage-in 300ms var(--ease-out-quint)' }}
      >
        <div className="flex items-start gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl leading-tight font-medium tracking-[-0.02em] text-ink">
              Nine steps, in the order the argument is made
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Each screen is one move in a case for handing grading to software. Walk them in order and the last
              screen follows from the first. Nothing here needs a login, a server, or a model.
            </p>
          </div>
          <button
            type="button"
            onClick={state.close}
            aria-label="Close"
            className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>

        <ol className="max-h-[46vh] divide-y divide-line overflow-y-auto">
          {STEPS.map((step) => (
            <li key={step.n}>
              <Link
                to={step.to}
                onClick={state.close}
                className="flex items-baseline gap-4 px-6 py-3 no-underline transition-colors hover:bg-paper"
              >
                <span className="w-4 shrink-0 font-mono text-xs text-ink-faint tabular-nums">{step.n}</span>
                <span className="min-w-0">
                  <span className="text-base font-medium tracking-tight text-ink">{step.title}</span>
                  <span className="ml-2 text-sm text-ink-faint">{step.label}</span>
                  <span className="mt-0.5 block text-sm leading-snug text-ink-soft">{step.lede}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-6 py-4">
          {SHORTCUTS.map(([key, what]) => (
            <span key={key} className="flex items-center gap-2">
              <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-2xs text-ink-soft">
                {key}
              </kbd>
              <span className="text-xs text-ink-faint">{what}</span>
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-6 py-4">
          <Badge tone="review" dot>
            Prototype
          </Badge>
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-faint">
            Every student, mark and identifier is invented. The hashing, keys, rubric arithmetic, cache, validation
            and record are real and run in this browser; judgement comes from a deterministic evaluator, not a
            language model.
          </p>
        </div>
      </div>
    </div>
  )
}
