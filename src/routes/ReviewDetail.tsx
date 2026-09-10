import clsx from 'clsx'
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CriteriaList, VerdictHeader } from '../components/Verdict'
import { Badge, Button, Card, CardHead, Empty, Note, StepHead } from '../components/ui'
import { SUBMISSIONS } from '../data/samples'
import { REVIEW_THRESHOLD } from '../engine/pipeline'
import { letterFor } from '../engine/rubric'
import { store, useStore } from '../engine/store'
import type { Verdict } from '../engine/types'
import { useSeed } from '../hooks'

const REASONS = [
  'Rubric anchor applied more generously in line with the cohort',
  'Evidence located in a section the extractor mis-ordered',
  'Criterion weighting does not reflect the brief given in class',
  'Model under-credited a valid alternative method',
]

export default function ReviewDetail() {
  const { submissionId = '' } = useParams()
  useSeed()
  const verdicts = useStore((s) => s.verdicts)
  const record = useStore((s) => s.record)

  const submission = SUBMISSIONS.find((s) => s.id === submissionId)
  const verdict = Object.values(verdicts).find((v) => v.submissionId === submissionId)
  const versions = record.filter((r) => r.submissionId === submissionId)

  if (!submission) {
    return <Empty title="Unknown submission">Nothing in this course matches that identifier.</Empty>
  }

  if (!verdict) {
    return (
      <>
        <BackLink />
        <StepHead title={submission.student} meta={`${submission.studentId} · ${submission.fileName}`} />
        <Note tone="review" title="This submission was never graded">
          It did not clear the pipeline, so there is no verdict to review. Held and rejected work is handled from the
          overview, with the failed check attached, rather than being given a mark to defend.
        </Note>
      </>
    )
  }

  return <Decision submission={submission} verdict={verdict} versions={versions} />
}

function BackLink() {
  return (
    <Link
      to="/review"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft no-underline hover:text-ink"
    >
      <ArrowLeft className="size-3.5" strokeWidth={2} />
      Review queue
    </Link>
  )
}

function Decision({
  submission,
  verdict,
  versions,
}: {
  submission: (typeof SUBMISSIONS)[number]
  verdict: Verdict
  versions: ReturnType<typeof store.getState>['record']
}) {
  const [adjust, setAdjust] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const released = versions.some((v) => v.released)

  const adjusted = useMemo(
    () => verdict.criteria.map((c) => ({ ...c, professor: c.score + (adjust[c.id] ?? 0) })),
    [verdict.criteria, adjust],
  )
  const total = Number((adjusted.reduce((sum, c) => sum + c.professor * c.weight, 0) / 100).toFixed(1))
  const changed = total !== verdict.total
  const canPublish = !changed || reason.trim().length >= 12

  function publish() {
    if (changed) {
      store.override({
        submissionId: submission.id,
        keyId: verdict.keyId,
        total,
        letter: letterFor(total),
        actor: 'Dr. Anita Rao',
        reason: reason.trim(),
        release: true,
        adjustments: Object.fromEntries(adjusted.map((c) => [c.id, c.professor])),
      })
    } else {
      store.release({ submissionId: submission.id, keyId: verdict.keyId, actor: 'Dr. Anita Rao' })
    }
    setAdjust({})
    setReason('')
  }

  return (
    <>
      <BackLink />
      <StepHead
        title={submission.student}
        meta={`${submission.studentId} · ${submission.assignment} · attempt ${submission.attempt} · submitted ${new Date(submission.submittedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`}
        actions={
          released ? (
            <Badge tone="verified" dot>
              Released to the student
            </Badge>
          ) : (
            <Badge tone="neutral">Not released</Badge>
          )
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_23rem]">
        <div className="min-w-0 space-y-5">
          <Note tone={verdict.confidence < REVIEW_THRESHOLD ? 'review' : 'neutral'} title="Why this reached you">
            {verdict.confidence < REVIEW_THRESHOLD ? (
              <>
                Overall confidence is {verdict.confidence.toFixed(2)}, below the {REVIEW_THRESHOLD} release
                threshold, driven by{' '}
                <strong className="font-medium text-ink">
                  {[...verdict.criteria].sort((a, b) => a.confidence - b.confidence)[0].name.toLowerCase()}
                </strong>{' '}
                sitting close to a band boundary. A borderline call is exactly the case a human should own.
              </>
            ) : (
              <>
                Confidence clears the release threshold. It still reaches you, because release is a state a person
                sets — not something the model is allowed to do on its own.
              </>
            )}
          </Note>

          <Card>
            <CardHead title="Proposed verdict" meta={`${verdict.criteria.length} criteria · rubric ${verdict.key.pins.rubricVersion.replace('rbr_', '')}`} />
            <VerdictHeader verdict={verdict} />
            <div className="border-t border-line">
              <CriteriaList verdict={verdict} />
            </div>
          </Card>

          <Card>
            <CardHead
              title="Submission"
              meta="Spans the evaluator quoted as evidence are marked. Everything else is the student's text as extracted."
            />
            <div className="max-h-[28rem] overflow-y-auto px-5 py-4">
              <HighlightedText verdict={verdict} />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHead title="Your decision" meta="An override is recorded as a new version. The proposed grade is kept." />

            <div className="divide-y divide-line">
              {adjusted.map((criterion) => {
                const delta = criterion.professor - criterion.score
                return (
                  <div key={criterion.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium tracking-tight text-ink">{criterion.name}</p>
                      <p className="text-2xs text-ink-faint">
                        weight {criterion.weight} · proposed {criterion.score}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Stepper
                        label={`Lower ${criterion.name}`}
                        icon={<Minus className="size-3" strokeWidth={2.5} />}
                        onClick={() =>
                          setAdjust((a) => ({ ...a, [criterion.id]: Math.max(-criterion.score, (a[criterion.id] ?? 0) - 1) }))
                        }
                      />
                      <span
                        className={clsx(
                          'w-10 text-center font-mono text-sm tabular-nums',
                          delta === 0 ? 'text-ink' : delta > 0 ? 'text-verified-ink' : 'text-hold-ink',
                        )}
                      >
                        {criterion.professor}
                      </span>
                      <Stepper
                        label={`Raise ${criterion.name}`}
                        icon={<Plus className="size-3" strokeWidth={2.5} />}
                        onClick={() =>
                          setAdjust((a) => ({ ...a, [criterion.id]: Math.min(100 - criterion.score, (a[criterion.id] ?? 0) + 1) }))
                        }
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-4 border-y border-line bg-paper px-5 py-3.5">
              <div>
                <p className="label">Proposed</p>
                <p className="mt-1 font-mono text-base text-ink-soft tabular-nums">
                  {verdict.total} · {verdict.letter}
                </p>
              </div>
              <span className="text-ink-faint" aria-hidden="true">
                →
              </span>
              <div className="text-right">
                <p className="label">Published</p>
                <p
                  className={clsx(
                    'mt-1 text-2xl leading-none font-medium tracking-tight tabular-nums',
                    changed ? 'text-verified-ink' : 'text-ink',
                  )}
                >
                  {total} · {letterFor(total)}
                </p>
              </div>
            </div>

            <div className="space-y-3 px-5 py-4">
              {changed && (
                <div>
                  <label htmlFor="reason" className="label">
                    Override reason <span className="text-hold-ink normal-case">required</span>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {REASONS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setReason(preset)}
                        className={clsx(
                          'rounded-full border px-2.5 py-1 text-left text-2xs leading-snug transition-colors',
                          reason === preset
                            ? 'border-ink bg-ink text-surface'
                            : 'border-line text-ink-soft hover:border-line-strong hover:text-ink',
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="What the model got wrong, in the words a student would need to read."
                    className="mt-2 w-full resize-y rounded-card border border-line bg-paper px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
                  />
                </div>
              )}

              <Button variant="primary" className="w-full" onClick={publish} disabled={!canPublish}>
                <Check className="size-4" strokeWidth={2.25} />
                {changed ? 'Override and release' : released ? 'Release again' : 'Release unchanged'}
              </Button>

              <p className="text-xs leading-relaxed text-ink-faint">
                {changed
                  ? 'The reason is written to the student feedback, the audit log and the rubric drift report. The original AI grade stays in the record.'
                  : 'Releasing writes a new version with your identity against it. It does not alter the proposed grade.'}
              </p>
            </div>
          </Card>

          <Card>
            <CardHead title="Version history" meta="Append-only. Nothing here is edited or removed." />
            {versions.length === 0 ? (
              <Empty title="No versions yet" />
            ) : (
              <ol className="divide-y divide-line">
                {versions.map((version) => (
                  <li key={`${version.v}-${version.at}`} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-xs text-ink-faint">v{version.v}</span>
                      <span className="font-medium text-ink tabular-nums">
                        {version.total} · {version.letter}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge tone={version.source === 'ai' ? 'neutral' : 'verified'}>
                        {version.source === 'ai' ? 'proposed by engine' : version.source === 'appeal' ? 'appeal' : 'professor override'}
                      </Badge>
                      {version.released && <Badge tone="verified">released</Badge>}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-faint">
                      {version.actor} · {new Date(version.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                    {version.reason && (
                      <p className="mt-1.5 text-base leading-relaxed text-ink-soft">{version.reason}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

function Stepper({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-ink hover:text-ink"
    >
      {icon}
    </button>
  )
}

/** Marks the spans the evaluator quoted, in place, in the student's own text. */
function HighlightedText({ verdict }: { verdict: Verdict }) {
  const segments = useMemo(() => {
    const spans = verdict.criteria
      .flatMap((c) => c.evidence.map((text) => ({ text, criterion: c.name })))
      .map((span) => ({ ...span, at: verdict.gradedText.indexOf(span.text) }))
      .filter((span) => span.at >= 0)
      .sort((a, b) => a.at - b.at)

    const out: { text: string; criterion?: string }[] = []
    let cursor = 0
    for (const span of spans) {
      if (span.at < cursor) continue
      if (span.at > cursor) out.push({ text: verdict.gradedText.slice(cursor, span.at) })
      out.push({ text: span.text, criterion: span.criterion })
      cursor = span.at + span.text.length
    }
    out.push({ text: verdict.gradedText.slice(cursor) })
    return out
  }, [verdict])

  return (
    <div className="max-w-[68ch] text-sm leading-[1.75] whitespace-pre-wrap text-ink-soft">
      {segments.map((segment, i) =>
        segment.criterion ? (
          <mark
            key={i}
            title={segment.criterion}
            className="rounded-[3px] bg-verified-bg px-0.5 text-ink decoration-verified/60 underline-offset-4"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </div>
  )
}
