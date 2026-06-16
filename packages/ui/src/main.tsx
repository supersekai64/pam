import './styles.css'

import { Ban, Merge, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { ConsoleHeader } from '@/components/console-header'
import { GovernancePanel } from '@/components/governance-panel'
import { KnowledgeGraphPanel } from '@/components/knowledge-graph-panel'
import { CreateForm, Editor, MemoryModal } from '@/components/memory-modal'
import { Sidebar } from '@/components/sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Hint, MetaTile, Panel } from '@/components/workbench-primitives'
import { api } from '@/lib/api'
import { countLabel, formatDate, getMetadata, nounLabel, toMemory } from '@/lib/memory-view'
import { conceptHints } from '@/lib/ui-copy'
import { cn } from '@/lib/utils'
import { ConceptsPage as ConceptsRoutePage } from '@/pages/concepts-page'
import { ContextPage } from '@/pages/context-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { EvidencePage } from '@/pages/evidence-page'
import { GovernancePage as GovernanceRoutePage } from '@/pages/governance-page'
import { KnowledgePage as KnowledgeRoutePage } from '@/pages/knowledge-page'
import type {
  ApiConceptGraph,
  ApiConceptNode,
  ConceptDepth,
  ConceptGraph,
  ContextPreview,
  GraphDatum,
  GraphEdge,
  KnowledgeGraphResponse,
  MapLayout,
  MemoriesResponse,
  Memory,
  MemoryAction,
  RecommendationsResponse,
  SearchResult,
  StatsResponse,
  Store,
  WorkspaceView,
} from '@/types'

const PROJECT_STORE: Store = 'project'

function App() {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() => getInitialWorkspaceView())
  const [mapLayout, setMapLayout] = useState<MapLayout>('3d')
  const [conceptDepth, setConceptDepth] = useState<ConceptDepth>('top')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('active')
  const [focusedConcept, setFocusedConcept] = useState('')
  const [includeNoise, setIncludeNoise] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Memory | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [memories, setMemories] = useState<Array<Memory | SearchResult>>([])
  const [memoryTotal, setMemoryTotal] = useState(0)
  const [conceptGraph, setConceptGraph] = useState<ApiConceptGraph | null>(null)
  const [contextPreview, setContextPreview] = useState<ContextPreview | null>(null)
  const [statsResponse, setStatsResponse] = useState<StatsResponse | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null)
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphResponse | null>(null)
  const [isIntelligenceLoading, setIsIntelligenceLoading] = useState(false)
  const [intelligenceAttempted, setIntelligenceAttempted] = useState(false)
  const [intelligenceLoaded, setIntelligenceLoaded] = useState(false)
  const [memoryDirectory, setMemoryDirectory] = useState<Map<string, Memory | SearchResult>>(
    () => new Map()
  )
  const [message, setMessage] = useState('')
  const intelligenceRequestRef = useRef<Promise<void> | null>(null)

  const conceptLimit = conceptDepth === 'top' ? 20 : 100
  const activeConcept = getActiveConcept(conceptGraph, focusedConcept)

  const loadStats = useCallback(async () => {
    const params = new URLSearchParams({
      store: PROJECT_STORE,
      includeNoise: String(includeNoise),
    })
    const response = await api<StatsResponse>(`/api/stats?${params.toString()}`)
    setStatsResponse(response)
  }, [includeNoise])

  const loadMemories = useCallback(async () => {
    const params = new URLSearchParams({
      store: PROJECT_STORE,
      includeNoise: String(includeNoise),
      limit: '120',
      status,
    })
    const effectiveQuery = focusedConcept || query
    if (effectiveQuery) params.set('query', effectiveQuery)
    const response = await api<MemoriesResponse>(`/api/memories?${params.toString()}`)
    setMemories(response.memories)
    setMemoryTotal(response.totalMatching)
  }, [focusedConcept, includeNoise, query, status])

  const loadConceptGraph = useCallback(async () => {
    const params = new URLSearchParams({
      store: PROJECT_STORE,
      includeNoise: String(includeNoise),
      limit: String(conceptLimit),
      maxMemories: '18',
    })
    const effectiveQuery = focusedConcept || query
    if (effectiveQuery) params.set('query', effectiveQuery)
    const response = await api<ApiConceptGraph>(`/api/concepts?${params.toString()}`)
    setConceptGraph(response)
  }, [conceptLimit, focusedConcept, includeNoise, query])

  const loadContextPreview = useCallback(async () => {
    const params = new URLSearchParams({
      store: PROJECT_STORE,
      includeNoise: String(includeNoise),
      maxMemories: '18',
    })
    const effectiveQuery = focusedConcept || query
    if (effectiveQuery) params.set('query', effectiveQuery)
    const response = await api<ContextPreview>(`/api/context-preview?${params.toString()}`)
    setContextPreview(response)
  }, [focusedConcept, includeNoise, query])

  const loadIntelligence = useCallback(async () => {
    if (intelligenceRequestRef.current) return intelligenceRequestRef.current

    const params = new URLSearchParams({ store: PROJECT_STORE })
    const directoryParams = new URLSearchParams({
      store: PROJECT_STORE,
      includeNoise: 'true',
      status: 'all',
      limit: '2000',
    })

    setIsIntelligenceLoading(true)

    const recommendationRequest = api<RecommendationsResponse>(
      `/api/recommendations?${params.toString()}`
    ).then((recommendationResponse) => {
      setRecommendations(recommendationResponse)
    })
    const graphRequest = api<KnowledgeGraphResponse>(
      `/api/knowledge-graph?${params.toString()}`
    ).then((graphResponse) => {
      setKnowledgeGraph(graphResponse)
    })
    const directoryRequest = api<MemoriesResponse>(
      `/api/memories?${directoryParams.toString()}`
    ).then((directoryResponse) => {
      setMemoryDirectory(
        new Map(directoryResponse.memories.map((memory) => [getMetadata(memory).id, memory]))
      )
    })

    const request = Promise.allSettled([recommendationRequest, graphRequest, directoryRequest])
      .then((results) => {
        if (results.some((result) => result.status === 'rejected')) return

        setIntelligenceLoaded(true)
      })
      .finally(() => {
        setIntelligenceAttempted(true)
        intelligenceRequestRef.current = null
        setIsIntelligenceLoading(false)
      })

    intelligenceRequestRef.current = request
    return request
  }, [])

  const refresh = useCallback(async () => {
    const baseRefresh = Promise.all([
      loadStats(),
      loadMemories(),
      loadConceptGraph(),
      loadContextPreview(),
    ])
    if (workspaceView === 'knowledge' || workspaceView === 'governance') {
      await Promise.all([baseRefresh, loadIntelligence()])
      return
    }

    await baseRefresh
  }, [
    loadConceptGraph,
    loadContextPreview,
    loadIntelligence,
    loadMemories,
    loadStats,
    workspaceView,
  ])

  const selectMemory = useCallback(async (id: string) => {
    setSelectedId(id)
    setIsCreating(false)
    const response = await api<{ memory: Memory }>(`/api/memories/${id}?store=${PROJECT_STORE}`)
    setSelected(response.memory)
  }, [])

  const closeMemoryModal = useCallback(() => {
    setSelected(null)
    setSelectedId(null)
    setIsCreating(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (intelligenceLoaded || intelligenceAttempted || isIntelligenceLoading) return

    const timeout = window.setTimeout(() => {
      void loadIntelligence().catch(() => undefined)
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [intelligenceAttempted, intelligenceLoaded, isIntelligenceLoading, loadIntelligence])

  useEffect(() => {
    if (!selectedId) return
    void selectMemory(selectedId)
  }, [selectMemory, selectedId])

  useEffect(() => {
    const onLocationChange = () => {
      const nextView = getInitialWorkspaceView()
      setWorkspaceView(nextView)
    }

    window.addEventListener('hashchange', onLocationChange)
    window.addEventListener('popstate', onLocationChange)
    return () => {
      window.removeEventListener('hashchange', onLocationChange)
      window.removeEventListener('popstate', onLocationChange)
    }
  }, [])

  const clearFocus = () => {
    setFocusedConcept('')
    setQuery('')
    setStatus('active')
    setSelected(null)
    setSelectedId(null)
    setIsCreating(false)
    setMessage('')
  }

  const clearConceptFocus = () => {
    setFocusedConcept('')
    setQuery('')
    setMessage('')
  }

  const changeWorkspaceView = (view: WorkspaceView) => {
    if (view !== workspaceView) {
      clearConceptFocus()
    }
    setWorkspaceView(view)
    if (window.location.hash !== `#/${view}`) {
      window.history.pushState(null, '', `#/${view}`)
    }
  }

  const openStatusFilter = (nextStatus: string) => {
    setFocusedConcept('')
    setQuery('')
    setStatus(nextStatus)
    setSelected(null)
    setSelectedId(null)
    setIsCreating(false)
    setMessage('')
    setWorkspaceView('evidence')
    if (window.location.hash !== '#/evidence') {
      window.history.pushState(null, '', '#/evidence')
    }
  }

  const focusConcept = (concept: string) => {
    setFocusedConcept(concept)
    setQuery('')
    setStatus('active')
    setSelected(null)
    setSelectedId(null)
    setIsCreating(false)
    setWorkspaceView('evidence')
    setMessage('')
  }

  async function createFromForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const content = String(data.get('content') ?? '').trim()
    if (!content) return

    const response = await api<{ memory: Memory }>(`/api/memories?store=${PROJECT_STORE}`, {
      method: 'POST',
      body: JSON.stringify({
        type: data.get('type'),
        scope: PROJECT_STORE,
        title: String(data.get('title') ?? '').trim(),
        tags: parseTags(String(data.get('tags') ?? '')),
        content,
        source: 'ui',
      }),
    })
    setMessage(`Created ${response.memory.metadata.id}`)
    setSelected(response.memory)
    setSelectedId(response.memory.metadata.id)
    setIsCreating(false)
    form.reset()
    await refresh()
  }

  async function updateMemoryFromForm(
    memoryLike: Memory | SearchResult,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const memory = toMemory(memoryLike)
    const data = new FormData(event.currentTarget)
    const response = await api<{ memory: Memory }>(
      `/api/memories/${memory.metadata.id}?store=${PROJECT_STORE}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          type: data.get('type'),
          scope: PROJECT_STORE,
          title: data.get('title') === null ? undefined : String(data.get('title') ?? '').trim(),
          tags: parseTags(String(data.get('tags') ?? '')),
          content: String(data.get('content') ?? ''),
        }),
      }
    )
    if (selected?.metadata.id === memory.metadata.id) {
      setSelected(response.memory)
    }
    setMessage(`Updated ${response.memory.metadata.id}`)
    await refresh()
  }

  async function updateFromForm(event: FormEvent<HTMLFormElement>) {
    if (!selected) {
      event.preventDefault()
      return
    }

    await updateMemoryFromForm(selected, event)
  }

  async function runMemoryAction(memoryLike: Memory | SearchResult, action: MemoryAction) {
    const memory = toMemory(memoryLike)
    const id = memory.metadata.id

    if (action === 'mark-noise') {
      const tags = Array.from(new Set([...memory.metadata.tags, 'pamh-noise']))
      const response = await api<{ memory: Memory }>(`/api/memories/${id}?store=${PROJECT_STORE}`, {
        method: 'PATCH',
        body: JSON.stringify({
          type: memory.metadata.type,
          scope: PROJECT_STORE,
          status: 'noise',
          tags,
          content: memory.content,
        }),
      })
      if (selected?.metadata.id === id) {
        setSelected(response.memory)
      }
      setMessage(`Marked as noise ${id}`)
      await refresh()
      return
    }

    if (action === 'delete' || action === 'physical-delete') {
      if (action === 'physical-delete') {
        const confirmation = window.prompt(`Type ${id} to permanently delete this memory.`)
        if (confirmation !== id) {
          setMessage(`Physical delete cancelled for ${id}`)
          return
        }
      }

      await api(
        `/api/memories/${id}?store=${PROJECT_STORE}&physical=${action === 'physical-delete'}`,
        {
          method: 'DELETE',
        }
      )
      setMessage(action === 'physical-delete' ? `Physically deleted ${id}` : `Deleted ${id}`)
      if (selected?.metadata.id === id) {
        setSelected(null)
        setSelectedId(null)
      }
    } else {
      const response = await api<{ memory?: Memory }>(
        `/api/memories/${id}/${action}?store=${PROJECT_STORE}`,
        {
          method: 'POST',
        }
      )
      setMessage(`${pastTenseAction(action)} ${id}`)
      if (response.memory && selected?.metadata.id === id) {
        setSelected(response.memory)
      }
      if ((action === 'approve' || action === 'reject') && selected?.metadata.id === id) {
        setSelected(null)
        setSelectedId(null)
      }
    }

    await refresh()
  }

  async function runAction(action: MemoryAction) {
    if (!selected) return

    await runMemoryAction(selected, action)
  }

  async function ignoreConcept(concept: string) {
    await api(`/api/concepts/${encodeURIComponent(concept)}/ignore?store=${PROJECT_STORE}`, {
      method: 'POST',
    })
    setMessage(`Ignored concept: ${concept}`)
    clearFocus()
    await refresh()
  }

  async function consolidateConcept(concept: string) {
    const response = await api<{ memory: Memory }>(
      `/api/concepts/${encodeURIComponent(concept)}/consolidate?store=${PROJECT_STORE}`,
      { method: 'POST' }
    )
    clearConceptFocus()
    setSelectedId(response.memory.metadata.id)
    setWorkspaceView('evidence')
    setMessage(`Created consolidated memory ${response.memory.metadata.id}`)
    await refresh()
  }

  async function handleRecommendation(id: string, action: 'apply' | 'reject' | 'defer') {
    const response = await api<{ memory?: Memory | null }>(
      `/api/recommendations/${id}/${action}?store=${PROJECT_STORE}`,
      { method: 'POST' }
    )
    const labels = { apply: 'Applied', reject: 'Rejected', defer: 'Deferred' }
    if (action === 'apply' && response.memory) {
      setSelected(response.memory)
      setSelectedId(response.memory.metadata.id)
      setStatus(response.memory.metadata.status)
      setWorkspaceView('evidence')
      setMessage(
        response.memory.metadata.status === 'proposed'
          ? `Created proposed memory ${response.memory.metadata.id}. Approve it to include it in the LLM context.`
          : `Applied recommendation ${id}`
      )
    } else {
      setMessage(`${labels[action]} recommendation ${id}`)
    }
    await refresh()
  }

  async function preferContradiction(id: string, preferredId: string) {
    await api(`/api/recommendations/${id}/prefer?store=${PROJECT_STORE}`, {
      method: 'POST',
      body: JSON.stringify({ preferredId }),
    })
    setMessage(`Resolved contradiction by keeping ${preferredId}`)
    await refresh()
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="grid min-h-screen w-full grid-cols-[16rem_minmax(0,1fr)] gap-3 p-3 lg:h-screen max-lg:grid-cols-1">
          <Sidebar
            selectedStatus={status}
            stats={statsResponse?.stats ?? null}
            view={workspaceView}
            onStatusSelect={openStatusFilter}
            onViewChange={changeWorkspaceView}
          />

          <main className="flex min-h-0 min-w-0 flex-col rounded-md bg-card p-4 shadow-sm">
            <ConsoleHeader
              onCreateMemory={() => {
                setSelected(null)
                setSelectedId(null)
                setIsCreating(true)
                changeWorkspaceView('evidence')
              }}
            />

            {message ? (
              <StatusMessage onClose={() => setMessage('')}>{message}</StatusMessage>
            ) : null}

            <FocusBar
              concept={focusedConcept}
              activeConcept={activeConcept}
              onClear={clearFocus}
              onConsolidate={consolidateConcept}
              onIgnore={ignoreConcept}
            />

            <div className="min-h-0 flex-1">
              <PageRouter
                activeConcept={activeConcept}
                conceptDepth={conceptDepth}
                conceptGraph={conceptGraph}
                contextPreview={contextPreview}
                directory={memoryDirectory}
                focusedConcept={focusedConcept}
                includeNoise={includeNoise}
                knowledgeGraph={knowledgeGraph}
                intelligenceLoading={!intelligenceAttempted || isIntelligenceLoading}
                mapLayout={mapLayout}
                memories={memories}
                recommendations={recommendations}
                selectedId={selectedId}
                statsResponse={statsResponse}
                status={status}
                totalMatching={memoryTotal}
                view={workspaceView}
                query={focusedConcept || query}
                onClearFocus={clearFocus}
                onConceptDepthChange={setConceptDepth}
                onConceptSelect={focusConcept}
                onEvidenceOpen={(id) => {
                  void selectMemory(id)
                }}
                onEvidenceAction={(memory, action) => {
                  void runMemoryAction(memory, action)
                }}
                onEvidenceUpdate={(memory, event) => {
                  void updateMemoryFromForm(memory, event)
                }}
                onGoToPage={changeWorkspaceView}
                onIgnoreConcept={ignoreConcept}
                onIncludeNoiseChange={setIncludeNoise}
                onMapLayoutChange={setMapLayout}
                onPreferContradiction={preferContradiction}
                onQueryChange={(value) => {
                  setFocusedConcept('')
                  setQuery(value)
                }}
                onRecommendationAction={handleRecommendation}
                onSelectMemory={selectMemory}
                onStatusChange={setStatus}
                onConsolidateConcept={consolidateConcept}
              />
            </div>

            <MemoryModal
              eyebrow={selected ? selected.metadata.id : isCreating ? 'Create' : 'Evidence'}
              open={Boolean(selected) || isCreating}
              title={
                selected
                  ? selected.metadata.status === 'proposed'
                    ? 'Review memory'
                    : 'Memory inspector'
                  : 'New memory'
              }
              onClose={closeMemoryModal}
            >
              {selected ? (
                <Editor
                  key={selected.metadata.id}
                  memory={selected}
                  onAction={runAction}
                  onUpdate={updateFromForm}
                />
              ) : isCreating ? (
                <CreateForm onCreate={createFromForm} />
              ) : null}
            </MemoryModal>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

function PageRouter({
  activeConcept,
  conceptDepth,
  conceptGraph,
  contextPreview,
  directory,
  focusedConcept,
  includeNoise,
  intelligenceLoading,
  knowledgeGraph,
  mapLayout,
  memories,
  onClearFocus,
  onConceptDepthChange,
  onEvidenceAction,
  onConceptSelect,
  onConsolidateConcept,
  onEvidenceOpen,
  onEvidenceUpdate,
  onGoToPage,
  onIgnoreConcept,
  onIncludeNoiseChange,
  onMapLayoutChange,
  onPreferContradiction,
  onQueryChange,
  onRecommendationAction,
  onSelectMemory,
  onStatusChange,
  query,
  recommendations,
  selectedId,
  statsResponse,
  status,
  totalMatching,
  view,
}: {
  activeConcept: ApiConceptNode | null
  conceptDepth: ConceptDepth
  conceptGraph: ApiConceptGraph | null
  contextPreview: ContextPreview | null
  directory: Map<string, Memory | SearchResult>
  focusedConcept: string
  includeNoise: boolean
  intelligenceLoading: boolean
  knowledgeGraph: KnowledgeGraphResponse | null
  mapLayout: MapLayout
  memories: Array<Memory | SearchResult>
  onClearFocus: () => void
  onConceptDepthChange: (depth: ConceptDepth) => void
  onEvidenceAction: (memory: Memory | SearchResult, action: MemoryAction) => void
  onConceptSelect: (concept: string) => void
  onConsolidateConcept: (concept: string) => void
  onEvidenceOpen: (id: string) => void
  onEvidenceUpdate: (memory: Memory | SearchResult, event: FormEvent<HTMLFormElement>) => void
  onGoToPage: (view: WorkspaceView) => void
  onIgnoreConcept: (concept: string) => void
  onIncludeNoiseChange: (includeNoise: boolean) => void
  onMapLayoutChange: (layout: MapLayout) => void
  onPreferContradiction: (id: string, preferredId: string) => void
  onQueryChange: (query: string) => void
  onRecommendationAction: (id: string, action: 'apply' | 'reject' | 'defer') => void
  onSelectMemory: (id: string) => void
  onStatusChange: (status: string) => void
  query: string
  recommendations: RecommendationsResponse | null
  selectedId: string | null
  statsResponse: StatsResponse | null
  status: string
  totalMatching: number
  view: WorkspaceView
}) {
  if (view === 'dashboard') {
    return (
      <DashboardPage
        conceptGraph={conceptGraph}
        contextPreview={contextPreview}
        memoryTotal={totalMatching}
        onContextOpen={() => onGoToPage('context')}
        onEvidenceOpen={() => onGoToPage('evidence')}
        statsResponse={statsResponse}
      />
    )
  }

  if (view === 'map') {
    return (
      <ConceptsRoutePage
        activeConcept={activeConcept}
        components={{
          ConceptInspector,
          NeuralMapPanel,
        }}
        conceptDepth={conceptDepth}
        conceptGraph={conceptGraph}
        focusedConcept={focusedConcept}
        mapLayout={mapLayout}
        onClearFocus={onClearFocus}
        onConceptDepthChange={onConceptDepthChange}
        onConceptSelect={onConceptSelect}
        onConsolidate={onConsolidateConcept}
        onIgnore={onIgnoreConcept}
        onMapLayoutChange={onMapLayoutChange}
      />
    )
  }

  if (view === 'evidence') {
    return (
      <EvidencePage
        activeConcept={activeConcept}
        focusedConcept={focusedConcept}
        memories={memories}
        onClearFocus={onClearFocus}
        onQueryChange={onQueryChange}
        onSelect={onSelectMemory}
        onStatusChange={onStatusChange}
        query={query}
        selectedId={selectedId}
        status={status}
        totalMatching={totalMatching}
      />
    )
  }

  if (view === 'context') {
    return <ContextPage contextPreview={contextPreview} focusedConcept={focusedConcept} />
  }

  if (view === 'knowledge') {
    return (
      <KnowledgeRoutePage
        KnowledgeGraphPanel={KnowledgeGraphPanel}
        directory={directory}
        graph={knowledgeGraph}
        loading={intelligenceLoading}
        onEvidenceAction={onEvidenceAction}
        onEvidenceUpdate={onEvidenceUpdate}
      />
    )
  }

  return (
    <GovernanceRoutePage
      GovernancePanel={GovernancePanel}
      conceptGraph={conceptGraph}
      directory={directory}
      includeNoise={includeNoise}
      loading={intelligenceLoading}
      onEvidenceSelect={onEvidenceOpen}
      onIncludeNoiseChange={onIncludeNoiseChange}
      onPreferContradiction={onPreferContradiction}
      onRecommendationAction={onRecommendationAction}
      recommendations={recommendations}
      statsResponse={statsResponse}
    />
  )
}

function StatusMessage({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
      <span>{children}</span>
      <button className="text-primary/80 hover:text-foreground" type="button" onClick={onClose}>
        <X className="size-4" />
      </button>
    </div>
  )
}

function FocusBar({
  activeConcept,
  concept,
  onClear,
  onConsolidate,
  onIgnore,
}: {
  activeConcept: ApiConceptNode | null
  concept: string
  onClear: () => void
  onConsolidate: (concept: string) => void
  onIgnore: (concept: string) => void
}) {
  if (!concept) return null

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/25 bg-primary/8 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Focused concept</Badge>
        <strong className="text-foreground">{activeConcept?.title ?? concept}</strong>
        <span className="text-muted-foreground">
          {activeConcept
            ? countLabel(activeConcept.occurrences, 'evidence memory', 'evidence memories')
            : 'evidence view'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Hint label={conceptHints.consolidate}>
          <Button size="sm" variant="outline" onClick={() => onConsolidate(concept)}>
            <Merge />
            Consolidate
          </Button>
        </Hint>
        <Hint label={conceptHints.markNoise}>
          <Button size="sm" variant="outline" onClick={() => onIgnore(concept)}>
            <Ban />
            Mark noise
          </Button>
        </Hint>
        <Hint label="Clear the focused concept and return to the full evidence list.">
          <Button size="sm" variant="outline" onClick={onClear}>
            <X />
            Clear focus
          </Button>
        </Hint>
      </div>
    </div>
  )
}

function NeuralMapPanel({
  conceptDepth,
  conceptGraph,
  focusedConcept,
  mapLayout,
  onClearFocus,
  onConceptDepthChange,
  onConceptSelect,
  onIgnore,
  onMapLayoutChange,
}: {
  conceptDepth: ConceptDepth
  conceptGraph: ApiConceptGraph | null
  focusedConcept: string
  mapLayout: MapLayout
  onClearFocus: () => void
  onConceptDepthChange: (depth: ConceptDepth) => void
  onConceptSelect: (concept: string) => void
  onIgnore: (concept: string) => void
  onMapLayoutChange: (layout: MapLayout) => void
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card max-xl:min-h-[32rem]">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            LLM context map
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {countLabel(conceptGraph?.concepts.length ?? 0, 'concept', 'concepts')} from{' '}
            {countLabel(conceptGraph?.totalMemories ?? 0, 'context memory', 'context memories')}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={[
              { label: '2D', value: '2d' },
              { label: '3D', value: '3d' },
            ]}
            value={mapLayout}
            onChange={(value) => onMapLayoutChange(value as MapLayout)}
          />
          <SegmentedControl
            options={[
              { label: 'Top 20', value: 'top' },
              { label: 'Top 100', value: 'expanded' },
            ]}
            value={conceptDepth}
            onChange={(value) => onConceptDepthChange(value as ConceptDepth)}
          />
          {focusedConcept ? (
            <>
              <Hint label={conceptHints.markNoise}>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => onIgnore(focusedConcept)}
                >
                  <Ban />
                  Mark noise
                </Button>
              </Hint>
              <Button size="sm" type="button" variant="outline" onClick={onClearFocus}>
                <X />
                Clear
              </Button>
            </>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-4 border-b border-border px-4 py-2 text-sm text-muted-foreground">
        <LegendDot className="bg-primary" label="primary concept" />
        <LegendDot className="bg-primary" label="tag signal" />
        <LegendDot className="bg-secondary" label="keyword signal" />
        <LegendLine label="co-occurrence link" />
      </div>
      <MemoryGraph
        conceptGraph={conceptGraph}
        focusedConcept={focusedConcept}
        mapLayout={mapLayout}
        onConceptSelect={onConceptSelect}
      />
    </section>
  )
}

function SegmentedControl({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="flex rounded-md border border-border bg-background/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          className={cn(
            'h-8 rounded-sm px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground',
            value === option.value && 'bg-muted text-foreground'
          )}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function ConceptInspector({
  concept,
  conceptGraph,
  focusedConcept,
  onConceptSelect,
  onConsolidate,
  onIgnore,
}: {
  concept: ApiConceptNode | null
  conceptGraph: ApiConceptGraph | null
  focusedConcept: string
  onConceptSelect: (concept: string) => void
  onConsolidate: (concept: string) => void
  onIgnore: (concept: string) => void
}) {
  if (!concept) {
    return (
      <Panel
        title="Context concepts"
        eyebrow="LLM signal"
        className="flex min-h-0 flex-col max-xl:min-h-[24rem]"
        contentClassName="min-h-0 flex-1 overflow-hidden"
      >
        <ScrollArea className="h-full">
          <div className="grid gap-2 pr-3">
            {(conceptGraph?.concepts ?? []).slice(0, 12).map((item) => (
              <button
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-sm border border-border bg-muted/35 px-3 py-2 text-left transition hover:border-primary/35 hover:bg-muted/60"
                type="button"
                onClick={() => onConceptSelect(item.searchTerm)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {countLabel(item.occurrences, 'memory', 'memories')} /{' '}
                    {Object.keys(item.typeCounts).slice(0, 2).join(', ')}
                  </span>
                </span>
                <Badge className="bg-muted text-foreground hover:bg-muted">#{item.rank}</Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Panel>
    )
  }

  return (
    <Panel
      title={concept.title}
      eyebrow="Focused concept"
      className="flex min-h-0 flex-col max-xl:min-h-[24rem]"
      contentClassName="min-h-0 flex-1 overflow-hidden"
    >
      <ScrollArea className="h-full">
        <div className="grid gap-4 pr-3">
          <div className="grid grid-cols-3 gap-2">
            <MetaTile
              label={nounLabel(concept.occurrences, 'Memory', 'Memories')}
              value={String(concept.occurrences)}
            />
            <MetaTile label="Strength" value={String(Math.round(concept.score))} />
            <MetaTile
              label="Updated"
              value={concept.lastUpdated ? formatDate(concept.lastUpdated) : 'unknown'}
            />
          </div>
          <CountList label="Types" values={concept.typeCounts} />
          <div className="flex flex-wrap gap-2">
            {concept.evidence.map((item) => (
              <Badge key={item} className="bg-primary/10 text-primary hover:bg-primary/10">
                {item}
              </Badge>
            ))}
          </div>
          <div className="grid gap-2">
            {concept.samples.slice(0, 3).map((sample) => (
              <div key={sample.id} className="rounded-md border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{sample.type}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(sample.updated_at)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {sample.content}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Hint label={conceptHints.consolidate}>
              <Button onClick={() => onConsolidate(focusedConcept)}>
                <Merge />
                Consolidate
              </Button>
            </Hint>
            <Hint label={conceptHints.markNoise}>
              <Button variant="outline" onClick={() => onIgnore(focusedConcept)}>
                <Ban />
                Mark noise
              </Button>
            </Hint>
          </div>
        </div>
      </ScrollArea>
    </Panel>
  )
}

function CountList({ label, values }: { label: string; values: Record<string, number> }) {
  const entries = Object.entries(values)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="grid gap-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">{key}</span>
            <span className="text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center text-sm gap-1.5">
      <span className={cn('size-2 rounded-full', className)} />
      {label}
    </span>
  )
}

function LegendLine({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-px w-5 bg-primary/70" />
      {label}
    </span>
  )
}

function MemoryGraph({
  conceptGraph,
  focusedConcept,
  mapLayout,
  onConceptSelect,
}: {
  conceptGraph: ApiConceptGraph | null
  focusedConcept: string
  mapLayout: MapLayout
  onConceptSelect: (concept: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onConceptSelectRef = useRef(onConceptSelect)

  useEffect(() => {
    onConceptSelectRef.current = onConceptSelect
  }, [onConceptSelect])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const graph = new MemoryGraphView(
      container,
      conceptGraph,
      focusedConcept,
      mapLayout,
      (concept) => {
        onConceptSelectRef.current(concept)
      }
    )
    return () => graph.dispose()
  }, [conceptGraph, focusedConcept, mapLayout])

  return (
    <div
      ref={containerRef}
      className="memory-graph min-h-0 flex-1 overflow-hidden max-xl:min-h-96 max-md:min-h-80"
      role="img"
      aria-label="Interactive network of strong memory concepts"
    />
  )
}

class MemoryGraphView {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000)
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  private controls: OrbitControls | null = null
  private readonly root = new THREE.Group()
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly interactive: THREE.Object3D[] = []
  private readonly tooltip = document.createElement('div')
  private readonly resizeObserver: ResizeObserver
  private frame = 0
  private hover: THREE.Object3D | null = null
  private pointerDown: {
    button: number
    object: THREE.Object3D | null
    time: number
    x: number
    y: number
  } | null = null
  private pointerMoved = false

  constructor(
    private readonly container: HTMLDivElement,
    conceptGraph: ApiConceptGraph | null,
    focusedConcept: string,
    private readonly mapLayout: MapLayout,
    private readonly onConceptSelect: (concept: string) => void
  ) {
    this.container.innerHTML = ''
    if (!conceptGraph?.concepts.length) {
      container.innerHTML =
        '<p class="grid h-full min-h-80 place-items-center text-sm text-muted-foreground">No concepts in the current LLM context.</p>'
      this.resizeObserver = new ResizeObserver(() => undefined)
      return
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.className = 'memory-graph-canvas'
    this.container.append(this.renderer.domElement)

    this.tooltip.className = 'graph-tooltip'
    this.container.append(this.tooltip)

    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = true
    controls.enableZoom = true
    controls.enableRotate = mapLayout === '3d'
    controls.autoRotate = mapLayout === '3d'
    controls.autoRotateSpeed = 0.22
    controls.minDistance = 3.5
    controls.maxDistance = 42
    this.controls = controls

    this.scene.add(this.root)
    this.scene.add(new THREE.AmbientLight(themeColorNumber('--graph-light'), 1.7))
    const keyLight = new THREE.DirectionalLight(themeColorNumber('--graph-light'), 2)
    keyLight.position.set(8, 12, 10)
    this.scene.add(keyLight)

    const graph = this.build(conceptGraph, focusedConcept)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    this.resize()
    this.positionCamera(graph, focusedConcept)

    this.container.addEventListener('pointerdown', this.handlePointerDown)
    this.container.addEventListener('pointermove', this.handlePointerMove)
    this.container.addEventListener('pointerup', this.handlePointerUp)
    this.container.addEventListener('pointerleave', this.handlePointerLeave)
    this.controls.addEventListener('start', this.handleControlsStart)
    this.controls.addEventListener('end', this.handleControlsEnd)
    this.animate()
  }

  dispose(): void {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    this.container.removeEventListener('pointerdown', this.handlePointerDown)
    this.container.removeEventListener('pointermove', this.handlePointerMove)
    this.container.removeEventListener('pointerup', this.handlePointerUp)
    this.container.removeEventListener('pointerleave', this.handlePointerLeave)
    this.controls?.removeEventListener('start', this.handleControlsStart)
    this.controls?.removeEventListener('end', this.handleControlsEnd)
    this.controls?.dispose()
    this.root.traverse((object) => {
      const mesh = object as THREE.Mesh
      mesh.geometry?.dispose()
      const material = mesh.material
      if (Array.isArray(material)) material.forEach((item) => item.dispose())
      else material?.dispose()
    })
    this.renderer.dispose()
  }

  private build(conceptGraph: ApiConceptGraph, focusedConcept: string): ConceptGraph {
    const graph = buildClientConceptGraph(conceptGraph, focusedConcept, this.mapLayout)
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    const edgePositions: number[] = []

    graph.edges.forEach((edge) => {
      const source = nodeById.get(edge.source)
      const target = nodeById.get(edge.target)
      if (!source || !target) return
      edgePositions.push(
        source.position.x,
        source.position.y,
        source.position.z,
        target.position.x,
        target.position.y,
        target.position.z
      )
    })

    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3))
    this.root.add(
      new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({
          color: themeColorNumber('--graph-link'),
          transparent: true,
          opacity: 0.26,
        })
      )
    )

    graph.nodes.forEach((node, index) => {
      const geometry =
        node.category === 'tag'
          ? new THREE.IcosahedronGeometry(node.radius, 2)
          : new THREE.SphereGeometry(node.radius, 18, 18)
      const material = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: node.searchTerm === focusedConcept ? 0.45 : index < 5 ? 0.24 : 0.1,
        roughness: 0.42,
        metalness: 0.06,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(node.position)
      mesh.userData = node
      this.root.add(mesh)
      this.interactive.push(mesh)

      if (node.labelVisible || node.searchTerm === focusedConcept) {
        const label = createTextSprite(node.title, node.searchTerm === focusedConcept)
        label.position.copy(node.position).add(new THREE.Vector3(0, node.radius + 0.32, 0))
        this.root.add(label)
      }

      if (index < 5 || node.searchTerm === focusedConcept) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(node.radius + 0.12, 0.012, 8, 56),
          new THREE.MeshBasicMaterial({
            color:
              node.searchTerm === focusedConcept
                ? themeColorNumber('--graph-primary')
                : themeColorNumber('--graph-accent'),
          })
        )
        ring.position.copy(node.position)
        ring.rotation.x = this.mapLayout === '2d' ? 0 : Math.PI / 2
        this.root.add(ring)
      }
    })

    return graph
  }

  private positionCamera(graph: ConceptGraph, focusedConcept: string): void {
    const focused = graph.nodes.find((node) => node.searchTerm === focusedConcept)
    const bounds = new THREE.Box3().setFromPoints(graph.nodes.map((node) => node.position))
    const target = focused?.position ?? bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov)
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * this.camera.aspect)
    const fitWidth = Math.max(size.x * 0.5 + 2.2, 3.6) / Math.tan(horizontalFov * 0.5)
    const fitHeight = Math.max(size.y * 0.5 + 1.15, 2.1) / Math.tan(verticalFov * 0.5)
    const distanceToFit = Math.max(fitWidth, fitHeight, 6.3 + size.z * 0.2)
    const distance = focused ? 7.5 : THREE.MathUtils.clamp(distanceToFit, 6.5, 15)

    if (this.mapLayout === '2d') {
      this.camera.position.set(target.x, target.y, distance)
    } else {
      this.camera.position.set(
        target.x + distance * 0.16,
        target.y + distance * 0.24,
        target.z + distance
      )
    }
    this.camera.lookAt(target)
    if (this.controls) this.controls.target.copy(target)
  }

  private resize(): void {
    const width = Math.max(this.container.clientWidth, 320)
    const height = Math.max(this.container.clientHeight, 320)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
  }

  private animate = (): void => {
    this.frame = requestAnimationFrame(this.animate)
    this.controls?.update()
    this.renderer.render(this.scene, this.camera)
  }

  private handleControlsStart = (): void => {
    if (this.controls) this.controls.autoRotate = false
  }

  private handleControlsEnd = (): void => {
    window.setTimeout(() => {
      if (this.controls && this.mapLayout === '3d') this.controls.autoRotate = true
    }, 2500)
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const rect = this.container.getBoundingClientRect()
    this.pointerDown = {
      button: event.button,
      object: this.getHitFromEvent(event, rect),
      time: performance.now(),
      x: event.clientX,
      y: event.clientY,
    }
    this.pointerMoved = false
  }

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.pointerDown) {
      const movement = Math.hypot(
        event.clientX - this.pointerDown.x,
        event.clientY - this.pointerDown.y
      )
      if (movement > 7) this.pointerMoved = true
    }

    const rect = this.container.getBoundingClientRect()
    const hit = this.getHitFromEvent(event, rect)
    if (hit !== this.hover) this.setHover(hit)

    if (hit) {
      const data = hit.userData as GraphDatum
      this.tooltip.innerHTML = data.detailHtml
      this.tooltip.style.left = `${event.clientX - rect.left + 14}px`
      this.tooltip.style.top = `${event.clientY - rect.top + 14}px`
    }
  }

  private handlePointerLeave = (): void => {
    this.pointerDown = null
    this.pointerMoved = false
    this.setHover(null)
  }

  private handlePointerUp = (event: PointerEvent): void => {
    const start = this.pointerDown
    this.pointerDown = null
    if (!start || start.button !== 0) return

    const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    const elapsed = performance.now() - start.time
    if (this.pointerMoved || movement > 7 || elapsed < 90) return

    const rect = this.container.getBoundingClientRect()
    const hit = this.getHitFromEvent(event, rect)
    if (hit !== this.hover) this.setHover(hit)
    if (!hit || hit !== start.object) return

    const data = hit?.userData as GraphDatum | undefined
    if (data) this.onConceptSelect(data.searchTerm)
  }

  private getHitFromEvent(event: PointerEvent, rect: DOMRect): THREE.Object3D | null {
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    this.raycaster.setFromCamera(this.pointer, this.camera)

    return this.raycaster.intersectObjects(this.interactive, false)[0]?.object ?? null
  }

  private setHover(object: THREE.Object3D | null): void {
    if (this.hover) this.hover.scale.setScalar(1)
    this.hover = object
    this.tooltip.classList.toggle('visible', Boolean(object))
    this.container.classList.toggle('can-select-concept', Boolean(object))
    if (object) object.scale.setScalar(1.35)
  }
}

const CONCEPT_LABEL_LIMIT = 8

function buildClientConceptGraph(
  conceptGraph: ApiConceptGraph,
  focusedConcept: string,
  mapLayout: MapLayout
): ConceptGraph {
  const maxScore = Math.max(...conceptGraph.concepts.map((concept) => concept.score), 1)
  const nodes = conceptGraph.concepts.map((concept, index): GraphDatum => {
    const normalizedScore = Math.log(concept.score + 1) / Math.log(maxScore + 1)
    const isFocused = concept.searchTerm === focusedConcept

    return {
      id: concept.id,
      title: concept.title,
      category: concept.category,
      color: isFocused
        ? themeColorNumber('--graph-primary')
        : colorForConcept(concept.category, index),
      radius: isFocused ? 0.32 : 0.07 + normalizedScore * 0.18,
      position: new THREE.Vector3(),
      searchTerm: concept.searchTerm,
      score: concept.score,
      occurrences: concept.occurrences,
      labelVisible: isFocused || index < CONCEPT_LABEL_LIMIT,
      detailHtml: conceptTooltipHtml(concept),
    }
  })
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = conceptGraph.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  )

  positionConceptNodes(nodes, edges, focusedConcept, mapLayout)

  return {
    nodes,
    edges,
    maxEdgeWeight: Math.max(...edges.map((edge) => edge.weight), 1),
  }
}

function conceptTooltipHtml(concept: ApiConceptNode): string {
  const types = Object.entries(concept.typeCounts)
    .slice(0, 3)
    .map(([key, value]) => `${escapeHtml(key)} ${value}`)
    .join(' / ')
  const sample = concept.samples[0]?.content
  return [
    `<strong>${escapeHtml(concept.title)}</strong>`,
    `<span>${escapeHtml(countLabel(concept.occurrences, 'memory', 'memories'))} / strength ${Math.round(concept.score)}</span>`,
    types ? `<span>${types}</span>` : '',
    concept.lastUpdated
      ? `<span>updated ${escapeHtml(formatDate(concept.lastUpdated))}</span>`
      : '',
    sample ? `<span>${escapeHtml(sample)}</span>` : '',
  ]
    .filter(Boolean)
    .join('')
}

function getActiveConcept(
  conceptGraph: ApiConceptGraph | null,
  focusedConcept: string
): ApiConceptNode | null {
  if (!conceptGraph) return null
  if (!focusedConcept) return null
  return conceptGraph.concepts.find((concept) => concept.searchTerm === focusedConcept) ?? null
}

function getInitialWorkspaceView(): WorkspaceView {
  const route = window.location.hash.replace(/^#\/?/, '')
  const knownViews = new Set<WorkspaceView>([
    'dashboard',
    'map',
    'evidence',
    'context',
    'governance',
    'knowledge',
  ])
  return knownViews.has(route as WorkspaceView) ? (route as WorkspaceView) : 'dashboard'
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`
}

function colorForConcept(category: 'tag' | 'keyword', index: number): number {
  if (index === 0) return themeColorNumber('--graph-primary')
  if (index === 1) return themeColorNumber('--graph-secondary')
  if (index === 2) return themeColorNumber('--graph-tertiary')
  if (index === 3) return themeColorNumber('--graph-accent')
  if (index === 4) return themeColorNumber('--graph-link')
  return category === 'tag'
    ? themeColorNumber('--graph-secondary')
    : themeColorNumber('--graph-tertiary')
}

function positionConceptNodes(
  nodes: GraphDatum[],
  edges: GraphEdge[],
  focusedConcept: string,
  mapLayout: MapLayout
): void {
  if (!nodes.length) return

  const edgeWeights = new Map<string, number>()
  edges.forEach((edge) => edgeWeights.set(pairKey(edge.source, edge.target), edge.weight))

  const focusedIndex = focusedConcept
    ? nodes.findIndex((node) => node.searchTerm === focusedConcept)
    : -1
  const orderedNodes =
    focusedIndex > 0
      ? [nodes[focusedIndex], ...nodes.slice(0, focusedIndex), ...nodes.slice(focusedIndex + 1)]
      : nodes

  orderedNodes[0].position.set(0, 0, 0)
  const anchorCount = Math.min(7, orderedNodes.length)
  const anchors = orderedNodes.slice(0, anchorCount)

  anchors.slice(1).forEach((node, index) => {
    const angle = (index / Math.max(anchorCount - 1, 1)) * Math.PI * 2
    const ring = focusedConcept ? 2.6 : 4.4
    node.position.set(
      Math.cos(angle) * ring,
      Math.sin(angle) * ring * (mapLayout === '2d' ? 0.72 : 0.35),
      mapLayout === '2d' ? 0 : Math.sin(angle) * ring
    )
  })

  const clusterCounts = new Map<string, number>()
  const anchorIds = anchors.map((node) => node.id)

  orderedNodes.slice(anchorCount).forEach((node) => {
    const anchor = findBestAnchor(node.id, anchorIds, edgeWeights, orderedNodes)
    const index = clusterCounts.get(anchor.id) ?? 0
    clusterCounts.set(anchor.id, index + 1)

    const angle = index * 2.399963 + hashToUnit(node.id) * Math.PI
    const ring = 1.0 + Math.floor(index / 6) * 0.54 + (0.25 - node.radius) * 0.4
    node.position.set(
      anchor.position.x + Math.cos(angle) * ring,
      anchor.position.y + Math.sin(angle) * ring * (mapLayout === '2d' ? 0.72 : 0.4),
      mapLayout === '2d' ? 0 : anchor.position.z + Math.sin(angle) * ring
    )
  })
}

function findBestAnchor(
  nodeId: string,
  anchorIds: string[],
  edgeWeights: Map<string, number>,
  nodes: GraphDatum[]
): GraphDatum {
  let bestAnchor = nodes[0]
  let bestWeight = -1

  anchorIds.forEach((anchorId) => {
    const weight = edgeWeights.get(pairKey(nodeId, anchorId)) ?? 0
    if (weight > bestWeight) {
      bestWeight = weight
      bestAnchor = nodes.find((node) => node.id === anchorId) ?? nodes[0]
    }
  })

  if (bestWeight <= 0 && anchorIds.length) {
    bestAnchor =
      nodes.find(
        (node) => node.id === anchorIds[Math.floor(hashToUnit(nodeId) * anchorIds.length)]
      ) ?? nodes[0]
  }

  return bestAnchor
}

function hashToUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function createTextSprite(text: string, focused: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (!context) return new THREE.Sprite()

  context.fillStyle = focused
    ? themeColor('--graph-label-background-focused', 'oklch(0.922 0 0 / 14%)')
    : themeColor('--graph-label-background', 'oklch(0.205 0 0 / 82%)')
  roundRect(context, 36, 34, 440, 58, 14)
  context.fill()
  context.strokeStyle = focused
    ? themeColor('--graph-label-border-focused', 'oklch(0.922 0 0 / 56%)')
    : themeColor('--graph-label-border', 'oklch(1 0 0 / 14%)')
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = focused
    ? themeColor('--graph-label-foreground-focused', 'white')
    : themeColor('--graph-label-foreground', 'white')
  context.font = '700 30px Inter, system-ui, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text.slice(0, 22), 256, 64, 410)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
  sprite.scale.set(focused ? 2.4 : 2.05, focused ? 0.6 : 0.52, 1)
  return sprite
}

function themeColor(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function themeColorNumber(name: string): number {
  const value = themeColor(name, '')
  const match = value.match(/^#([0-9a-f]{6})$/i)
  return match ? Number.parseInt(match[1], 16) : Number.parseInt('ffffff', 16)
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function pastTenseAction(action: MemoryAction): string {
  const labels: Record<MemoryAction, string> = {
    archive: 'Archived',
    restore: 'Restored',
    delete: 'Deleted',
    'physical-delete': 'Physically deleted',
    approve: 'Approved',
    reject: 'Rejected',
    'mark-noise': 'Marked as noise',
  }
  return labels[action] ?? capitalize(action)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    }
    return entities[char]
  })
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('App container not found')

createRoot(root).render(<App />)
