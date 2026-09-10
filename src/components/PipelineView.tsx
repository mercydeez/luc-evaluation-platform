import clsx from 'clsx'
import { Check, ChevronRight, Minus, OctagonAlert, PauseCircle } from 'lucide-react'
import { useState } from 'react'
import type { Stage, StageStatus } from '../engine/types'

const ICON: Record<StageStatus, typeof Check | null> = {
  pending: null,
  running: null,
  ok: Check,
  skipped: Minus,
  held: PauseCircle,
  failed: OctagonAlert,
}

function statusClasses(status: StageStatus) {
  switch (status) {
    case 'ok':
      return { dot: 'border-verified bg-verified text-surface', text: 'text-ink', meta: 'text-ink-soft' }
    case 'running':
      return { dot: 'border-ink bg-ink text-surface', text: 'text-ink', meta: 'text-ink-soft' }
    case 'held':
      return { dot: 'border-review bg-review-bg text-review-ink', text: 'text-review-ink', meta: 'text-review-ink' }
    case 'failed':
      return { dot: 'border-hold bg-hold-bg text-hold-ink', text: 'text-hold-ink', meta: 'text-hold-ink' }
    case 'skipped':
      return { dot: 'border-line bg-paper text-ink-faint', text: 'text-ink-faint', meta: 'text-ink-faint' }
    default:
      return { dot: 'border-line bg-surface text-ink-faint', text: 'text-ink-faint', meta: 'text-ink-faint' }
  }
}

export function PipelineView({ stages, className }: { stages: Stage[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null)

  if (stages.length === 0) {
    return (
      <div className={clsx('px-5 py-8 text-center text-[0.8125rem] text-ink-faint', className)}>
        Eleven stages. Nothing has run yet.
      </div>
    )
  }

  return (
    <ol className={clsx('divide-y divide-line', className)}>
      {stages.map((stage) => {
        const cls = statusClasses(stage.status)
        const Icon = ICON[stage.status]
        const isOpen = open === stage.id
        const dim = stage.status === 'skipped'

        return (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : stage.id)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-paper"
            >
              <span
                className={clsx(
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[0.625rem] font-medium',
                  cls.dot,
                )}
                style={stage.status === 'running' ? { animation: 'pulse-run 1.1s ease-in-out infinite' } : undefined}
              >
                {Icon ? <Icon className="size-3" strokeWidth={3} /> : stage.n}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span
                    className={clsx(
                      'text-[0.8125rem] font-medium tracking-tight',
                      cls.text,
                      dim && 'line-through decoration-line-strong',
                    )}
                  >
                    {stage.name}
                  </span>
                  {stage.status === 'running' && (
                    <span className="text-[0.75rem] text-ink-faint">running…</span>
                  )}
                  {stage.ms > 0 && (
                    <span className="font-mono text-[0.6875rem] text-ink-faint tabular-nums">{stage.ms}ms</span>
                  )}
                </span>
                {stage.detail && (
                  <span className={clsx('mt-0.5 block truncate text-[0.75rem]', cls.meta)}>{stage.detail}</span>
                )}
              </span>

              <ChevronRight
                className={clsx(
                  'mt-0.5 size-3.5 shrink-0 text-line-strong transition-transform duration-200',
                  isOpen && 'rotate-90 text-ink-faint',
                )}
              />
            </button>

            {isOpen && (
              <div
                className="border-t border-line bg-paper px-5 py-3.5 pl-13"
                style={{ animation: 'stage-in 200ms var(--ease-out-quint)' }}
              >
                <p className="label">Why this stage exists</p>
                <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-ink-soft">{stage.why}</p>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
