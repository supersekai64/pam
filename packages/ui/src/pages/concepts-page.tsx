import type { ReactNode } from 'react'
import type { ApiConceptGraph, ApiConceptNode, ConceptDepth, MapLayout } from '@/types'

interface ConceptsPageComponents {
  NeuralMapPanel: (props: {
    conceptDepth: ConceptDepth
    conceptGraph: ApiConceptGraph | null
    focusedConcept: string
    mapLayout: MapLayout
    onClearFocus: () => void
    onConceptDepthChange: (depth: ConceptDepth) => void
    onConceptSelect: (concept: string) => void
    onIgnore: (concept: string) => void
    onMapLayoutChange: (layout: MapLayout) => void
  }) => ReactNode
  ConceptInspector: (props: {
    concept: ApiConceptNode | null
    conceptGraph: ApiConceptGraph | null
    focusedConcept: string
    onConceptSelect: (concept: string) => void
    onConsolidate: (concept: string) => void
    onIgnore: (concept: string) => void
  }) => ReactNode
}

export function ConceptsPage({
  activeConcept,
  components,
  conceptDepth,
  conceptGraph,
  focusedConcept,
  mapLayout,
  onClearFocus,
  onConceptDepthChange,
  onConceptSelect,
  onConsolidate,
  onIgnore,
  onMapLayoutChange,
}: {
  activeConcept: ApiConceptNode | null
  components: ConceptsPageComponents
  conceptDepth: ConceptDepth
  conceptGraph: ApiConceptGraph | null
  focusedConcept: string
  mapLayout: MapLayout
  onClearFocus: () => void
  onConceptDepthChange: (depth: ConceptDepth) => void
  onConceptSelect: (concept: string) => void
  onConsolidate: (concept: string) => void
  onIgnore: (concept: string) => void
  onMapLayoutChange: (layout: MapLayout) => void
}) {
  const { ConceptInspector, NeuralMapPanel } = components

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(20rem,1fr)_minmax(16rem,auto)] gap-4 max-xl:h-auto max-xl:grid-rows-none">
      <NeuralMapPanel
        conceptDepth={conceptDepth}
        conceptGraph={conceptGraph}
        focusedConcept={focusedConcept}
        mapLayout={mapLayout}
        onClearFocus={onClearFocus}
        onConceptDepthChange={onConceptDepthChange}
        onConceptSelect={onConceptSelect}
        onIgnore={onIgnore}
        onMapLayoutChange={onMapLayoutChange}
      />
      <ConceptInspector
        concept={activeConcept}
        conceptGraph={conceptGraph}
        focusedConcept={focusedConcept}
        onConceptSelect={onConceptSelect}
        onConsolidate={onConsolidate}
        onIgnore={onIgnore}
      />
    </div>
  )
}
