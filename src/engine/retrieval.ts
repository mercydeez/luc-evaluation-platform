import type { State } from './store'
import type { Submission } from './types'

/**
 * Record-grounded retrieval.
 *
 * The tutor answers questions about a grade strictly from what is in the
 * record. There is no model and no network anywhere in this path: the corpus is
 * built from stored verdicts, criteria, evidence spans, versions and audit
 * entries, it is ranked with BM25, and every answer names where it came from.
 * When nothing clears the relevance floor, the answer is that the record does
 * not cover it — which is a real answer, not a failure.
 *
 * This is the appeals rule made interactive. An appeal is resolved against the
 * stored evidence rather than by re-running the model, because re-running risks
 * producing a third answer in front of a student already disputing the second.
 * A tutor that could invent would break the same guarantee the platform exists
 * to make.
 */

export type DocKind = 'verdict' | 'criterion' | 'version' | 'audit' | 'policy' | 'submission'

export interface Doc {
  id: string
  kind: DocKind
  /** Shown to the reader as the citation label, and weighted when ranking. */
  title: string
  body: string
  /**
   * Words a person might actually use for this document, indexed at title
   * weight but never displayed. Keeping them out of the title is what lets a
   * citation label stay readable while retrieval still matches the vocabulary
   * a student would reach for.
   */
  keywords?: string[]
  /** What the reader is told this came from. */
  source: string
  /** Where in the product to go and check it. */
  to?: string
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'of', 'to', 'in', 'on', 'for', 'and',
  'or', 'it', 'this', 'that', 'what', 'why', 'how', 'when', 'where', 'which', 'who', 'do', 'does',
  'did', 'can', 'could', 'would', 'should', 'i', 'my', 'me', 'you', 'your', 'we', 'us', 'they',
  'them', 'get', 'got', 'with', 'about', 'from', 'at', 'as', 'by', 'if', 'so', 'not', 'no',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_.\s-]/g, ' ')
    .split(/[\s-]+/)
    .map((t) => t.replace(/^[._]+|[._]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

/** Very light stemming: enough to match "grades" to "grade" without a dictionary. */
function stem(token: string): string {
  return token
    .replace(/(ies)$/, 'y')
    .replace(/(sses|shes|ches|xes)$/, '')
    .replace(/([^s])s$/, '$1')
    .replace(/(ing|ed)$/, '')
}

function terms(text: string): string[] {
  return tokenize(text).map(stem)
}

export interface Index {
  docs: Doc[]
  /** Term frequencies per document, over title + body. */
  tf: Map<string, number>[]
  lengths: number[]
  df: Map<string, number>
  avgLength: number
}

/** Titles carry the identifying words, so they count for more than body prose. */
const TITLE_WEIGHT = 3
const K1 = 1.4
const B = 0.72
/** How much a document drawn from the record outranks a policy statement. */
const RECORD_BOOST = 1.3

export function buildIndex(docs: Doc[]): Index {
  const tf: Map<string, number>[] = []
  const lengths: number[] = []
  const df = new Map<string, number>()

  for (const doc of docs) {
    const counts = new Map<string, number>()
    let length = 0
    for (const term of terms([doc.title, ...(doc.keywords ?? [])].join(' '))) {
      counts.set(term, (counts.get(term) ?? 0) + TITLE_WEIGHT)
      length += TITLE_WEIGHT
    }
    for (const term of terms(doc.body)) {
      counts.set(term, (counts.get(term) ?? 0) + 1)
      length += 1
    }
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
    tf.push(counts)
    lengths.push(length)
  }

  return {
    docs,
    tf,
    lengths,
    df,
    avgLength: lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length),
  }
}

export interface Hit {
  doc: Doc
  score: number
  /** Distinct query terms this document actually contains. */
  matched: string[]
}

export function search(index: Index, query: string, limit = 4): Hit[] {
  const queryTerms = terms(query)
  if (queryTerms.length === 0 || index.docs.length === 0) return []

  const N = index.docs.length
  const hits: Hit[] = index.docs.map((doc, i) => {
    let score = 0
    const matched: string[] = []
    for (const term of queryTerms) {
      const f = index.tf[i].get(term)
      if (!f) continue
      matched.push(term)
      const n = index.df.get(term) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      const norm = 1 - B + B * (index.lengths[i] / index.avgLength)
      score += idf * ((f * (K1 + 1)) / (f + K1 * norm))
    }
    // When a stored fact and the general rule behind it both match, the fact
    // wins: "Dr. Rao raised criterion 3" answers a question that "professors
    // may override" only gestures at.
    return { doc, score: score * (doc.kind === 'policy' ? 1 : RECORD_BOOST), matched }
  })

  return hits
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Below this, a match is a coincidence of common words rather than an answer.
 * Set deliberately high: saying "the record does not cover that" costs nothing,
 * and answering from a weak match costs the only thing this product sells.
 */
export const RELEVANCE_FLOOR = 2.2

export interface Answer {
  kind: 'answer' | 'unknown'
  text: string
  citations: { label: string; detail: string; to?: string }[]
}

/**
 * A question has to be answerable, not merely on-topic.
 *
 * One word is a subject, not a question: "grade" matches almost every document
 * in the corpus and identifies none of them. So a multi-word question must land
 * on at least two of its own terms, and a single-word question is only answered
 * when that word is specific enough to pick out a small part of the record.
 */
const SPECIFIC_TERM_SHARE = 0.25

function answerable(index: Index, query: string, best: Hit): boolean {
  const queryTerms = new Set(terms(query))
  if (queryTerms.size >= 2) return best.matched.length >= 2
  const [only] = best.matched
  if (!only) return false
  return (index.df.get(only) ?? 0) <= Math.max(1, index.docs.length * SPECIFIC_TERM_SHARE)
}

export function answer(index: Index, query: string): Answer {
  const hits = search(index, query, 4)
  const best = hits[0]

  if (!best || best.score < RELEVANCE_FLOOR || !answerable(index, query, best)) {
    return {
      kind: 'unknown',
      text:
        'The record does not cover that. This tutor answers only from stored evaluations, criterion scores, evidence spans, professor decisions and audit entries — it has no model behind it and cannot infer past what was recorded. Ask about a grade, a criterion, an evaluation key, an override or a held submission.',
      citations: [],
    }
  }

  // Supporting citations have to be close to the best hit, or a question about
  // one student picks up a loosely related document about another.
  const supporting = hits.slice(1).filter((h) => h.score >= best.score * 0.8)
  return {
    kind: 'answer',
    text: best.doc.body,
    citations: [best, ...supporting].map((h) => ({
      label: h.doc.title,
      detail: h.doc.source,
      to: h.doc.to,
    })),
  }
}

/** Product rules that are implemented in code, so quoting them is quoting the system. */
const POLICY: Doc[] = [
  {
    id: 'policy:cache',
    kind: 'policy',
    title: 'Resubmitting identical work',
    keywords: ['duplicate', 'resubmission', 'resubmitted', 'identical', 'same file', 'twice', 'again', 'cache', 'unchanged', 'second attempt'],
    body: 'A resubmission of unchanged work resolves to the same evaluation key and returns the stored verdict. No model call is made, and the grade cannot move in either direction.',
    source: 'Pipeline stage 7 \u2014 verdict store',
    to: '/consistency',
  },
  {
    id: 'policy:refusal',
    kind: 'policy',
    title: 'Why an unpinned run is refused',
    keywords: ['temperature', 'above zero', 'sampling', 'decoding', 'reproducible', 'irreproducible', 'random', 'randomness', 'diverge', 'different grades', 'refused', 'vary'],
    body: 'With temperature above zero the sampler is free to move between runs, so identical inputs can return different marks. A run made with decoding unpinned cannot be reproduced, so it is logged and refused from the record rather than stored: a grade that cannot be reproduced cannot be defended.',
    source: 'Pipeline stage 11 \u2014 grade record',
    to: '/consistency',
  },
  {
    id: 'policy:gate',
    kind: 'policy',
    title: 'Work held before grading',
    keywords: ['ocr', 'extraction', 'scanned', 'handwritten', 'gate', 'held', 'not graded', 'threshold', 'illegible'],
    body: 'Extraction confidence below 0.75 is not graded. The work is routed to human review with the extraction score attached, rather than being given a mark the model was not equipped to produce.',
    source: 'Pipeline stage 3 \u2014 extraction quality gate',
    to: '/overview',
  },
  {
    id: 'policy:validation',
    kind: 'policy',
    title: 'How quoted evidence is checked',
    keywords: ['validation', 'malformed', 'verbatim', 'quote', 'quoted', 'hallucination', 'invented', 'fabricated', 'made up'],
    body: 'Every quoted evidence span is checked against the graded text before a verdict reaches a human. Out-of-range scores, missing criteria, and evidence that does not appear in the submission are all rejected by the validation layer.',
    source: 'Pipeline stage 10 \u2014 validation layer',
    to: '/submit',
  },
  {
    id: 'policy:appeal',
    kind: 'policy',
    title: 'How an appeal is answered',
    keywords: ['appeal', 'appealing', 'dispute', 'disputed', 'contest', 'challenge', 'unfair', 'regrade', 'complaint'],
    body: 'An appeal is answered against the stored record: the same evidence, the same per-criterion scores, and the rubric version in force at submission. The model is not re-run, because re-running it risks producing a third answer in front of a student already disputing the second.',
    source: 'Appeals policy',
    to: '/student',
  },
  {
    id: 'policy:mechanical',
    kind: 'policy',
    title: 'Marks the model is never asked for',
    keywords: ['word count', 'length', 'late', 'lateness', 'penalty', 'deadline', 'required section', 'missing section', 'arithmetic', 'compliance', 'weights'],
    body: 'Word counts, required sections, criterion weights and late penalties are arithmetic. They are computed in code, where they are testable, and are never asked of the model.',
    source: 'Pipeline stage 8 \u2014 rubric engine',
    to: '/submit',
  },
  {
    id: 'policy:override',
    kind: 'policy',
    title: 'Professor authority over release',
    keywords: ['override', 'overridden', 'authority', 'release', 'released', 'publish', 'final say', 'human decision'],
    body: 'The model proposes and a person releases. An override is recorded as a new version with the professor identity and reason attached; the original proposed grade is retained and stays visible to the student.',
    source: 'Grade record \u2014 append-only',
    to: '/review',
  },
  {
    id: 'policy:key',
    kind: 'policy',
    title: 'What the evaluation key is made of',
    keywords: ['evaluation key', 'key', 'hash', 'sha256', 'pin', 'pinned', 'rubric version', 'prompt version', 'model version', 'address'],
    body: 'An evaluation key is a sha-256 over the canonicalised text of the work, combined with the rubric version, the prompt version, the model build and the decoding settings. Two runs that share a key must share a verdict; a run that differs in any pin gets a different key and is recorded as a separate version.',
    source: 'Pipeline stage 6 \u2014 evaluation key',
    to: '/submit',
  },
]

/** Builds the searchable corpus from whatever is currently in the record. */
export function buildCorpus(state: State, submissions: Submission[]): Doc[] {
  const nameOf = (id: string) => submissions.find((s) => s.id === id)?.student ?? id
  const docs: Doc[] = [...POLICY]

  for (const verdict of Object.values(state.verdicts)) {
    const who = nameOf(verdict.submissionId)
    const pins = verdict.key.pins

    docs.push({
      id: `verdict:${verdict.keyId}`,
      kind: 'verdict',
      title: `${who} \u2014 proposed grade`,
      keywords: [who, verdict.keyId, 'grade', 'mark', 'score', 'total', 'result', String(verdict.total), verdict.letter],
      body: `${who} was proposed ${verdict.total} out of 100 (${verdict.letter}) at confidence ${verdict.confidence}, under rubric ${pins.rubricVersion}, prompt ${pins.promptVersion} and model build ${pins.modelVersion}, with temperature ${pins.temperature}. The evaluation key is ${verdict.keyId} and the run made ${verdict.modelCalls} model calls.`,
      source: `Verdict ${verdict.keyId}`,
      to: `/review/${verdict.submissionId}`,
    })

    for (const criterion of verdict.criteria) {
      const evidence = criterion.evidence.length
        ? ` The evidence quoted for it was: “${criterion.evidence[0]}”`
        : ''
      const lines = criterion.lines?.length
        ? ` The calculation was: ${criterion.lines.map((l) => `${l.label} (${l.delta})`).join('; ')}.`
        : ''
      docs.push({
        id: `criterion:${verdict.keyId}:${criterion.id}`,
        kind: 'criterion',
        title: `${who} \u2014 ${criterion.name}`,
        keywords: [who, criterion.name, criterion.id, 'criterion', 'score', 'marks', 'lost'],
        body: `${who} scored ${criterion.score} out of 100 on ${criterion.name}, which carries weight ${criterion.weight}, at confidence ${criterion.confidence}. ${criterion.reasoning}${lines}${evidence}`,
        source: `${criterion.name} · ${verdict.keyId}`,
        to: `/review/${verdict.submissionId}`,
      })
    }
  }

  for (const version of state.record) {
    const who = nameOf(version.submissionId)
    docs.push({
      id: `version:${version.submissionId}:${version.v}:${version.at}`,
      kind: 'version',
      title: `${who} \u2014 version ${version.v}`,
      keywords: [
        who, 'version', 'history',
        ...(version.source === 'ai'
          ? ['proposed', 'engine', 'ai']
          : ['override', 'overridden', 'professor', 'released', 'published', 'adjusted', version.actor]),
      ],
      body:
        version.source === 'ai'
          ? `Version ${version.v} for ${who} was proposed by the engine at ${version.total} (${version.letter}) against key ${version.keyId}.`
          : `Version ${version.v} for ${who} was overridden to ${version.total} (${version.letter}) by ${version.actor}, the professor who owns the course${version.reason ? `, on the grounds that ${version.reason.charAt(0).toLowerCase()}${version.reason.slice(1)}` : ''}. The proposed grade was kept in the record.`,
      source: `Grade record v${version.v} · ${new Date(version.at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}`,
      to: `/review/${version.submissionId}`,
    })
  }

  for (const entry of state.audit) {
    docs.push({
      id: `audit:${entry.id}`,
      kind: 'audit',
      title: `Audit entry \u2014 ${entry.event}`,
      keywords: [entry.event.replace(/[._]/g, ' '), 'audit', 'log', 'recorded', 'history'],
      body: `${entry.detail} Recorded by ${entry.actor}${entry.keyId ? ` against ${entry.keyId}` : ''}.`,
      source: `Audit log · ${entry.event}`,
      to: '/audit',
    })
  }

  for (const submission of submissions) {
    docs.push({
      id: `submission:${submission.id}`,
      kind: 'submission',
      title: `${submission.student} \u2014 submission`,
      keywords: [submission.student, submission.studentId, submission.fileName, 'upload', 'attempt', 'submitted'],
      body: `${submission.student} (${submission.studentId}) submitted ${submission.fileName} for ${submission.assignment}, attempt ${submission.attempt}, at extraction confidence ${submission.ocrConfidence}${submission.lateHours > 0 ? `, ${submission.lateHours} hours after the deadline` : ', on time'}.`,
      source: `Submission ${submission.id}`,
      to: `/review/${submission.id}`,
    })
  }

  return docs
}
