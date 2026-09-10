import { sha256Hex, shortHash } from './hash'
import type { EvaluationKey, PinName, Pins } from './types'

export const DEFAULT_PINS: Pins = {
  rubricVersion: 'rbr_2.3',
  promptVersion: 'p_11',
  modelVersion: 'm_2026-05-14',
  temperature: 0,
  topP: 1,
  seed: 41,
}

const PIN_ORDER: PinName[] = ['rubricVersion', 'promptVersion', 'modelVersion', 'temperature', 'topP', 'seed']

/**
 * The evaluation key is derived from every input that can influence the
 * outcome. Two runs that share a key must share a verdict; two runs that
 * differ in any pin get different keys and are recorded as separate versions.
 */
export async function buildKey(textHash: string, pins: Pins): Promise<EvaluationKey> {
  const material = [textHash, ...PIN_ORDER.map((p) => `${p}=${pins[p]}`)].join('|')
  const digest = await sha256Hex(material)
  return { id: `ek_${digest.slice(0, 8)}`, digest, textHash, pins }
}

/** Compact single-line rendering, e.g. ek_3b81c7d2 · rbr2.3 · p11 · m20260514 · t0 · s41 */
export function formatKey(key: EvaluationKey): string {
  return keySegments(key).map((s) => s.value).join(' \u00b7 ')
}

export interface KeySegment {
  pin: PinName | 'text'
  label: string
  value: string
  /** What breaks if this is not pinned. */
  note: string
}

export function keySegments(key: EvaluationKey): KeySegment[] {
  const { pins } = key
  return [
    {
      pin: 'text',
      label: 'Content hash',
      value: key.id,
      note: 'Identifies the work regardless of file bytes. Without it, an essay re-exported as a fresh PDF is treated as new work and graded twice.',
    },
    {
      pin: 'rubricVersion',
      label: 'Rubric version',
      value: pins.rubricVersion.replace('rbr_', 'rbr'),
      note: 'Rubric edits are legitimate, but a grade change must be traceable to one. Without it, students see marks move for no visible reason.',
    },
    {
      pin: 'promptVersion',
      label: 'Prompt version',
      value: pins.promptVersion.replace('p_', 'p'),
      note: 'The prompt is behaviour, not configuration. Without versioning, a wording change silently regrades a cohort.',
    },
    {
      pin: 'modelVersion',
      label: 'Model build',
      value: pins.modelVersion.replace('m_', 'm').replace(/-/g, ''),
      note: 'Providers update models. Without pinning, students graded either side of an update are held to different standards.',
    },
    {
      pin: 'temperature',
      label: 'Temperature',
      value: `t${pins.temperature}`,
      note: 'Fixed decoding removes sampling randomness. Above zero, identical inputs still diverge and the verdict cannot be reproduced.',
    },
    {
      pin: 'seed',
      label: 'Decode seed',
      value: `s${pins.seed}`,
      note: 'Pins the remaining decoding entropy so a replay lands on the same tokens.',
    },
  ]
}

/** Which pins changed between two runs. Drives the "one field moved" callout. */
export function diffPins(a: Pins, b: Pins): PinName[] {
  return PIN_ORDER.filter((p) => a[p] !== b[p])
}

export const PIN_LABELS: Record<PinName, string> = {
  rubricVersion: 'Rubric version',
  promptVersion: 'Prompt version',
  modelVersion: 'Model build',
  temperature: 'Temperature',
  topP: 'Top-p',
  seed: 'Decode seed',
}

export { shortHash }
