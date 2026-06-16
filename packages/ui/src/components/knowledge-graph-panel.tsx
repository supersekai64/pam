import { Archive, Ban, Check, FileText, Pencil, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { TagField, TypeScopeFields } from '@/components/memory-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Hint, Label, LoadingLine, Panel } from '@/components/workbench-primitives'
import { countLabel, formatDate, getMemoryTitle, groupBy, toMemory } from '@/lib/memory-view'
import { conceptHints } from '@/lib/ui-copy'
import { cn } from '@/lib/utils'
import type {
  KnowledgeGraphResponse,
  KnowledgeRelation,
  Memory,
  MemoryAction,
  SearchResult,
} from '@/types'

export function KnowledgeGraphPanel({
  directory,
  graph,
  loading,
  onEvidenceAction,
  onEvidenceUpdate,
}: {
  directory: Map<string, Memory | SearchResult>
  graph: KnowledgeGraphResponse | null
  loading: boolean
  onEvidenceAction: (memory: Memory | SearchResult, action: MemoryAction) => void
  onEvidenceUpdate: (memory: Memory | SearchResult, event: FormEvent<HTMLFormElement>) => void
}) {
  const [selectedRelationGroupId, setSelectedRelationGroupId] = useState<string | null>(null)
  const rawEntities = graph?.entities ?? []
  const rawRelations = graph?.relations ?? []
  const evidenceIds = Array.from(
    new Set([
      ...rawEntities.flatMap((entity) => entity.evidence_ids),
      ...rawRelations.flatMap((relation) => relation.evidence_ids),
    ])
  )
  const relations = rawRelations.filter(isDisplayKnowledgeRelation)
  const relationEntityIds = new Set(
    relations.flatMap((relation) => [relation.source, relation.target])
  )
  const entities = rawEntities.filter((entity) => relationEntityIds.has(entity.id))
  const entityById = new Map((graph?.entities ?? []).map((entity) => [entity.id, entity]))
  const relationGroups = groupKnowledgeRelations(relations)
  const relationTypes = groupBy(relationGroups, (group) => group.type)
  const selectedRelationGroup =
    relationGroups.find((group) => group.id === selectedRelationGroupId) ??
    relationGroups[0] ??
    null
  const hasGraph = evidenceIds.length >= 2 && relations.length > 0
  const isEvidenceLoading = loading && directory.size === 0
  const isLoadingInitialGraph = loading && !graph

  return (
    <section className="grid h-full min-h-0 grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)] gap-4 max-xl:h-auto max-xl:min-h-0 max-xl:grid-cols-1">
      <Panel
        title="Relation explorer"
        eyebrow="Knowledge graph"
        className="flex min-h-0 flex-col max-xl:min-h-[32rem]"
        contentClassName="min-h-0 flex-1 overflow-hidden"
        toolbar={
          <div className="flex flex-wrap justify-end gap-2 text-sm">
            <GraphMetric
              label="Entities"
              value={isLoadingInitialGraph ? '...' : String(entities.length)}
            />
            <GraphMetric
              label="Relations"
              value={isLoadingInitialGraph ? '...' : String(relations.length)}
            />
            <GraphMetric
              label="Evidence"
              value={isLoadingInitialGraph ? '...' : String(evidenceIds.length)}
            />
          </div>
        }
      >
        {isLoadingInitialGraph ? (
          <KnowledgeGraphLoadingState />
        ) : hasGraph ? (
          <ScrollArea className="h-full">
            <div className="grid gap-6 pr-3">
              {Object.entries(relationTypes).map(([type, typedGroups]) => {
                const typedRelationCount = typedGroups.reduce(
                  (count, group) => count + group.relations.length,
                  0
                )
                const typeDisplay = getRelationTypeDisplay(type)

                return (
                  <section
                    key={type}
                    className="grid gap-2 border-t border-border/80 pt-5 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-3 pb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                          Relation type
                        </p>
                        <h3 className="mt-1 text-base font-semibold leading-5 text-foreground">
                          {typeDisplay.label}
                        </h3>
                        <p className="mt-1 text-sm leading-5 text-muted-foreground">
                          {typeDisplay.description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
                        {countLabel(typedGroups.length, 'source', 'sources')} /{' '}
                        {countLabel(typedRelationCount, 'relation', 'relations')}
                      </span>
                    </div>

                    <div className="grid gap-1.5 border-l border-border/70 pl-3">
                      {typedGroups.slice(0, 16).map((group) => {
                        const sourceLabel = getKnowledgeEntityLabel(
                          group.source,
                          entityById,
                          directory
                        )
                        const targetLabels = getRelationTargetLabels(group, entityById, directory)
                        const selected = selectedRelationGroup?.id === group.id

                        return (
                          <button
                            key={group.id}
                            className={cn(
                              'grid gap-2 rounded-sm border px-3 py-2.5 text-left transition',
                              selected
                                ? 'border-primary/35 bg-primary/10'
                                : 'border-border/70 bg-background/35 hover:border-primary/30 hover:bg-muted/25'
                            )}
                            type="button"
                            onClick={() => {
                              setSelectedRelationGroupId(group.id)
                            }}
                          >
                            <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
                              <span className="truncate font-medium text-foreground">
                                {sourceLabel}
                              </span>
                              <span className="text-muted-foreground">-&gt;</span>
                              <span className="truncate font-medium text-foreground">
                                {formatRelationTargets(targetLabels)}
                              </span>
                            </span>
                            <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span className="truncate">
                                {countLabel(group.relations.length, 'relation', 'relations')}
                              </span>
                              <span className="shrink-0">
                                {countLabel(group.evidence_ids.length, 'evidence', 'evidence')}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="grid h-full min-h-80 place-items-center rounded-md border border-dashed border-border bg-muted/20 p-8 text-center">
            <div className="max-w-md">
              <p className="text-sm font-medium text-foreground">
                Knowledge graph needs at least 2 memories.
              </p>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Add or approve more memories to reveal useful relations between concepts, decisions,
                files, and evidence.
              </p>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title="Relation detail"
        eyebrow="Inspector"
        className="flex min-h-0 flex-col max-xl:min-h-[32rem]"
        contentClassName="min-h-0 flex-1 overflow-hidden"
      >
        <ScrollArea className="h-full">
          <div className="grid gap-4 pr-3">
            {isLoadingInitialGraph ? (
              <div className="grid gap-3">
                <LoadingLine className="h-5 w-20" />
                <LoadingLine className="h-6 w-3/4" />
                <LoadingLine className="h-4 w-1/2" />
                <div className="mt-2 grid gap-2">
                  <LoadingLine className="h-28 w-full" />
                  <LoadingLine className="h-20 w-full" />
                </div>
              </div>
            ) : selectedRelationGroup ? (
              <div className="grid gap-4">
                <div>
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    {getRelationTypeDisplay(selectedRelationGroup.type).label}
                  </Badge>
                  <h3 className="mt-3 text-lg font-semibold leading-7 text-foreground">
                    {getKnowledgeEntityLabel(selectedRelationGroup.source, entityById, directory)}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedRelationGroup.targets.map((target) => {
                      const label = getKnowledgeEntityLabel(target, entityById, directory)

                      return (
                        <Badge key={target} className="bg-muted text-foreground hover:bg-muted">
                          {label}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Evidence
                  </p>
                  <InlineEvidenceCards
                    directory={directory}
                    loading={isEvidenceLoading}
                    ids={selectedRelationGroup.evidence_ids}
                    onAction={onEvidenceAction}
                    onUpdate={onEvidenceUpdate}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a relation to inspect.</p>
            )}

            {relations.length ? (
              <div className="rounded-md bg-muted/25 p-3 text-sm leading-6 text-muted-foreground">
                Select a relation on the left to review the exact evidence that produced it.
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </Panel>
    </section>
  )
}

function InlineEvidenceCards({
  directory,
  ids,
  loading = false,
  onAction,
  onUpdate,
}: {
  directory?: Map<string, Memory | SearchResult>
  ids: string[]
  loading?: boolean
  onAction: (memory: Memory | SearchResult, action: MemoryAction) => void
  onUpdate: (memory: Memory | SearchResult, event: FormEvent<HTMLFormElement>) => void
}) {
  if (!ids.length) {
    return <p className="mt-2 text-sm text-muted-foreground">No evidence linked.</p>
  }

  return (
    <div className="mt-2 grid gap-3">
      {ids.map((id) => {
        const memory = directory?.get(id)

        if (!memory && loading) {
          return <InlineEvidenceCardLoading key={id} />
        }

        if (!memory) {
          return (
            <article
              key={id}
              className="grid gap-2 rounded-md border border-border bg-background/70 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-muted text-foreground hover:bg-muted">missing</Badge>
                <span className="font-mono text-xs text-muted-foreground">{id}</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                This relation references a memory that is no longer available in this store.
              </p>
            </article>
          )
        }

        return (
          <InlineEvidenceCard key={id} memory={memory} onAction={onAction} onUpdate={onUpdate} />
        )
      })}
    </div>
  )
}

function InlineEvidenceCardLoading() {
  return (
    <article className="grid gap-3 rounded-md border border-border bg-background/70 p-3">
      <div className="flex flex-wrap gap-2">
        <LoadingLine className="h-5 w-16" />
        <LoadingLine className="h-5 w-24" />
      </div>
      <LoadingLine className="h-4 w-52 max-w-full" />
      <LoadingLine className="h-20 w-full" />
    </article>
  )
}

function KnowledgeGraphLoadingState() {
  return (
    <div className="grid h-full min-h-80 place-items-center rounded-md border border-dashed border-border bg-muted/20 p-8">
      <div className="w-full max-w-2xl">
        <div className="mx-auto mb-8 grid max-w-sm gap-3 text-center">
          <p className="text-sm font-medium text-foreground">Building knowledge graph...</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Reading memories, extracting relations, and loading evidence links.
          </p>
        </div>
        <div className="grid gap-3">
          <LoadingLine className="h-12 w-full" />
          <LoadingLine className="h-12 w-11/12" />
          <LoadingLine className="h-12 w-full" />
          <LoadingLine className="h-12 w-10/12" />
        </div>
      </div>
    </div>
  )
}

function InlineEvidenceCard({
  memory,
  onAction,
  onUpdate,
}: {
  memory: Memory | SearchResult
  onAction: (memory: Memory | SearchResult, action: MemoryAction) => void
  onUpdate: (memory: Memory | SearchResult, event: FormEvent<HTMLFormElement>) => void
}) {
  const normalized = toMemory(memory)
  const metadata = normalized.metadata
  const isProposed = metadata.status === 'proposed'
  const isArchived = metadata.status === 'archived'
  const isDeleted = metadata.status === 'deleted'
  const isNoise = metadata.status === 'noise'
  const canEdit = !isProposed && !isArchived && !isDeleted && !isNoise
  const [isEditing, setIsEditing] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [tags, setTags] = useState(metadata.tags.join(', '))
  const filePath = 'file_path' in memory ? memory.file_path : ''
  const technicalDetails = [
    { label: 'id', value: metadata.id },
    { label: 'created', value: metadata.created_at },
    { label: 'updated', value: metadata.updated_at },
    { label: 'scope', value: metadata.scope },
    { label: 'source', value: metadata.source },
    metadata.salience === undefined
      ? null
      : { label: 'salience', value: String(metadata.salience) },
    filePath ? { label: 'file', value: filePath } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item))

  useEffect(() => {
    setTags(metadata.tags.join(', '))
    setIsEditing(false)
    setDetailsOpen(false)
    setDangerOpen(false)
  }, [metadata.id, metadata.status, metadata.tags, metadata.updated_at])

  const cancelEdit = () => {
    setTags(metadata.tags.join(', '))
    setIsEditing(false)
  }

  return (
    <article className="overflow-hidden rounded-md border border-border bg-background/70">
      <div className="border-b border-border/70 bg-muted/15 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              {metadata.type}
            </Badge>
            <Badge className="bg-muted text-foreground hover:bg-muted">{metadata.status}</Badge>
            <span className="text-xs text-muted-foreground">
              updated {formatDate(metadata.updated_at)}
            </span>
          </div>
          <Button
            className={cn(detailsOpen && 'bg-muted text-foreground')}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            <FileText />
            Details
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            source <span className="text-foreground">{metadata.source}</span>
          </span>
          <span>
            store <span className="text-foreground">{metadata.scope}</span>
          </span>
        </div>

        {detailsOpen ? (
          <dl className="mt-3 grid gap-2 rounded-sm border border-border/70 bg-background/65 p-2 text-xs">
            {technicalDetails.map((detail) => (
              <div key={detail.label} className="grid gap-1">
                <dt className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {detail.label}
                </dt>
                <dd className="break-all font-mono text-muted-foreground">{detail.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {isEditing ? (
        <form
          className="grid gap-3 p-3"
          onSubmit={(event) => {
            onUpdate(memory, event)
            setIsEditing(false)
          }}
        >
          <TypeScopeFields type={metadata.type} />
          <Label text="Display title">
            <Input
              className="border-border bg-background/60 text-foreground"
              defaultValue={metadata.title ?? ''}
              name="title"
              placeholder="Optional short title"
            />
          </Label>
          <TagField tags={tags} onTagsChange={setTags} />
          <Label text="Memory">
            <Textarea
              key={`${metadata.id}:${metadata.updated_at}`}
              className="min-h-44 border-border bg-background/60 text-foreground"
              defaultValue={normalized.content}
              name="content"
              required
            />
          </Label>
          <div className="flex flex-wrap gap-2">
            <Hint label={conceptHints.save}>
              <Button size="sm" type="submit">
                <Save />
                Save
              </Button>
            </Hint>
            <Button size="sm" type="button" variant="outline" onClick={cancelEdit}>
              <X />
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid gap-3 px-3 py-3">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
              {normalized.content || 'Empty memory'}
            </p>
            {metadata.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {metadata.tags.map((tag) => (
                  <Badge key={tag} className="bg-muted/70 text-foreground hover:bg-muted/70">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {isProposed ? (
            <div className="flex flex-wrap gap-2 border-t border-border/70 bg-muted/10 px-3 py-2.5">
              <Hint label={conceptHints.approve}>
                <Button size="sm" type="button" onClick={() => onAction(memory, 'approve')}>
                  <Check />
                  Approve
                </Button>
              </Hint>
              <Hint label={conceptHints.reject}>
                <Button
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => onAction(memory, 'reject')}
                >
                  <X />
                  Reject
                </Button>
              </Hint>
            </div>
          ) : (
            <div className="grid gap-2 border-t border-border/70 bg-muted/10 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Hint label={conceptHints.archive}>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => onAction(memory, 'archive')}
                        >
                          <Archive />
                          Archive
                        </Button>
                      </Hint>
                      <Hint label={conceptHints.markNoise}>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => onAction(memory, 'mark-noise')}
                        >
                          <Ban />
                          Mark noise
                        </Button>
                      </Hint>
                    </>
                  ) : null}
                  {isArchived || isDeleted || isNoise ? (
                    <Hint label={conceptHints.restore}>
                      <Button size="sm" type="button" onClick={() => onAction(memory, 'restore')}>
                        <RotateCcw />
                        Restore
                      </Button>
                    </Hint>
                  ) : null}
                </div>
                <Button
                  className="text-destructive hover:text-destructive"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setDangerOpen(!dangerOpen)}
                >
                  <Trash2 />
                  Delete
                </Button>
              </div>
              {dangerOpen ? (
                <div className="flex flex-wrap gap-2 rounded-sm border border-destructive/25 bg-destructive/10 p-2">
                  <Hint label={conceptHints.softDelete}>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => onAction(memory, 'delete')}
                    >
                      <Trash2 />
                      Soft delete
                    </Button>
                  </Hint>
                  <Hint label={conceptHints.physicalDelete}>
                    <Button
                      size="sm"
                      type="button"
                      variant="destructive"
                      onClick={() => onAction(memory, 'physical-delete')}
                    >
                      <Trash2 />
                      Confirm physical delete
                    </Button>
                  </Hint>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </article>
  )
}

interface KnowledgeRelationGroup {
  id: string
  source: string
  type: string
  targets: string[]
  evidence_ids: string[]
  relations: KnowledgeRelation[]
}

interface RelationTypeDisplay {
  label: string
  description: string
}

const relationTypeDisplays: Record<string, RelationTypeDisplay> = {
  depends_on: {
    label: 'Depends on',
    description: 'These memories rely on the targets they point to.',
  },
  supersedes: {
    label: 'Replaces older memory',
    description: 'These memories update or replace earlier project knowledge.',
  },
  contradicts: {
    label: 'Conflicts with',
    description: 'These memories disagree with their targets and may need review.',
  },
  mentions: {
    label: 'Mentions',
    description: 'These memories mention the target concept or file.',
  },
  implements: {
    label: 'Implements',
    description: 'These memories describe implementation work for their targets.',
  },
  owned_by: {
    label: 'Owned by',
    description: 'These memories point to the owner or responsible area.',
  },
  uses: {
    label: 'Uses or depends on',
    description: 'These memories rely on a component, API, stack, or concept.',
  },
  caused_by: {
    label: 'Caused by',
    description: 'These memories describe something caused by the target.',
  },
  resolved_by: {
    label: 'Resolved by',
    description: 'These memories are answered or fixed by the target.',
  },
  applies_to: {
    label: 'Applies to',
    description: 'These memories concern a file, package, API, or concept.',
  },
  excludes_from: {
    label: 'Excluded from',
    description: 'These memories exclude the target from context or processing.',
  },
}

function getRelationTypeDisplay(type: string): RelationTypeDisplay {
  return (
    relationTypeDisplays[type] ?? {
      label: humanizeRelationType(type),
      description: 'These memories share this relation with their targets.',
    }
  )
}

function humanizeRelationType(type: string): string {
  return type
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function groupKnowledgeRelations(relations: KnowledgeRelation[]): KnowledgeRelationGroup[] {
  const groups = new Map<string, KnowledgeRelationGroup>()

  for (const relation of relations) {
    const key = `${relation.type}|${relation.source}`
    const existing = groups.get(key)

    if (existing) {
      existing.targets = mergeUniqueStrings(existing.targets, [relation.target])
      existing.evidence_ids = mergeUniqueStrings(existing.evidence_ids, relation.evidence_ids)
      existing.relations.push(relation)
      continue
    }

    groups.set(key, {
      id: key,
      source: relation.source,
      type: relation.type,
      targets: [relation.target],
      evidence_ids: mergeUniqueStrings([], relation.evidence_ids),
      relations: [relation],
    })
  }

  return [...groups.values()]
}

function getRelationTargetLabels(
  group: KnowledgeRelationGroup,
  entityById: Map<string, { label: string }>,
  directory: Map<string, Memory | SearchResult>
): string[] {
  return group.targets.map((target) => getKnowledgeEntityLabel(target, entityById, directory))
}

function getKnowledgeEntityLabel(
  entityId: string,
  entityById: Map<string, { label: string }>,
  directory: Map<string, Memory | SearchResult>
): string {
  const entity = entityById.get(entityId)
  const memoryId = getKnowledgeEntityMemoryId(entityId, entity?.label)
  const memory = memoryId ? directory.get(memoryId) : null

  if (entity?.label && !isRawMemoryId(entity.label)) return entity.label
  if (memory) return getMemoryTitle(memory)
  if (memoryId) return formatFallbackMemoryLabel(memoryId)

  return entity?.label ?? entityId
}

function getKnowledgeEntityMemoryId(entityId: string, label?: string): string | null {
  if (isRawMemoryId(entityId)) return entityId
  if (label && isRawMemoryId(label)) return label

  const entityMemoryId = entityId.match(/(?:^|:)(mem_[A-Za-z0-9_-]+)$/)?.[1]
  if (entityMemoryId) return entityMemoryId

  return null
}

function isRawMemoryId(value?: string): boolean {
  return Boolean(value?.match(/^mem_[A-Za-z0-9_-]+$/))
}

function formatFallbackMemoryLabel(memoryId: string): string {
  return `Memory ${memoryId.replace(/^mem_/, '').slice(0, 8)}`
}

function formatRelationTargets(targets: string[]): string {
  if (targets.length <= 3) return targets.join(', ')
  return `${targets.slice(0, 3).join(', ')} + ${targets.length - 3} more`
}

function mergeUniqueStrings(left: string[], right: string[]): string[] {
  return Array.from(new Set([...left, ...right].filter(Boolean)))
}

function GraphMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-muted-foreground">
      <span>{label}</span>
      <strong className="text-foreground">{value}</strong>
    </span>
  )
}

function isDisplayKnowledgeRelation(relation: KnowledgeRelation): boolean {
  return relation.type !== 'mentions' && relation.source !== relation.target
}
