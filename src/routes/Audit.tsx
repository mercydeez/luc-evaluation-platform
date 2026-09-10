import clsx from 'clsx'
import { useState } from 'react'
import { KeyRef } from '../components/EvaluationKeyChip'
import { Badge, Card, CardHead, Empty, Note, StepHead } from '../components/ui'
import { useStore } from '../engine/store'
import { useSeed } from '../hooks'

const EVENT_TONE: Record<string, 'neutral' | 'verified' | 'review' | 'hold'> = {
  'grade.proposed': 'neutral',
  'grade.released': 'verified',
  'grade.overridden': 'verified',
  'grade.overridden_and_released': 'verified',
  'submission.duplicate': 'verified',
  'submission.held': 'review',
  'submission.rejected': 'hold',
  'verdict.refused': 'hold',
}

export default function Audit() {
  useSeed()
  const audit = useStore((s) => s.audit)
  const [filter, setFilter] = useState<string>('all')

  const events = [...new Set(audit.map((a) => a.event))].sort()
  const rows = filter === 'all' ? audit : audit.filter((a) => a.event === filter)

  return (
    <>
      <StepHead
        meta={`${audit.length} entries · append-only · every entry replayable from its evaluation key`}
      >
        Who did what, when, and on what grounds. Entries are added and never edited, which is what separates a grade
        change that can be explained from one that cannot.
      </StepHead>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All · {audit.length}
        </FilterChip>
        {events.map((event) => (
          <FilterChip key={event} active={filter === event} onClick={() => setFilter(event)}>
            {event} · {audit.filter((a) => a.event === event).length}
          </FilterChip>
        ))}
      </div>

      <Card>
        <CardHead title="Entries" meta="Newest first. Retention on an institutional deployment is seven years." />
        {rows.length === 0 ? (
          <Empty title="Nothing recorded yet">Grade something and the record will fill.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="label px-5 py-2.5 font-medium">Time</th>
                  <th className="label px-3 py-2.5 font-medium">Actor</th>
                  <th className="label px-3 py-2.5 font-medium">Event</th>
                  <th className="label px-5 py-2.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...rows].reverse().map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-paper">
                    <td className="px-5 py-3 align-top font-mono text-[0.75rem] whitespace-nowrap text-ink-faint tabular-nums">
                      {new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-3 align-top text-[0.8125rem] whitespace-nowrap text-ink-soft">{entry.actor}</td>
                    <td className="px-3 py-3 align-top">
                      <Badge tone={EVENT_TONE[entry.event] ?? 'neutral'}>{entry.event}</Badge>
                    </td>
                    <td className="px-5 py-3 align-top">
                      <p className="max-w-xl text-[0.8125rem] leading-relaxed text-ink">{entry.detail}</p>
                      {entry.keyId && (
                        <div className="mt-1.5">
                          <KeyRef id={entry.keyId} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Note title="A refused verdict is still an entry">
          A run made under unpinned decoding never reaches the record as a grade, but the attempt is logged. Silence
          about a rejected run is how a system loses the ability to explain itself later.
        </Note>
        <Note title="Tenancy">
          Each institution is a hard tenant: separate verdict store, separate audit stream, separate rubric
          namespace. There are no cross-tenant hash lookups, so an identical document submitted at another
          university is never a cache hit here.
        </Note>
      </div>
    </>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-full border px-3 py-1.5 font-mono text-[0.6875rem] transition-colors',
        active ? 'border-ink bg-ink text-surface' : 'border-line text-ink-soft hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
