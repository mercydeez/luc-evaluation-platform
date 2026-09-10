import { describe, expect, it } from 'vitest'
import { answer, buildCorpus, buildIndex, search, tokenize } from './retrieval'
import type { State } from './store'
import type { Submission, Verdict } from './types'

const submission: Submission = {
  id: 'sub_1', student: 'Priya Nandakumar', studentId: 'MBA-514-A17',
  course: 'MBA-514', assignment: 'Case Study 2', attempt: 2,
  fileName: 'nandakumar.pdf', sizeKb: 412, pages: 9,
  submittedAt: '2026-08-11T21:04:00+04:00', lateHours: 0, ocrConfidence: 0.98,
  text: 'irrelevant to retrieval',
}

const verdict = {
  keyId: 'ek_a8e027e3',
  key: {
    id: 'ek_a8e027e3', digest: 'abc', textHash: 'def',
    pins: { rubricVersion: 'rbr_2.3', promptVersion: 'p_11', modelVersion: 'm_2026-05-14', temperature: 0, topP: 1, seed: 41 },
  },
  submissionId: 'sub_1', total: 92.7, letter: 'A',
  criteria: [
    {
      id: 'method', name: 'Method rigour', weight: 25, kind: 'judgement' as const,
      score: 92, band: 'A', anchor: 'anchor',
      reasoning: 'Meets the distinction anchor.',
      evidence: ['Transactions were deseasonalised with a 13-week trailing median'],
      confidence: 0.9,
    },
    {
      id: 'compliance', name: 'Submission compliance', weight: 15, kind: 'mechanical' as const,
      score: 100, band: 'A', anchor: 'anchor',
      reasoning: 'Computed in code.', evidence: [], confidence: 1,
      lines: [{ label: 'Baseline', delta: 100 }, { label: '724 words — inside 700–1500', delta: 0 }],
    },
  ],
  confidence: 0.82, reproducible: true, modelCalls: 4, cached: false,
  computedAt: '2026-09-10T10:00:00Z', elapsedMs: 7, gradedText: 'graded text',
} as unknown as Verdict

const state: State = {
  verdicts: { ek_a8e027e3: verdict },
  hits: { ek_a8e027e3: 2 },
  record: [
    { v: 1, submissionId: 'sub_1', keyId: 'ek_a8e027e3', source: 'ai', total: 92.7, letter: 'A', actor: 'invariant/engine', released: false, at: '2026-09-10T10:00:00Z' },
    { v: 2, submissionId: 'sub_1', keyId: 'ek_a8e027e3', source: 'professor_override', total: 93.3, letter: 'A', actor: 'Dr. Anita Rao', reason: 'Rubric anchor applied more generously in line with the cohort', released: true, at: '2026-09-10T10:05:00Z' },
  ],
  audit: [
    { id: 'ev_1', at: '2026-09-10T10:00:00Z', actor: 'invariant/engine', event: 'grade.proposed', detail: '92.7 (A) proposed at confidence 0.82', keyId: 'ek_a8e027e3' },
  ],
}

const index = buildIndex(buildCorpus(state, [submission]))

describe('tokenising', () => {
  it('drops question words that carry no signal', () => {
    expect(tokenize('What is the grade for Priya?')).toEqual(['grade', 'priya'])
  })

  it('keeps identifiers intact', () => {
    expect(tokenize('why did ek_a8e027e3 change')).toContain('ek_a8e027e3')
  })
})

describe('the tutor answers from the record', () => {
  it('finds the criterion a question is about', () => {
    const result = answer(index, 'why did Priya lose marks on method rigour?')
    expect(result.kind).toBe('answer')
    expect(result.text).toContain('Method rigour')
    expect(result.text).toContain('92')
  })

  it('quotes the evidence the score was based on', () => {
    const result = answer(index, 'what evidence supported the method rigour score')
    expect(result.text).toContain('deseasonalised')
  })

  it('explains a duplicate submission from the stored rule', () => {
    const result = answer(index, 'I submitted the same file twice, why is the grade identical?')
    expect(result.kind).toBe('answer')
    expect(result.text).toMatch(/stored verdict|no model call/i)
  })

  it('reports a professor override with its reason', () => {
    const result = answer(index, 'did a professor override this grade and why')
    expect(result.kind).toBe('answer')
    expect(result.text.toLowerCase()).toContain('anchor')
  })

  it('always names a source it can be checked against', () => {
    for (const question of [
      'what is the total grade',
      'how was submission compliance calculated',
      'what happens at temperature above zero',
    ]) {
      const result = answer(index, question)
      expect(result.kind, question).toBe('answer')
      expect(result.citations.length, question).toBeGreaterThan(0)
      expect(result.citations[0].detail, question).toBeTruthy()
    }
  })
})

describe('the tutor refuses what the record does not hold', () => {
  it('says so rather than guessing', () => {
    const result = answer(index, 'what will the weather be like in Dubai next Tuesday')
    expect(result.kind).toBe('unknown')
    expect(result.citations).toHaveLength(0)
  })

  it('will not answer about a student who is not in the record', () => {
    expect(answer(index, 'what did Wolfgang Kellerman score').kind).toBe('unknown')
  })

  it('will not invent a policy it does not implement', () => {
    expect(answer(index, 'does this platform detect plagiarism or contract cheating').kind).toBe('unknown')
  })

  it('holds the floor against a single incidental word match', () => {
    const hits = search(index, 'grade')
    // One common word hits many documents and identifies none of them.
    expect(hits[0].matched).toEqual(['grade'])
    expect(answer(index, 'grade').kind).toBe('unknown')

    // A word specific enough to pick out one part of the record still answers.
    expect(answer(index, 'temperature').kind).toBe('answer')
  })
})

describe('the corpus tracks the record', () => {
  it('grows a document per criterion, version and audit entry', () => {
    const docs = buildCorpus(state, [submission])
    expect(docs.filter((d) => d.kind === 'criterion')).toHaveLength(2)
    expect(docs.filter((d) => d.kind === 'version')).toHaveLength(2)
    expect(docs.filter((d) => d.kind === 'audit')).toHaveLength(1)
  })

  it('carries a route so every answer can be checked in the product', () => {
    for (const doc of buildCorpus(state, [submission])) {
      expect(doc.to, doc.id).toBeTruthy()
    }
  })

  it('holds nothing but policy when the record is empty', () => {
    const empty = buildCorpus({ verdicts: {}, hits: {}, record: [], audit: [] }, [])
    expect(empty.every((d) => d.kind === 'policy')).toBe(true)
    expect(answer(buildIndex(empty), 'what did Priya score').kind).toBe('unknown')
  })
})
