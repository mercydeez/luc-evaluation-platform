import { rng } from './prng'
import { distanceToBandEdge, letterFor, splitSentences } from './rubric'
import type { Criterion, CriterionScore, EvaluationKey, Features } from './types'

/**
 * Deterministic stand-in for the language model.
 *
 * This is not a language model and the product never claims it is. It is the
 * *contract* a model has to satisfy once decoding is pinned: given the same
 * evaluation key it returns byte-identical judgement, and given a different key
 * it returns different judgement. Scores are anchored to measurable properties
 * of the submission so that editing the work moves the mark in a direction a
 * reader can follow, rather than moving it at random.
 *
 * Replacing this with a provider call changes this file and nothing else. The
 * pipeline, the key, the cache, the validation layer and the record are all
 * indifferent to where judgement came from.
 */

/** Marks either side of the anchored score that sampling is allowed to move. */
const JITTER_AT_ZERO = 2.5
const JITTER_PER_DEGREE = 26

function saturate(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/**
 * Sentences carrying the most cue terms for this criterion, verbatim.
 *
 * A submission that evidences a criterion badly still has to be quoted. Falling
 * back to the substantive sentences when no cue term appears is deliberate: "you
 * scored low and here is nothing" is not a mark a student can act on, and a
 * verdict with no evidence at all is rejected by the validation layer anyway.
 */
function findEvidence(text: string, cues: string[], take: number): string[] {
  const lower = cues.map((c) => c.toLowerCase())
  const ranked = splitSentences(text)
    .map((sentence) => {
      const haystack = sentence.toLowerCase()
      return { sentence, hits: lower.reduce((n, cue) => n + (haystack.includes(cue) ? 1 : 0), 0) }
    })
    .sort((a, b) => b.hits - a.hits || b.sentence.length - a.sentence.length)

  return ranked.slice(0, take).map((s) => clampSpan(s.sentence))
}

/**
 * Trims a span to a readable length from the start, so what is shown stays a
 * contiguous substring of the graded text and the validation layer can verify it.
 */
function clampSpan(sentence: string, max = 260): string {
  if (sentence.length <= max) return sentence
  const cut = sentence.lastIndexOf(' ', max)
  return sentence.slice(0, cut > 0 ? cut : max)
}

function reasoningFor(criterion: Criterion, ratio: number, features: Features): string {
  const measured = criterion.feature ? features[criterion.feature].toFixed(2) : '—'
  const target = criterion.target?.toFixed(2) ?? '—'
  if (ratio >= 0.95) {
    return `Meets the distinction anchor. Measured ${measured} per 100 words against a target of ${target}; the supporting spans below carry the claim rather than restating it.`
  }
  if (ratio >= 0.7) {
    return `Clears the merit anchor but not distinction. Measured ${measured} per 100 words against a target of ${target}. The reasoning is present and the quantification is uneven across sections.`
  }
  if (ratio >= 0.45) {
    return `Pass band. Measured ${measured} per 100 words against a target of ${target}. The claim is made and the work behind it is largely asserted rather than shown.`
  }
  return `Below the pass anchor. Measured ${measured} per 100 words against a target of ${target}. The submission does not evidence this criterion in a form a second reader could check.`
}

export interface JudgementInput {
  criterion: Criterion
  text: string
  features: Features
  key: EvaluationKey
  /** Present only when decoding is unpinned. Its presence is what makes a run irreproducible. */
  nonce?: string
}

/** One judgement criterion. Pure with respect to (criterion, text, key, nonce). */
export function judge({ criterion, text, features, key, nonce }: JudgementInput): CriterionScore {
  const seed = `${key.digest}:${criterion.id}${nonce ? `:${nonce}` : ''}`
  const random = rng(seed)

  const measured = criterion.feature ? features[criterion.feature] : 0
  const ratio = saturate(measured / (criterion.target ?? 1))

  // Anchored band, then the movement decoding is allowed to introduce.
  const anchored = 46 + 48 * ratio
  const jitter = (random() - 0.5) * 2 * (JITTER_AT_ZERO + key.pins.temperature * JITTER_PER_DEGREE)
  const score = Math.max(0, Math.min(100, Math.round(anchored + jitter)))

  // Confidence falls as a score approaches a band boundary — a borderline call is
  // the honest reason to ask a human, and it is measurable rather than guessed.
  const edge = saturate(distanceToBandEdge(score) / 6)
  const confidence = Math.max(0.3, Math.min(0.99, 0.58 + 0.4 * edge - random() * 0.06))

  return {
    id: criterion.id,
    name: criterion.name,
    weight: criterion.weight,
    kind: 'judgement',
    score,
    band: letterFor(score),
    anchor: criterion.anchor,
    reasoning: reasoningFor(criterion, ratio, features),
    evidence: findEvidence(text, criterion.cues ?? [], 2),
    confidence: Number(confidence.toFixed(2)),
  }
}
