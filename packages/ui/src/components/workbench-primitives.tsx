import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function Hint({
  children,
  label,
  side = 'top',
}: {
  children: ReactNode
  label: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-5" side={side}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function Panel({
  children,
  className,
  contentClassName,
  eyebrow,
  title,
  toolbar,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
  eyebrow: string
  title: string
  toolbar?: ReactNode
}) {
  return (
    <section className={cn('rounded-md border border-border bg-card', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {toolbar}
      </div>
      <div className={cn('p-4', contentClassName)}>{children}</div>
    </section>
  )
}

export function Label({
  children,
  text,
  hint,
}: {
  children: ReactNode
  text: string
  hint?: ReactNode
}) {
  return (
    <label className="grid gap-2">
      {hint ? (
        <Hint label={hint}>
          <span className="w-fit cursor-help text-sm font-semibold uppercase tracking-widest text-muted-foreground underline decoration-dotted underline-offset-4">
            {text}
          </span>
        </Hint>
      ) : (
        <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {text}
        </span>
      )}
      {children}
    </label>
  )
}

export function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/35 p-3">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-foreground">{value}</p>
    </div>
  )
}

export function LoadingLine({ className }: { className: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-muted/45', className)} />
}
