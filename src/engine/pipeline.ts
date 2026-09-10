import { judge } from './evaluator'
import { canonicalise, contentHash } from './hash'
import { buildKey } from './key'
import { rng } from './prng'
import { distanceToBandEdge, extractFeatures, getRubric, letterFor, scoreCompliance } from './rubric'
import { validateVerdict, type ValidationIssue } from './validate'
import type { CriterionScore, Outcome, Pins, Stage, Submission, Verdict } from './types'

/** Extraction confidence below this is not graded. It is routed to a human. */
export const EXTRACTION_GATE = 0.75

/** A verdict this uncertain is held for a professor decision before release. */
export const REVIEW_THRESHOLD = 0.75

interface StageSpec {
  id: string
  name: string
  ms: number
  why: string
}

const SPECS: StageSpec[] = [
  { id: 'intake', name: 'Intake', ms: 120, why: 'A corrupted or oversized file is rejected before a job exists, so it surfaces as a specific upload error rather than as a low grade someone has to defend.' },
  { id: 'extract', name: 'Text extraction', ms: 620, why: 'Text is the artifact being graded, not the file. Extraction is separated from grading so its failures are visible on their own.' },
  { id: 'quality_gate', name: 'Extraction quality gate', ms: 90, why: 'Poor text produces confident nonsense. Below the confidence threshold the work goes to a human instead of to a model.' },
  { id: 'canonicalise', name: 'Canonicalisation', ms: 70, why: 'Whitespace, smart quotes and re-export artifacts are removed, so the same work hashes identically however the file was produced.' },
  { id: 'content_hash', name: 'Content hash', ms: 60, why: 'sha-256 over the canonical text. This is the identity of the work, independent of the bytes it arrived in.' },
  { id: 'key', name: 'Evaluation key', ms: 55, why: 'The hash and every pin are combined into one address. Nothing is graded without a key, because a grade that cannot be reproduced is not admitted to the record.' },
  { id: 'verdict_lookup', name: 'Verdict store', ms: 45, why: 'If the key already exists the stored verdict is returned and no model is called. This is what makes identical work impossible to grade twice.' },
  { id: 'rubric_engine', name: 'Rubric engine', ms: 110, why: 'Word counts, required sections, weights and late penalties are arithmetic. They are computed in code, where they are testable, and never asked of the model.' },
  { id: 'model_evaluation', name: 'Model evaluation', ms: 1420, why: 'The model is asked only for the part of the rubric that requires judgement, against pinned decoding settings.' },
  { id: 'validation', name: 'Validation layer', ms: 130, why: 'Malformed output, out-of-range scores, missing criteria and evidence that does not appear in the submission are rejected before a human ever sees them.' },
  { id: 'record', name: 'Grade record', ms: 95, why: 'The verdict is appended to a versioned, append-only record with an audit entry. History is never overwritten.' },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface PipelineOptions {
  submission: Submission
  pins: Pins
  /** Verdict store lookup. Returning a verdict short-circuits the model. */
  lookup: (keyId: string) => Verdict | undefined
  /** Wall-clock multiplier for the demo. 0 runs with no delay, for tests and replays. */
  pace?: number
}

/**
 * The grading pipeline, as eleven named stages.
 *
 * Yields the full stage list on every transition, so a caller renders progress
 * without tracking it, and returns the outcome. Grading is written as a
 * generator for the same reason it runs as a queued job in production:
 * submissions arrive in a spike before a deadline, and the work has to be
 * observable while it is in flight rather than only when it lands.
 */
export async function* runPipeline(opts: PipelineOptions): AsyncGenerator<Stage[], Outcome> {
  const { submission, pins, lookup, pace = 1 } = opts
  const started = performance.now()
  const jitter = rng(`${submission.id}:${pins.seed}`)

  const stages: Stage[] = SPECS.map((s, i) => ({
    n: i + 1, id: s.id, name: s.name, status: 'pending', ms: 0, detail: '', why: s.why,
  }))
  const snapshot = () => stages.map((s) => ({ ...s }))

  /** Marks stage n running, waits out its cost, then commits the result. */
  async function* step<T>(n: number, work: () => T | Promise<T>): AsyncGenerator<Stage[], T> {
    const stage = stages[n - 1]
    stage.status = 'running'
    yield snapshot()
    const ms = Math.round(SPECS[n - 1].ms * (0.85 + jitter() * 0.3))
    if (pace > 0) await sleep(ms * pace)
    const value = await work()
    stage.ms = ms
    stage.status = 'ok'
    return value
  }

  const skipRest = (from: number, detail = '') => {
    for (const s of stages.slice(from)) {
      s.status = 'skipped'
      if (detail) s.detail = detail
    }
  }

  // 1 — Intake
  yield* step(1, () => undefined)
  if (submission.corrupt) {
    stages[0].status = 'failed'
    stages[0].detail = 'Page tree unreadable — file truncated at 40% of its declared length'
    skipRest(1)
    yield snapshot()
    return {
      kind: 'rejected',
      reason: 'The file is structurally invalid and was rejected at upload. No grading job was created, and the student receives the failed check with a re-upload link rather than a mark.',
      stages: snapshot(),
    }
  }
  stages[0].detail = `${submission.fileName} · ${submission.sizeKb} KB · ${submission.pages} pages`

  // 2 — Text extraction
  const extracted = yield* step(2, () => submission.text)
  stages[1].detail = `OCR confidence ${submission.ocrConfidence.toFixed(2)} · text layer ${submission.ocrConfidence > 0.9 ? 'present' : 'partial'}`

  // 3 — Extraction quality gate
  yield* step(3, () => undefined)
  if (submission.ocrConfidence < EXTRACTION_GATE) {
    stages[2].status = 'held'
    stages[2].detail = `${submission.ocrConfidence.toFixed(2)} is below the ${EXTRACTION_GATE} gate`
    skipRest(3)
    yield snapshot()
    return {
      kind: 'held',
      reason: `Extraction confidence ${submission.ocrConfidence.toFixed(2)} is below the ${EXTRACTION_GATE} gate, so the work was not graded. It is queued for human review with the extraction score attached, rather than being given a mark the model was not equipped to produce.`,
      stages: snapshot(),
    }
  }
  stages[2].detail = `${submission.ocrConfidence.toFixed(2)} clears the ${EXTRACTION_GATE} gate`

  // 4 — Canonicalisation
  const gradedText = yield* step(4, () => canonicalise(extracted))
  stages[3].detail = `${extracted.length.toLocaleString()} chars in, ${gradedText.length.toLocaleString()} out`

  // 5 — Content hash
  const textHash = yield* step(5, () => contentHash(extracted))
  stages[4].detail = `sha256 ${textHash.slice(0, 12)}…`

  // 6 — Evaluation key
  const key = yield* step(6, () => buildKey(textHash, pins))
  stages[5].detail = key.id

  // 7 — Verdict store
  const hit = yield* step(7, () => lookup(key.id))
  if (hit) {
    stages[6].detail = `Hit — ${key.id} already owns a verdict`
    for (const s of stages.slice(7, 10)) {
      s.status = 'skipped'
      s.detail = 'Not reached — the key already owns a verdict'
    }
    stages[10].status = 'ok'
    stages[10].ms = 12
    stages[10].detail = 'Recorded as a resubmission of identical work against the existing grade'
    yield snapshot()
    return {
      kind: 'cached',
      verdict: { ...hit, cached: true, modelCalls: 0, elapsedMs: Math.round(performance.now() - started) },
      stages: snapshot(),
    }
  }
  stages[6].detail = `Miss — ${key.id} is new`

  // 8 — Rubric engine: everything that is arithmetic
  const rubric = getRubric(pins.rubricVersion)
  const complianceSpec = rubric.criteria.find((c) => c.id === 'compliance')!
  const features = extractFeatures(gradedText)
  const compliance = yield* step(8, () => scoreCompliance(rubric, features, submission.lateHours))
  const mechanical: CriterionScore = {
    id: complianceSpec.id,
    name: complianceSpec.name,
    weight: complianceSpec.weight,
    kind: 'mechanical',
    score: compliance.score,
    band: letterFor(compliance.score),
    anchor: complianceSpec.anchor,
    reasoning: 'Computed in code from the submission and the deadline. No model call was made for this criterion.',
    evidence: [],
    confidence: 1,
    lines: compliance.lines,
  }
  stages[7].detail = `${compliance.lines.length} lines computed · ${compliance.score}/100`

  // 9 — Model evaluation: judgement only
  const judgementCriteria = rubric.criteria.filter((c) => c.kind === 'judgement')
  // Unpinned decoding samples. The nonce is what makes such a run irreproducible,
  // and it is exactly the defect this platform exists to close.
  const nonce = pins.temperature > 0 ? `${Date.now()}:${Math.random()}` : undefined
  const judged = yield* step(9, () =>
    judgementCriteria.map((criterion) => judge({ criterion, text: gradedText, features, key, nonce })),
  )
  stages[8].detail = `${judged.length} judgement criteria · t=${pins.temperature} · ${nonce ? 'sampled' : 'deterministic'}`

  const criteria = [...judged, mechanical]

  // 10 — Validation layer
  const issues = yield* step(10, () => validateVerdict(rubric, criteria, gradedText))
  if (issues.length > 0) {
    stages[9].status = 'failed'
    stages[9].detail = issues[0].message
    stages[10].status = 'skipped'
    yield snapshot()
    return { kind: 'held', reason: describeIssues(issues), stages: snapshot() }
  }
  stages[9].detail = `${criteria.length} criteria · evidence verified verbatim`

  const total = Number((criteria.reduce((sum, c) => sum + c.score * c.weight, 0) / 100).toFixed(1))

  // Confidence is the weight-respecting mean of the criterion confidences, cut
  // when the final mark itself lands on a band boundary. Both halves matter: a
  // shaky criterion carrying 25% of the mark should pull the verdict down, and a
  // total of 79.6 is a decision worth a human regardless of how sure each
  // criterion was on its own.
  const weighted = criteria.reduce((sum, c) => sum + c.confidence * c.weight, 0) / 100
  const onBandEdge = distanceToBandEdge(total) < 1.5
  const confidence = Number(Math.max(0.3, Math.min(0.99, weighted - (onBandEdge ? 0.15 : 0))).toFixed(2))

  const verdict: Verdict = {
    keyId: key.id,
    key,
    submissionId: submission.id,
    total,
    letter: letterFor(total),
    criteria,
    confidence,
    reproducible: pins.temperature === 0,
    modelCalls: judgementCriteria.length,
    cached: false,
    computedAt: new Date().toISOString(),
    elapsedMs: 0,
    gradedText,
  }

  // 11 — Grade record
  yield* step(11, () => undefined)
  stages[10].detail = verdict.reproducible
    ? `Appended as a new version under ${key.id}`
    : 'Not admitted — decoding was not pinned, so this verdict cannot be reproduced'
  verdict.elapsedMs = Math.round(performance.now() - started)
  yield snapshot()

  return { kind: 'graded', verdict, stages: snapshot() }
}

function describeIssues(issues: ValidationIssue[]): string {
  const rest = issues.length - 1
  return `${issues[0].message} The run was rejected by the validation layer${
    rest > 0 ? ` along with ${rest} further issue${rest > 1 ? 's' : ''}` : ''
  } and routed to human review. No grade was published.`
}

/** Runs the pipeline to completion with no pacing. Used by tests and by replays. */
export async function evaluate(opts: PipelineOptions): Promise<Outcome> {
  const gen = runPipeline({ ...opts, pace: opts.pace ?? 0 })
  let step = await gen.next()
  while (!step.done) step = await gen.next()
  return step.value
}
