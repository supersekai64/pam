import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { importMemories } from './import.js'
import { initProjectMemory, listMemories } from './storage.js'
import { MemoryIndex } from './indexer.js'

describe('import', () => {
  let tempDir: string
  let basePath: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pamh-import-test-'))
    basePath = await initProjectMemory(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should import from JSON format', async () => {
    const jsonData = {
      version: '1.0.0',
      memories: [
        {
          metadata: {
            id: 'mem_test123',
            type: 'decision',
            scope: 'project',
            status: 'active',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tags: ['test'],
            source: 'import',
          },
          content: 'Test decision',
        },
      ],
    }

    const inputPath = join(tempDir, 'import.json')
    await writeFile(inputPath, JSON.stringify(jsonData, null, 2), 'utf-8')

    const result = await importMemories({ format: 'json', inputPath, basePath })

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
    expect(result.errors).toEqual([])

    const memories = await listMemories(basePath)
    expect(memories.length).toBe(1)
    expect(memories[0].content).toBe('Test decision')

    const index = new MemoryIndex(basePath)
    const results = index.search({ query: 'Test decision' })
    index.close()

    expect(results.length).toBe(1)
  })

  it('should import multiple memories from JSON', async () => {
    const jsonData = {
      version: '1.0.0',
      memories: [
        {
          metadata: {
            id: 'mem_1',
            type: 'decision',
            scope: 'project',
            status: 'active',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tags: [],
            source: 'import',
          },
          content: 'Decision 1',
        },
        {
          metadata: {
            id: 'mem_2',
            type: 'knowledge',
            scope: 'project',
            status: 'active',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tags: [],
            source: 'import',
          },
          content: 'Knowledge 1',
        },
      ],
    }

    const inputPath = join(tempDir, 'import.json')
    await writeFile(inputPath, JSON.stringify(jsonData, null, 2), 'utf-8')

    const result = await importMemories({ format: 'json', inputPath, basePath })

    expect(result.imported).toBe(2)

    const memories = await listMemories(basePath)
    expect(memories.length).toBe(2)
  })

  it('should import a Markdown memory', async () => {
    const inputPath = join(tempDir, 'memory.md')
    await writeFile(
      inputPath,
      `---
id: mem_markdown
type: knowledge
scope: project
status: active
created_at: '2026-01-01T00:00:00.000Z'
updated_at: '2026-01-01T00:00:00.000Z'
tags:
  - markdown
source: import
---
Markdown memory content
`,
      'utf-8'
    )

    const result = await importMemories({ format: 'markdown', inputPath, basePath })

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)

    const index = new MemoryIndex(basePath)
    const results = index.search({ query: 'Markdown memory content' })
    index.close()

    expect(results.length).toBe(1)
  })

  it('should normalize legacy project type in JSON imports', async () => {
    const jsonData = {
      version: '1.0.0',
      memories: [
        {
          metadata: {
            id: 'mem_legacy_project_type',
            type: 'project',
            scope: 'project',
            status: 'active',
            tags: [],
            source: 'import',
          },
          content: 'Legacy project metadata is now regular knowledge.',
        },
      ],
    }

    const inputPath = join(tempDir, 'legacy-project-type.json')
    await writeFile(inputPath, JSON.stringify(jsonData, null, 2), 'utf-8')

    const result = await importMemories({ format: 'json', inputPath, basePath })

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)

    const memories = await listMemories(basePath)
    expect(memories[0].metadata.type).toBe('knowledge')
  })

  it('should handle invalid JSON gracefully', async () => {
    const inputPath = join(tempDir, 'invalid.json')
    await writeFile(inputPath, 'not valid json', 'utf-8')

    await expect(importMemories({ format: 'json', inputPath, basePath })).rejects.toThrow()
  })

  it('should skip memories with errors', async () => {
    const jsonData = {
      version: '1.0.0',
      memories: [
        {
          metadata: {
            id: 'mem_valid',
            type: 'decision',
            scope: 'project',
            status: 'active',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tags: [],
            source: 'import',
          },
          content: 'Valid memory',
        },
      ],
    }

    const inputPath = join(tempDir, 'import.json')
    await writeFile(inputPath, JSON.stringify(jsonData, null, 2), 'utf-8')

    const result = await importMemories({ format: 'json', inputPath, basePath })

    expect(result.imported).toBe(1)
    expect(result.skipped).toBe(0)
  })

  it('should reject imported memories with invalid metadata', async () => {
    const jsonData = {
      version: '1.0.0',
      memories: [
        {
          metadata: {
            id: 'mem_invalid',
            type: 'unknown',
            scope: 'project',
            status: 'active',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            tags: [],
            source: 'import',
          },
          content: 'Invalid memory',
        },
      ],
    }

    const inputPath = join(tempDir, 'invalid-metadata.json')
    await writeFile(inputPath, JSON.stringify(jsonData, null, 2), 'utf-8')

    const result = await importMemories({ format: 'json', inputPath, basePath })

    expect(result.imported).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain('Invalid memory type')
  })
})
