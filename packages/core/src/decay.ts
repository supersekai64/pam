import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseMarkdown, serializeMarkdown } from './markdown.js'
import { MemoryIndex } from './indexer.js'
import type { Memory } from './types.js'

// Decay M8 parameters (configurable)
export interface DecayConfig {
  lambda: number  // Temporal decay rate (default: 0.02)
  sigma: number   // Access reinforcement weight (default: 0.6)
  mu: number      // Access decay rate (default: 0.04)
  coldThreshold: number  // Score below which to soft-delete (default: 0.20)
  hardDeleteAfterDays: number  // Days after soft-delete to hard-delete (default: 180)
}

const DEFAULT_CONFIG: DecayConfig = {
  lambda: 0.02,
  sigma: 0.6,
  mu: 0.04,
  coldThreshold: 0.20,
  hardDeleteAfterDays: 180,
}

/**
 * Calculate the decay score for a memory using the M8 formula:
 * score = salience · exp(−λΔt) + σ · log(1+access_count) · exp(−μ · days_since_access)
 */
export function calculateDecayScore(memory: Memory, config: DecayConfig = DEFAULT_CONFIG): number {
  const now = Date.now()
  const createdAt = new Date(memory.metadata.created_at).getTime()
  const lastAccessedAt = memory.metadata.last_accessed_at
    ? new Date(memory.metadata.last_accessed_at).getTime()
    : createdAt

  const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24)
  const daysSinceAccess = (now - lastAccessedAt) / (1000 * 60 * 60 * 24)

  const salience = memory.metadata.salience ?? 0.5
  const accessCount = memory.metadata.access_count ?? 0

  // M8 formula
  const temporalDecay = salience * Math.exp(-config.lambda * daysSinceCreation)
  const accessReinforcement =
    config.sigma * Math.log(1 + accessCount) * Math.exp(-config.mu * daysSinceAccess)

  return temporalDecay + accessReinforcement
}

/**
 * Record an access to a memory (increment access_count and update last_accessed_at)
 */
export async function recordAccess(basePath: string, memoryId: string): Promise<Memory | null> {
  const filePath = await findMemoryFile(basePath, memoryId)
  if (!filePath) return null

  const raw = await readFile(filePath, 'utf-8')
  const memory = parseMarkdown(raw)

  memory.metadata.access_count = (memory.metadata.access_count ?? 0) + 1
  memory.metadata.last_accessed_at = new Date().toISOString()
  memory.metadata.updated_at = new Date().toISOString()

  await writeFile(filePath, serializeMarkdown(memory), 'utf-8')

  // Update index
  const index = new MemoryIndex(basePath)
  index.indexMemory(memory, filePath)
  index.close()

  return memory
}

/**
 * Run a forget sweep: soft-delete memories below the cold threshold
 */
export async function forgetSweep(
  basePath: string,
  config: DecayConfig = DEFAULT_CONFIG,
  dryRun: boolean = false
): Promise<{
  softDeleted: Memory[]
  hardDeleted: Memory[]
  preserved: Memory[]
}> {
  const result = {
    softDeleted: [] as Memory[],
    hardDeleted: [] as Memory[],
    preserved: [] as Memory[],
  }

  const memories = await listAllMemories(basePath)
  const now = Date.now()

  for (const memory of memories) {
    // Skip already deleted or archived
    if (memory.metadata.status === 'deleted' || memory.metadata.status === 'archived') {
      // Check if it's time to hard-delete
      if (memory.metadata.status === 'archived' && memory.metadata.updated_at) {
        const daysSinceArchive =
          (now - new Date(memory.metadata.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceArchive > config.hardDeleteAfterDays) {
          if (!dryRun) {
            await hardDeleteMemory(basePath, memory.metadata.id)
          }
          result.hardDeleted.push(memory)
          continue
        }
      }
      result.preserved.push(memory)
      continue
    }

    // Skip pinned memories (high salience)
    if ((memory.metadata.salience ?? 0) >= 0.9) {
      result.preserved.push(memory)
      continue
    }

    // Calculate decay score
    const score = calculateDecayScore(memory, config)

    if (score < config.coldThreshold) {
      // Soft-delete
      if (!dryRun) {
        await softDeleteMemory(basePath, memory.metadata.id)
      }
      result.softDeleted.push(memory)
    } else {
      result.preserved.push(memory)
    }
  }

  return result
}

/**
 * Soft-delete a memory (mark as archived)
 */
async function softDeleteMemory(basePath: string, memoryId: string): Promise<void> {
  const filePath = await findMemoryFile(basePath, memoryId)
  if (!filePath) return

  const raw = await readFile(filePath, 'utf-8')
  const memory = parseMarkdown(raw)

  memory.metadata.status = 'archived'
  memory.metadata.updated_at = new Date().toISOString()

  await writeFile(filePath, serializeMarkdown(memory), 'utf-8')

  const index = new MemoryIndex(basePath)
  index.indexMemory(memory, filePath)
  index.close()
}

/**
 * Hard-delete a memory (remove file)
 */
async function hardDeleteMemory(basePath: string, memoryId: string): Promise<void> {
  const filePath = await findMemoryFile(basePath, memoryId)
  if (!filePath) return

  const { rm } = await import('node:fs/promises')
  await rm(filePath, { force: true })

  const index = new MemoryIndex(basePath)
  index.removeMemory(memoryId, 'Hard-deleted by decay sweep')
  index.close()
}

/**
 * List all memories in a base path
 */
async function listAllMemories(basePath: string): Promise<Memory[]> {
  const memories: Memory[] = []
  const subdirs = [
    'decisions',
    'knowledge',
    'mistakes',
    'patterns',
    'preferences',
    'projects',
    'sessions',
    'tasks',
    'rules',
    'clients',
  ]

  for (const subdir of subdirs) {
    const dirPath = join(basePath, subdir)
    if (!existsSync(dirPath)) continue

    const files = await readdir(dirPath)
    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const filePath = join(dirPath, file)
      try {
        const raw = await readFile(filePath, 'utf-8')
        const memory = parseMarkdown(raw)
        memories.push(memory)
      } catch {
        // Skip invalid files
      }
    }
  }

  return memories
}

/**
 * Find a memory file by ID
 */
async function findMemoryFile(basePath: string, id: string): Promise<string | null> {
  const subdirs = [
    'decisions',
    'knowledge',
    'mistakes',
    'patterns',
    'preferences',
    'projects',
    'sessions',
    'tasks',
    'rules',
    'clients',
  ]

  for (const subdir of subdirs) {
    const filePath = join(basePath, subdir, `${id}.md`)
    if (existsSync(filePath)) {
      return filePath
    }
  }

  return null
}
