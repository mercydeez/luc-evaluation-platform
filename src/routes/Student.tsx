import { FileDown, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EvaluationKeyChip } from '../components/EvaluationKeyChip'
import { Badge, Button, Card, CardHead, DataRow, Meter, Note, StepHead } from '../components/ui'
import { COURSE, SUBMISSIONS } from '../data/samples'
import { useStore } from '../engine/store'
import { useSeed } from '../hooks'

const STUDENT_ID = 'sub_2211'

export default function Student() {
  useSeed()
  const verdicts = useStore((s) => s.verdicts)
  const record = useStore((s) => s.record)

  const submission = SUBMISSIONS.find((s) => s.id === STUDENT_ID)!
  const verdict = Object.values(verdicts).find((v) => v.submissionId === STUDENT_ID)
  const versions = record.filter((r) => r.submissionId === STUDENT_ID)
  const published = [...versions].reverse().find((v) => v.released)

  return (
    <>
      <StepHead
        title={`${submission.student}'s view`}
        meta={`${COURSE.code} · ${COURSE.name} · student portal`}
        actions={
          <Badge tone="neutral" dot>
            Shown as the student sees it
          </Badge>
        }
      >
        Everything a student can see about how their grade was produced. Nothing here is a number without a reason
        attached to it.
      </StepHead>

      {!published ? (
        <Card className="max-w-3xl">
          <CardHead
            title="Case Study 2 — Regional assortment rationalisation"
            meta={`Submitted ${new Date(submission.submittedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · attempt ${submission.attempt}`}
            action={<Badge tone="review" dot>With your professor</Badge>}
          />
          <div className="px-5 py-6">
            <p className="max-w-xl text-base leading-relaxed text-ink-soft">
              Your submission has been evaluated and is waiting on your course owner. No mark is shown until a person
              has released it, and no mark reaches this page without the reasoning behind it.
            </p>
            <div className="mt-5">
              <Link
                to={`/review/${STUDENT_ID}`}
                className="text-base font-medium text-ink hover:underline"
              >
                Open the professor's review screen and release it →
              </Link>
              <p className="mt-1.5 text-xs text-ink-faint">
                A demo shortcut. A student would never see this link.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid max-w-5xl gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHead
                title="Case Study 2 — Regional assortment rationalisation"
                meta={`Released ${new Date(published.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`}
                action={
                  <Badge tone="verified" dot>
                    {published.source === 'professor_override' ? 'Reviewed and adjusted' : 'Human reviewed'}
                  </Badge>
                }
              />

              <div className="flex flex-wrap items-end gap-x-10 gap-y-4 px-5 py-5">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl leading-none font-medium tracking-[-0.04em] text-ink tabular-nums">
                      {published.total}
                    </span>
                    <span className="text-lg leading-none font-medium text-ink-soft">/ 100 · {published.letter}</span>
                  </div>
                  <p className="label mt-2.5">Your grade</p>
                </div>
                <div className="text-base leading-relaxed text-ink-soft">
                  Measured against rubric{' '}
                  <span className="chip">{verdict?.key.pins.rubricVersion.replace('rbr_', '')}</span>, the version in
                  force when you submitted. A later rubric does not change this mark.
                </div>
              </div>

              {verdict && (
                <div className="border-t border-line">
                  <ul className="divide-y divide-line">
                    {verdict.criteria.map((base) => {
                      // A released grade shows the marks that were released. Where a
                      // professor moved a criterion, the student sees the moved mark
                      // and is told it moved.
                      const score = published.adjustments?.[base.id] ?? base.score
                      const criterion = { ...base, score }
                      const moved = score !== base.score
                      return (
                      <li key={criterion.id} className="px-5 py-3.5">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium tracking-tight text-ink">{criterion.name}</span>
                            {moved && (
                              <Badge tone="verified">
                                adjusted from {base.score} by your professor
                              </Badge>
                            )}
                          </span>
                          <span className="shrink-0 text-sm font-medium text-ink tabular-nums">
                            {criterion.score}
                            <span className="ml-1 text-xs font-normal text-ink-faint">/ 100</span>
                          </span>
                        </div>
                        <div className="mt-2 max-w-md">
                          <Meter value={criterion.score} tone={criterion.kind === 'mechanical' ? 'verified' : 'ink'} />
                        </div>
                        <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-soft">
                          {criterion.reasoning}
                        </p>
                        {criterion.lines && (
                          <ul className="mt-2 space-y-1">
                            {criterion.lines
                              .filter((line) => line.delta < 0)
                              .map((line, i) => (
                                <li key={i} className="text-xs text-hold-ink">
                                  {line.delta} — {line.label}
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {published.reason && (
                <div className="border-t border-line px-5 py-4">
                  <Note tone="verified" title="Note from your professor">
                    {published.reason}
                  </Note>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
                <Button variant="secondary">
                  <Scale className="size-4" strokeWidth={1.75} />
                  Appeal this grade
                </Button>
                <Button variant="ghost">
                  <FileDown className="size-4" strokeWidth={1.75} />
                  Download evaluation report
                </Button>
                <span className="self-center text-xs text-ink-faint">Appeal window closes 21 Aug</span>
              </div>
            </Card>

            <Note title="What an appeal does">
              An appeal is answered against the stored record: the same evidence, the same per-criterion scores, and
              the rubric version in force when you submitted. The model is not re-run, because re-running it risks
              producing a third answer in front of a student already disputing the second. Your original grade stays
              visible either way.
            </Note>
          </div>

          <div className="min-w-0 space-y-5">
            <Card>
              <CardHead title="How this grade was produced" meta="The exact inputs, kept for as long as the record is." />
              <div className="px-5 py-4">
                {verdict && <EvaluationKeyChip keyValue={verdict.key} />}
                <dl className="mt-4 divide-y divide-line">
                  <DataRow k="Attempt" v={`${submission.attempt} of 3`} />
                  <DataRow k="Extraction confidence" v={submission.ocrConfidence.toFixed(2)} />
                  <DataRow k="Human review" v={published.source === 'professor_override' ? 'Adjusted' : 'Released unchanged'} />
                  <DataRow k="Released by" v={published.actor} />
                </dl>
              </div>
            </Card>

            <Card>
              <CardHead title="Submission history" meta="Every version you have submitted, and what happened to it." />
              <ol className="divide-y divide-line">
                {versions.map((version) => (
                  <li key={`${version.v}-${version.at}`} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-xs text-ink-faint">v{version.v}</span>
                      <span className="text-sm font-medium text-ink tabular-nums">
                        {version.total} · {version.letter}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                      {version.source === 'ai' ? 'Evaluated' : 'Adjusted by your professor'} ·{' '}
                      {new Date(version.at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                      {version.released ? ' · released' : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </Card>

            <Note tone="verified" title="Attempt 2 returned the same grade as attempt 1">
              Your second upload was identical to your first, so it resolved to the same evaluation key and returned
              the stored result. The platform does not re-grade work it has already graded, which is why an
              unchanged resubmission cannot move your mark in either direction.
            </Note>
          </div>
        </div>
      )}
    </>
  )
}
