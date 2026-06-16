import { describe, it, expect } from 'vitest'
import { assertMemoryId, generateId, isMemoryId } from './id.js'

describe('generateId', () => {
  it('should return a string starting with mem_', () => {
    const id = generateId()
    expect(id).toMatch(/^mem_[a-f0-9]{16}$/)
  })

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('memory ID validation', () => {
  it('should accept generated and legacy-safe memory IDs', () => {
    expect(isMemoryId(generateId())).toBe(true)
    expect(isMemoryId('mem_test-123')).toBe(true)
    expect(isMemoryId('mem_test_123')).toBe(true)
  })

  it('should reject path traversal and unsafe file names', () => {
    const unsafeIds = [
      '',
      'memory',
      'mem_',
      '../mem_escape',
      '..\\mem_escape',
      'mem_escape/path',
      'mem_escape\\path',
      `mem_${'a'.repeat(125)}`,
    ]

    for (const id of unsafeIds) {
      expect(isMemoryId(id)).toBe(false)
      expect(() => assertMemoryId(id)).toThrow('Invalid memory id')
    }
  })
})
