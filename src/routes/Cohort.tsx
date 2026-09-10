import { useEffect, useState } from 'react'
import { Badge, Card, CardHead, Empty, MetricStrip, Note, StepHead } from '../components/ui'
import { buildCohort, type Cohort as CohortData } from '../data/cohort'
import { COURSE } from '../data/samples'
import { REVIEW_THRESHOLD } from '../engine/pipeline'

export default function Cohort() {
  const [cohort, setCohort] = useState<CohortData | null>(null)

  useEffect(() => {
    let live = true
    buildCohort().then((result) => live && setCohort(result))
    return () => {
      live = false
    }
  }, [])

  if (!cohort) {
    return (
      <>
        <StepHead />
        <Card>
          <Empty title="Grading forty submissions…">
            Every one is going through the same eleven stages, in this browser, before anything is charted.
          </Empty>
        </Card>
      </>
    )
  }

  const total = cohort.members.length
  const peak = Math.max(...cohort.distribution.map((d) => d.count), 1)

  return (
    <>
      <StepHead
        meta={`${COURSE.code} · ${COURSE.name} · ${COURSE.term}`}
        actions={
          <Badge tone="review" dot>
            Synthetic cohort · {total} fictional learners
          </Badge>
        }
      />

      <MetricStrip
        items={[
          { value: cohort.graded, label: 'Graded', note: 'Cleared every gate and produced a verdict' },
          {
            value: cohort.resubmissions,
            label: 'Resubmitted unchanged',
            note: 'The same student again — the stored grade is returned, no model call',
            tone: 'verified',
          },
          {
            value: cohort.held + cohort.rejected,
            label: 'Never graded',
            note: `${cohort.held} held at the extraction gate, ${cohort.rejected} rejected at intake`,
            tone: 'review',
          },
          {
            value: cohort.needsDecision,
            label: 'Needs a human',
            note: `Confidence below ${REVIEW_THRESHOLD}, so release is withheld`,
            tone: 'review',
          },
        ]}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead
            title="Grade distribution"
            meta={`Mean ${cohort.mean}, median ${cohort.median}. Every bar is engine output, not an illustration.`}
          />
          <div className="space-y-2 px-5 py-5">
            {cohort.distribution.map((band) => (
              <div key={band.band} className="flex items-center gap-3">
                <span className="w-7 shrink-0 font-mono text-xs text-ink-faint tabular-nums">{band.band}</span>
                <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-[4px] bg-ink/6">
                  <div
                    className="h-full rounded-[4px] bg-verified transition-[width] duration-700"
                    style={{ width: `${(band.count / peak) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-mono text-xs text-ink-soft tabular-nums">
                  {band.count || ''}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-4">
            <p className="max-w-2xl text-base leading-relaxed text-ink-soft">
              The shape follows from the corpus rather than from a target. Submissions were degraded
              deterministically — sections dropped, quantification thinned, length cut, deadlines missed — and the
              rubric priced each degradation the same way every time.
            </p>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHead
              title="What sends work to a human"
              meta="The criterion sitting closest to a band boundary, counted across the cohort."
            />
            <ul className="divide-y divide-line">
              {cohort.borderlineBy.map((row) => (
                <li key={row.name} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-medium tracking-tight text-ink">{row.name}</span>
                    <span className="shrink-0 font-mono text-base text-ink-soft tabular-nums">
                      {Math.round(row.share * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/6">
                    <div className="h-full rounded-full bg-review" style={{ width: `${row.share * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-4">
              <p className="text-base leading-relaxed text-ink-soft">
                Concentration is the useful signal. A criterion that repeatedly lands on a boundary points at vague
                anchor language rather than at model quality, and the rubric owner is the one who can fix it.
              </p>
            </div>
          </Card>

          <MetricStrip
            className="sm:grid-cols-2"
            items={[
              {
                value: `${cohort.medianMs}ms`,
                label: 'Median evaluation',
                note: 'In-browser, excluding the model call a production run would make',
              },
              {
                value: `${Math.round(cohort.mechanicalShare * 100)}%`,
                label: 'Marks computed in code',
                note: 'Removed from the model’s reach before determinism is considered',
                tone: 'verified',
              },
            ]}
          />
        </div>
      </div>

      {cohort.collisions > 0 && (
        <Note tone="hold" title={`${cohort.collisions} submissions were byte-identical to another student's work`}>
          <p className="mt-1">
            Content addressing found these without being asked to look. The key is a hash of the work, so identical
            text from two different people lands on the same key — and the platform cannot tell a saving from a
            coincidence on its own.
          </p>
          <p className="mt-2">
            The cache still answers, because two identical submissions must receive identical grades either way. What
            it must not do is stay quiet: in production this raises an integrity flag for the course owner rather than
            being counted as a cost saving. That is a different product with different liability, which is why the
            flag stops here and the accusation does not.
          </p>
        </Note>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Note tone="verified" title="Why this chart can be trusted more than most demo charts">
          Nothing here is a stored number. Forty submissions were generated from the sample corpus and put through
          the same eleven stages the rest of the product uses, in this browser, when you opened this screen. Reset
          the demo and the identical distribution comes back, because the generation is seeded and the engine is
          deterministic.
        </Note>

        <Note tone="review" title="Three things a real term would show, and this cannot">
          <ul className="mt-1.5 space-y-1.5">
            <li>
              <strong className="font-medium text-ink">Override rate by criterion.</strong> Needs professors making
              real decisions over a term. Fabricating it would be the one number a director should not believe.
            </li>
            <li>
              <strong className="font-medium text-ink">Agreement against a human baseline.</strong> Needs the same
              scripts double-marked by staff, which is the first thing a pilot should collect.
            </li>
            <li>
              <strong className="font-medium text-ink">Appeal and overturn rate.</strong> Needs students who can
              actually appeal.
            </li>
          </ul>
        </Note>
      </div>
    </>
  )
}
