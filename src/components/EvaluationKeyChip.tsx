import clsx from 'clsx'
import { Lock, Unlock } from 'lucide-react'
import { useState } from 'react'
import { keySegments } from '../engine/key'
import type { EvaluationKey, PinName } from '../engine/types'

/**
 * The evaluation key, rendered as what it is: one address made of six locked
 * parts. Each segment can be opened to say what breaks if it is not pinned, and
 * a segment that moved between two runs is marked, because "the grade changed"
 * is only defensible when it is followed by "and this is the field that moved".
 */
export function EvaluationKeyChip({
  keyValue,
  changed = [],
  className,
}: {
  keyValue: EvaluationKey
  changed?: PinName[]
  className?: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  const segments = keySegments(keyValue)
  const active = segments.find((s) => s.pin === open)

  return (
    <div className={className}>
      <div className="inline-flex max-w-full flex-wrap items-stretch overflow-hidden rounded-lg border border-line-strong bg-surface">
        {segments.map((segment) => {
          const moved = segment.pin !== 'text' && changed.includes(segment.pin)
          const unpinned = segment.pin === 'temperature' && keyValue.pins.temperature > 0
          const isOpen = open === segment.pin
          const Icon = unpinned ? Unlock : Lock
          return (
            <button
              key={segment.pin}
              type="button"
              onClick={() => setOpen(isOpen ? null : segment.pin)}
              aria-expanded={isOpen}
              title={segment.label}
              className={clsx(
                'group flex items-center gap-1.5 border-r border-line px-2.5 py-1.5 font-mono text-[0.75rem] tracking-tight transition-colors last:border-r-0',
                isOpen && 'bg-ink text-white',
                !isOpen && moved && 'bg-hold-bg text-hold-ink',
                !isOpen && unpinned && !moved && 'bg-review-bg text-review-ink',
                !isOpen && !moved && !unpinned && 'text-ink-soft hover:bg-paper hover:text-ink',
              )}
            >
              <Icon
                className={clsx(
                  'size-3 shrink-0',
                  isOpen ? 'text-white/70' : unpinned ? 'text-review' : moved ? 'text-hold' : 'text-verified',
                )}
                strokeWidth={2.25}
              />
              {segment.value}
            </button>
          )
        })}
      </div>

      {active && (
        <div
          className="mt-2 max-w-xl rounded-card border border-line bg-paper px-3.5 py-3"
          style={{ animation: 'stage-in 220ms var(--ease-out-quint)' }}
        >
          <p className="text-[0.75rem] font-semibold tracking-tight text-ink">{active.label}</p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{active.note}</p>
        </div>
      )}
    </div>
  )
}

/** Compact form for tables and log rows. */
export function KeyRef({ id, className }: { id: string; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md bg-ink/6 px-1.5 py-0.5 font-mono text-[0.75rem] tracking-tight text-ink-soft',
        className,
      )}
    >
      <Lock className="size-2.5 shrink-0 text-verified" strokeWidth={2.5} />
      {id}
    </span>
  )
}
