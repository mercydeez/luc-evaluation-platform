import clsx from 'clsx'
import {
  BookOpenCheck,
  FlaskConical,
  GraduationCap,
  Info,
  LayoutDashboard,
  Menu,
  ScrollText,
  UploadCloud,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { COURSE } from '../data/samples'
import { store, useStore } from '../engine/store'
import { Mark } from './Mark'
import { Badge, Button } from './ui'

const NAV = [
  {
    group: 'Evaluation',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/submit', label: 'Submit & grade', icon: UploadCloud },
      { to: '/consistency', label: 'Consistency lab', icon: FlaskConical },
    ],
  },
  {
    group: 'Decisions',
    items: [
      { to: '/review', label: 'Review queue', icon: BookOpenCheck },
      { to: '/student', label: 'Student view', icon: GraduationCap },
    ],
  },
  {
    group: 'Record',
    items: [
      { to: '/audit', label: 'Audit log', icon: ScrollText },
      { to: '/case', label: 'Product case', icon: Info },
    ],
  },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="sr-only rounded-full bg-ink px-4 py-2 text-sm text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {/* Rail */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-rail transition-transform duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          open ? 'translate-x-0 shadow-rail' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <Mark className="size-7 shrink-0" color="#3FBF6E" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[0.8125rem] font-semibold tracking-tight text-white">Learners Education</div>
            <div className="truncate text-[0.6875rem] text-rail-muted">Invariant · evaluation</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto rounded-full p-1.5 text-rail-muted hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-4 mb-4 rounded-card border border-rail-line bg-white/4 px-3 py-2.5">
          <div className="font-mono text-[0.6875rem] text-rail-muted">{COURSE.code}</div>
          <div className="mt-0.5 text-[0.8125rem] leading-tight font-medium text-rail-text">{COURSE.name}</div>
          <div className="mt-1 text-[0.6875rem] text-rail-muted">
            {COURSE.term} · {COURSE.enrolled} enrolled
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="px-2.5 pb-1.5 text-[0.625rem] font-medium tracking-[0.08em] text-rail-muted uppercase">
                {section.group}
              </div>
              <ul className="space-y-0.5">
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium tracking-tight no-underline transition-colors duration-150',
                          isActive
                            ? 'bg-white/12 text-white'
                            : 'text-rail-muted hover:bg-white/6 hover:text-rail-text',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={clsx('size-4 shrink-0', isActive ? 'text-[#3FBF6E]' : '')}
                            strokeWidth={1.75}
                          />
                          {label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <RailFooter />
      </div>

      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-ink-deep/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-col">
        <TopBar onMenu={() => setOpen(true)} />
        <main id="main" className="flex-1 px-4 pt-5 pb-16 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function RailFooter() {
  const record = useStore((s) => s.record)

  return (
    <div className="border-t border-rail-line px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#3FBF6E]/18 text-[0.6875rem] font-semibold text-[#7DDCA1]">
          AR
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[0.8125rem] font-medium text-rail-text">Dr. Anita Rao</div>
          <div className="truncate text-[0.6875rem] text-rail-muted">Faculty · course owner</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          store.reset()
          location.reload()
        }}
        className="mt-3 w-full rounded-full border border-rail-line px-3 py-1.5 text-[0.75rem] font-medium text-rail-muted transition-colors hover:border-[#3FBF6E]/50 hover:text-rail-text"
      >
        Reset demo · {record.length} versions
      </button>
    </div>
  )
}

const TITLES: Record<string, [string, string]> = {
  '/': ['Evaluation', 'Overview'],
  '/submit': ['Evaluation', 'Submit & grade'],
  '/consistency': ['Evaluation', 'Consistency lab'],
  '/review': ['Decisions', 'Review queue'],
  '/student': ['Decisions', 'Student view'],
  '/audit': ['Record', 'Audit log'],
  '/case': ['Record', 'Product case'],
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { pathname } = useLocation()
  const [note, setNote] = useState(false)
  const [section, title] = TITLES[pathname] ?? (pathname.startsWith('/review') ? ['Decisions', 'Review'] : ['', ''])

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          className="-ml-1 rounded-full p-2 text-ink-soft hover:bg-ink/6 hover:text-ink lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4.5" />
        </button>

        <div className="min-w-0 text-[0.8125rem] tracking-tight">
          <span className="text-ink-faint">{section}</span>
          {title && (
            <span className="mx-1.5 text-line-strong" aria-hidden="true">
              /
            </span>
          )}
          <span className="font-medium text-ink">{title}</span>
        </div>

        <div className="relative ml-auto">
          <button type="button" onClick={() => setNote((v) => !v)} aria-expanded={note} className="block">
            <Badge tone="review" dot>
              Demo build
            </Badge>
          </button>
          {note && (
            <div
              className="absolute top-full right-0 z-30 mt-2 w-80 rounded-card border border-line bg-surface p-4 shadow-pop"
              style={{ animation: 'stage-in 200ms var(--ease-out-quint)' }}
            >
              <h3 className="text-[0.8125rem] font-semibold tracking-tight text-ink">What is real here</h3>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                The hashing, the evaluation key, the rubric arithmetic, the verdict cache, the validation layer and
                the append-only record all run for real, in this browser.
              </p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                Judgement comes from a <strong className="font-medium text-ink">deterministic stand-in</strong>, not a
                language model, and every student name and mark on screen is synthetic.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 -ml-1"
                onClick={() => setNote(false)}
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
