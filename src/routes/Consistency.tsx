import clsx from 'clsx'
import { CircleAlert, Lock, Play, Unlock } from 'lucide-react'
import { useState } from 'react'
import { KeyRef } from '../components/EvaluationKeyChip'
import { Badge, Button, Card, CardHead, Empty, Note, StepHead } from '../components/ui'
import { SUBMISSIONS } from '../data/samples'
import { keySegments, DEFAULT_PINS } from '../engine/key'
import { evaluate } from '../engine/pipeline'
import { store, useStore } from '../engine/store'
import type { Pins, Verdict } from '../engine/types'

const RUNS = 5

interface Run {
  n: number
  keyId: string
  total: number
  letter: string
  modelCalls: number
  source: 'model' | 'record'
  ms: number
  stored: boolean
}

export default function Consistency() {
  const [subject, setSubject] = useState(SUBMISSIONS[0].id)
  const [unpinned, setUnpinned] = useState<Run[]>([])
  const [pinned, setPinned] = useState<Run[]>([])
  const [busy, setBusy] = useState<'none' | 'unpinned' | 'pinned'>('none')
  const verdicts = useStore((s) => s.verdicts)
  const hits = useStore((s) => s.hits)

  const submission = SUBMISSIONS.find((s) => s.id === subject)!

  async function replay(pins: Pins, set: (runs: Run[]) => void, tag: 'unpinned' | 'pinned') {
    setBusy(tag)
    set([])
    const collected: Run[] = []

    for (let n = 1; n <= RUNS; n++) {
      const outcome = await evaluate({
        submission,
        pins,
        lookup: (id) => store.lookup(id),
        pace: 0,
      })
      if (outcome.kind !== 'graded' && outcome.kind !== 'cached') break

      const verdict: Verdict = outcome.verdict
      if (outcome.kind === 'graded') store.commit(verdict, 'consistency-lab')
      else store.noteHit(verdict.keyId)

      collected.push({
        n,
        keyId: verdict.keyId,
        total: verdict.total,
        letter: verdict.letter,
        modelCalls: verdict.modelCalls,
        source: outcome.kind === 'cached' ? 'record' : 'model',
        ms: verdict.elapsedMs,
        stored: verdict.reproducible,
      })
      set([...collected])
      await new Promise((r) => setTimeout(r, 260))
    }
    setBusy('none')
  }

  return (
    <>
      <StepHead meta={`${RUNS} runs each side · rubric ${DEFAULT_PINS.rubricVersion.replace('rbr_', '')} · prompt ${DEFAULT_PINS.promptVersion.replace('p_', 'p')} · model ${DEFAULT_PINS.modelVersion.replace('m_', '')}`}>
        A student uploaded the same assignment twice and was graded A, then B. Five things were free to move between
        those two runs. Below, the same submission is graded five times with decoding unpinned, then five times with
        every input pinned into an evaluation key.
      </StepHead>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="label">Subject</span>
        <select
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value)
            setUnpinned([])
            setPinned([])
          }}
          className="w-full max-w-full rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink outline-none focus:border-line-strong sm:w-auto"
        >
          {SUBMISSIONS.filter((s) => !s.corrupt && s.ocrConfidence >= 0.75).map((s) => (
            <option key={s.id} value={s.id}>
              {s.student} · {s.fileName}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ReplayPanel
          tone="hold"
          icon={<Unlock className="size-4 text-hold-ink" strokeWidth={2} />}
          title="Decoding unpinned"
          meta="temperature 0.7 · everything else identical"
          explain="Nothing about the work changed between these runs. The sampler did. This is the defect exactly as it was reported, and no amount of prompt engineering closes it."
          runs={unpinned}
          busy={busy === 'unpinned'}
          disabled={busy !== 'none'}
          onRun={() => replay({ ...DEFAULT_PINS, temperature: 0.7 }, setUnpinned, 'unpinned')}
        />

        <ReplayPanel
          tone="verified"
          icon={<Lock className="size-4 text-verified-ink" strokeWidth={2} />}
          title="Every input pinned"
          meta="temperature 0 · rubric, prompt, model and seed fixed"
          explain="The first run derives a key and records a verdict against it. Every run after that finds the key already present and returns the stored grade, so there is no second inference to disagree with the first."
          runs={pinned}
          busy={busy === 'pinned'}
          disabled={busy !== 'none'}
          onRun={() => replay(DEFAULT_PINS, setPinned, 'pinned')}
        />
      </div>

      <Card className="mt-5">
        <CardHead
          title="Verdict ledger"
          meta="Every key this browser has produced, what it resolved to, and how often it has been asked for."
        />
        {Object.keys(verdicts).length === 0 ? (
          <Empty title="No verdicts yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="label px-5 py-2.5 font-medium">Evaluation key</th>
                  <th className="label px-3 py-2.5 font-medium">Verdict</th>
                  <th className="label px-3 py-2.5 font-medium">Requests</th>
                  <th className="label px-3 py-2.5 font-medium">Served from record</th>
                  <th className="label px-5 py-2.5 font-medium">Pins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {Object.values(verdicts)
                  .slice()
                  .reverse()
                  .map((verdict) => {
                    const requests = hits[verdict.keyId] ?? 1
                    return (
                      <tr key={verdict.keyId} className="transition-colors hover:bg-paper">
                        <td className="px-5 py-3">
                          <KeyRef id={verdict.keyId} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-medium text-ink tabular-nums">{verdict.total}</span>
                          <span className="ml-1.5 text-xs text-ink-faint">{verdict.letter}</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-sm text-ink-soft tabular-nums">{requests}</td>
                        <td className="px-3 py-3">
                          {requests > 1 ? (
                            <Badge tone="verified">{requests - 1} of {requests}</Badge>
                          ) : (
                            <span className="text-sm text-ink-faint">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs text-ink-faint">
                            {keySegments(verdict.key).slice(1).map((s) => s.value).join(' · ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="mt-5">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">What each pin protects</h2>
        <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-ink-soft">
          A grade is a function of four inputs and the settings used to decode them. Each of the six below can change
          a mark legitimately. What is not acceptable is any of them changing without being recorded.
        </p>
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {keySegments({ id: 'ek_example', digest: '', textHash: '', pins: DEFAULT_PINS }).map((segment) => (
            <div key={segment.pin} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <div className="flex shrink-0 items-center gap-2 sm:w-52">
                <Lock className="size-3 shrink-0 text-verified" strokeWidth={2.5} />
                <span className="text-base font-medium tracking-tight text-ink">{segment.label}</span>
              </div>
              <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{segment.note}</p>
            </div>
          ))}
        </div>
      </section>

      <Note tone="neutral" title="A changed pin never rewrites history">
        <p className="mt-1">
          Publishing a new rubric, prompt or model build creates a new key space. Work already in flight finishes on
          its original pin, and future submissions bind to the new one. Re-grading history is an explicit, logged,
          opt-in migration — never a side effect of shipping.
        </p>
      </Note>
    </>
  )
}

function ReplayPanel({
  tone,
  icon,
  title,
  meta,
  explain,
  runs,
  busy,
  disabled,
  onRun,
}: {
  tone: 'hold' | 'verified'
  icon: React.ReactNode
  title: string
  meta: string
  explain: string
  runs: Run[]
  busy: boolean
  disabled: boolean
  onRun: () => void
}) {
  const distinct = new Set(runs.map((r) => r.total))
  const done = runs.length === RUNS
  const modelCalls = runs.reduce((sum, r) => sum + r.modelCalls, 0)

  return (
    <Card className="flex flex-col">
      <CardHead
        title={
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
        }
        meta={meta}
        action={
          <Button variant={tone === 'verified' ? 'primary' : 'secondary'} size="sm" onClick={onRun} disabled={disabled}>
            <Play className="size-3.5" strokeWidth={2} />
            {busy ? 'Running…' : `Run ${RUNS}×`}
          </Button>
        }
      />

      <div className="px-5 py-4">
        <p className="max-w-lg text-base leading-relaxed text-ink-soft">{explain}</p>
      </div>

      {runs.length === 0 ? (
        <div className="flex-1 border-t border-line">
          <Empty title={`Not run yet`}>Five runs, same file, same rubric.</Empty>
        </div>
      ) : (
        <div className="flex-1 border-t border-line">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-5 py-2 font-medium">Run</th>
                <th className="label px-3 py-2 font-medium">Key</th>
                <th className="label px-3 py-2 font-medium">Grade</th>
                <th className="label px-5 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.map((run) => (
                <tr key={run.n} style={{ animation: 'stage-in 260ms var(--ease-out-quint)' }}>
                  <td className="px-5 py-2.5 font-mono text-xs text-ink-faint">#{run.n}</td>
                  <td className="px-3 py-2.5">
                    <KeyRef id={run.keyId} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={clsx(
                        'font-medium tabular-nums',
                        tone === 'hold' && distinct.size > 1 ? 'text-hold-ink' : 'text-ink',
                      )}
                    >
                      {run.total}
                    </span>
                    <span className="ml-1.5 text-xs text-ink-faint">{run.letter}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    {run.source === 'record' ? (
                      <Badge tone="verified">record · 0 calls</Badge>
                    ) : (
                      <Badge tone="neutral">model · {run.modelCalls} calls</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {done && (
        <div
          className={clsx(
            'border-t px-5 py-4',
            tone === 'verified' ? 'border-verified-line bg-verified-bg' : 'border-hold-line bg-hold-bg',
          )}
          style={{ animation: 'stage-in 320ms var(--ease-out-quint)' }}
        >
          <div className="flex items-start gap-2.5">
            {tone === 'hold' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-hold-ink" strokeWidth={2} />
            ) : (
              <Lock className="mt-0.5 size-3.5 shrink-0 text-verified-ink" strokeWidth={2.5} />
            )}
            <div>
              <p
                className={clsx(
                  'text-sm font-medium tracking-tight',
                  tone === 'verified' ? 'text-verified-ink' : 'text-hold-ink',
                )}
              >
                {distinct.size === 1
                  ? `One grade across ${RUNS} runs`
                  : `${distinct.size} different grades across ${RUNS} runs`}
              </p>
              <p className={clsx('mt-1 text-base leading-relaxed', tone === 'verified' ? 'text-verified-ink/85' : 'text-hold-ink/85')}>
                {distinct.size > 1
                  ? `Range ${Math.min(...runs.map((r) => r.total))} to ${Math.max(...runs.map((r) => r.total))}. None of these runs was admitted to the record, because none of them can be reproduced. Note that the evaluation key is identical across all five — the key is honest about the inputs, and unpinned decoding is an input it cannot capture.`
                  : modelCalls === 0
                    ? 'Not one model call. Every run found the key already present and returned the stored verdict, so there was no second inference that could disagree with the first.'
                    : `${modelCalls} model calls in total, all in the first run. Every run after it resolved from the record.`}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
