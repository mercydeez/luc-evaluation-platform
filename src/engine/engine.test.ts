import { describe, expect, it } from 'vitest'
import { canonicalise, contentHash } from './hash'
import { buildKey, DEFAULT_PINS, diffPins } from './key'
import { evaluate } from './pipeline'
import { RUBRICS, extractFeatures, getRubric, scoreCompliance } from './rubric'
import { store } from './store'
import { validateVerdict } from './validate'
import type { CriterionScore, Pins, Submission, Verdict } from './types'

const BODY = `Executive summary
The analysis covers 148 stores over 26 weeks. Three categories show stockout cost exceeding carrying cost by more than 2 times.

Methodology
Transactions were deseasonalised with a 13-week trailing median before price elasticity was estimated per category, which avoids the promotional distortion visible in the raw series. A weighted baseline was aggregated per cohort.

Findings
Reordering thresholds were recomputed with a 94% service-level target, lifting simulated availability by 3.1 points at flat inventory value. Therefore the recommendation holds at current cost.

Limitations
The elasticity estimates assume competitor pricing is held constant, which the dataset cannot confirm, and the store clustering uses a single season of footfall. However this limitation does not reverse the ranking.

Recommendation
Reorder points should be raised for the three named categories because the simulated availability gain exceeds the carrying cost.`

function submission(over: Partial<Submission> = {}): Submission {
  return {
    id: 'sub_test',
    student: 'Test Student',
    studentId: 'BA-402-T01',
    course: 'BA-402',
    assignment: 'Case Study 2',
    attempt: 1,
    fileName: 'test.pdf',
    sizeKb: 240,
    pages: 9,
    submittedAt: '2026-08-11T21:04:00Z',
    lateHours: 0,
    ocrConfidence: 0.98,
    // Repeated so the sample clears the rubric's word-count floor.
    text: [BODY, BODY, BODY, BODY, BODY, BODY, BODY, BODY].join('\n\n'),
    ...over,
  }
}

const noCache = (_id: string): Verdict | undefined => undefined

async function run(
  sub: Submission,
  pins: Pins = DEFAULT_PINS,
  lookup: (id: string) => Verdict | undefined = noCache,
) {
  return evaluate({ submission: sub, pins, lookup, pace: 0 })
}

function verdictOf(outcome: Awaited<ReturnType<typeof run>>): Verdict {
  if (outcome.kind !== 'graded' && outcome.kind !== 'cached') {
    throw new Error(`expected a verdict, got ${outcome.kind}`)
  }
  return outcome.verdict
}

describe('content identity', () => {
  it('hashes the work, not the file: a re-export produces the same hash', async () => {
    const original = 'The margin rose 2.4% — see section 5.\n\nMethodology follows.'
    const reExported = '  The  margin rose 2.4% — see section 5.\r\n\r\n\r\nMethodology follows.  '
    expect(await contentHash(original)).toBe(await contentHash(reExported))
  })

  it('does not collapse a real edit into the same hash', async () => {
    expect(await contentHash('availability by 3.1 points')).not.toBe(
      await contentHash('availability by 4.1 points'),
    )
  })

  it('leaves case and word order alone', () => {
    expect(canonicalise('Stockout Cost')).toBe('Stockout Cost')
  })
})

describe('the evaluation key', () => {
  it('changes when any single pin changes, and names which one', async () => {
    const hash = await contentHash(BODY)
    const base = await buildKey(hash, DEFAULT_PINS)

    const changes: [keyof Pins, Partial<Pins>][] = [
      ['rubricVersion', { rubricVersion: 'rbr_2.2' }],
      ['promptVersion', { promptVersion: 'p_12' }],
      ['modelVersion', { modelVersion: 'm_2026-08-01' }],
      ['temperature', { temperature: 0.7 }],
      ['seed', { seed: 42 }],
    ]

    for (const [name, patch] of changes) {
      const pins = { ...DEFAULT_PINS, ...patch }
      const key = await buildKey(hash, pins)
      expect(key.id, `${name} must move the key`).not.toBe(base.id)
      expect(diffPins(DEFAULT_PINS, pins)).toEqual([name])
    }
  })

  it('is stable for the same hash and pins', async () => {
    const hash = await contentHash(BODY)
    expect((await buildKey(hash, DEFAULT_PINS)).id).toBe((await buildKey(hash, DEFAULT_PINS)).id)
  })
})

describe('the invariant: identical work cannot receive two grades', () => {
  it('returns a byte-identical verdict for the same submission and pins', async () => {
    const a = verdictOf(await run(submission()))
    const b = verdictOf(await run(submission()))

    expect(a.keyId).toBe(b.keyId)
    expect(a.total).toBe(b.total)
    expect(a.letter).toBe(b.letter)
    expect(a.criteria.map((c) => [c.id, c.score, c.confidence])).toEqual(
      b.criteria.map((c) => [c.id, c.score, c.confidence]),
    )
  })

  it('is unaffected by whitespace and smart-quote noise from a re-export', async () => {
    const clean = verdictOf(await run(submission()))
    const noisy = verdictOf(
      await run(submission({ text: submission().text.replace(/\n/g, '\r\n  ').replace(/'/g, '’') })),
    )
    expect(noisy.keyId).toBe(clean.keyId)
    expect(noisy.total).toBe(clean.total)
  })

  it('returns the stored verdict without calling the model on a repeat submission', async () => {
    const first = verdictOf(await run(submission()))
    const cache = new Map([[first.keyId, first]])

    const second = await run(submission(), DEFAULT_PINS, (id) => cache.get(id))

    expect(second.kind).toBe('cached')
    const v = verdictOf(second)
    expect(v.modelCalls).toBe(0)
    expect(v.total).toBe(first.total)
    expect(second.stages.find((s) => s.id === 'model_evaluation')?.status).toBe('skipped')
  })

  it('produces a different grade when a pin moves, and only then', async () => {
    const base = verdictOf(await run(submission()))
    const other = verdictOf(await run(submission(), { ...DEFAULT_PINS, promptVersion: 'p_12' }))
    expect(other.keyId).not.toBe(base.keyId)
  })
})

describe('the reported defect', () => {
  it('diverges across runs when decoding is not pinned', async () => {
    const pins = { ...DEFAULT_PINS, temperature: 0.7 }
    const totals = new Set<number>()
    for (let i = 0; i < 6; i++) totals.add(verdictOf(await run(submission(), pins)).total)
    expect(totals.size).toBeGreaterThan(1)
  })

  it('marks an unpinned run as irreproducible and refuses it from the record', async () => {
    const verdict = verdictOf(await run(submission(), { ...DEFAULT_PINS, temperature: 0.7 }))
    expect(verdict.reproducible).toBe(false)

    store.reset()
    expect(store.commit(verdict, 'test')).toBeNull()
    expect(store.getState().record).toHaveLength(0)
    expect(store.getState().audit.at(-1)?.event).toBe('verdict.refused')
  })
})

describe('the rubric engine computes what can be computed', () => {
  const rubric = getRubric('rbr_2.3')

  it('penalises a shortfall against the word floor', () => {
    const features = extractFeatures(BODY)
    const { score, lines } = scoreCompliance(rubric, features, 0)
    expect(features.words).toBeLessThan(rubric.minWords)
    expect(score).toBeLessThan(100)
    expect(lines.some((l) => l.label.includes('below the 700 minimum'))).toBe(true)
  })

  it('charges lateness at the published rate and respects the cap', () => {
    const features = extractFeatures(submission().text)
    const twoDays = scoreCompliance(rubric, features, 36)
    const tenDays = scoreCompliance(rubric, features, 240)
    expect(twoDays.lines.at(-1)?.delta).toBe(-10)
    expect(tenDays.lines.at(-1)?.delta).toBe(-rubric.latePenaltyCap)
  })

  it('charges a missing required section once each', () => {
    const features = extractFeatures('Executive summary. Methodology. Findings only.')
    const { lines } = scoreCompliance(rubric, features, 0)
    const missing = lines.filter((l) => l.label.startsWith('Required section absent'))
    expect(missing.map((l) => l.delta)).toEqual([-12, -12])
  })

  it('never asks the model for a mechanical criterion', async () => {
    const verdict = verdictOf(await run(submission()))
    const compliance = verdict.criteria.find((c) => c.id === 'compliance')!
    expect(compliance.kind).toBe('mechanical')
    expect(compliance.confidence).toBe(1)
    expect(verdict.modelCalls).toBe(verdict.criteria.filter((c) => c.kind === 'judgement').length)
  })

  it('ships rubrics whose weights sum to 100', () => {
    for (const rubricVersion of Object.values(RUBRICS)) {
      const total = rubricVersion.criteria.reduce((sum, c) => sum + c.weight, 0)
      expect(total, rubricVersion.version).toBe(100)
    }
  })
})

describe('the validation layer', () => {
  const rubric = getRubric('rbr_2.3')

  function score(over: Partial<CriterionScore> = {}): CriterionScore {
    return {
      id: 'method', name: 'Method rigour', weight: 25, kind: 'judgement',
      score: 80, band: 'B+', anchor: '', reasoning: '',
      evidence: ['Transactions were deseasonalised'], confidence: 0.9, ...over,
    }
  }

  const full = (patch: Partial<CriterionScore> = {}) =>
    rubric.criteria.map((c) =>
      score({ id: c.id, name: c.name, weight: c.weight, kind: c.kind, evidence: c.kind === 'judgement' ? ['Transactions were deseasonalised'] : [], ...(c.id === 'method' ? patch : {}) }),
    )

  it('accepts a well-formed verdict', () => {
    expect(validateVerdict(rubric, full(), 'Transactions were deseasonalised with a median.')).toEqual([])
  })

  it('rejects a score outside range', () => {
    const issues = validateVerdict(rubric, full({ score: 140 }), 'Transactions were deseasonalised')
    expect(issues.map((i) => i.rule)).toContain('score-in-range')
  })

  it('rejects evidence that does not appear in the submission', () => {
    const issues = validateVerdict(rubric, full({ evidence: ['a quote the student never wrote'] }), 'Transactions were deseasonalised')
    expect(issues.map((i) => i.rule)).toContain('evidence-verbatim')
  })

  it('rejects a missing criterion', () => {
    const issues = validateVerdict(rubric, full().slice(1), 'Transactions were deseasonalised')
    expect(issues.map((i) => i.rule)).toContain('criterion-present')
  })
})

describe('gates and rejections', () => {
  it('holds low-confidence extraction instead of grading it', async () => {
    const outcome = await run(submission({ ocrConfidence: 0.41 }))
    expect(outcome.kind).toBe('held')
    expect(outcome.stages.find((s) => s.id === 'model_evaluation')?.status).toBe('skipped')
  })

  it('rejects a corrupt file before a job exists', async () => {
    const outcome = await run(submission({ corrupt: true }))
    expect(outcome.kind).toBe('rejected')
    expect(outcome.stages.filter((s) => s.status === 'ok')).toHaveLength(0)
  })

  it('scores a submission that evidences nothing, rather than rejecting it as malformed', async () => {
    // Contains none of the cue terms any criterion looks for. A weak answer is a
    // low mark with quoted text behind it, not a validation failure.
    const bare = Array.from(
      { length: 30 },
      (_, i) => `Summary. Methodology. Findings. Limitations. Recommendation. The company should do the thing in paragraph ${i} and it will be good for them overall.`,
    ).join(' ')

    const outcome = await run(submission({ text: bare }))
    expect(outcome.kind).toBe('graded')
    const verdict = verdictOf(outcome)
    for (const criterion of verdict.criteria.filter((c) => c.kind === 'judgement')) {
      expect(criterion.evidence.length).toBeGreaterThan(0)
    }
  })

  it('quotes evidence that is verbatim in the graded text', async () => {
    const verdict = verdictOf(await run(submission()))
    for (const criterion of verdict.criteria.filter((c) => c.kind === 'judgement')) {
      for (const span of criterion.evidence) {
        expect(verdict.gradedText).toContain(span)
      }
    }
  })
})

describe('the record is append-only', () => {
  it('keeps the AI grade when a professor overrides it', async () => {
    store.reset()
    const verdict = verdictOf(await run(submission()))
    store.commit(verdict, 'system')

    store.override({
      submissionId: verdict.submissionId,
      keyId: verdict.keyId,
      total: 81,
      letter: 'B+',
      actor: 'Dr. Anita Rao',
      reason: 'Criterion 4 anchor applied more generously in line with the cohort.',
      release: true,
      adjustments: { limits: 84 },
    })

    const versions = store.getState().record.filter((r) => r.submissionId === verdict.submissionId)
    expect(versions).toHaveLength(2)
    expect(versions[0].source).toBe('ai')
    expect(versions[0].total).toBe(verdict.total)
    expect(versions[1].source).toBe('professor_override')
    expect(versions[1].total).toBe(81)
    expect(store.getState().audit.some((a) => a.event.startsWith('grade.overridden'))).toBe(true)
  })
})
