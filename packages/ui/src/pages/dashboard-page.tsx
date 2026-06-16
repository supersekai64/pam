import { ClipboardCheck, FileText, PlugZap, SearchCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import { ContextPreviewPanel } from '@/components/context-preview-panel'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ApiConceptGraph, ContextPreview, StatsResponse } from '@/types'

export function DashboardPage({
  conceptGraph,
  contextPreview,
  memoryTotal,
  onContextOpen,
  onEvidenceOpen,
  statsResponse,
}: {
  conceptGraph: ApiConceptGraph | null
  contextPreview: ContextPreview | null
  memoryTotal: number
  onContextOpen: () => void
  onEvidenceOpen: () => void
  statsResponse: StatsResponse | null
}) {
  const stats = statsResponse?.stats
  const project = statsResponse?.project
  const hasNoMemories = stats ? stats.total === 0 : memoryTotal === 0

  return (
    <section className="grid gap-4">
      <Panel title="Project overview" eyebrow="Dashboard">
        <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4 max-lg:grid-cols-1">
          <div className="rounded-md border border-border bg-background/45 p-4">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Current project
            </p>
            <h2 className="mt-3 truncate text-3xl font-semibold tracking-tight text-foreground">
              {project?.name || 'Unknown project'}
            </h2>
            <p className="mt-3 break-all text-sm leading-6 text-muted-foreground">
              {project?.path || 'Project path unavailable'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/25 p-4">
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Memory store
            </p>
            <p className="mt-3 break-all text-sm leading-6 text-foreground">
              {project?.memoryPath || '.ai-memory'}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Project-local store used by CLI, MCP, API, and this console.
            </p>
          </div>
        </div>
      </Panel>

      {hasNoMemories ? (
        <FirstRunPanel onContextOpen={onContextOpen} onEvidenceOpen={onEvidenceOpen} />
      ) : null}

      <section className="grid grid-cols-[0.9fr_0.9fr_0.9fr_1.15fr] gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        <Hint label="Active memories that would be included in the LLM context window right now.">
          <div>
            <MetricPanel
              tone="primary"
              label={nounLabel(stats?.active ?? 0, 'LLM candidate', 'LLM candidates')}
              value={stats?.active ?? '-'}
              detail={countLabel(
                stats?.total ?? 0,
                'visible project memory',
                'visible project memories'
              )}
            />
          </div>
        </Hint>
        <Hint label="Tags and keywords that recur across the current LLM context. They are the backbone of the concepts map.">
          <div>
            <MetricPanel
              tone="secondary"
              label={nounLabel(
                conceptGraph?.concepts.length ?? 0,
                'Context concept',
                'Context concepts'
              )}
              value={conceptGraph?.concepts.length ?? '-'}
              detail={`from ${countLabel(
                conceptGraph?.totalMemories ?? 0,
                'context memory',
                'context memories'
              )}`}
            />
          </div>
        </Hint>
        <Hint label="Memories matching the current search query and status filter - what you would inspect or edit.">
          <div>
            <MetricPanel
              tone="muted"
              label="Evidence set"
              value={memoryTotal}
              detail="current query and status"
            />
          </div>
        </Hint>
        <div aria-hidden="true" className="rounded-md border border-border bg-card" />
      </section>

      <ContextPreviewPanel contextPreview={contextPreview} onOpen={onContextOpen} />
    </section>
  )
}

function FirstRunPanel({
  onContextOpen,
  onEvidenceOpen,
}: {
  onContextOpen: () => void
  onEvidenceOpen: () => void
}) {
  const steps = [
    {
      icon: PlugZap,
      title: 'Connect agent',
      detail: 'memory doctor integrations',
    },
    {
      icon: ClipboardCheck,
      title: 'Create probe',
      detail: 'memory smoke-test agent',
    },
    {
      icon: SearchCheck,
      title: 'Approve proposal',
      detail: 'memory review',
    },
    {
      icon: FileText,
      title: 'Preview recall',
      detail: 'Context view',
    },
  ]

  return (
    <Panel title="First capture path" eyebrow="Empty store">
      <div className="grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <div key={step.title} className="rounded-md border border-border bg-background/45 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon className="size-4 text-primary" />
                <span>
                  {index + 1}. {step.title}
                </span>
              </div>
              <code className="mt-3 block break-all rounded-sm bg-muted/55 px-2 py-1.5 text-xs text-muted-foreground">
                {step.detail}
              </code>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEvidenceOpen}>
          <ClipboardCheck />
          Review queue
        </Button>
        <Button onClick={onContextOpen}>
          <FileText />
          Preview context
        </Button>
      </div>
    </Panel>
  )
}

function MetricPanel({
  detail,
  label,
  tone,
  value,
}: {
  detail: string
  label: string
  tone: 'primary' | 'secondary' | 'muted'
  value: number | string
}) {
  const classes = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    muted: 'bg-muted text-foreground',
  }

  return (
    <div className={cn('rounded-md p-4', classes[tone])}>
      <p className="text-sm font-bold uppercase tracking-widest opacity-65">{label}</p>
      <strong className="mt-2 block text-4xl font-semibold tracking-tight">{value}</strong>
      <p className="mt-2 text-sm opacity-75">{detail}</p>
    </div>
  )
}

function Panel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode
  eyebrow: string
  title: string
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Hint({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-left leading-5">{label}</TooltipContent>
    </Tooltip>
  )
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function nounLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
