import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyDistillationProposal,
  createMemory,
  initProjectMemory,
  type DistillationProposal,
} from '../../core/src/index.js'
import { createLocalApiServer, type LocalApiServerOptions } from './server.js'

describe('local API concepts', () => {
  let tempDir: string
  let memoryPath: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pamh-api-test-'))
    memoryPath = await initProjectMemory(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('builds concepts from the same selected memories as context preview', async () => {
    await createMemory(memoryPath, {
      type: 'decision',
      scope: 'project',
      status: 'active',
      tags: ['alpha-context'],
      content: 'Alpha context decides the active LLM map signal. Alpha context is durable.',
    })
    await createMemory(memoryPath, {
      type: 'preference',
      scope: 'project',
      status: 'active',
      tags: ['alpha-context'],
      content: 'Alpha context should remain visible in the LLM map when it is selected.',
    })
    await createMemory(memoryPath, {
      type: 'decision',
      scope: 'project',
      status: 'archived',
      tags: ['archived-only'],
      content: 'Archived only should never appear in the LLM context concept map.',
    })
    await createMemory(memoryPath, {
      type: 'decision',
      scope: 'project',
      status: 'proposed',
      tags: ['proposed-only'],
      content: 'Proposed only should never appear in the LLM context concept map.',
    })
    await createMemory(memoryPath, {
      type: 'knowledge',
      scope: 'project',
      status: 'noise',
      tags: ['noise-only', 'pamh-noise'],
      content: 'Noise only should never appear in the LLM context concept map.',
    })

    const { baseUrl, close } = await startTestServer({ cwd: tempDir })
    try {
      const concepts = await getJson<ApiConceptGraph>(
        `${baseUrl}/api/concepts?store=project&limit=24&maxMemories=6`
      )
      const preview = await getJson<ContextPreview>(
        `${baseUrl}/api/context-preview?store=project&maxMemories=6`
      )

      expect(concepts.totalMemories).toBe(preview.memoryCount)
      expect(concepts.concepts.map((concept) => concept.title)).toContain('Alpha-Context')
      expect(concepts.concepts.map((concept) => concept.title)).not.toContain('Archived-Only')
      expect(concepts.concepts.map((concept) => concept.title)).not.toContain('Proposed-Only')
      expect(concepts.concepts.map((concept) => concept.title)).not.toContain('Noise-Only')
      expect(concepts.excludedNoiseMemories).toBe(1)
      expect(concepts.exclusions.map((exclusion) => exclusion.reason)).toEqual(
        expect.arrayContaining(['not active (archived)', 'not active (proposed)'])
      )
      expect(concepts.concepts.slice(0, 10).map(toTopConcept)).toEqual(preview.topConcepts)
    } finally {
      await close()
    }
  })

  it('respects focused query and lower-ranked durable overflow', async () => {
    await createMemory(memoryPath, {
      type: 'decision',
      scope: 'project',
      status: 'active',
      tags: ['focus-alpha'],
      content: 'Focus alpha anchors the focused LLM context. Focus alpha appears twice.',
    })
    await createMemory(memoryPath, {
      type: 'knowledge',
      scope: 'project',
      status: 'active',
      tags: ['outside-beta'],
      content: 'Outside beta is active but belongs to an unrelated review topic.',
    })
    const overflowTagsById = new Map<string, string>()
    for (let index = 0; index < 7; index += 1) {
      const memory = await createMemory(memoryPath, {
        type: 'decision',
        scope: 'project',
        status: 'active',
        tags: [`overflow-${index}`],
        content: `Overflow ${index} active durable memory matches overflow query.`,
      })
      overflowTagsById.set(memory.metadata.id, `Overflow-${index}`)
    }

    const { baseUrl, close } = await startTestServer({ cwd: tempDir })
    try {
      const focused = await getJson<ApiConceptGraph>(
        `${baseUrl}/api/concepts?store=project&query=focus&limit=24&maxMemories=6`
      )
      expect(focused.concepts.map((concept) => concept.title)).toContain('Focus-Alpha')
      expect(focused.concepts.map((concept) => concept.title)).not.toContain('Outside-Beta')
      expect(focused.exclusions.map((exclusion) => exclusion.reason)).toContain(
        'does not match focused query'
      )

      const overflow = await getJson<ApiConceptGraph>(
        `${baseUrl}/api/concepts?store=project&query=overflow&limit=24&maxMemories=6`
      )
      expect(overflow.exclusions.map((exclusion) => exclusion.reason)).toContain(
        'lower-ranked durable memory overflow'
      )
      const overflowed = overflow.exclusions.find(
        (exclusion) => exclusion.reason === 'lower-ranked durable memory overflow'
      )
      expect(overflowed).toBeDefined()
      expect(overflow.concepts.map((concept) => concept.title)).not.toContain(
        overflowTagsById.get(overflowed!.id)
      )
    } finally {
      await close()
    }
  })

  it('filters French stopwords from context concepts', async () => {
    const contents = [
      'La sauvegarde localStorage est restaurée dans le navigateur avec une grille durable.',
      'Le serveur Sudoku est lancé dans le navigateur avec une configuration locale.',
      'La mémoire projet est disponible dans le dossier local avec une sauvegarde durable.',
    ]

    for (const content of contents) {
      await createMemory(memoryPath, {
        type: 'knowledge',
        scope: 'project',
        status: 'active',
        tags: [],
        content,
      })
    }

    const { baseUrl, close } = await startTestServer({ cwd: tempDir })
    try {
      const concepts = await getJson<ApiConceptGraph>(
        `${baseUrl}/api/concepts?store=project&limit=24&maxMemories=6`
      )
      const titles = concepts.concepts.map((concept) => concept.title)

      expect(titles).not.toContain('Est')
      expect(titles).not.toContain('Avec')
      expect(titles).not.toContain('Dans')
    } finally {
      await close()
    }
  })

  it('includes an approved distilled memory in the LLM context after sources are archived', async () => {
    const sourceIds: string[] = []
    for (let index = 0; index < 6; index += 1) {
      const memory = await createMemory(memoryPath, {
        type: 'decision',
        scope: 'project',
        status: 'active',
        tags: ['agent-codex', 'decision'],
        content: `Agent Codex decision ${index + 1}: keep the Sudoku localStorage save reliable.`,
      })
      sourceIds.push(memory.metadata.id)
    }
    const proposal: DistillationProposal = {
      id: 'distill-agent-codex-test',
      concept: 'Agent-Codex',
      type: 'knowledge',
      scope: 'project',
      tags: ['agent-codex', 'distilled', 'decision'],
      content:
        'Agent-Codex is a recurring project signal supported by source memories.\n\nDurable summary:\n- Keep the Sudoku localStorage save reliable.',
      source_ids: sourceIds,
      source_count: sourceIds.length,
      compression_ratio: 0.4,
      reason: 'Agent-Codex appears repeatedly.',
    }

    const distilled = await applyDistillationProposal(memoryPath, proposal)

    const { baseUrl, close, token } = await startTestServer({ cwd: tempDir })
    try {
      const beforeApprove = await getJson<ContextPreview>(
        `${baseUrl}/api/context-preview?store=project&maxMemories=6`
      )
      expect(beforeApprove.sources.map((source) => source.id)).not.toContain(distilled.metadata.id)

      await postJson(
        `${baseUrl}/api/memories/${distilled.metadata.id}/approve?store=project`,
        token
      )

      const afterApprove = await getJson<ContextPreview>(
        `${baseUrl}/api/context-preview?store=project&maxMemories=6`
      )
      expect(afterApprove.sources.map((source) => source.id)).toContain(distilled.metadata.id)
      expect(afterApprove.content).toContain('Agent-Codex is a recurring project signal')
    } finally {
      await close()
    }
  })

  it('identifies the PAMH API through health metadata', async () => {
    const { baseUrl, close } = await startTestServer({ cwd: tempDir })
    try {
      const health = await getJson<{
        ok: boolean
        name: string
        projectPath: string
        memoryPath: string
      }>(`${baseUrl}/api/health`)

      expect(health.ok).toBe(true)
      expect(health.name).toBe('pamh')
      expect(health.projectPath).toBe(tempDir)
      expect(health.memoryPath).toBe(memoryPath)
    } finally {
      await close()
    }
  })

  it('rejects mutable requests without the PAMH session token', async () => {
    const { baseUrl, close } = await startTestServer({ cwd: tempDir })
    try {
      const response = await fetch(`${baseUrl}/api/memories?store=project`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'knowledge',
          scope: 'project',
          content: 'No token',
        }),
      })

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        error: 'Missing or invalid PAMH session token.',
      })
    } finally {
      await close()
    }
  })

  it('validates memory creation payloads before calling the core store', async () => {
    const { baseUrl, close, token } = await startTestServer({ cwd: tempDir })
    try {
      const invalid = await fetch(`${baseUrl}/api/memories?store=project`, {
        method: 'POST',
        headers: { 'x-pamh-session': token },
        body: JSON.stringify({
          type: 'knowledge',
          scope: 'project',
          content: 'Invalid tags',
          tags: 'not-an-array',
        }),
      })

      expect(invalid.status).toBe(400)
      await expect(invalid.json()).resolves.toMatchObject({
        error: 'Field "tags" must be an array of strings when provided.',
      })

      const valid = await postJson<{ memory: { metadata: { id: string; title?: string } } }>(
        `${baseUrl}/api/memories?store=project`,
        token,
        {
          type: 'knowledge',
          scope: 'project',
          title: 'API-created memory',
          content: 'Valid API memory',
          tags: ['api'],
        }
      )
      expect(valid.memory.metadata.id).toMatch(/^mem_/)
      expect(valid.memory.metadata.title).toBe('API-created memory')
    } finally {
      await close()
    }
  })

  it('validates memory update payloads before mutating', async () => {
    const memory = await createMemory(memoryPath, {
      type: 'knowledge',
      scope: 'project',
      content: 'Original',
    })
    const { baseUrl, close, token } = await startTestServer({ cwd: tempDir })
    try {
      const response = await fetch(`${baseUrl}/api/memories/${memory.metadata.id}?store=project`, {
        method: 'PATCH',
        headers: { 'x-pamh-session': token },
        body: JSON.stringify({ status: 'unknown' }),
      })

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({
        error: 'Field "status" must be a valid memory status when provided.',
      })

      const updated = await fetch(`${baseUrl}/api/memories/${memory.metadata.id}?store=project`, {
        method: 'PATCH',
        headers: { 'x-pamh-session': token },
        body: JSON.stringify({ title: 'API-updated title' }),
      })

      expect(updated.status).toBe(200)
      await expect(updated.json()).resolves.toMatchObject({
        memory: { metadata: { title: 'API-updated title' } },
      })
    } finally {
      await close()
    }
  })

  it('rejects cross-origin mutable requests', async () => {
    const { baseUrl, close, token } = await startTestServer({ cwd: tempDir })
    try {
      const response = await fetch(`${baseUrl}/api/memories?store=project`, {
        method: 'POST',
        headers: {
          origin: 'http://example.test',
          'x-pamh-session': token,
        },
        body: JSON.stringify({
          type: 'knowledge',
          scope: 'project',
          content: 'Wrong origin',
        }),
      })

      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        error: 'Cross-origin mutation blocked.',
      })
    } finally {
      await close()
    }
  })

  it('hides the destructive debug reset endpoint by default', async () => {
    const { baseUrl, close, token } = await startTestServer({ cwd: tempDir })
    try {
      const response = await fetch(`${baseUrl}/api/debug/reset?store=project`, {
        method: 'POST',
        headers: { 'x-pamh-session': token },
        body: JSON.stringify({ confirm: 'RESET' }),
      })

      expect(response.status).toBe(404)
    } finally {
      await close()
    }
  })
})

interface ApiConceptGraph {
  totalMemories: number
  excludedNoiseMemories: number
  concepts: Array<{ title: string; occurrences: number; score: number }>
  exclusions: Array<{ id: string; type: string; reason: string }>
}

interface ContextPreview {
  content: string
  memoryCount: number
  sources: Array<{ id: string }>
  topConcepts: Array<{ title: string; occurrences: number; score: number }>
}

async function startTestServer(
  options: LocalApiServerOptions
): Promise<{ baseUrl: string; close: () => Promise<void>; token: string }> {
  const token = options.sessionToken ?? 'test-session-token'
  const server = createLocalApiServer({ ...options, sessionToken: token })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  const address = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
    token,
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  expect(response.ok).toBe(true)
  return (await response.json()) as T
}

async function postJson<T = unknown>(
  url: string,
  token: string,
  body?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-pamh-session': token },
    body: body ? JSON.stringify(body) : undefined,
  })
  expect(response.ok).toBe(true)
  return (await response.json()) as T
}

function toTopConcept(concept: { title: string; occurrences: number; score: number }): {
  title: string
  occurrences: number
  score: number
} {
  return {
    title: concept.title,
    occurrences: concept.occurrences,
    score: concept.score,
  }
}
