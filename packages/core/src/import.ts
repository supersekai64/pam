import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { parseMarkdown, serializeMarkdown } from './markdown.js'
import { assertMemoryId, generateId } from './id.js'
import { MemoryIndex } from './indexer.js'
import { findMemoryFile } from './storage.js'
import { supersedeMemory } from './supersession.js'
import {
  assertMemoryStatus,
  normalizeStoredMemoryScope,
  normalizeStoredMemoryType,
  type Memory,
} from './types.js'

export type ImportFormat = 'json' | 'zip' | 'markdown'
export type ImportCollisionMode = 'skip' | 'replace' | 'rename' | 'supersede'

export interface ImportOptions {
  format: ImportFormat
  inputPath: string
  basePath: string
  collision?: ImportCollisionMode
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function importMemories(options: ImportOptions): Promise<ImportResult> {
  const { format, inputPath, basePath } = options
  const collision = normalizeImportCollisionMode(options.collision)

  switch (format) {
    case 'json':
      return importFromJson(inputPath, basePath, collision)
    case 'zip':
      return importFromZip(inputPath, basePath, collision)
    case 'markdown':
      return importFromMarkdown(inputPath, basePath, collision)
    default:
      throw new Error(`Unsupported import format: ${format}`)
  }
}

function normalizeImportCollisionMode(value: unknown): ImportCollisionMode {
  if (value === undefined || value === null || value === '') return 'skip'
  if (value === 'skip' || value === 'replace' || value === 'rename' || value === 'supersede') {
    return value
  }
  throw new Error(`Invalid import collision mode: ${String(value)}`)
}

async function importFromMarkdown(
  inputPath: string,
  basePath: string,
  collision: ImportCollisionMode
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  try {
    const raw = await readFile(inputPath, 'utf-8')
    const memory = parseMarkdown(raw)

    const preparation = await prepareImportedMemory(basePath, memory, collision)
    if (preparation.skipReason) {
      result.errors.push(preparation.skipReason)
      result.skipped++
      return result
    }
    if (preparation.handled) {
      result.imported++
      return result
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

async function importFromJson(
  inputPath: string,
  basePath: string,
  collision: ImportCollisionMode
): Promise<ImportResult> {
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

      const preparation = await prepareImportedMemory(basePath, memory, collision)
      if (preparation.skipReason) {
        result.errors.push(preparation.skipReason)
        result.skipped++
        continue
      }
      if (preparation.handled) {
        result.imported++
        continue
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

async function importFromZip(
  inputPath: string,
  basePath: string,
  collision: ImportCollisionMode
): Promise<ImportResult> {
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

      const preparation = await prepareImportedMemory(basePath, memory, collision)
      if (preparation.skipReason) {
        result.errors.push(`${entry.entryName}: ${preparation.skipReason}`)
        result.skipped++
        continue
      }
      if (preparation.handled) {
        result.imported++
        continue
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

interface ImportPreparation {
  skipReason?: string
  handled?: boolean
}

async function prepareImportedMemory(
  basePath: string,
  memory: Memory,
  collision: ImportCollisionMode
): Promise<ImportPreparation> {
  if (!memory.metadata.id) {
    memory.metadata.id = await generateUniqueId(basePath)
  }

  assertMemoryId(memory.metadata.id)

  const existingPath = await findMemoryFile(basePath, memory.metadata.id)
  if (!existingPath) return {}

  if (collision === 'skip') {
    return { skipReason: `Skipped memory ${memory.metadata.id}: ID already exists.` }
  }

  if (collision === 'rename') {
    memory.metadata.id = await generateUniqueId(basePath)
    return {}
  }

  if (collision === 'supersede') {
    const result = await supersedeMemory(basePath, memory.metadata.id, {
      type: memory.metadata.type,
      scope: memory.metadata.scope,
      status: memory.metadata.status,
      source: memory.metadata.source || 'import-supersede',
      tags: memory.metadata.tags,
      salience: memory.metadata.salience,
      source_ids: memory.metadata.source_ids,
      content: memory.content,
    })
    if (!result) {
      return { skipReason: `Skipped memory ${memory.metadata.id}: existing memory not found.` }
    }
    return { handled: true }
  }

  await rm(existingPath, { force: true })
  return {}
}

async function generateUniqueId(basePath: string): Promise<string> {
  let id = generateId()
  while (await findMemoryFile(basePath, id)) {
    id = generateId()
  }
  return id
}

async function writeMemoryToFile(basePath: string, memory: Memory): Promise<string> {
  assertMemoryId(memory.metadata.id)

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
