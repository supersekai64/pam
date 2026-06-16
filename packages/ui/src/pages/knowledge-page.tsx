import type { FormEvent, ReactNode } from 'react'
import type { KnowledgeGraphResponse, Memory, MemoryAction, SearchResult } from '@/types'

export function KnowledgePage({
  KnowledgeGraphPanel,
  directory,
  graph,
  loading,
  onEvidenceAction,
  onEvidenceUpdate,
}: {
  KnowledgeGraphPanel: (props: {
    directory: Map<string, Memory | SearchResult>
    graph: KnowledgeGraphResponse | null
    loading: boolean
    onEvidenceAction: (memory: Memory | SearchResult, action: MemoryAction) => void
    onEvidenceUpdate: (memory: Memory | SearchResult, event: FormEvent<HTMLFormElement>) => void
  }) => ReactNode
  directory: Map<string, Memory | SearchResult>
  graph: KnowledgeGraphResponse | null
  loading: boolean
  onEvidenceAction: (memory: Memory | SearchResult, action: MemoryAction) => void
  onEvidenceUpdate: (memory: Memory | SearchResult, event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <div className="h-full min-h-0">
      <KnowledgeGraphPanel
        directory={directory}
        graph={graph}
        loading={loading}
        onEvidenceAction={onEvidenceAction}
        onEvidenceUpdate={onEvidenceUpdate}
      />
    </div>
  )
}
