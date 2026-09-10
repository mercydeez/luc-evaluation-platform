/** Everything that can influence a grade. If it is not in here, it cannot move a mark. */
export interface Pins {
  rubricVersion: string
  promptVersion: string
  modelVersion: string
  temperature: number
  topP: number
  seed: number
}

export type PinName = keyof Pins

export interface EvaluationKey {
  /** Short public identifier, e.g. ek_3b81c7d2 */
  id: string
  /** Full sha-256 over the canonical text and every pin */
  digest: string
  textHash: string
  pins: Pins
}

export interface Submission {
  id: string
  student: string
  studentId: string
  course: string
  assignment: string
  attempt: number
  fileName: string
  sizeKb: number
  pages: number
  submittedAt: string
  /** Hours past the deadline. 0 when on time. */
  lateHours: number
  /** Extraction confidence reported by the OCR/text layer, 0–1. */
  ocrConfidence: number
  text: string
  /** File failed structural validation at upload and never reaches extraction. */
  corrupt?: boolean
}

export type CriterionKind = 'mechanical' | 'judgement'

export interface Criterion {
  id: string
  name: string
  /** Percentage of the final mark. Weights across a rubric sum to 100. */
  weight: number
  kind: CriterionKind
  anchor: string
  /** Cue terms used to locate evidence and to score judgement criteria. */
  cues?: string[]
  /** Feature target a full mark corresponds to. */
  target?: number
  feature?: FeatureName
}

export interface Rubric {
  version: string
  name: string
  publishedAt: string
  minWords: number
  maxWords: number
  requiredSections: string[]
  /** Marks lost per 24h late, capped at latePenaltyCap. */
  latePenaltyPerDay: number
  latePenaltyCap: number
  criteria: Criterion[]
}

export type FeatureName =
  | 'quantDensity'
  | 'methodDensity'
  | 'hedgeDensity'
  | 'connectiveDensity'

export interface Features {
  words: number
  sentences: number
  numbers: number
  quantDensity: number
  methodDensity: number
  hedgeDensity: number
  connectiveDensity: number
  sectionsFound: string[]
}

export interface MarkLine {
  label: string
  delta: number
}

export interface CriterionScore {
  id: string
  name: string
  weight: number
  kind: CriterionKind
  score: number
  band: string
  anchor: string
  reasoning: string
  /** Verbatim spans taken from the graded text. Verified by the validation layer. */
  evidence: string[]
  confidence: number
  /** Arithmetic shown in full for mechanical criteria. */
  lines?: MarkLine[]
}

export interface Verdict {
  keyId: string
  key: EvaluationKey
  submissionId: string
  total: number
  letter: string
  criteria: CriterionScore[]
  confidence: number
  /** False when decoding was not pinned. A non-reproducible verdict is never stored. */
  reproducible: boolean
  modelCalls: number
  cached: boolean
  computedAt: string
  elapsedMs: number
  /** Canonical text the verdict was produced against. */
  gradedText: string
}

export type StageStatus = 'pending' | 'running' | 'ok' | 'skipped' | 'held' | 'failed'

export interface Stage {
  n: number
  id: string
  name: string
  status: StageStatus
  ms: number
  detail: string
  /** Why this stage exists at all. Shown in the pipeline inspector. */
  why: string
}

export type Outcome =
  | { kind: 'graded'; verdict: Verdict; stages: Stage[] }
  | { kind: 'cached'; verdict: Verdict; stages: Stage[] }
  | { kind: 'held'; reason: string; stages: Stage[] }
  | { kind: 'rejected'; reason: string; stages: Stage[] }

export interface GradeVersion {
  v: number
  submissionId: string
  keyId: string
  source: 'ai' | 'professor_override' | 'appeal'
  total: number
  letter: string
  actor: string
  reason?: string
  released: boolean
  at: string
  /** Criterion id to the mark the professor set, present only on an override. */
  adjustments?: Record<string, number>
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  event: string
  detail: string
  keyId?: string
}
