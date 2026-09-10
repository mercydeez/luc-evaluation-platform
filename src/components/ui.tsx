import clsx from 'clsx'
import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type Tone = 'neutral' | 'verified' | 'review' | 'hold' | 'ink'

const TONE_SURFACE: Record<Tone, string> = {
  neutral: 'bg-paper text-ink-soft border-line',
  verified: 'bg-verified-bg text-verified-ink border-verified-line',
  review: 'bg-review-bg text-review-ink border-review-line',
  hold: 'bg-hold-bg text-hold-ink border-hold-line',
  ink: 'bg-ink text-white border-ink',
}

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  verified: 'bg-verified',
  review: 'bg-review',
  hold: 'bg-hold',
  ink: 'bg-white',
}

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight whitespace-nowrap',
        TONE_SURFACE[tone],
        className,
      )}
    >
      {dot && <span className={clsx('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />}
      {children}
    </span>
  )
}

/** Machine-owned values: hashes, keys, versions, timings. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx('font-mono text-[0.8125rem] tracking-tight', className)}>{children}</span>
}

export function Card({ className, children, ...rest }: ComponentProps<'div'>) {
  return (
    <div className={clsx('card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHead({
  title,
  meta,
  action,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4', className)}>
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-ink">{title}</h2>
        {meta && <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">{meta}</p>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-ink text-white border-ink hover:bg-ink-deep disabled:bg-line-strong disabled:border-line-strong disabled:text-white',
  secondary:
    'bg-surface text-ink border-line-strong hover:border-ink hover:bg-paper disabled:text-ink-faint disabled:border-line disabled:hover:bg-surface',
  ghost:
    'bg-transparent text-ink-soft border-transparent hover:bg-ink/6 hover:text-ink disabled:text-line-strong disabled:hover:bg-transparent',
  danger:
    'bg-hold-bg text-hold-ink border-hold-line hover:border-hold disabled:opacity-50',
}

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full border font-medium tracking-tight transition-[background-color,border-color,color] duration-150 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-[0.8125rem]' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    />
  )
}

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  className,
  children,
}: {
  to: string
  variant?: NonNullable<ButtonProps['variant']>
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full border font-medium tracking-tight no-underline transition-[background-color,border-color,color] duration-150',
        size === 'sm' ? 'px-3 py-1.5 text-[0.8125rem]' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}

/** A labelled figure. Used sparingly — a number without a unit is not a metric. */
export function Figure({
  value,
  label,
  note,
  tone = 'neutral',
}: {
  value: ReactNode
  label: string
  note?: ReactNode
  tone?: Tone
}) {
  return (
    <div className="min-w-0">
      <div
        className={clsx(
          'text-[1.75rem] leading-none font-medium tracking-[-0.03em] tabular-nums',
          tone === 'verified' ? 'text-verified-ink' : tone === 'hold' ? 'text-hold-ink' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="label mt-2">{label}</div>
      {note && <p className="mt-1.5 text-[0.8125rem] leading-snug text-ink-soft">{note}</p>}
    </div>
  )
}

/** An explanatory aside that carries an argument rather than a status. */
export function Note({
  title,
  children,
  tone = 'neutral',
}: {
  title?: string
  children: ReactNode
  tone?: Tone
}) {
  return (
    <div
      className={clsx(
        'rounded-card border px-4 py-3.5',
        tone === 'verified'
          ? 'border-verified-line bg-verified-bg'
          : tone === 'hold'
            ? 'border-hold-line bg-hold-bg'
            : tone === 'review'
              ? 'border-review-line bg-review-bg'
              : 'border-line bg-paper',
      )}
    >
      {title && <h3 className="text-[0.8125rem] font-semibold tracking-tight text-ink">{title}</h3>}
      <div className={clsx('text-[0.8125rem] leading-relaxed text-ink-soft', title && 'mt-1.5')}>{children}</div>
    </div>
  )
}

export function DataRow({ k, v }: { k: ReactNode; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-[0.8125rem] text-ink-faint">{k}</dt>
      <dd className="min-w-0 text-right text-[0.8125rem] font-medium text-ink">{v}</dd>
    </div>
  )
}

export function Meter({ value, tone = 'ink' }: { value: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/8" role="presentation">
      <div
        className={clsx(
          'h-full rounded-full transition-[width] duration-500',
          tone === 'verified' ? 'bg-verified' : tone === 'hold' ? 'bg-hold' : tone === 'review' ? 'bg-review' : 'bg-ink',
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function PageHead({
  title,
  meta,
  children,
  actions,
}: {
  title: string
  meta?: ReactNode
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[1.75rem] leading-[1.1] font-medium tracking-[-0.035em] text-ink text-balance sm:text-[2rem]">
          {title}
        </h1>
        {meta && <p className="mt-2 text-[0.8125rem] text-ink-faint">{meta}</p>}
        {children && <div className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[0.8125rem] leading-relaxed text-ink-soft">{children}</div>}
    </div>
  )
}
