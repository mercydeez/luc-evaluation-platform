import { useSyncExternalStore } from 'react'
import type { AuditEntry, GradeVersion, Verdict } from './types'

/**
 * The record.
 *
 * Three collections, and the difference between them is the whole point:
 *
 * - `verdicts`  is a cache addressed by evaluation key. Idempotent by construction.
 * - `record`    is the append-only grade history. Versions are added, never edited.
 * - `audit`     is append-only too, and carries who did what, when, and on what grounds.
 *
 * Nothing in this module updates a stored entry in place. There is no method to
 * do it, which is a cheaper guarantee than a rule nobody enforces.
 */

export interface State {
  verdicts: Record<string, Verdict>
  /** Times each key was requested. A hit is a saving, not an anomaly. */
  hits: Record<string, number>
  record: GradeVersion[]
  audit: AuditEntry[]
}

const STORAGE_KEY = 'luc.invariant.state.v1'
const MAX_VERDICTS = 40

function emptyState(): State {
  return { verdicts: {}, hits: {}, record: [], audit: [] }
}

function load(): State {
  if (typeof localStorage === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<State>
    return { ...emptyState(), ...parsed }
  } catch {
    // A demo that cannot read its own persisted state starts clean rather than blank-screening.
    return emptyState()
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function set(next: State) {
  state = next
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trim(next)))
    } catch {
      // Quota is not worth failing an interaction over.
    }
  }
  listeners.forEach((l) => l())
}

/** Keeps the persisted payload bounded. The record and the audit log are never trimmed. */
function trim(s: State): State {
  const keys = Object.keys(s.verdicts)
  if (keys.length <= MAX_VERDICTS) return s
  const keep = keys.slice(-MAX_VERDICTS)
  return {
    ...s,
    verdicts: Object.fromEntries(keep.map((k) => [k, s.verdicts[k]])),
  }
}

let sequence = 0
function entryId(): string {
  sequence += 1
  return `ev_${Date.now().toString(36)}${sequence.toString(36)}`
}

export const store = {
  getState: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  /** Cache read. Records the hit so the saving is measurable. */
  lookup(keyId: string): Verdict | undefined {
    return state.verdicts[keyId]
  },

  noteHit(keyId: string) {
    set({ ...state, hits: { ...state.hits, [keyId]: (state.hits[keyId] ?? 0) + 1 } })
  },

  /**
   * Admits a verdict to the record. A verdict produced under unpinned decoding
   * cannot be reproduced, so it is logged and refused rather than stored.
   */
  commit(verdict: Verdict, actor: string): GradeVersion | null {
    if (!verdict.reproducible) {
      this.append({
        actor: 'system',
        event: 'verdict.refused',
        detail: `Run under temperature ${verdict.key.pins.temperature} was not admitted to the record: it cannot be reproduced.`,
        keyId: verdict.keyId,
      })
      return null
    }

    const version: GradeVersion = Object.freeze({
      v: state.record.filter((r) => r.submissionId === verdict.submissionId).length + 1,
      submissionId: verdict.submissionId,
      keyId: verdict.keyId,
      source: 'ai',
      total: verdict.total,
      letter: verdict.letter,
      actor,
      released: false,
      at: new Date().toISOString(),
    })

    set({
      ...state,
      verdicts: { ...state.verdicts, [verdict.keyId]: verdict },
      hits: { ...state.hits, [verdict.keyId]: state.hits[verdict.keyId] ?? 1 },
      record: [...state.record, version],
      audit: [
        ...state.audit,
        auditEntry({
          actor,
          event: 'grade.proposed',
          detail: `${verdict.total} (${verdict.letter}) proposed at confidence ${verdict.confidence} under ${verdict.key.pins.rubricVersion}`,
          keyId: verdict.keyId,
        }),
      ],
    })
    return version
  },

  /**
   * A professor override. It is a new version, not an edit: the original AI
   * grade stays in the record and stays visible.
   */
  override(input: {
    submissionId: string
    keyId: string
    total: number
    letter: string
    actor: string
    reason: string
    release: boolean
    /** The marks the professor set, so the released breakdown matches the released total. */
    adjustments: Record<string, number>
  }): GradeVersion {
    const version: GradeVersion = Object.freeze({
      v: state.record.filter((r) => r.submissionId === input.submissionId).length + 1,
      submissionId: input.submissionId,
      keyId: input.keyId,
      source: 'professor_override' as const,
      total: input.total,
      letter: input.letter,
      actor: input.actor,
      reason: input.reason,
      released: input.release,
      at: new Date().toISOString(),
      adjustments: input.adjustments,
    })

    set({
      ...state,
      record: [...state.record, version],
      audit: [
        ...state.audit,
        auditEntry({
          actor: input.actor,
          event: input.release ? 'grade.overridden_and_released' : 'grade.overridden',
          detail: `${input.total} (${input.letter}) — ${input.reason}`,
          keyId: input.keyId,
        }),
      ],
    })
    return version
  },

  /** Releases the standing version without changing the mark. */
  release(input: { submissionId: string; keyId: string; actor: string }): GradeVersion {
    const standing = latestFor(input.submissionId)
    const version: GradeVersion = Object.freeze({
      v: state.record.filter((r) => r.submissionId === input.submissionId).length + 1,
      submissionId: input.submissionId,
      keyId: input.keyId,
      source: (standing?.source ?? 'ai') as GradeVersion['source'],
      total: standing?.total ?? 0,
      letter: standing?.letter ?? 'F',
      actor: input.actor,
      released: true,
      at: new Date().toISOString(),
    })
    set({
      ...state,
      record: [...state.record, version],
      audit: [
        ...state.audit,
        auditEntry({
          actor: input.actor,
          event: 'grade.released',
          detail: `${version.total} (${version.letter}) released to the student`,
          keyId: input.keyId,
        }),
      ],
    })
    return version
  },

  append(entry: Omit<AuditEntry, 'id' | 'at'>) {
    set({ ...state, audit: [...state.audit, auditEntry(entry)] })
  },

  reset() {
    set(emptyState())
  },
}

function auditEntry(entry: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
  return Object.freeze({ ...entry, id: entryId(), at: new Date().toISOString() })
}

export function latestFor(submissionId: string): GradeVersion | undefined {
  return [...state.record].reverse().find((r) => r.submissionId === submissionId)
}

export function versionsFor(submissionId: string): GradeVersion[] {
  return state.record.filter((r) => r.submissionId === submissionId)
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getState()),
    () => select(store.getState()),
  )
}
