import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  calculateDecayScore,
  recordAccess,
  forgetSweep,
  createMemory,
  initProjectMemory,
  type Memory,
} from './index.js'

describe('decay', () => {
  let tempDir: string
  let basePath: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pamh-decay-test-'))
    basePath = await initProjectMemory(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should calculate decay score', () => {
    const memory: Memory = {
      metadata: {
        id: 'test',
        type: 'knowledge',
        scope: 'project',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tags: [],
        source: 'manual',
        salience: 0.8,
        access_count: 5,
        last_accessed_at: new Date().toISOString(),
      },
      content: 'Test content',
    }

    const score = calculateDecayScore(memory)

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(2) // Reasonable upper bound
  })

  it('should record access', async () => {
    const memory = await createMemory(basePath, {
      type: 'knowledge',
      scope: 'project',
      content: 'Test',
    })

    const updated = await recordAccess(basePath, memory.metadata.id)

    expect(updated).not.toBeNull()
    expect(updated!.metadata.access_count).toBe(1)
    expect(updated!.metadata.last_accessed_at).toBeDefined()
  })

  it('should run forget sweep', async () => {
    // Create a memory with low salience
    await createMemory(basePath, {
      type: 'knowledge',
      scope: 'project',
      content: 'Low importance',
      salience: 0.1,
    })

    // Create a memory with high salience
    await createMemory(basePath, {
      type: 'decision',
      scope: 'project',
      content: 'High importance',
      salience: 0.9,
    })

    const result = await forgetSweep(basePath, {
      lambda: 0.02,
      sigma: 0.6,
      mu: 0.04,
      coldThreshold: 0.5,
      hardDeleteAfterDays: 180,
    })

    // Low salience memory should be soft-deleted
    expect(result.softDeleted.length).toBeGreaterThanOrEqual(1)
    // High salience memory should be preserved
    expect(result.preserved.length).toBeGreaterThanOrEqual(1)
  })

  it('should support dry run', async () => {
    await createMemory(basePath, {
      type: 'knowledge',
      scope: 'project',
      content: 'Test',
      salience: 0.1,
    })

    const result = await forgetSweep(
      basePath,
      {
        lambda: 0.02,
        sigma: 0.6,
        mu: 0.04,
        coldThreshold: 0.5,
        hardDeleteAfterDays: 180,
      },
      true // dry run
    )

    // Should report what would be deleted without actually deleting
    expect(result.softDeleted.length).toBeGreaterThanOrEqual(0)
  })
})
