import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initProjectMemory } from '@pamh/core'
import {
  addMemory,
  compileMemoryContext,
  editMemory,
  getMemory,
  linkProject,
  listProjects,
  removeMemory,
  searchMemory,
  type McpToolContext,
} from './tools.js'

describe('MCP tools', () => {
  let tempDir: string
  let projectDir: string
  let globalMemoryPath: string
  let projectMemoryPath: string
  let context: McpToolContext

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pamh-mcp-test-'))
    projectDir = join(tempDir, 'project')
    globalMemoryPath = join(tempDir, 'global-memory')
    projectMemoryPath = await initProjectMemory(projectDir)
    context = { cwd: projectDir, globalMemoryPath, projectMemoryPath }
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should add, get, edit, search, and delete a memory', async () => {
    const created = await addMemory(
      {
        content: 'Use PostgreSQL for relational data',
        type: 'decision',
        scope: 'project',
        tags: ['database'],
      },
      context
    )

    const loaded = await getMemory({ id: created.metadata.id, scope: 'project' }, context)
    expect(loaded?.content).toBe('Use PostgreSQL for relational data')

    const edited = await editMemory(
      {
        id: created.metadata.id,
        content: 'Use SQLite for the local memory index',
        scope: 'project',
        tags: ['sqlite'],
      },
      context
    )
    expect(edited?.content).toBe('Use SQLite for the local memory index')

    const results = await searchMemory({ query: 'SQLite', scope: 'project' }, context)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe(created.metadata.id)

    const deleted = await removeMemory({ id: created.metadata.id, scope: 'project' }, context)
    expect(deleted).toBe(true)

    const afterDelete = await getMemory({ id: created.metadata.id, scope: 'project' }, context)
    expect(afterDelete?.metadata.status).toBe('deleted')
  })

  it('should list current and linked projects', async () => {
    const linkedProject = join(tempDir, 'linked-project')
    await linkProject(linkedProject, context)

    const projects = await listProjects({}, context)
    expect(projects).toContain(projectDir)
    expect(projects).toContain(linkedProject)
  })

  it('should compile context', async () => {
    await addMemory(
      {
        content: 'Project architecture uses TypeScript packages',
        type: 'knowledge',
        scope: 'project',
      },
      context
    )

    const compiled = await compileMemoryContext({ query: 'architecture' }, context)
    expect(compiled.content).toContain('Compiled Context')
    expect(compiled.content).toContain('Project architecture uses TypeScript packages')
  })
})
