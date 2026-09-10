import { Link } from 'react-router-dom'
import { KeyRef } from '../components/EvaluationKeyChip'
import { Badge, Card, CardHead, Empty, Note, PageHead } from '../components/ui'
import { SUBMISSIONS } from '../data/samples'
import { REVIEW_THRESHOLD } from '../engine/pipeline'
import { useStore } from '../engine/store'
import { useSeed } from '../hooks'

export default function Review() {
  const outcomes = useSeed()
  const verdicts = useStore((s) => s.verdicts)
  const record = useStore((s) => s.record)

  const rows = SUBMISSIONS.map((submission) => {
    const outcome = outcomes?.[submission.id]
    const verdict = Object.values(verdicts).find((v) => v.submissionId === submission.id)
    const versions = record.filter((r) => r.submissionId === submission.id)
    const released = versions.some((v) => v.released)
    const overridden = versions.some((v) => v.source === 'professor_override')
    return { submission, outcome, verdict, released, overridden, versions }
  })

  return (
    <>
      <PageHead
        title="Review queue"
        meta={`${rows.filter((r) => r.verdict && !r.released).length} awaiting a decision · ${rows.filter((r) => !r.verdict).length} held before grading`}
      >
        The model proposes a grade. Release is a separate state, and it belongs to the course owner. Nothing on this
        list has reached a student.
      </PageHead>

      <Card>
        <CardHead title="This assignment" meta="Every row was produced by the pipeline running in this browser." />
        {!outcomes ? (
          <Empty title="Grading the sample corpus…" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="label px-5 py-2.5 font-medium">Student</th>
                  <th className="label px-3 py-2.5 font-medium">Grade</th>
                  <th className="label px-3 py-2.5 font-medium">Confidence</th>
                  <th className="label px-3 py-2.5 font-medium">Versions</th>
                  <th className="label px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ submission, outcome, verdict, released, overridden, versions }) => {
                  const standing = versions.at(-1)
                  return (
                    <tr key={submission.id} className="transition-colors hover:bg-paper">
                      <td className="px-5 py-3">
                        {verdict ? (
                          <Link
                            to={`/review/${submission.id}`}
                            className="text-[0.875rem] font-medium tracking-tight text-ink no-underline hover:underline"
                          >
                            {submission.student}
                          </Link>
                        ) : (
                          <span className="text-[0.875rem] font-medium tracking-tight text-ink-soft">
                            {submission.student}
                          </span>
                        )}
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-[0.75rem] text-ink-faint">{submission.studentId}</span>
                          {verdict && <KeyRef id={verdict.keyId} />}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {standing ? (
                          <>
                            <span className="text-[0.9375rem] font-medium text-ink tabular-nums">{standing.total}</span>
                            <span className="ml-1.5 text-[0.75rem] text-ink-faint">{standing.letter}</span>
                          </>
                        ) : (
                          <span className="text-[0.8125rem] text-ink-faint">not graded</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {verdict ? (
                          <span
                            className={`font-mono text-[0.8125rem] tabular-nums ${
                              verdict.confidence < REVIEW_THRESHOLD ? 'text-review-ink' : 'text-ink-soft'
                            }`}
                          >
                            {verdict.confidence.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[0.8125rem] text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[0.8125rem] text-ink-soft tabular-nums">
                        {versions.length || '—'}
                      </td>
                      <td className="px-5 py-3">
                        {outcome?.kind === 'rejected' ? (
                          <Badge tone="hold" dot>
                            Rejected at intake
                          </Badge>
                        ) : outcome?.kind === 'held' ? (
                          <Badge tone="review" dot>
                            Held at extraction gate
                          </Badge>
                        ) : released ? (
                          <Badge tone="verified" dot>
                            Released{overridden ? ' · overridden' : ''}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Awaiting your decision</Badge>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Note title="An override is signal, not failure">
          Each override is a labelled disagreement between the system and the person who owns the course. The rate,
          and which criterion it lands on, is the most direct measure of whether the model is close enough to be
          trusted with more autonomy later.
        </Note>
        <Note title="Appeals are answered from the record">
          Re-running the model during an appeal risks producing a third answer in front of a student already
          disputing the second. An appeal is resolved against the stored evidence, the per-criterion scores and the
          rubric version in force at submission.
        </Note>
      </div>
    </>
  )
}
