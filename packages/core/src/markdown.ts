import matter from 'gray-matter'
import {
  assertMemoryScope,
  assertMemoryStatus,
  assertMemoryType,
  type Memory,
  type MemoryMetadata,
} from './types.js'

export function parseMarkdown(raw: string): Memory {
  const { data, content } = matter(raw)

  const metadata: MemoryMetadata = {
    id: String(data.id ?? ''),
    type: assertMemoryType(data.type ?? 'knowledge'),
    scope: assertMemoryScope(data.scope ?? 'global'),
    status: assertMemoryStatus(data.status ?? 'active'),
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
    tags: Array.isArray(data.tags) ? data.tags : [],
    source: data.source ?? 'manual',
  }

  return {
    metadata,
    content: content.trim(),
  }
}

export function serializeMarkdown(memory: Memory): string {
  const frontmatter = {
    id: memory.metadata.id,
    type: memory.metadata.type,
    scope: memory.metadata.scope,
    status: memory.metadata.status,
    created_at: memory.metadata.created_at,
    updated_at: memory.metadata.updated_at,
    tags: memory.metadata.tags,
    source: memory.metadata.source,
  }

  return matter.stringify(memory.content, frontmatter)
}
