import { readFile, writeFile } from 'node:fs/promises'
import { parseMarkdown, serializeMarkdown } from './markdown.js'
import { findMemoryFile } from './storage.js'
import { MemoryIndex } from './indexer.js'

export async function restoreMemory(basePath: string, id: string): Promise<boolean> {
  const filePath = await findMemoryFile(basePath, id)
  if (!filePath) return false

  const raw = await readFile(filePath, 'utf-8')
  const memory = parseMarkdown(raw)

  if (memory.metadata.status !== 'deleted') {
    return false
  }

  memory.metadata.status = 'active'
  memory.metadata.updated_at = new Date().toISOString()

  await writeFile(filePath, serializeMarkdown(memory), 'utf-8')

  const index = new MemoryIndex(basePath)
  index.indexMemory(memory, filePath)
  index.close()

  return true
}
