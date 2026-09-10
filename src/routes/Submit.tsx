import { Play, RotateCcw, Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EvaluationKeyChip } from '../components/EvaluationKeyChip'
import { PipelineView } from '../components/PipelineView'
import { CriteriaList, OutcomeNotice, VerdictHeader } from '../components/Verdict'
import { Badge, Button, Card, CardHead, Note, PageHead } from '../components/ui'
import { COURSE, SAMPLE_NOTES, SUBMISSIONS } from '../data/samples'
import { contentHash } from '../engine/hash'
import { buildKey, DEFAULT_PINS } from '../engine/key'
import { getRubric, RUBRIC_VERSIONS } from '../engine/rubric'
import { useStore } from '../engine/store'
import type { EvaluationKey, Pins, Submission } from '../engine/types'
import { useEvaluation } from '../hooks'

const PROMPT_VERSIONS = ['p_11', 'p_12']
const MODEL_VERSIONS = ['m_2026-05-14', 'm_2026-08-01']
const TEMPERATURES = [0, 0.3, 0.7, 1]

export default function Submit() {
  const [sourceId, setSourceId] = useState(SUBMISSIONS[0].id)
  const [text, setText] = useState(SUBMISSIONS[0].text)
  const [pins, setPins] = useState<Pins>(DEFAULT_PINS)
  const { stages, outcome, running, run, reset } = useEvaluation()
  const verdicts = useStore((s) => s.verdicts)

  const source = SUBMISSIONS.find((s) => s.id === sourceId)!
  const edited = text !== source.text
  const submission: Submission = useMemo(() => ({ ...source, text }), [source, text])

  const liveKey = useLiveKey(text, pins, source.corrupt === true)
  const willHit = liveKey ? Boolean(verdicts[liveKey.id]) : false

  function pick(id: string) {
    setSourceId(id)
    setText(SUBMISSIONS.find((s) => s.id === id)!.text)
    reset()
  }

  return (
    <>
      <PageHead
        title="Submit & grade"
        meta={`${COURSE.code} · ${COURSE.assignment} · rubric ${pins.rubricVersion.replace('rbr_', '')} · due ${COURSE.deadline}`}
      >
        Pick a submission, change anything you like about it or about the pins, and watch what the evaluation key
        does. The key is what the grade is stored against, so two runs that share one cannot disagree.
      </PageHead>

      <div className="grid gap-5 xl:grid-cols-[23rem_1fr]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHead title="Source" meta="Five synthetic submissions covering the states the pipeline has to handle." />
            <ul className="divide-y divide-line">
              {SUBMISSIONS.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-3 px-5 py-3 transition-colors hover:bg-paper">
                    <input
                      type="radio"
                      name="source"
                      checked={sourceId === item.id}
                      onChange={() => pick(item.id)}
                      className="mt-1 size-3.5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.875rem] font-medium tracking-tight text-ink">{item.student}</span>
                        {item.corrupt && <Badge tone="hold">corrupt file</Badge>}
                        {!item.corrupt && item.ocrConfidence < 0.75 && <Badge tone="review">OCR {item.ocrConfidence}</Badge>}
                        {item.lateHours > 0 && <Badge tone="review">{item.lateHours}h late</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-ink-faint">
                        {item.fileName}
                      </span>
                      <span className="mt-1 block text-[0.75rem] leading-snug text-ink-soft">
                        {SAMPLE_NOTES[item.id]}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHead
              title="Extracted text"
              meta="Edit a single character and the content hash moves, which makes this a different piece of work."
              action={
                edited ? (
                  <Button size="sm" variant="ghost" onClick={() => setText(source.text)}>
                    <RotateCcw className="size-3.5" strokeWidth={1.75} />
                    Restore
                  </Button>
                ) : undefined
              }
            />
            <div className="px-5 py-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                aria-label="Extracted submission text"
                className="h-44 w-full resize-y rounded-card border border-line bg-paper px-3 py-2.5 font-mono text-[0.75rem] leading-relaxed text-ink-soft outline-none focus:border-line-strong"
              />
              <p className="mt-2 text-[0.75rem] text-ink-faint">
                {text.split(/\s+/).filter(Boolean).length.toLocaleString()} words ·{' '}
                {edited ? 'edited from the original upload' : 'as extracted'}
              </p>
            </div>
          </Card>

          <PinPanel pins={pins} onChange={setPins} />
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHead
              title="Evaluation key"
              meta="Recomputed as you type. Nothing has to run for this — the key is derived from the inputs alone."
              action={
                <Button variant="primary" onClick={() => run(submission, pins)} disabled={running}>
                  <Play className="size-4" strokeWidth={2} />
                  {running ? 'Running…' : 'Run evaluation'}
                </Button>
              }
            />
            <div className="px-5 py-4">
              {liveKey ? (
                <>
                  <EvaluationKeyChip keyValue={liveKey} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {willHit ? (
                      <Badge tone="verified" dot>
                        <Zap className="size-3" strokeWidth={2.25} />
                        Already in the record — this run will return the stored grade
                      </Badge>
                    ) : (
                      <Badge tone="neutral">New key — this run will be graded and recorded</Badge>
                    )}
                    {pins.temperature > 0 && (
                      <Badge tone="hold" dot>
                        Decoding unpinned — the result cannot be reproduced or stored
                      </Badge>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[0.8125rem] text-ink-faint">
                  This file is rejected at intake, so no key is ever derived for it.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Pipeline"
              meta="Eleven named stages. Open any one to see why it exists."
              action={
                outcome?.kind === 'cached' ? (
                  <Badge tone="verified" dot>
                    Short-circuited at stage 7
                  </Badge>
                ) : undefined
              }
            />
            <PipelineView stages={stages} />
          </Card>

          {outcome && <OutcomePanel outcome={outcome} submissionId={submission.id} />}

          {!outcome && !running && (
            <Note title="What to try first">
              Run the first submission, then run it again without changing anything. The second run stops at stage 7,
              makes no model calls, and returns the identical grade — that is the whole product in one interaction.
              Then set temperature above zero and run it twice more.
            </Note>
          )}
        </div>
      </div>
    </>
  )
}

function OutcomePanel({ outcome, submissionId }: { outcome: NonNullable<ReturnType<typeof useEvaluation>['outcome']>; submissionId: string }) {
  if (outcome.kind === 'held' || outcome.kind === 'rejected') {
    return (
      <Card>
        <CardHead title="No grade was produced" />
        <div className="px-5 py-4">
          <OutcomeNotice kind={outcome.kind} reason={outcome.reason} />
        </div>
      </Card>
    )
  }

  const { verdict } = outcome
  return (
    <Card>
      <CardHead
        title={outcome.kind === 'cached' ? 'Stored verdict returned' : 'Verdict'}
        meta={
          outcome.kind === 'cached'
            ? 'This work has been graded before under this exact key. The record answered; the model was not called.'
            : `${verdict.criteria.length} criteria · rubric ${verdict.key.pins.rubricVersion.replace('rbr_', '')}`
        }
        action={
          <Link
            to={`/review/${submissionId}`}
            className="text-[0.8125rem] font-medium text-ink no-underline hover:underline"
          >
            Open in review →
          </Link>
        }
      />
      <VerdictHeader verdict={verdict} />
      <div className="border-t border-line">
        <CriteriaList verdict={verdict} />
      </div>
      {!verdict.reproducible && (
        <div className="border-t border-line px-5 py-4">
          <Note tone="hold" title="This verdict was not admitted to the record">
            Decoding was not pinned, so re-running these exact inputs can return a different mark. A grade that
            cannot be reproduced cannot be defended, so it is logged and refused rather than stored.
          </Note>
        </div>
      )}
    </Card>
  )
}

function PinPanel({ pins, onChange }: { pins: Pins; onChange: (p: Pins) => void }) {
  const rubric = getRubric(pins.rubricVersion)
  const set = <K extends keyof Pins>(k: K, v: Pins[K]) => onChange({ ...pins, [k]: v })

  return (
    <Card>
      <CardHead
        title="Pins"
        meta="The four inputs a grade is a function of, plus the decoding settings that decide whether it can be reproduced."
        action={
          <Button size="sm" variant="ghost" onClick={() => onChange(DEFAULT_PINS)}>
            Defaults
          </Button>
        }
      />
      <div className="space-y-4 px-5 py-4">
        <Field label="Rubric version" note={`${rubric.name} · ${rubric.minWords}–${rubric.maxWords} words · ${rubric.requiredSections.length} required sections`}>
          <Select value={pins.rubricVersion} onChange={(v) => set('rubricVersion', v)} options={RUBRIC_VERSIONS} />
        </Field>

        <Field label="Prompt version" note="The prompt is behaviour, not configuration.">
          <Select value={pins.promptVersion} onChange={(v) => set('promptVersion', v)} options={PROMPT_VERSIONS} />
        </Field>

        <Field label="Model build" note="Pinned per cohort. A provider update does not reach work already in flight.">
          <Select value={pins.modelVersion} onChange={(v) => set('modelVersion', v)} options={MODEL_VERSIONS} />
        </Field>

        <Field
          label="Temperature"
          note={
            pins.temperature === 0
              ? 'Pinned. Identical inputs return an identical verdict.'
              : 'Sampling. Identical inputs can return different marks, and the run will be refused from the record.'
          }
        >
          <div className="flex gap-1.5">
            {TEMPERATURES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('temperature', t)}
                className={`flex-1 rounded-full border px-2 py-1.5 font-mono text-[0.75rem] transition-colors ${
                  pins.temperature === t
                    ? t === 0
                      ? 'border-verified bg-verified-bg text-verified-ink'
                      : 'border-hold bg-hold-bg text-hold-ink'
                    : 'border-line text-ink-faint hover:border-line-strong hover:text-ink-soft'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Decode seed" note="Pins the remaining decoding entropy.">
          <input
            type="number"
            value={pins.seed}
            min={1}
            max={9999}
            onChange={(e) => set('seed', Number(e.target.value) || 1)}
            className="w-24 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[0.8125rem] text-ink outline-none focus:border-line-strong"
          />
        </Field>
      </div>
    </Card>
  )
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="label">{label}</span>
        {children}
      </div>
      {note && <p className="mt-1.5 max-w-sm text-[0.75rem] leading-snug text-ink-faint">{note}</p>}
    </div>
  )
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[0.75rem] text-ink outline-none focus:border-line-strong"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

/** Derives the key from the current inputs on every edit. No grading involved. */
function useLiveKey(text: string, pins: Pins, disabled: boolean): EvaluationKey | null {
  const [key, setKey] = useState<EvaluationKey | null>(null)

  useEffect(() => {
    if (disabled) return
    let live = true
    const timer = setTimeout(() => {
      contentHash(text)
        .then((hash) => buildKey(hash, pins))
        .then((next) => {
          if (live) setKey(next)
        })
    }, 120)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [text, pins, disabled])

  return disabled ? null : key
}
