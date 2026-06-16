import { Ban, Check, Circle, Sparkles, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Hint, LoadingLine, Panel } from '@/components/workbench-primitives'
import { countLabel, formatDate, getMemoryTitle, getMetadata } from '@/lib/memory-view'
import { conceptHints } from '@/lib/ui-copy'
import { cn } from '@/lib/utils'
import type {
  ApiConceptGraph,
  Memory,
  MemoryRecommendation,
  RecommendationsResponse,
  SearchResult,
  StatsResponse,
} from '@/types'

interface RecommendationDescriptor {
  actionTitle: string
  category: string
  confidence: number
  outcome: string
  plainSummary: string
  safety: string
  technicalReason: string
  acceptLabel: string
  acceptHint: string
  rejectHint: string
  deferHint: string
  details: Array<{ label: string; value: string }>
}

function describeRecommendation(rec: MemoryRecommendation): RecommendationDescriptor {
  const evidenceCount = rec.evidence_ids.length
  const details: Array<{ label: string; value: string }> = []

  switch (rec.type) {
    case 'distill_candidates': {
      const sources = rec.payload?.source_ids?.length ?? evidenceCount
      const concept = rec.payload?.concept
      const conceptLabel = concept ? `"${concept}"` : 'this repeated theme'
      if (concept) details.push({ label: 'Concept', value: concept })
      details.push({ label: 'Source memories', value: String(sources) })
      if (typeof rec.payload?.compression_ratio === 'number') {
        details.push({
          label: 'Compression',
          value: `${Math.round(rec.payload.compression_ratio * 100)}%`,
        })
      }
      return {
        actionTitle: `Summarize ${sources} ${concept ? `${concept} ` : ''}memories`,
        category: 'Merge repeated memories',
        confidence: confidenceFromEvidence(sources, 3, 92),
        outcome: `PAMH creates one proposed knowledge memory, archives the ${sources} originals, and keeps every source ID linked as evidence.`,
        plainSummary: `${conceptLabel} appears in many memories, so the agent may receive repeated context instead of one clean signal.`,
        safety:
          'No evidence is destroyed. The originals leave LLM context, stay restorable from Evidence, and applying twice does not duplicate the summary.',
        technicalReason:
          'Recurring concept: at least 3 active or proposed memories share a tag or keyword.',
        acceptLabel: 'Create summary',
        acceptHint:
          'Creates the distilled memory and archives the source memories. Clicking twice does not duplicate it.',
        rejectHint: 'Dismiss this distillation suggestion. It will not be proposed again.',
        deferHint: 'Hide for now. The suggestion may resurface next time you refresh.',
        details,
      }
    }
    case 'noise_candidate': {
      const targetId = rec.payload?.target_id ?? rec.evidence_ids[0]
      if (targetId) details.push({ label: 'Memory', value: targetId })
      return {
        actionTitle: 'Hide a low-signal memory',
        category: 'Clean up noise',
        confidence: 84,
        outcome:
          'The memory moves to Noise, leaves the LLM context and map, and remains available for audit.',
        plainSummary:
          'This memory looks too weak or generated to help future agents make a decision.',
        safety: 'This is reversible from Evidence; it does not physically delete the memory.',
        technicalReason: 'Low signal: very short content, generated fragment, or low-value tag.',
        acceptLabel: 'Mark as noise',
        acceptHint: 'Move this memory to the Noise bucket. Reversible from the Evidence view.',
        rejectHint: 'Keep this memory visible and stop suggesting it.',
        deferHint: 'Hide for now without changing the memory.',
        details,
      }
    }
    case 'obsolete_candidate': {
      const older = rec.payload?.target_id ?? rec.evidence_ids[0]
      const replacement = rec.payload?.replacement_id ?? rec.evidence_ids[1]
      if (older) details.push({ label: 'Archive', value: older })
      if (replacement) details.push({ label: 'Replaced by', value: replacement })
      return {
        actionTitle: 'Archive older guidance',
        category: 'Remove outdated context',
        confidence: 78,
        outcome:
          'The older memory is archived while the newer replacement remains active and searchable.',
        plainSummary:
          'Two memories appear to cover the same guidance, and one looks superseded by the other.',
        safety:
          'Archived memories are still searchable and restorable; this only removes stale guidance from LLM context.',
        technicalReason:
          'Obsolete pair: a newer decision overlaps the older one and uses replacement language.',
        acceptLabel: 'Archive older',
        acceptHint: 'Archive the older memory. Restorable from the Evidence view.',
        rejectHint: 'Keep both memories Active and stop suggesting this archival.',
        deferHint: 'Hide for now without archiving.',
        details,
      }
    }
    case 'contradiction': {
      const left = rec.payload?.left_id ?? rec.evidence_ids[0]
      const right = rec.payload?.right_id ?? rec.evidence_ids[1]
      if (left) details.push({ label: 'Memory A', value: left })
      if (right) details.push({ label: 'Memory B', value: right })
      return {
        actionTitle: 'Choose which guidance to trust',
        category: 'Resolve conflict',
        confidence: 70,
        outcome:
          'Your chosen memory stays active. The opposing memory is archived and linked to the one you kept.',
        plainSummary:
          'Two memories appear to give opposing guidance, which can make the next agent follow the wrong instruction.',
        safety:
          'Nothing is physically deleted. The archived memory keeps its evidence trail and can be restored.',
        technicalReason:
          'Contradiction: memories share important terms and contain opposing language.',
        acceptLabel: 'Inspect',
        acceptHint: 'Open the evidence memories to review the contradiction.',
        rejectHint: 'Dismiss this contradiction warning.',
        deferHint: 'Hide for now. The contradiction will resurface on next refresh.',
        details,
      }
    }
    case 'strong_concept': {
      const concept = rec.payload?.concept
      const count = rec.payload?.count ?? evidenceCount
      if (concept) details.push({ label: 'Concept', value: concept })
      if (typeof rec.payload?.count === 'number') {
        details.push({ label: 'Memories', value: String(rec.payload.count) })
      }
      return {
        actionTitle: concept
          ? `Review the repeated "${concept}" concept`
          : 'Review a repeated concept',
        category: 'Curate an anchor',
        confidence:
          typeof rec.payload?.count === 'number'
            ? confidenceFromEvidence(rec.payload.count, 5, 88)
            : 72,
        outcome:
          'Use the evidence to create or edit one durable rule, decision, or knowledge memory that anchors the theme.',
        plainSummary: `This theme appears across ${count} memories, so it may deserve one clearer source of truth.`,
        safety:
          'This hint does not mutate memory automatically. It is a prompt to inspect the evidence and curate manually.',
        technicalReason: 'Strong concept: at least 5 visible memories share a tag or keyword.',
        acceptLabel: 'Open evidence',
        acceptHint: 'Open the Evidence view filtered by this concept.',
        rejectHint: 'Dismiss this hint.',
        deferHint: 'Hide for now.',
        details,
      }
    }
    default:
      return {
        actionTitle: rec.action
          ? `Apply ${formatInternalLabel(rec.action)}`
          : 'Inspect the linked evidence',
        category: 'Manual review',
        confidence: confidenceFromEvidence(evidenceCount, 1, 74),
        outcome: rec.action
          ? `PAMH applies ${formatInternalLabel(rec.action)} to the linked memories.`
          : 'No automatic action is available; review the evidence manually.',
        plainSummary:
          'PAMH found a maintenance signal that does not fit one of the main guided flows.',
        safety: 'Inspect the evidence before applying the recommendation.',
        technicalReason: 'Generic recommendation: inspect the linked evidence before acting.',
        acceptLabel: rec.action ? 'Apply' : 'Inspect',
        acceptHint: 'Apply this recommendation.',
        rejectHint: 'Dismiss this recommendation.',
        deferHint: 'Hide for now.',
        details,
      }
  }
}

function confidenceFromEvidence(count: number, threshold: number, cap: number): number {
  if (count <= 0) return 50
  const overThreshold = Math.max(0, count - threshold)
  return Math.min(cap, 62 + overThreshold * 6 + Math.min(count, threshold) * 4)
}

function formatInternalLabel(value: string): string {
  return value.replaceAll('_', ' ')
}

export function GovernancePanel({
  conceptGraph,
  directory,
  includeNoise,
  loading,
  onEvidenceSelect,
  onIncludeNoiseChange,
  onPreferContradiction,
  onRecommendationAction,
  recommendations,
  statsResponse,
}: {
  conceptGraph: ApiConceptGraph | null
  directory: Map<string, Memory | SearchResult>
  includeNoise: boolean
  loading: boolean
  onEvidenceSelect: (id: string) => void
  onIncludeNoiseChange: (include: boolean) => void
  onPreferContradiction: (id: string, preferredId: string) => void
  onRecommendationAction: (id: string, action: 'apply' | 'reject' | 'defer') => void
  recommendations: RecommendationsResponse | null
  statsResponse: StatsResponse | null
}) {
  const recs = recommendations?.recommendations ?? []
  const isLoadingRecommendations = loading && !recommendations
  const isLoadingEvidenceDirectory = loading && directory.size === 0
  const openCount = recommendations?.metrics.proposed_recommendations ?? recs.length
  const preservationPct = recommendations?.metrics
    ? Math.round(recommendations.metrics.source_preservation_rate * 100)
    : 100
  const visibleRecommendations = useMemo(() => recs.slice(0, 30), [recs])
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<string | null>(null)
  const selectedRecommendation =
    visibleRecommendations.find(
      (recommendation) => recommendation.id === selectedRecommendationId
    ) ??
    visibleRecommendations[0] ??
    null

  useEffect(() => {
    if (!visibleRecommendations.length) {
      setSelectedRecommendationId(null)
      return
    }

    if (
      !visibleRecommendations.some(
        (recommendation) => recommendation.id === selectedRecommendationId
      )
    ) {
      setSelectedRecommendationId(visibleRecommendations[0].id)
    }
  }, [selectedRecommendationId, visibleRecommendations])

  return (
    <section className="flex h-full min-h-[38rem] flex-col">
      <Panel
        className="flex min-h-0 flex-1 flex-col"
        contentClassName="flex min-h-0 flex-1 flex-col gap-4"
        title="Recommendations"
        eyebrow="Assisted review"
        toolbar={
          <Hint
            label={`Source preservation rate: percent of original memories still reachable after applied recommendations. 100% means nothing has been lost.`}
          >
            <Badge className="bg-muted text-foreground hover:bg-muted">
              {isLoadingRecommendations
                ? 'Loading suggestions...'
                : `${countLabel(openCount, 'open suggestion', 'open suggestions')} / ${preservationPct}% preserved`}
            </Badge>
          </Hint>
        }
      >
        <GovernanceControlStrip
          conceptGraph={conceptGraph}
          includeNoise={includeNoise}
          statsResponse={statsResponse}
          onIncludeNoiseChange={onIncludeNoiseChange}
        />

        {isLoadingRecommendations && recs.length === 0 ? (
          <RecommendationLoadingState />
        ) : recs.length === 0 ? (
          <EmptyRecommendationsState />
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(18rem,0.36fr)_minmax(0,0.64fr)]">
            <section className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Review queue
                </p>
                {recs.length > visibleRecommendations.length ? (
                  <span className="text-xs text-muted-foreground">
                    first {visibleRecommendations.length} shown
                  </span>
                ) : null}
              </div>
              <ScrollArea className="h-80 rounded-md border border-border bg-background/40 xl:h-auto xl:min-h-0 xl:flex-1">
                <div className="grid gap-1.5 p-2">
                  {visibleRecommendations.map((recommendation, index) => (
                    <RecommendationQueueItem
                      key={recommendation.id}
                      descriptor={describeRecommendation(recommendation)}
                      index={index}
                      recommendation={recommendation}
                      selected={selectedRecommendation?.id === recommendation.id}
                      onSelect={() => setSelectedRecommendationId(recommendation.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </section>

            {selectedRecommendation ? (
              <RecommendationDetail
                descriptor={describeRecommendation(selectedRecommendation)}
                directory={directory}
                loadingEvidence={isLoadingEvidenceDirectory}
                recommendation={selectedRecommendation}
                onEvidenceSelect={onEvidenceSelect}
                onPreferContradiction={onPreferContradiction}
                onRecommendationAction={onRecommendationAction}
              />
            ) : null}
          </div>
        )}
      </Panel>
    </section>
  )
}

function EmptyRecommendationsState() {
  return (
    <div className="flex min-h-112 flex-1 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-8 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        <div className="grid size-10 place-items-center">
          <Check className="size-5 text-primary" />
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium text-foreground">All clean!</p>
          <p className="text-sm leading-5 text-muted-foreground">
            PAMH has no maintenance suggestion for now. Keep capturing memories; new suggestions
            will appear here when patterns emerge.
          </p>
        </div>
      </div>
    </div>
  )
}

function GovernanceControlStrip({
  conceptGraph,
  includeNoise,
  onIncludeNoiseChange,
  statsResponse,
}: {
  conceptGraph: ApiConceptGraph | null
  includeNoise: boolean
  onIncludeNoiseChange: (include: boolean) => void
  statsResponse: StatsResponse | null
}) {
  const ignoredCount = conceptGraph?.ignoredConcepts.length ?? 0
  const hiddenNoiseCount = statsResponse?.excludedNoiseMemories ?? 0

  return (
    <div className="grid gap-2 rounded-sm border border-border/70 bg-background/35 p-2 lg:grid-cols-[minmax(16rem,0.9fr)_repeat(2,minmax(10rem,0.55fr))]">
      <Hint side="right" label={conceptHints.showNoise}>
        <div>
          <ToggleRow
            active={includeNoise}
            icon={Ban}
            label={`${includeNoise ? 'Hide' : 'Show'} noise`}
            value={countLabel(hiddenNoiseCount, 'item', 'items')}
            onToggle={() => onIncludeNoiseChange(!includeNoise)}
          />
        </div>
      </Hint>
      <MiniMetric
        label="Working map"
        value={countLabel(statsResponse?.stats.total ?? 0, 'visible memory', 'visible memories')}
        detail={countLabel(
          statsResponse?.rawTotalMemories ?? 0,
          'raw indexed memory',
          'raw indexed memories'
        )}
      />
      <MiniMetric
        label="Ignored concepts"
        value={countLabel(ignoredCount, 'concept', 'concepts')}
        detail={
          conceptGraph?.ignoredConcepts.length
            ? conceptGraph.ignoredConcepts.slice(0, 3).join(', ')
            : 'none'
        }
      />
    </div>
  )
}

function RecommendationQueueItem({
  descriptor,
  index,
  onSelect,
  recommendation,
  selected,
}: {
  descriptor: RecommendationDescriptor
  index: number
  onSelect: () => void
  recommendation: MemoryRecommendation
  selected: boolean
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'grid gap-2 rounded-sm border px-3 py-2.5 text-left transition',
        selected
          ? 'border-primary/40 bg-primary/10'
          : 'border-border/70 bg-background/55 hover:border-primary/30 hover:bg-muted/30'
      )}
      type="button"
      onClick={onSelect}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {index === 0 ? (
            <Hint label="Top suggestion based on impact. Starting here is a safe choice.">
              <Sparkles className="size-3.5 shrink-0 text-primary" />
            </Hint>
          ) : null}
          <span className="truncate text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {descriptor.category}
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {descriptor.confidence}%
        </span>
      </span>
      <span className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
        {descriptor.actionTitle}
      </span>
      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
        {descriptor.plainSummary}
      </span>
      <span className="text-xs text-muted-foreground">
        {countLabel(recommendation.evidence_ids.length, 'memory', 'memories')}
      </span>
    </button>
  )
}

function RecommendationDetail({
  descriptor,
  directory,
  loadingEvidence,
  onEvidenceSelect,
  onPreferContradiction,
  onRecommendationAction,
  recommendation,
}: {
  descriptor: RecommendationDescriptor
  directory: Map<string, Memory | SearchResult>
  loadingEvidence: boolean
  onEvidenceSelect: (id: string) => void
  onPreferContradiction: (id: string, preferredId: string) => void
  onRecommendationAction: (id: string, action: 'apply' | 'reject' | 'defer') => void
  recommendation: MemoryRecommendation
}) {
  const contradictionIds =
    recommendation.type === 'contradiction'
      ? [
          recommendation.payload?.left_id ?? recommendation.evidence_ids[0],
          recommendation.payload?.right_id ?? recommendation.evidence_ids[1],
        ].filter((id): id is string => Boolean(id))
      : []

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background/45">
      <ScrollArea className="h-[38rem] xl:h-auto xl:min-h-0 xl:flex-1">
        <div className="grid gap-4 p-4">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                {descriptor.category}
              </Badge>
              <span className="rounded-sm bg-muted/35 px-2 py-1 text-xs font-medium text-muted-foreground">
                {descriptor.confidence}% confidence
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Recommended action
              </p>
              <h3 className="mt-2 text-lg font-semibold leading-7 text-foreground">
                {descriptor.actionTitle}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {descriptor.plainSummary}
              </p>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <PreviewTile label="Result" value={descriptor.outcome} />
            <PreviewTile label="Safety" value={descriptor.safety} />
          </div>

          <RecommendationActions
            contradictionIds={contradictionIds}
            descriptor={descriptor}
            directory={directory}
            recommendation={recommendation}
            onPreferContradiction={onPreferContradiction}
            onRecommendationAction={onRecommendationAction}
          />

          <TechnicalDetails descriptor={descriptor} recommendation={recommendation} />

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Affected memories
              </span>
              <span className="text-xs text-muted-foreground">
                {countLabel(recommendation.evidence_ids.length, 'item', 'items')}
              </span>
            </div>
            <div className="max-h-80 overflow-hidden rounded-sm border border-border bg-background/55">
              <ScrollArea className="h-80">
                <div className="p-2">
                  <EvidenceLinks
                    directory={directory}
                    ids={recommendation.evidence_ids}
                    limit={12}
                    loading={loadingEvidence}
                    onOpen={onEvidenceSelect}
                  />
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </ScrollArea>
    </section>
  )
}

function RecommendationActions({
  contradictionIds,
  descriptor,
  directory,
  onPreferContradiction,
  onRecommendationAction,
  recommendation,
}: {
  contradictionIds: string[]
  descriptor: RecommendationDescriptor
  directory: Map<string, Memory | SearchResult>
  onPreferContradiction: (id: string, preferredId: string) => void
  onRecommendationAction: (id: string, action: 'apply' | 'reject' | 'defer') => void
  recommendation: MemoryRecommendation
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-sm border border-primary/20 bg-primary/5 p-3">
      <span className="w-full text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Decision
      </span>
      {contradictionIds.length === 2 ? (
        <>
          <Hint
            label={`Keep ${getEvidenceActionLabel(directory, contradictionIds[0])} active and archive ${getEvidenceActionLabel(directory, contradictionIds[1])}.`}
          >
            <Button
              size="sm"
              onClick={() => onPreferContradiction(recommendation.id, contradictionIds[0])}
            >
              <Check />
              Keep first
            </Button>
          </Hint>
          <Hint
            label={`Keep ${getEvidenceActionLabel(directory, contradictionIds[1])} active and archive ${getEvidenceActionLabel(directory, contradictionIds[0])}.`}
          >
            <Button
              size="sm"
              variant="outline"
              onClick={() => onPreferContradiction(recommendation.id, contradictionIds[1])}
            >
              <Check />
              Keep second
            </Button>
          </Hint>
        </>
      ) : null}
      {recommendation.action ? (
        <Hint label={descriptor.acceptHint}>
          <Button size="sm" onClick={() => onRecommendationAction(recommendation.id, 'apply')}>
            <Check />
            {descriptor.acceptLabel}
          </Button>
        </Hint>
      ) : null}
      <Hint label={descriptor.deferHint}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRecommendationAction(recommendation.id, 'defer')}
        >
          <Circle />
          Later
        </Button>
      </Hint>
      <Hint label={descriptor.rejectHint}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onRecommendationAction(recommendation.id, 'reject')}
        >
          <X />
          Dismiss
        </Button>
      </Hint>
    </div>
  )
}

function TechnicalDetails({
  descriptor,
  recommendation,
}: {
  descriptor: RecommendationDescriptor
  recommendation: MemoryRecommendation
}) {
  return (
    <div className="grid gap-3 rounded-sm border border-border/70 bg-background/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Why PAMH suggested this
        </span>
        <span className="text-xs text-muted-foreground">
          {formatInternalLabel(recommendation.type)}
        </span>
      </div>
      <p className="text-sm leading-5 text-foreground">{descriptor.technicalReason}</p>
      {descriptor.details.length ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {descriptor.details.map((detail) => (
            <span
              key={detail.label}
              className="rounded-sm bg-muted/45 px-2 py-1 text-muted-foreground"
            >
              <span className="uppercase tracking-widest opacity-70">{detail.label}</span>{' '}
              <span className="text-foreground">{detail.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">
        Original suggestion: {recommendation.title}
      </p>
    </div>
  )
}

function RecommendationLoadingState() {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-4">
      <div className="grid gap-2">
        <LoadingLine className="h-5 w-44" />
        <LoadingLine className="h-4 w-64 max-w-full" />
      </div>
      <LoadingLine className="h-24 w-full" />
      <LoadingLine className="h-24 w-full" />
      <LoadingLine className="h-24 w-11/12" />
    </div>
  )
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-background/45 p-3 text-sm leading-5">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 text-foreground">{value}</p>
    </div>
  )
}

function MiniMetric({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="grid content-center gap-1 rounded-sm bg-muted/25 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm font-medium text-foreground">{value}</span>
      <span className="truncate text-sm text-muted-foreground">{detail}</span>
    </div>
  )
}

function EvidenceLinks({
  directory,
  ids,
  limit = 10,
  loading = false,
  onOpen,
}: {
  directory?: Map<string, Memory | SearchResult>
  ids: string[]
  limit?: number
  loading?: boolean
  onOpen?: (id: string) => void
}) {
  if (!ids.length) return null

  return (
    <div className="grid gap-1.5">
      {ids.slice(0, limit).map((id) => {
        const memory = directory?.get(id)

        if (!memory && loading) {
          return <LoadingLine key={id} className="h-12 w-full" />
        }

        const metadata = memory ? getMetadata(memory) : null
        const title = memory ? getMemoryTitle(memory) : id
        const subtitle = metadata
          ? `${metadata.type} - ${metadata.status} - ${formatDate(metadata.updated_at)}`
          : 'unknown memory (no longer in this store)'
        return (
          <Hint
            key={id}
            side="top"
            label={
              memory ? (
                <span className="grid gap-1">
                  <span className="font-mono text-xs opacity-70">{id}</span>
                  <span className="line-clamp-4 whitespace-pre-wrap">{memory.content}</span>
                </span>
              ) : (
                <span className="font-mono text-xs">{id}</span>
              )
            }
          >
            <button
              className="grid gap-0.5 rounded-sm border border-border bg-background/70 px-2 py-1.5 text-left transition hover:border-primary/40 hover:bg-background"
              disabled={!onOpen}
              type="button"
              onClick={() => onOpen?.(id)}
            >
              <span className="truncate text-sm font-medium text-foreground">{title}</span>
              <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
            </button>
          </Hint>
        )
      })}
      {ids.length > limit ? (
        <span className="text-xs text-muted-foreground">+ {ids.length - limit} more</span>
      ) : null}
    </div>
  )
}

function getEvidenceActionLabel(directory: Map<string, Memory | SearchResult>, id: string): string {
  const memory = directory.get(id)
  if (!memory) return id
  return getMemoryTitle(memory)
}

function ToggleRow({
  active,
  icon: Icon,
  label,
  onToggle,
  value,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onToggle: () => void
  value: string
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center justify-between gap-4 rounded-sm border px-3 py-3 text-left transition',
        active
          ? 'border-primary/35 bg-primary/10 text-primary'
          : 'border-border bg-muted/35 text-foreground hover:bg-muted/60'
      )}
      type="button"
      onClick={onToggle}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="size-4 shrink-0" />
        <span className="truncate text-sm font-medium">{label}</span>
      </span>
      <span className="text-sm text-muted-foreground">{value}</span>
    </button>
  )
}
