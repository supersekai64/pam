import type { Memory, MemoryMetadata, SearchResult } from '@/types'

export function getMetadata(memory: Memory | SearchResult): MemoryMetadata {
  return 'metadata' in memory ? memory.metadata : memory
}

export function toMemory(memory: Memory | SearchResult): Memory {
  if ('metadata' in memory) return memory

  return {
    metadata: {
      id: memory.id,
      title: memory.title,
      type: memory.type,
      scope: memory.scope,
      status: memory.status,
      created_at: memory.created_at,
      updated_at: memory.updated_at,
      tags: memory.tags,
      source: memory.source,
      salience: memory.salience,
    },
    content: memory.content,
  }
}

export function groupBy<T>(items: T[], getKey: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getKey(item)
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${nounLabel(count, singular, plural)}`
}

export function nounLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function getMemoryTitle(memoryOrContent: Memory | SearchResult | string): string {
  const title =
    typeof memoryOrContent === 'string' ? undefined : getMetadata(memoryOrContent).title?.trim()
  if (title) return title

  const content = typeof memoryOrContent === 'string' ? memoryOrContent : memoryOrContent.content
  const firstLine = content.replace(/\s+/g, ' ').trim()
  if (!firstLine) return 'Untitled memory'
  return firstLine.length > 88 ? `${firstLine.slice(0, 88).trim()}...` : firstLine
}
