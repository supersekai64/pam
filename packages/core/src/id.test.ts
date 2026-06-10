import { describe, it, expect } from 'vitest'
import { generateId } from './id.js'

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
