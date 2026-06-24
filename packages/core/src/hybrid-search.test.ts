import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMemory, initProjectMemory } from './storage.js'
import { hybridSearchMemories, isVagueMemoryQuery } from './hybrid-search.js'
import type { EmbeddingProvider } from './embedding.js'

class SearchEmbeddingProvider implements EmbeddingProvider {
  generate(text: string): Promise<number[]> {
    const normalized = text.toLowerCase()
    return Promise.resolve([
      normalized.includes('postgres') ||
      normalized.includes('postgresql') ||
      normalized.includes('persistence') ||
      normalized.includes('durable') ||
      normalized.includes('state')
        ? 1
        : 0,
      normalized.includes('react') ||
      normalized.includes('dashboard') ||
      normalized.includes('interface') ||
      normalized.includes('ui')
        ? 1
        : 0,
      normalized.includes('test') || normalized.includes('vitest') ? 1 : 0,
    ])
  }

  getDimensions(): number {
    return 3
  }
}

class ThrowingEmbeddingProvider implements EmbeddingProvider {
  generate(): Promise<number[]> {
    throw new Error('semantic search should not run')
  }

  getDimensions(): number {
    return 3
  }
}

describe('hybrid search', () => {
  let tempDir: string
  let basePath: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pam-hybrid-search-test-'))
    basePath = await initProjectMemory(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('keeps exact FTS fast when lexical results are sufficient', async () => {
    await createMemory(basePath, {
      type: 'decision',
      scope: 'project',
      content: 'Use PostgreSQL for production persistence.',
    })

    const results = await hybridSearchMemories(basePath, {
      query: 'PostgreSQL',
      minLexicalResults: 1,
      embeddingProvider: new ThrowingEmbeddingProvider(),
    })

    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('PostgreSQL')
    expect(results[0].match.sources).toEqual(['lexical-exact'])
  })

  it('falls back to semantic vectors when lexical search is weak', async () => {
    await createMemory(basePath, {
      type: 'decision',
      scope: 'project',
      content: 'Use PostgreSQL for production persistence.',
    })

    await createMemory(basePath, {
      type: 'knowledge',
      scope: 'project',
      content: 'Render dashboards with React components.',
    })

    const results = await hybridSearchMemories(basePath, {
      query: 'durable state',
      embeddingProvider: new SearchEmbeddingProvider(),
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('PostgreSQL')
    expect(results[0].match.sources).toContain('semantic')
  })

  it('fuses lexical and semantic signals for vague queries', async () => {
    await createMemory(basePath, {
      type: 'decision',
      scope: 'project',
      content: 'Use PostgreSQL for production persistence.',
    })

    await createMemory(basePath, {
      type: 'knowledge',
      scope: 'project',
      content: 'React dashboards show system health.',
    })

    const results = await hybridSearchMemories(basePath, {
      query: 'what should we use for durable state?',
      embeddingProvider: new SearchEmbeddingProvider(),
    })

    expect(results[0].content).toContain('PostgreSQL')
    expect(results[0].match.sources).toContain('semantic')
  })

  it('detects vague user questions', () => {
    expect(isVagueMemoryQuery('what should we use for durable state?')).toBe(true)
    expect(isVagueMemoryQuery('PostgreSQL')).toBe(false)
  })
})
