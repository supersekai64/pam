import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { listMemories } from './storage.js'
import { MemoryIndex } from './indexer.js'
import { recordMemoryDebugEvent } from './memory-debug.js'
import type { Memory, MemoryScope, MemoryStatus, MemoryType } from './types.js'

export interface CompileContextOptions {
  query?: string
  maxTokens?: number
  includeProject?: boolean
  includeSearch?: boolean
}

export interface CompiledContext {
  content: string
  tokenCount: number
  sources: {
    project: Memory[]
    search: Memory[]
  }
}

const DEFAULT_MAX_TOKENS = 4000
const CHARS_PER_TOKEN = 4
const CONTEXT_TYPE_WEIGHTS: Record<string, number> = {
  rule: 1000,
  decision: 930,
  preference: 900,
  knowledge: 830,
  mistake: 730,
  task: 700,
  pattern: 660,
  client: 600,
  session: 160,
}

const CONTEXT_SECTION_TITLES: Record<string, string> = {
  rule: 'Current Project Rules',
  decision: 'Active Decisions',
  preference: 'Durable Preferences',
  knowledge: 'Project Knowledge',
  mistake: 'Known Pitfalls',
  task: 'Open Tasks',
  pattern: 'Reusable Patterns',
  client: 'Client Context',
  session: 'Recent Activity',
}

export async function compileContext(
  projectBasePath: string,
  options: CompileContextOptions = {}
): Promise<CompiledContext> {
  const {
    query,
    maxTokens = DEFAULT_MAX_TOKENS,
    includeProject = true,
    includeSearch = true,
  } = options

  const sources = {
    project: [] as Memory[],
    search: [] as Memory[],
  }

  let currentTokens = 0

  if (includeProject && existsSync(projectBasePath)) {
    const projectMemories = await listMemories(projectBasePath)
    const activeProject = projectMemories.filter(isContextMemory).sort(compareContextMemories)

    for (const memory of activeProject) {
      const memoryTokens = estimateTokens(memory.content)
      if (currentTokens + memoryTokens <= maxTokens) {
        sources.project.push(memory)
        currentTokens += memoryTokens
      }
    }
  }

  if (includeSearch && query && existsSync(projectBasePath)) {
    try {
      const index = new MemoryIndex(projectBasePath)
      const searchResults = index.search({ query, limit: 10 })
      index.close()

      for (const result of searchResults) {
        if (result.status === 'active' && !isNoiseResult(result)) {
          const memoryTokens = estimateTokens(result.content)
          if (currentTokens + memoryTokens <= maxTokens) {
            sources.search.push({
              metadata: {
                id: result.id,
                type: result.type as MemoryType,
                scope: result.scope as MemoryScope,
                status: result.status as MemoryStatus,
                created_at: result.created_at,
                updated_at: result.updated_at,
                tags: result.tags,
                source: result.source,
              },
              content: result.content,
            })
            currentTokens += memoryTokens
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Search failed during context compilation: ${error}`)
    }
  }

  const content = formatCompiledContext(sources, query)

  await recordMemoryDebugEvent(projectBasePath, {
    action: 'context.compile',
    outcome: 'ok',
    details: {
      query,
      maxTokens,
      includeProject,
      includeSearch,
      tokenCount: currentTokens,
      source_counts: {
        project: sources.project.length,
        search: sources.search.length,
      },
      source_ids: {
        project: sources.project.map((memory) => memory.metadata.id),
        search: sources.search.map((memory) => memory.metadata.id),
      },
    },
  })

  return {
    content,
    tokenCount: currentTokens,
    sources,
  }
}

export async function writeCompiledContext(
  projectBasePath: string,
  compiled: CompiledContext
): Promise<string> {
  const outputPath = join(projectBasePath, 'compiled-context.md')
  await writeFile(outputPath, compiled.content, 'utf-8')

  await recordMemoryDebugEvent(projectBasePath, {
    action: 'context.write',
    outcome: 'ok',
    details: {
      outputPath,
      tokenCount: compiled.tokenCount,
      source_counts: {
        project: compiled.sources.project.length,
        search: compiled.sources.search.length,
      },
    },
  })

  return outputPath
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function formatCompiledContext(sources: CompiledContext['sources'], query?: string): string {
  let content = '# Compiled Context\n\n'
  content += `Generated at: ${new Date().toISOString()}\n`
  if (query) {
    content += `Query: ${query}\n`
  }
  content += '\n---\n\n'

  if (sources.project.length > 0) {
    content += '## Project Memory\n\n'
    for (const [section, memories] of groupMemoriesBySection(sources.project)) {
      content += `### ${section}\n\n`
      for (const memory of memories) {
        content += formatMemory(memory)
      }
    }
    content += '\n'
  }

  if (sources.search.length > 0) {
    content += '## Search Results\n\n'
    for (const [section, memories] of groupMemoriesBySection(sources.search)) {
      content += `### ${section}\n\n`
      for (const memory of memories) {
        content += formatMemory(memory)
      }
    }
    content += '\n'
  }

  return content
}

function formatMemory(memory: Memory): string {
  let output = `#### ${memory.metadata.id}\n\n`
  output += `- **Type**: ${memory.metadata.type}\n`
  if (memory.metadata.tags.length > 0) {
    output += `- **Tags**: ${memory.metadata.tags.join(', ')}\n`
  }
  output += `\n${memory.content}\n\n---\n\n`
  return output
}

function isContextMemory(memory: Memory): boolean {
  return memory.metadata.status === 'active' && !isNoiseMemory(memory)
}

function isNoiseMemory(memory: Memory): boolean {
  return (
    memory.metadata.status === 'noise' ||
    memory.metadata.tags.includes('noise') ||
    memory.metadata.tags.includes('ignored') ||
    memory.metadata.tags.includes('pamh-noise') ||
    memory.metadata.source === 'noise'
  )
}

function isNoiseResult(memory: { status: string; tags: string[]; source: string }): boolean {
  return (
    memory.status === 'noise' ||
    memory.tags.includes('noise') ||
    memory.tags.includes('ignored') ||
    memory.tags.includes('pamh-noise') ||
    memory.source === 'noise'
  )
}

function compareContextMemories(left: Memory, right: Memory): number {
  const leftScore = CONTEXT_TYPE_WEIGHTS[left.metadata.type] ?? 500
  const rightScore = CONTEXT_TYPE_WEIGHTS[right.metadata.type] ?? 500
  return rightScore - leftScore || right.metadata.updated_at.localeCompare(left.metadata.updated_at)
}

function groupMemoriesBySection(memories: Memory[]): Array<[string, Memory[]]> {
  const order = [
    'Current Project Rules',
    'Active Decisions',
    'Durable Preferences',
    'Project Knowledge',
    'Known Pitfalls',
    'Open Tasks',
    'Reusable Patterns',
    'Client Context',
    'Recent Activity',
  ]
  const groups = new Map<string, Memory[]>()

  memories.forEach((memory) => {
    const section = CONTEXT_SECTION_TITLES[memory.metadata.type] ?? 'Project Knowledge'
    groups.set(section, [...(groups.get(section) ?? []), memory])
  })

  return [...groups.entries()].sort(
    (a, b) => order.indexOf(a[0]) - order.indexOf(b[0]) || a[0].localeCompare(b[0])
  )
}
