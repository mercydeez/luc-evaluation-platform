import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureSeeded } from './data/seed'
import { runPipeline } from './engine/pipeline'
import { store } from './engine/store'
import type { Outcome, Pins, Stage, Submission } from './engine/types'

/** Drives the pipeline generator into React state, and drops results after unmount. */
export function useEvaluation() {
  const [stages, setStages] = useState<Stage[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [running, setRunning] = useState(false)
  const token = useRef(0)

  useEffect(() => () => {
    token.current += 1
  }, [])

  const run = useCallback(async (submission: Submission, pins: Pins, pace = 1) => {
    const mine = ++token.current
    setRunning(true)
    setOutcome(null)
    setStages([])

    const generator = runPipeline({ submission, pins, lookup: (id) => store.lookup(id), pace })
    let step = await generator.next()
    while (!step.done) {
      if (token.current !== mine) return null
      setStages(step.value)
      step = await generator.next()
    }
    if (token.current !== mine) return null

    const result = step.value
    setStages(result.stages)
    setOutcome(result)
    setRunning(false)

    if (result.kind === 'graded') {
      store.commit(result.verdict, 'invariant/engine')
    } else if (result.kind === 'cached') {
      store.noteHit(result.verdict.keyId)
      store.append({
        actor: 'invariant/engine',
        event: 'submission.duplicate',
        detail: 'Identical work resubmitted. The stored verdict was returned and no model was called.',
        keyId: result.verdict.keyId,
      })
    }
    return result
  }, [])

  const reset = useCallback(() => {
    token.current += 1
    setStages([])
    setOutcome(null)
    setRunning(false)
  }, [])

  return { stages, outcome, running, run, reset }
}

/** Blocks the first paint of a route until the sample corpus has been graded. */
export function useSeed() {
  const [outcomes, setOutcomes] = useState<Record<string, Outcome> | null>(null)

  useEffect(() => {
    let live = true
    ensureSeeded().then((result) => {
      if (live) setOutcomes(result)
    })
    return () => {
      live = false
    }
  }, [])

  return outcomes
}
