import { FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MetaTile, Panel } from '@/components/workbench-primitives'
import { formatDate, nounLabel } from '@/lib/memory-view'
import type { ContextPreview } from '@/types'

export function ContextPreviewPanel({
  contextPreview,
  onOpen,
}: {
  contextPreview: ContextPreview | null
  onOpen: () => void
}) {
  return (
    <Panel
      title="LLM context preview"
      eyebrow="Current read"
      className="flex min-h-0 flex-col"
      contentClassName="min-h-0 flex-1"
    >
      <div className="grid min-h-[22rem] gap-4">
        <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
          <MetaTile
            label={nounLabel(contextPreview?.memoryCount ?? 0, 'Source', 'Sources')}
            value={String(contextPreview?.memoryCount ?? 0)}
          />
          <MetaTile
            label={nounLabel(contextPreview?.tokenEstimate ?? 0, 'Token', 'Tokens')}
            value={String(contextPreview?.tokenEstimate ?? 0)}
          />
          <MetaTile
            label="Generated"
            value={contextPreview?.generatedAt ? formatDate(contextPreview.generatedAt) : 'pending'}
          />
        </div>
        <pre className="max-h-[22rem] min-h-[14rem] overflow-auto rounded-md border border-border bg-background/50 p-3 text-sm leading-5 text-muted-foreground">
          {contextPreview?.content || 'No active project memory available for context.'}
        </pre>
        <Button variant="outline" onClick={onOpen}>
          <FileText />
          Open context view
        </Button>
      </div>
    </Panel>
  )
}
