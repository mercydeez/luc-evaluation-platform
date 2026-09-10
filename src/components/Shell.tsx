import clsx from 'clsx'
import { ArrowLeft, ArrowRight, CircleHelp, Moon, RotateCcw, Sun } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { store, useStore } from '../engine/store'
import { neighbours, STEPS, stepFor, type Step } from '../steps'
import { useTheme } from '../theme'
import { Mark } from './Mark'
import { Tour, useTour } from './Tour'
import { Tutor, useTutor } from './Tutor'

export function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const step = stepFor(pathname)
  const { prev, next } = neighbours(step)
  const [, toggleTheme] = useTheme()
  const tutor = useTutor()
  const tour = useTour()

  // The walkthrough is nine steps, so it should also be two arrow keys.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // A keydown can be dispatched at the document or the window, neither of
      // which is an Element, so the typing guard has to check before it asks.
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowLeft' && prev) navigate(prev.to)
      else if (event.key === 'ArrowRight' && next) navigate(next.to)
      else if (event.key === 't') toggleTheme()
      else if (event.key === '?') tour.toggle()
      else if (event.key === '/') {
        event.preventDefault()
        tutor.open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, navigate, toggleTheme, tour, tutor])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only rounded-full bg-ink px-4 py-2 text-sm text-surface focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* The chrome floats, so the strip behind it has to carry the ground colour:
          without it, page content scrolls through the gaps between the pills. */}
      <div className="sticky top-0 z-30 bg-paper px-3 pt-3 pb-2 sm:px-5 sm:pt-4">
        <div className="mx-auto max-w-[84rem] space-y-2">
          <Header onTheme={toggleTheme} onTour={tour.toggle} />
          <StepBar current={step?.n} />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-6 bg-linear-to-b from-paper to-transparent"
        />
      </div>

      <main id="main" className="mx-auto max-w-[84rem] px-4 pt-6 pb-8 sm:px-6 lg:px-7">
        {children}
      </main>

      {step && <StepFooter prev={prev} next={next} />}

      <Tutor state={tutor} />
      <Tour state={tour} />
    </div>
  )
}

function Header({ onTheme, onTour }: { onTheme: () => void; onTour: () => void }) {
  const [theme] = useTheme()
  const versions = useStore((s) => s.record).length

  return (
    <header className="flex items-center gap-3 rounded-full border border-line bg-surface/88 px-3 py-2 shadow-float backdrop-blur-xl sm:px-4 sm:py-2.5">
      <NavLink to="/" className="flex min-w-0 items-center gap-2.5 no-underline" aria-label="Invariant — home">
        <Mark className="size-6 shrink-0" color={theme === 'dark' ? '#3FBF6E' : '#259D4A'} />
        <span className="min-w-0 leading-none">
          <span className="block font-mono text-[0.8125rem] font-medium tracking-[0.1em] text-ink uppercase">
            Invariant
          </span>
          <span className="mt-1 hidden text-[0.625rem] tracking-[0.14em] text-ink-faint uppercase sm:block">
            Learners Education
          </span>
        </span>
      </NavLink>

      <span className="mx-auto hidden rounded-full border border-review-line bg-review-bg px-2.5 py-1 font-mono text-[0.625rem] tracking-[0.08em] text-review-ink uppercase md:inline">
        Prototype — synthetic data
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
        <IconButton
          label={theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
          onClick={onTheme}
        >
          {theme === 'dark' ? (
            <Sun className="size-4" strokeWidth={1.75} />
          ) : (
            <Moon className="size-4" strokeWidth={1.75} />
          )}
        </IconButton>
        <IconButton
          label={`Reset the demo — ${versions} versions recorded`}
          onClick={() => {
            store.reset()
            location.reload()
          }}
        >
          <RotateCcw className="size-4" strokeWidth={1.75} />
        </IconButton>
        <IconButton label="How to read this demo" onClick={onTour}>
          <CircleHelp className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:bg-paper hover:text-ink"
    >
      {children}
    </button>
  )
}

function StepBar({ current }: { current?: number }) {
  const bar = useRef<HTMLDivElement>(null)

  // Keep the active step in view on narrow screens, where nine will not fit.
  useEffect(() => {
    bar.current?.querySelector('[data-active="true"]')?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [current])

  return (
    <nav aria-label="Walkthrough" className="rounded-full border border-line bg-surface/88 shadow-float backdrop-blur-xl">
      <div
        ref={bar}
        className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((item) => {
          const active = current === item.n
          return (
            <NavLink
              key={item.n}
              to={item.to}
              data-active={active}
              aria-current={active ? 'step' : undefined}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] tracking-tight whitespace-nowrap no-underline transition-colors duration-150',
                active ? 'bg-ink text-surface' : 'text-ink-soft hover:bg-paper hover:text-ink',
              )}
            >
              <span className={clsx('font-mono text-[0.6875rem]', active ? 'text-surface/70' : 'text-ink-faint')}>
                {item.n}
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

function StepFooter({ prev, next }: ReturnType<typeof neighbours>) {
  return (
    <nav aria-label="Walkthrough steps" className="mx-auto grid max-w-[84rem] gap-2 px-4 pb-10 sm:grid-cols-2 sm:px-6 lg:px-7">
      {prev ? <StepLink step={prev} direction="prev" /> : <span className="hidden sm:block" />}
      {next && <StepLink step={next} direction="next" />}
    </nav>
  )
}

function StepLink({ step, direction }: { step: Step; direction: 'prev' | 'next' }) {
  const isNext = direction === 'next'
  return (
    <NavLink
      to={step.to}
      className={clsx(
        'group flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 no-underline transition-colors hover:border-line-strong hover:bg-paper',
        isNext && 'sm:col-start-2 sm:flex-row-reverse sm:text-right',
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-colors group-hover:border-ink group-hover:text-ink">
        {isNext ? (
          <ArrowRight className="size-3.5" strokeWidth={2} />
        ) : (
          <ArrowLeft className="size-3.5" strokeWidth={2} />
        )}
      </span>
      <span className="min-w-0">
        <span className="label block">
          {isNext ? 'Next' : 'Back'} · step {step.n} of {STEPS.length}
        </span>
        <span className="mt-1 block truncate text-[0.9375rem] font-medium tracking-tight text-ink">{step.title}</span>
      </span>
    </NavLink>
  )
}
