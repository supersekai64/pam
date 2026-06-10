import { describe, it, expect } from 'vitest'
import { parseMarkdown, serializeMarkdown } from './markdown.js'
import type { Memory } from './types.js'

describe('parseMarkdown', () => {
  it('should parse frontmatter and content', () => {
    const raw = `---
id: mem_abc123
type: decision
scope: global
status: active
created_at: '2026-01-01T00:00:00.000Z'
updated_at: '2026-01-01T00:00:00.000Z'
tags:
  - architecture
  - backend
source: manual
---

This is the memory content.`

    const memory = parseMarkdown(raw)

    expect(memory.metadata.id).toBe('mem_abc123')
    expect(memory.metadata.type).toBe('decision')
    expect(memory.metadata.scope).toBe('global')
    expect(memory.metadata.status).toBe('active')
    expect(memory.metadata.tags).toEqual(['architecture', 'backend'])
    expect(memory.metadata.source).toBe('manual')
    expect(memory.content).toBe('This is the memory content.')
  })

  it('should use defaults for missing fields', () => {
    const raw = `---
id: mem_xyz
---

Simple content.`

    const memory = parseMarkdown(raw)

    expect(memory.metadata.id).toBe('mem_xyz')
    expect(memory.metadata.type).toBe('knowledge')
    expect(memory.metadata.scope).toBe('global')
    expect(memory.metadata.status).toBe('active')
    expect(memory.metadata.tags).toEqual([])
    expect(memory.metadata.source).toBe('manual')
    expect(memory.content).toBe('Simple content.')
  })
})

describe('serializeMarkdown', () => {
  it('should serialize memory to markdown with frontmatter', () => {
    const memory: Memory = {
      metadata: {
        id: 'mem_test',
        type: 'knowledge',
        scope: 'project',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        tags: ['test'],
        source: 'manual',
      },
      content: 'Test content',
    }

    const result = serializeMarkdown(memory)

    expect(result).toContain('id: mem_test')
    expect(result).toContain('type: knowledge')
    expect(result).toContain('scope: project')
    expect(result).toContain('Test content')
  })

  it('should round-trip correctly', () => {
    const original: Memory = {
      metadata: {
        id: 'mem_round',
        type: 'decision',
        scope: 'global',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        tags: ['round', 'trip'],
        source: 'manual',
      },
      content: 'Round trip content',
    }

    const serialized = serializeMarkdown(original)
    const parsed = parseMarkdown(serialized)

    expect(parsed.metadata.id).toBe(original.metadata.id)
    expect(parsed.metadata.type).toBe(original.metadata.type)
    expect(parsed.metadata.tags).toEqual(original.metadata.tags)
    expect(parsed.content).toBe(original.content)
  })
})
