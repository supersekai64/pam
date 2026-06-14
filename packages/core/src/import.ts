import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { parseMarkdown, serializeMarkdown } from './markdown.js'
import { generateId } from './id.js'
import { MemoryIndex } from './indexer.js'
import {
  assertMemoryStatus,
  normalizeStoredMemoryScope,
  normalizeStoredMemoryType,
  type Memory,
} from './types.js'

export type ImportFormat = 'json' | 'zip' | 'markdown'

export interface ImportOptions {
  format: ImportFormat
  inputPath: string
  basePath: string
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function importMemories(options: ImportOptions): Promise<ImportResult> {
  const { format, inputPath, basePath } = options

  switch (format) {
    case 'json':
      return importFromJson(inputPath, basePath)
    case 'zip':
      return importFromZip(inputPath, basePath)
    case 'markdown':
      return importFromMarkdown(inputPath, basePath)
    default:
      throw new Error(`Unsupported import format: ${format}`)
  }
}

async function importFromMarkdown(inputPath: string, basePath: string): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  try {
    const raw = await readFile(inputPath, 'utf-8')
    const memory = parseMarkdown(raw)

    if (!memory.metadata.id) {
      memory.metadata.id = generateId()
    }

    const filePath = await writeMemoryToFile(basePath, memory)
    const index = new MemoryIndex(basePath)
    index.indexMemory(memory, filePath)
    index.close()
    result.imported++
  } catch (error) {
    result.errors.push(`Failed to import markdown: ${error}`)
    result.skipped++
  }

  return result
}

async function importFromJson(inputPath: string, basePath: string): Promise<ImportResult> {
  const raw = await readFile(inputPath, 'utf-8')
  const data = JSON.parse(raw)

  if (!data.memories || !Array.isArray(data.memories)) {
    throw new Error('Invalid JSON format: missing memories array')
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  for (const item of data.memories) {
    try {
      const memory: Memory = {
        metadata: {
          id: item.metadata?.id || generateId(),
          type: normalizeStoredMemoryType(item.metadata?.type || 'knowledge'),
          scope: normalizeStoredMemoryScope(item.metadata?.scope),
          status: assertMemoryStatus(item.metadata?.status || 'active'),
          created_at: item.metadata?.created_at || new Date().toISOString(),
          updated_at: item.metadata?.updated_at || new Date().toISOString(),
          tags: item.metadata?.tags || [],
          source: item.metadata?.source || 'import',
        },
        content: item.content || '',
      }

      const filePath = await writeMemoryToFile(basePath, memory)
      const index = new MemoryIndex(basePath)
      index.indexMemory(memory, filePath)
      index.close()
      result.imported++
    } catch (error) {
      result.errors.push(`Failed to import memory: ${error}`)
      result.skipped++
    }
  }

  return result
}

async function importFromZip(inputPath: string, basePath: string): Promise<ImportResult> {
  const zip = new AdmZip(inputPath)
  const entries = zip.getEntries()

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  for (const entry of entries) {
    if (entry.entryName === 'manifest.json' || !entry.entryName.endsWith('.md')) {
      continue
    }

    try {
      const content = entry.getData().toString('utf-8')
      const memory = parseMarkdown(content)

      if (!memory.metadata.id) {
        memory.metadata.id = generateId()
      }

      const filePath = await writeMemoryToFile(basePath, memory)
      const index = new MemoryIndex(basePath)
      index.indexMemory(memory, filePath)
      index.close()
      result.imported++
    } catch (error) {
      result.errors.push(`Failed to import ${entry.entryName}: ${error}`)
      result.skipped++
    }
  }

  return result
}

async function writeMemoryToFile(basePath: string, memory: Memory): Promise<string> {
  const subdir = getSubdirForType(memory.metadata.type)
  const dirPath = join(basePath, subdir)
  await mkdir(dirPath, { recursive: true })

  const filePath = join(dirPath, `${memory.metadata.id}.md`)
  await writeFile(filePath, serializeMarkdown(memory), 'utf-8')
  return filePath
}

function getSubdirForType(type: string): string {
  const typeToSubdir: Record<string, string> = {
    decision: 'decisions',
    knowledge: 'knowledge',
    mistake: 'mistakes',
    pattern: 'patterns',
    preference: 'preferences',
    session: 'sessions',
    task: 'tasks',
    rule: 'rules',
    client: 'clients',
  }

  return typeToSubdir[type] ?? 'knowledge'
}
