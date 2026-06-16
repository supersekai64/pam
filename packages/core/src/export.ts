import { copyFile, writeFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { indexAllMemories, listMemories } from './storage.js'
import { serializeMarkdown } from './markdown.js'
import { join } from 'node:path'
import { assertMemoryId } from './id.js'
import type { Memory } from './types.js'

export type ExportFormat = 'zip' | 'json' | 'markdown' | 'sqlite'

export interface ExportOptions {
  format: ExportFormat
  outputPath: string
  basePath: string
}

export async function exportMemories(options: ExportOptions): Promise<string> {
  const { format, outputPath, basePath } = options

  switch (format) {
    case 'json':
      return exportToJson(basePath, outputPath)
    case 'markdown':
      return exportToMarkdown(basePath, outputPath)
    case 'zip':
      return exportToZip(basePath, outputPath)
    case 'sqlite':
      return exportToSqlite(basePath, outputPath)
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

async function exportToSqlite(basePath: string, outputPath: string): Promise<string> {
  await indexAllMemories(basePath)
  await copyFile(join(basePath, 'memory.db'), outputPath)
  return outputPath
}

async function exportToJson(basePath: string, outputPath: string): Promise<string> {
  const memories = await getExportableMemories(basePath)

  const exportData = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    count: memories.length,
    memories: memories.map((m) => ({
      metadata: m.metadata,
      content: m.content,
    })),
  }

  await writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')
  return outputPath
}

async function exportToMarkdown(basePath: string, outputPath: string): Promise<string> {
  const memories = await getExportableMemories(basePath)

  let content = `# Memory Export\n\n`
  content += `Exported at: ${new Date().toISOString()}\n`
  content += `Total memories: ${memories.length}\n\n`
  content += `---\n\n`

  for (const memory of memories) {
    content += `## ${memory.metadata.id}\n\n`
    content += `- **Type**: ${memory.metadata.type}\n`
    content += `- **Scope**: ${memory.metadata.scope}\n`
    content += `- **Status**: ${memory.metadata.status}\n`
    content += `- **Created**: ${memory.metadata.created_at}\n`
    content += `- **Updated**: ${memory.metadata.updated_at}\n`
    if (memory.metadata.tags.length > 0) {
      content += `- **Tags**: ${memory.metadata.tags.join(', ')}\n`
    }
    content += `\n${memory.content}\n\n`
    content += `---\n\n`
  }

  await writeFile(outputPath, content, 'utf-8')
  return outputPath
}

async function exportToZip(basePath: string, outputPath: string): Promise<string> {
  const memories = await getExportableMemories(basePath)

  const zip = new AdmZip()

  const manifest = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    count: memories.length,
  }
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'))

  for (const memory of memories) {
    const filename = `${memory.metadata.type}/${memory.metadata.id}.md`
    zip.addFile(filename, Buffer.from(serializeMarkdown(memory), 'utf-8'))
  }

  zip.writeZip(outputPath)
  return outputPath
}

async function getExportableMemories(basePath: string): Promise<Memory[]> {
  const memories = await listMemories(basePath)
  memories.forEach((memory) => assertMemoryId(memory.metadata.id))
  return memories
}
