export const memoryTypes = [
  'decision',
  'knowledge',
  'mistake',
  'rule',
  'preference',
  'session',
  'task',
  'client',
  'pattern',
]

export const typeHints: Record<string, string> = {
  decision: 'A technical choice made for the project (library, pattern, schema, protocol).',
  knowledge: 'A reusable fact, constraint or gotcha about the codebase.',
  mistake: 'A lesson learned from an error or regression — used to avoid repeating it.',
  rule: 'A durable workflow requirement ("always …", "never …").',
  preference: 'A stylistic, UX, naming or architectural choice that should apply broadly.',
  session: 'A short summary of completed work.',
  task: 'Follow-up work identified but not done yet.',
  client: 'Memory scoped to a specific client / customer.',
  pattern: 'A recurring pattern observed in code or workflow.',
}

export const conceptHints = {
  llmCandidates: 'Active memories that would be included in the LLM context window right now.',
  strongConcepts:
    'Tags and keywords that recur across the current LLM context. They are the backbone of the concepts map.',
  evidenceSet:
    'Memories matching the current search query and status filter — what you would inspect or edit.',
  excludedNoise:
    'Memories marked as Noise. Hidden from the LLM and the map, but still stored for audit.',
  focusedConcept:
    'A concept you clicked in the map. The Evidence and Context views become filtered to it.',
  consolidate:
    'Promote this concept into a distilled "knowledge" memory that summarizes its evidence.',
  markNoise:
    'Tell PAMH this concept (or memory) is irrelevant. It will be hidden from future LLM context.',
  contextPreview:
    'The exact block of text that would be sent to the LLM as project memory right now.',
  tokenEstimate: 'Approximate token count of the current context block (rough heuristic).',
  approve: 'Promote this proposed memory to Active so the LLM can use it.',
  reject: 'Discard this proposed memory. It will be soft-deleted.',
  archive: 'Remove from the LLM context but keep for history. Restorable.',
  restore: 'Bring this memory back to Active so the LLM can use it again.',
  softDelete: 'Mark as deleted. Hidden everywhere but still restorable.',
  physicalDelete: 'Permanently remove the file from disk. This cannot be undone.',
  save: 'Save your edits to the memory content, type and tags.',
  distillation:
    'Group of related memories that could be merged into a single, denser "knowledge" memory.',
  recommendation:
    'Assisted suggestion produced by PAMH based on your current store (merges, deletions, promotions).',
  showNoise: 'Toggle visibility of memories marked as noise across the whole console.',
  knowledgeGraph:
    'Typed relations (decision → component, person → owns → module, etc.) extracted across memories.',
  copyContext: 'Copy the LLM context block to the clipboard.',
}
