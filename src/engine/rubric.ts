import type { Criterion, Features, MarkLine, Rubric } from './types'

const JUDGEMENT: Criterion[] = [
  {
    id: 'method',
    name: 'Method rigour',
    weight: 25,
    kind: 'judgement',
    anchor: 'Distinction: the analytical sequence is stated, justified and reproducible from the text alone.',
    feature: 'methodDensity',
    target: 1.4,
    cues: ['deseasonalis', 'elasticit', 'median', 'regression', 'baseline', 'cohort', 'weighted', 'variance', 'aggregat', 'estimat'],
  },
  {
    id: 'evidence',
    name: 'Use of evidence',
    weight: 25,
    kind: 'judgement',
    anchor: 'Distinction: every claim that carries a recommendation is quantified against the dataset.',
    feature: 'quantDensity',
    target: 3.2,
    cues: ['%', 'stores', 'weeks', 'points', 'cost', 'factor', 'target', 'threshold'],
  },
  {
    id: 'limits',
    name: 'Critical evaluation of limits',
    weight: 20,
    kind: 'judgement',
    anchor: 'Distinction: limitations are named and their effect on the recommendation is sized.',
    feature: 'hedgeDensity',
    target: 1.1,
    cues: ['limitation', 'assume', 'assumption', 'cannot confirm', 'caveat', 'uncertain', 'held constant'],
  },
  {
    id: 'communication',
    name: 'Structure and communication',
    weight: 15,
    kind: 'judgement',
    anchor: 'Distinction: the argument is ordered, signposted and readable at pace by a non-specialist.',
    feature: 'connectiveDensity',
    target: 1.0,
    cues: ['therefore', 'however', 'because', 'as a result', 'consequently', 'in contrast', 'summary'],
  },
]

const COMPLIANCE: Criterion = {
  id: 'compliance',
  name: 'Submission compliance',
  weight: 15,
  kind: 'mechanical',
  anchor: 'Length, required sections and lateness. Computed in code and never asked of the model.',
}

export const RUBRICS: Record<string, Rubric> = {
  rbr_2_3: {
    version: 'rbr_2.3',
    name: 'Case analysis 2.3',
    publishedAt: '2026-07-28',
    minWords: 700,
    maxWords: 1500,
    requiredSections: ['summary', 'methodology', 'findings', 'limitations', 'recommendation'],
    latePenaltyPerDay: 5,
    latePenaltyCap: 20,
    criteria: [...JUDGEMENT, COMPLIANCE],
  },
  rbr_2_2: {
    version: 'rbr_2.2',
    name: 'Case analysis 2.2',
    publishedAt: '2026-05-02',
    minWords: 600,
    maxWords: 1800,
    requiredSections: ['summary', 'methodology', 'findings'],
    latePenaltyPerDay: 3,
    latePenaltyCap: 12,
    // 2.2 weighted method more heavily and treated limitations as a token criterion.
    // Re-weighting is exactly the kind of legitimate edit that must never move a
    // published grade silently, which is why the version is part of the key.
    criteria: [
      { ...JUDGEMENT[0], weight: 35 },
      { ...JUDGEMENT[1], weight: 30 },
      { ...JUDGEMENT[2], weight: 5, anchor: 'Merit: limitations are acknowledged.' },
      { ...JUDGEMENT[3], weight: 15 },
      { ...COMPLIANCE, weight: 15 },
    ],
  },
}

/** Rubric versions are addressed by their printed label everywhere outside this map. */
export function getRubric(version: string): Rubric {
  const rubric = RUBRICS[version.replace(/\./g, '_')]
  if (!rubric) throw new Error(`Unknown rubric version: ${version}`)
  return rubric
}

export const RUBRIC_VERSIONS = Object.values(RUBRICS).map((r) => r.version)

const SECTION_PATTERNS: Record<string, RegExp> = {
  summary: /\b(executive summary|summary)\b/i,
  methodology: /\b(methodolog|method|approach)\w*\b/i,
  findings: /\b(finding|result|analysis)\w*\b/i,
  limitations: /\b(limitation|caveat)\w*\b/i,
  recommendation: /\b(recommend|proposal)\w*\b/i,
}

const RE_NUMBER = /\b\d+(?:[.,]\d+)?\s*(?:%|x)?\b/g
const RE_METHOD = /\b(deseasonalis\w*|elasticit\w*|median|regression|baseline|cohort|weighted|variance|aggregat\w*|estimat\w*|significance)\b/gi
const RE_HEDGE = /\b(limitation\w*|assum\w+|caveat\w*|uncertain\w*|cannot confirm|held constant|approximat\w*)\b/gi
const RE_CONNECTIVE = /\b(therefore|however|because|as a result|consequently|in contrast|whereas)\b/gi

function per100(count: number, words: number): number {
  return words === 0 ? 0 : (count / words) * 100
}

/** Measurable properties of the graded text. Pure, and identical for every caller. */
export function extractFeatures(text: string): Features {
  const words = text.split(/\s+/).filter(Boolean).length
  const numbers = (text.match(RE_NUMBER) ?? []).length
  return {
    words,
    sentences: splitSentences(text).length,
    numbers,
    quantDensity: per100(numbers, words),
    methodDensity: per100((text.match(RE_METHOD) ?? []).length, words),
    hedgeDensity: per100((text.match(RE_HEDGE) ?? []).length, words),
    connectiveDensity: per100((text.match(RE_CONNECTIVE) ?? []).length, words),
    sectionsFound: Object.entries(SECTION_PATTERNS)
      .filter(([, re]) => re.test(text))
      .map(([name]) => name),
  }
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30)
}

/**
 * The mechanical half of the rubric. Length, required sections and lateness are
 * arithmetic, so they are computed here and never sent to a model. Every line of
 * the calculation is returned, so a student can be shown exactly where marks went.
 */
export function scoreCompliance(
  rubric: Rubric,
  features: Features,
  lateHours: number,
): { score: number; lines: MarkLine[] } {
  const lines: MarkLine[] = [{ label: 'Baseline', delta: 100 }]

  if (features.words < rubric.minWords) {
    const shortfall = rubric.minWords - features.words
    lines.push({
      label: `${features.words} words — ${shortfall} below the ${rubric.minWords} minimum`,
      delta: -Math.min(30, Math.ceil((shortfall / rubric.minWords) * 60)),
    })
  } else if (features.words > rubric.maxWords) {
    const excess = features.words - rubric.maxWords
    lines.push({
      label: `${features.words} words — ${excess} above the ${rubric.maxWords} maximum`,
      delta: -Math.min(20, Math.ceil((excess / rubric.maxWords) * 40)),
    })
  } else {
    lines.push({
      label: `${features.words} words — inside ${rubric.minWords}–${rubric.maxWords}`,
      delta: 0,
    })
  }

  for (const section of rubric.requiredSections.filter((s) => !features.sectionsFound.includes(s))) {
    lines.push({ label: `Required section absent — ${section}`, delta: -12 })
  }

  if (lateHours > 0) {
    const days = Math.ceil(lateHours / 24)
    lines.push({
      label: `${days} day${days > 1 ? 's' : ''} late at ${rubric.latePenaltyPerDay}/day, capped at ${rubric.latePenaltyCap}`,
      delta: -Math.min(rubric.latePenaltyCap, days * rubric.latePenaltyPerDay),
    })
  }

  const score = Math.max(0, Math.min(100, lines.reduce((acc, l) => acc + l.delta, 0)))
  return { score, lines }
}

const BANDS: [number, string][] = [
  [90, 'A'], [85, 'A-'], [80, 'B+'], [75, 'B'], [70, 'B-'],
  [65, 'C+'], [60, 'C'], [55, 'C-'], [50, 'D'], [0, 'F'],
]

export function letterFor(total: number): string {
  return BANDS.find(([floor]) => total >= floor)?.[1] ?? 'F'
}

/**
 * Marks between a score and the nearest band boundary. A small distance means a
 * borderline call, which is the single most useful reason to route work to a human.
 */
export function distanceToBandEdge(score: number): number {
  return Math.min(...BANDS.map(([floor]) => Math.abs(score - floor)))
}
