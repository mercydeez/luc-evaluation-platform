import { DEFAULT_PINS } from '../engine/key'
import { evaluate } from '../engine/pipeline'
import { store } from '../engine/store'
import type { Outcome } from '../engine/types'
import { SUBMISSIONS } from './samples'

/**
 * The demo starts populated, and nothing in it is written by hand.
 *
 * Every grade, confidence, held file and rejection on screen is produced by
 * running the real pipeline over the sample submissions once, in the browser,
 * on first load. Seeding is therefore also a smoke test: if the engine is
 * broken, the dashboard is empty rather than plausibly wrong.
 */
let pending: Promise<Record<string, Outcome>> | null = null

export function ensureSeeded(): Promise<Record<string, Outcome>> {
  pending ??= (async () => {
    const outcomes: Record<string, Outcome> = {}
    const alreadyGraded = store.getState().record.length > 0

    for (const submission of SUBMISSIONS) {
      const outcome = await evaluate({
        submission,
        pins: DEFAULT_PINS,
        lookup: (id) => store.lookup(id),
        pace: 0,
      })
      outcomes[submission.id] = outcome

      if (alreadyGraded) continue

      if (outcome.kind === 'graded') {
        store.commit(outcome.verdict, 'invariant/engine')
      } else if (outcome.kind === 'held') {
        store.append({
          actor: 'invariant/engine',
          event: 'submission.held',
          detail: `${submission.student} · ${submission.fileName} — ${outcome.reason.split('.')[0]}.`,
        })
      } else if (outcome.kind === 'rejected') {
        store.append({
          actor: 'invariant/engine',
          event: 'submission.rejected',
          detail: `${submission.student} · ${submission.fileName} — rejected at intake before a grading job was created.`,
        })
      }
    }

    return outcomes
  })()

  return pending
}
