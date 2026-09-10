import { DEFAULT_PINS } from '../engine/key'
import { evaluate, REVIEW_THRESHOLD } from '../engine/pipeline'
import { rng } from '../engine/prng'
import { distanceToBandEdge, letterFor } from '../engine/rubric'
import type { Submission, Verdict } from '../engine/types'
import { COURSE, SUBMISSIONS } from './samples'

/**
 * A synthetic cohort, graded by the real engine.
 *
 * Forty submissions are generated deterministically from the sample corpus by
 * dropping sections, trimming length, thinning the quantification and moving
 * the deadline — then every one is put through the same pipeline the product
 * uses. The distribution on the cohort screen is therefore the engine's own
 * output rather than an illustration of what it might produce.
 *
 * Seven of the forty are exact resubmissions of work already in the cohort, so
 * the cache-hit rate shown is measured rather than claimed.
 *
 * This runs in a private verdict cache. It never touches the record the rest of
 * the product reads, because forty demonstration grades in the audit log would
 * bury the five that a person actually walked through.
 */

const SIZE = 40
const DUPLICATES = 7

const FIRST = [
  'Aisha', 'Rohan', 'Mei', 'Tomas', 'Zainab', 'Daniel', 'Leila', 'Arun', 'Hana', 'Yusuf',
  'Clara', 'Nikhil', 'Sofia', 'Idris', 'Anya', 'Ravi', 'Noor', 'Elias', 'Divya', 'Karim',
  'Mariam', 'Jonas', 'Sana', 'Felix', 'Nadia', 'Omar', 'Grace', 'Imran', 'Talia', 'Victor',
  'Lina', 'Aditya',
]
const LAST = [
  'Haddad', 'Menon', 'Okafor', 'Silva', 'Rahman', 'Novak', 'Farouk', 'Iyer', 'Costa', 'Bakr',
  'Lindqvist', 'Nair', 'Duarte', 'Osei', 'Petrov', 'Kaur', 'Aziz', 'Weber', 'Sharma', 'Mensah',
]

/** Deterministic degradations, applied in combination, that a real cohort exhibits. */
function degrade(text: string, random: () => number): string {
  let out = text

  if (random() < 0.35) {
    // Drops the limitations section: the single most common weakness in the corpus.
    out = out.replace(/\n\nLimitations\n\n[\s\S]*?(?=\n\n[A-Z])/, '\n\n')
  }
  if (random() < 0.3) {
    // Strips quantification, leaving the claim without the number behind it.
    out = out.replace(/\b\d+(?:\.\d+)?\s?(%|per cent|points|weeks|stores|times)\b/g, 'some')
  }
  if (random() < 0.4) {
    // Truncates: a submission written against the clock.
    const paragraphs = out.split('\n\n')
    out = paragraphs.slice(0, Math.max(4, Math.floor(paragraphs.length * (0.5 + random() * 0.4)))).join('\n\n')
  }
  if (random() < 0.25) {
    // Removes the hedging that the limits criterion looks for.
    out = out.replace(/\b(assume[sd]?|limitation[s]?|cannot confirm|held constant)\b/gi, 'is')
  }
  return out
}

export interface CohortMember {
  submission: Submission
  verdict?: Verdict
  outcome: 'graded' | 'cached' | 'held' | 'rejected'
  /**
   * Set on a cache hit where the key was first produced by a *different*
   * student. Content addressing cannot tell the two cases apart on its own, and
   * they are not the same case at all: one is a saving, the other is two people
   * handing in the same words.
   */
  collision?: boolean
}

export interface Cohort {
  members: CohortMember[]
  /** Count per letter band, in descending band order. */
  distribution: { band: string; count: number }[]
  mean: number
  median: number
  graded: number
  held: number
  rejected: number
  /** Cache hits that were the same student submitting again. */
  resubmissions: number
  /** Cache hits where the identical text came from someone else. */
  collisions: number
  /** Verdicts below the release threshold: the work a human has to decide. */
  needsDecision: number
  /** How often each criterion was the one closest to a band boundary. */
  borderlineBy: { name: string; count: number; share: number }[]
  medianMs: number
  /** Marks awarded by the rubric engine rather than by judgement, as a share. */
  mechanicalShare: number
}

const BAND_ORDER = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F']

let pending: Promise<Cohort> | null = null

export function buildCohort(): Promise<Cohort> {
  pending ??= run()
  return pending
}

async function run(): Promise<Cohort> {
  const random = rng('cohort:mba-514:term-3')
  const gradeable = SUBMISSIONS.filter((s) => !s.corrupt && s.ocrConfidence >= 0.75)
  const cache = new Map<string, Verdict>()
  /** Which student first produced each key, so a hit can be attributed. */
  const owner = new Map<string, string>()
  const members: CohortMember[] = []

  for (let i = 0; i < SIZE; i++) {
    const isDuplicate = i >= SIZE - DUPLICATES
    const source = isDuplicate
      ? members[Math.floor(random() * (SIZE - DUPLICATES))]
      : undefined

    const base = gradeable[Math.floor(random() * gradeable.length)]
    const name = `${FIRST[Math.floor(random() * FIRST.length)]} ${LAST[Math.floor(random() * LAST.length)]}`
    const ocr = random() < 0.08 ? 0.3 + random() * 0.4 : 0.9 + random() * 0.09
    const late = random() < 0.18 ? Math.ceil(random() * 4) * 24 : 0

    const submission: Submission = source
      ? { ...source.submission, id: `coh_${i}`, attempt: source.submission.attempt + 1 }
      : {
          ...base,
          id: `coh_${i}`,
          student: name,
          studentId: `${COURSE.code}-${String(i + 1).padStart(3, '0')}`,
          attempt: 1,
          lateHours: late,
          ocrConfidence: Number(ocr.toFixed(2)),
          text: degrade(base.text, random),
        }

    const outcome = await evaluate({
      submission,
      pins: DEFAULT_PINS,
      lookup: (id) => cache.get(id),
      pace: 0,
    })

    if (outcome.kind === 'graded') {
      cache.set(outcome.verdict.keyId, outcome.verdict)
      owner.set(outcome.verdict.keyId, submission.student)
      members.push({ submission, verdict: outcome.verdict, outcome: 'graded' })
    } else if (outcome.kind === 'cached') {
      members.push({
        submission,
        verdict: outcome.verdict,
        outcome: 'cached',
        collision: owner.get(outcome.verdict.keyId) !== submission.student,
      })
    } else {
      members.push({ submission, outcome: outcome.kind })
    }
  }

  return summarise(members)
}

function summarise(members: CohortMember[]): Cohort {
  const scored = members.filter((m) => m.verdict).map((m) => m.verdict!)
  const totals = scored.map((v) => v.total).sort((a, b) => a - b)

  const counts = new Map<string, number>()
  for (const verdict of scored) counts.set(verdict.letter, (counts.get(verdict.letter) ?? 0) + 1)

  // Which criterion sits closest to a band boundary is what actually routes a
  // submission to a human, so it is counted rather than an override rate the
  // prototype has no real decisions to compute.
  const borderline = new Map<string, number>()
  for (const verdict of scored) {
    const closest = [...verdict.criteria]
      .filter((c) => c.kind === 'judgement')
      .sort((a, b) => distanceToBandEdge(a.score) - distanceToBandEdge(b.score))[0]
    if (closest) borderline.set(closest.name, (borderline.get(closest.name) ?? 0) + 1)
  }

  const mechanical = scored.reduce(
    (sum, v) => sum + v.criteria.filter((c) => c.kind === 'mechanical').reduce((s, c) => s + c.weight, 0),
    0,
  )

  const times = scored.map((v) => v.elapsedMs).sort((a, b) => a - b)

  return {
    members,
    distribution: BAND_ORDER.map((band) => ({ band, count: counts.get(band) ?? 0 })),
    mean: Number((totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length)).toFixed(1)),
    median: totals.length ? Number(totals[Math.floor(totals.length / 2)].toFixed(1)) : 0,
    graded: members.filter((m) => m.outcome === 'graded').length,
    held: members.filter((m) => m.outcome === 'held').length,
    rejected: members.filter((m) => m.outcome === 'rejected').length,
    resubmissions: members.filter((m) => m.outcome === 'cached' && !m.collision).length,
    collisions: members.filter((m) => m.outcome === 'cached' && m.collision).length,
    needsDecision: scored.filter((v) => v.confidence < REVIEW_THRESHOLD).length,
    borderlineBy: [...borderline.entries()]
      .map(([name, count]) => ({ name, count, share: count / Math.max(1, scored.length) }))
      .sort((a, b) => b.count - a.count),
    medianMs: times.length ? times[Math.floor(times.length / 2)] : 0,
    mechanicalShare: scored.length ? mechanical / scored.length / 100 : 0,
  }
}

export { letterFor }
