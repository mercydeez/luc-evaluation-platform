import clsx from 'clsx'
import { ArrowUp, MessageSquareText, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { answer, buildCorpus, buildIndex, type Answer, type Index } from '../engine/retrieval'
import { useStore } from '../engine/store'
import { SUBMISSIONS } from '../data/samples'
import { Badge } from './ui'

const SUGGESTIONS = [
  'Why did Priya lose marks on critical evaluation of limits?',
  'I submitted the same file twice — why is the grade identical?',
  'Did a professor override this grade, and on what grounds?',
  'How was submission compliance calculated?',
  'Why was Fatima’s work never graded?',
  'What happens if the rubric changes after I submit?',
]

export interface TutorState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export function useTutor(): TutorState {
  const [isOpen, setOpen] = useState(false)
  const open = useCallback(() => setOpen(true), [])
  const close = useCallback(() => setOpen(false), [])
  // Stable across renders, so the shortcut listener is registered once.
  return useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])
}

interface Exchange {
  question: string
  result: Answer
  ms: number
}

/** Retrieval is synchronous and local, so the cost is worth showing rather than hiding. */
function timedAnswer(index: Index, question: string): { result: Answer; ms: number } {
  const started = performance.now()
  const result = answer(index, question)
  return { result, ms: Math.max(1, Math.round(performance.now() - started)) }
}

export function Tutor({ state }: { state: TutorState }) {
  const [thread, setThread] = useState<Exchange[]>([])
  const [draft, setDraft] = useState('')
  const verdicts = useStore((s) => s.verdicts)
  const record = useStore((s) => s.record)
  const audit = useStore((s) => s.audit)
  const hits = useStore((s) => s.hits)
  const input = useRef<HTMLInputElement>(null)
  const foot = useRef<HTMLDivElement>(null)

  // Rebuilt whenever the record changes, so an override becomes answerable the
  // moment it is published rather than on the next reload.
  const index = useMemo(
    () => buildIndex(buildCorpus({ verdicts, record, audit, hits }, SUBMISSIONS)),
    [verdicts, record, audit, hits],
  )

  useEffect(() => {
    if (state.isOpen) input.current?.focus()
  }, [state.isOpen])

  useEffect(() => {
    foot.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread])

  useEffect(() => {
    if (!state.isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && state.close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed) return
    setThread((t) => [...t, { question: trimmed, ...timedAnswer(index, trimmed) }])
    setDraft('')
  }

  return (
    <>
      {!state.isOpen && (
        <button
          type="button"
          onClick={state.open}
          // Bottom-left, not bottom-right: the review screen keeps its primary action in
          // the bottom-right corner, and a floating launcher must never sit on top of the
          // one button the screen exists for.
          className="fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 shadow-pop transition-colors hover:border-line-strong sm:bottom-6 sm:left-6"
        >
          <MessageSquareText className="size-4 text-verified" strokeWidth={1.75} />
          <span className="text-sm font-medium tracking-tight text-ink">Ask the record</span>
          <kbd className="hidden rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-2xs text-ink-faint sm:inline">
            /
          </kbd>
        </button>
      )}

      {state.isOpen && (
        <>
          <button
            type="button"
            aria-label="Close the record tutor"
            onClick={state.close}
            className="fixed inset-0 z-40 bg-ink-deep/30 backdrop-blur-[2px] lg:hidden"
          />
          <aside
            aria-label="Record tutor"
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[27rem] flex-col border-l border-line bg-surface shadow-pop"
            style={{ animation: 'panel-in 280ms var(--ease-out-quint)' }}
          >
            <header className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight text-ink">Ask the record</h2>
                <p className="mt-1 text-base leading-snug text-ink-soft">
                  Answers come from stored evaluations, evidence and decisions. Every one names its source.
                </p>
              </div>
              <button
                type="button"
                onClick={state.close}
                aria-label="Close"
                className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="rounded-card border border-line bg-paper px-4 py-3.5">
                <p className="label">How this works</p>
                <p className="mt-1.5 text-base leading-relaxed text-ink-soft">
                  There is no model and no network in this path. The{' '}
                  <strong className="font-medium text-ink">{index.docs.length} documents</strong> behind these answers
                  are built from the record itself and ranked locally. When nothing in the record covers a question,
                  the answer says so instead of inventing one — the same rule that governs an appeal.
                </p>
              </div>

              {thread.map((exchange, i) => (
                <Exchange key={i} exchange={exchange} onFollow={state.close} />
              ))}

              {thread.length === 0 && (
                <div>
                  <p className="label mb-2">Try one of these</p>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => ask(suggestion)}
                        className="block w-full rounded-card border border-line bg-surface px-3.5 py-2.5 text-left text-sm leading-snug text-ink-soft transition-colors hover:border-line-strong hover:bg-paper hover:text-ink"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={foot} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask(draft)
              }}
              className="flex items-center gap-2 border-t border-line px-4 py-3"
            >
              <input
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about a grade, a criterion or a decision"
                aria-label="Ask about the record"
                className="min-w-0 flex-1 rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-line-strong"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Ask"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-surface transition-opacity disabled:opacity-35"
              >
                <ArrowUp className="size-4" strokeWidth={2.25} />
              </button>
            </form>
          </aside>
        </>
      )}
    </>
  )
}

function Exchange({ exchange, onFollow }: { exchange: Exchange; onFollow: () => void }) {
  const { question, result, ms } = exchange
  const unknown = result.kind === 'unknown'

  return (
    <div style={{ animation: 'stage-in 240ms var(--ease-out-quint)' }}>
      <p className="text-sm leading-snug font-medium text-ink">{question}</p>

      <div
        className={clsx(
          'mt-2 rounded-card border px-4 py-3.5',
          unknown ? 'border-review-line bg-review-bg' : 'border-line bg-paper',
        )}
      >
        <p className={clsx('text-base leading-relaxed', unknown ? 'text-review-ink' : 'text-ink-soft')}>
          {result.text}
        </p>

        {result.citations.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="label mb-1.5">Answered from</p>
            <ul className="space-y-1">
              {result.citations.map((citation, i) => (
                <li key={i}>
                  {citation.to ? (
                    <Link
                      to={citation.to}
                      onClick={onFollow}
                      className="group flex items-baseline gap-2 no-underline"
                    >
                      <span className="text-sm font-medium text-ink group-hover:underline">
                        {citation.label}
                      </span>
                      <span className="truncate font-mono text-2xs text-ink-faint">{citation.detail}</span>
                    </Link>
                  ) : (
                    <span className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-ink">{citation.label}</span>
                      <span className="truncate font-mono text-2xs text-ink-faint">{citation.detail}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <Badge tone={unknown ? 'review' : 'verified'}>
          {unknown ? 'Not in the record' : `Retrieved locally in ${ms}ms`}
        </Badge>
        <span className="text-2xs text-ink-faint">0 model calls · 0 network requests</span>
      </div>
    </div>
  )
}
