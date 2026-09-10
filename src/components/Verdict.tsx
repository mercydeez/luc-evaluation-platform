import clsx from 'clsx'
import { ChevronRight, Cpu, Quote, Sigma } from 'lucide-react'
import { useState } from 'react'
import { REVIEW_THRESHOLD } from '../engine/pipeline'
import type { CriterionScore, Verdict } from '../engine/types'
import { EvaluationKeyChip } from './EvaluationKeyChip'
import { Badge, Meter, Note } from './ui'

export function VerdictHeader({ verdict }: { verdict: Verdict }) {
  const needsReview = verdict.confidence < REVIEW_THRESHOLD

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl leading-none font-medium tracking-[-0.04em] text-ink tabular-nums">
              {verdict.total}
            </span>
            <span className="text-lg leading-none font-medium tracking-tight text-ink-soft">
              / 100 · {verdict.letter}
            </span>
          </div>
          <p className="label mt-2.5">Proposed grade</p>
        </div>

        <div className="min-w-[8rem]">
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                'text-2xl leading-none font-medium tracking-[-0.03em] tabular-nums',
                needsReview ? 'text-review-ink' : 'text-ink',
              )}
            >
              {verdict.confidence.toFixed(2)}
            </span>
          </div>
          <p className="label mt-2.5">Confidence</p>
          <p className="mt-1 text-xs leading-snug text-ink-soft">
            {needsReview ? `Below ${REVIEW_THRESHOLD} — human decision required` : `Clears the ${REVIEW_THRESHOLD} release threshold`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {verdict.cached ? (
            <Badge tone="verified" dot>
              Cache hit · 0 model calls
            </Badge>
          ) : (
            <Badge tone="neutral">{verdict.modelCalls} model calls</Badge>
          )}
          {verdict.reproducible ? (
            <Badge tone="verified">Reproducible</Badge>
          ) : (
            <Badge tone="hold" dot>
              Not reproducible
            </Badge>
          )}
          <Badge tone="neutral">{verdict.elapsedMs}ms</Badge>
        </div>
      </div>

      <div className="mt-5">
        <p className="label mb-2">Evaluation key</p>
        <EvaluationKeyChip keyValue={verdict.key} />
      </div>
    </div>
  )
}

export function CriteriaList({ verdict }: { verdict: Verdict }) {
  const [open, setOpen] = useState<string | null>(verdict.criteria[0]?.id ?? null)

  return (
    <ul className="divide-y divide-line">
      {verdict.criteria.map((criterion) => (
        <CriterionRow
          key={criterion.id}
          criterion={criterion}
          open={open === criterion.id}
          onToggle={() => setOpen(open === criterion.id ? null : criterion.id)}
        />
      ))}
    </ul>
  )
}

function CriterionRow({
  criterion,
  open,
  onToggle,
}: {
  criterion: CriterionScore
  open: boolean
  onToggle: () => void
}) {
  const borderline = criterion.confidence < REVIEW_THRESHOLD

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-paper"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium tracking-tight text-ink">{criterion.name}</span>
            <span className="chip">weight {criterion.weight}</span>
            {criterion.kind === 'mechanical' ? (
              <Badge tone="verified">
                <Sigma className="size-3" strokeWidth={2.25} />
                computed in code
              </Badge>
            ) : borderline ? (
              <Badge tone="review">band edge · conf {criterion.confidence.toFixed(2)}</Badge>
            ) : (
              <span className="chip">conf {criterion.confidence.toFixed(2)}</span>
            )}
          </span>
          <span className="mt-2 block max-w-md">
            <Meter value={criterion.score} tone={criterion.kind === 'mechanical' ? 'verified' : 'ink'} />
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-lg leading-none font-medium tracking-tight text-ink tabular-nums">
            {criterion.score}
          </span>
          <span className="mt-1 block text-2xs text-ink-faint">{criterion.band}</span>
        </span>

        <ChevronRight
          className={clsx('size-3.5 shrink-0 text-line-strong transition-transform duration-200', open && 'rotate-90 text-ink-faint')}
        />
      </button>

      {open && (
        <div
          className="space-y-4 border-t border-line bg-paper px-5 py-4"
          style={{ animation: 'stage-in 200ms var(--ease-out-quint)' }}
        >
          <div>
            <p className="label">Rubric anchor applied</p>
            <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-ink-soft">{criterion.anchor}</p>
          </div>

          <div>
            <p className="label flex items-center gap-1.5">
              {criterion.kind === 'mechanical' ? <Sigma className="size-3" /> : <Cpu className="size-3" />}
              {criterion.kind === 'mechanical' ? 'Calculation' : 'Reasoning'}
            </p>
            <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-ink-soft">{criterion.reasoning}</p>
          </div>

          {criterion.lines && (
            <dl className="max-w-lg rounded-card border border-line bg-surface px-4 py-1">
              {criterion.lines.map((line, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
                  <dt className="text-sm text-ink-soft">{line.label}</dt>
                  <dd
                    className={clsx(
                      'shrink-0 font-mono text-sm tabular-nums',
                      line.delta < 0 ? 'text-hold-ink' : 'text-ink',
                    )}
                  >
                    {line.delta > 0 ? line.delta : line.delta === 0 ? '—' : line.delta}
                  </dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 border-t border-line-strong py-2.5">
                <dt className="text-sm font-medium text-ink">Criterion score</dt>
                <dd className="font-mono text-sm font-medium text-ink tabular-nums">{criterion.score}</dd>
              </div>
            </dl>
          )}

          {criterion.evidence.length > 0 && (
            <div>
              <p className="label flex items-center gap-1.5">
                <Quote className="size-3" />
                Evidence from the submission
              </p>
              <div className="mt-2 space-y-2">
                {criterion.evidence.map((span, i) => (
                  <blockquote
                    key={i}
                    className="rounded-card border border-line bg-surface px-4 py-3 text-base leading-relaxed text-ink"
                  >
                    <span className="text-ink-faint">“</span>
                    {span}
                    <span className="text-ink-faint">”</span>
                  </blockquote>
                ))}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-faint">
                Each span was checked against the graded text before this verdict was released for review. Evidence
                that does not appear verbatim in the submission is rejected by the validation layer.
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

export function OutcomeNotice({
  kind,
  reason,
}: {
  kind: 'held' | 'rejected'
  reason: string
}) {
  return (
    <Note tone={kind === 'held' ? 'review' : 'hold'} title={kind === 'held' ? 'Held before grading' : 'Rejected at intake'}>
      {reason}
    </Note>
  )
}
