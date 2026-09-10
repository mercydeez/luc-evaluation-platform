import { ArrowRight, FlaskConical, ShieldCheck, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { KeyRef } from '../components/EvaluationKeyChip'
import { Badge, Card, CardHead, Empty, LinkButton, Note, PageHead } from '../components/ui'
import { COURSE, SUBMISSIONS } from '../data/samples'
import { REVIEW_THRESHOLD } from '../engine/pipeline'
import { useStore } from '../engine/store'
import type { Outcome, Verdict } from '../engine/types'
import { useSeed } from '../hooks'

export default function Overview() {
  const outcomes = useSeed()
  const record = useStore((s) => s.record)
  const hits = useStore((s) => s.hits)
  const verdicts = useStore((s) => s.verdicts)

  const graded = Object.values(verdicts)
  const held = outcomes ? Object.entries(outcomes).filter(([, o]) => o.kind === 'held') : []
  const rejected = outcomes ? Object.entries(outcomes).filter(([, o]) => o.kind === 'rejected') : []

  // The claim on this page is checked rather than asserted: group the record by
  // evaluation key and count keys that ever produced two different marks.
  const byKey = new Map<string, Set<number>>()
  for (const version of record.filter((r) => r.source === 'ai')) {
    const totals = byKey.get(version.keyId) ?? new Set<number>()
    totals.add(version.total)
    byKey.set(version.keyId, totals)
  }
  const divergences = [...byKey.values()].filter((totals) => totals.size > 1).length
  const cacheHits = Object.values(hits).reduce((sum, n) => sum + Math.max(0, n - 1), 0)

  const awaiting = graded.filter((v) => !isReleased(record, v.submissionId))

  return (
    <>
      <PageHead
        title="Grading overview"
        meta={`${COURSE.code} · ${COURSE.name} · ${COURSE.term} · closes ${COURSE.deadline}`}
        actions={
          <>
            <LinkButton to="/review" variant="secondary">
              Review queue
              <Badge tone="review" className="-mr-1">
                {awaiting.length}
              </Badge>
            </LinkButton>
            <LinkButton to="/submit" variant="primary">
              <UploadCloud className="size-4" strokeWidth={1.75} />
              Submit & grade
            </LinkButton>
          </>
        }
      />

      <DeterminismPanel
        evaluations={record.filter((r) => r.source === 'ai').length}
        keys={byKey.size}
        divergences={divergences}
        cacheHits={cacheHits}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.75fr_1fr]">
        <Card>
          <CardHead
            title="Needs your decision"
            meta="Sorted by confidence. A verdict below the release threshold is never published without a human."
            action={
              <Link
                to="/review"
                className="text-[0.8125rem] font-medium text-ink no-underline hover:underline"
              >
                Open queue →
              </Link>
            }
          />
          {!outcomes ? (
            <Empty title="Grading the sample corpus…">
              Five submissions are being run through the real pipeline in this browser.
            </Empty>
          ) : awaiting.length === 0 ? (
            <Empty title="Nothing is waiting on you">
              Every graded submission in this course has been released by its course owner.
            </Empty>
          ) : (
            <QueueTable verdicts={[...awaiting].sort((a, b) => a.confidence - b.confidence)} />
          )}
        </Card>

        <Card className="self-start">
          <CardHead
            title="Held back from grading"
            meta="Neither of these received a mark. They were stopped before a model was involved."
          />
          {!outcomes ? (
            <Empty title="Running intake checks…" />
          ) : (
            <ul className="divide-y divide-line">
              {[...held, ...rejected].map(([id, outcome]) => (
                <ExceptionRow key={id} id={id} outcome={outcome} />
              ))}
              {held.length + rejected.length === 0 && (
                <li>
                  <Empty title="No exceptions" />
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Note title="Marks that can be calculated are calculated">
          Word counts, required sections, criterion weights and late penalties are arithmetic, so they are computed
          in code where they are testable, and the model is never asked for them. On this course that is 15 of every
          100 marks removed from the model's reach before determinism is even considered.
        </Note>
        <Note title="Every name and mark here is synthetic">
          No real student work appears in this prototype. The pipeline, hashing, key derivation, cache, validation
          layer and append-only record are real and run in your browser; judgement comes from a deterministic
          stand-in rather than a language model, so the same key always returns the same verdict.
        </Note>
      </div>
    </>
  )
}

function DeterminismPanel({
  evaluations,
  keys,
  divergences,
  cacheHits,
}: {
  evaluations: number
  keys: number
  divergences: number
  cacheHits: number
}) {
  const clean = divergences === 0

  return (
    <section className="overflow-hidden rounded-lg border border-ink-deep bg-rail text-rail-text shadow-rail">
      <div className="flex flex-wrap items-start gap-x-12 gap-y-6 px-6 py-6 sm:px-8 sm:py-7">
        <div className="min-w-0 max-w-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={clean ? 'size-4 text-[#3FBF6E]' : 'size-4 text-hold'}
              strokeWidth={2}
            />
            <span className="text-[0.6875rem] font-medium tracking-[0.08em] text-rail-muted uppercase">
              Determinism check
            </span>
          </div>
          <h2 className="mt-3 text-[1.5rem] leading-[1.15] font-medium tracking-[-0.03em] text-white text-balance sm:text-[1.75rem]">
            {clean
              ? 'No submission in this record has ever received two different grades.'
              : `${divergences} evaluation key${divergences > 1 ? 's have' : ' has'} produced more than one grade.`}
          </h2>
          <p className="mt-3 text-[0.875rem] leading-relaxed text-rail-muted">
            This is checked, not claimed. Every grade in the record is grouped by its evaluation key and counted;
            a key that ever produced two different marks would appear here as a divergence.
          </p>
          <Link
            to="/consistency"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-rail-line px-3.5 py-1.5 text-[0.8125rem] font-medium text-rail-text no-underline transition-colors hover:border-[#3FBF6E]/60 hover:text-white"
          >
            <FlaskConical className="size-3.5" strokeWidth={1.75} />
            Replay the defect
            <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4 lg:max-w-md">
          <RailFigure value={divergences} label="Grade divergences" accent={clean} />
          <RailFigure value={evaluations} label="Evaluations recorded" />
          <RailFigure value={keys} label="Distinct keys" />
          <RailFigure value={cacheHits} label="Served from cache" />
        </dl>
      </div>
    </section>
  )
}

function RailFigure({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <dd
        className={`text-[1.75rem] leading-none font-medium tracking-[-0.03em] tabular-nums ${
          accent ? 'text-[#3FBF6E]' : 'text-white'
        }`}
      >
        {value}
      </dd>
      <dt className="mt-2 text-[0.6875rem] leading-tight tracking-[0.04em] text-rail-muted uppercase">{label}</dt>
    </div>
  )
}

function QueueTable({ verdicts }: { verdicts: Verdict[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="label px-5 py-2.5 font-medium">Student / submission</th>
            <th className="label px-3 py-2.5 font-medium">Grade</th>
            <th className="label px-3 py-2.5 font-medium">Confidence</th>
            <th className="label px-5 py-2.5 font-medium">Flag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {verdicts.map((verdict) => {
            const submission = SUBMISSIONS.find((s) => s.id === verdict.submissionId)
            const borderline = verdict.confidence < REVIEW_THRESHOLD
            return (
              <tr key={verdict.keyId} className="transition-colors hover:bg-paper">
                <td className="px-5 py-3">
                  <Link
                    to={`/review/${verdict.submissionId}`}
                    className="text-[0.875rem] font-medium tracking-tight text-ink no-underline hover:underline"
                  >
                    {submission?.student ?? verdict.submissionId}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[0.75rem] text-ink-faint">
                      {submission?.studentId} · attempt {submission?.attempt}
                    </span>
                    <KeyRef id={verdict.keyId} />
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-[0.9375rem] font-medium text-ink tabular-nums">{verdict.total}</span>
                  <span className="ml-1.5 text-[0.75rem] text-ink-faint">{verdict.letter}</span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`font-mono text-[0.8125rem] tabular-nums ${
                      borderline ? 'text-review-ink' : 'text-ink-soft'
                    }`}
                  >
                    {verdict.confidence.toFixed(2)}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {borderline ? (
                    <Badge tone="review" dot>
                      Band edge
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Awaiting release</Badge>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ExceptionRow({ id, outcome }: { id: string; outcome: Outcome }) {
  const submission = SUBMISSIONS.find((s) => s.id === id)
  if (outcome.kind !== 'held' && outcome.kind !== 'rejected') return null

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-2">
        <Badge tone={outcome.kind === 'held' ? 'review' : 'hold'} dot>
          {outcome.kind === 'held' ? 'Held at gate' : 'Rejected at intake'}
        </Badge>
        <span className="truncate text-[0.75rem] text-ink-faint">{submission?.fileName}</span>
      </div>
      <p className="mt-2 text-[0.875rem] font-medium tracking-tight text-ink">{submission?.student}</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">{outcome.reason}</p>
    </li>
  )
}

function isReleased(record: { submissionId: string; released: boolean }[], submissionId: string): boolean {
  return record.some((r) => r.submissionId === submissionId && r.released)
}
