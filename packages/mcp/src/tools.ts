import {
  MemoryIndex,
  addLinkedProject,
  compileContext,
  createMemory,
  deleteMemory,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  indexAllMemories,
  loadLinkedProjects,
  readMemory,
  updateMemory,
  assertMemoryType,
} from '@pamh/core'

export interface McpToolContext {
  cwd: string
  globalMemoryPath?: string
  projectMemoryPath?: string
}

export interface SearchMemoryInput {
  query?: string
  scope?: 'global' | 'project'
  type?: string
  tag?: string
  limit?: number
}

export interface GetMemoryInput {
  id: string
  scope?: 'global' | 'project'
}

export interface AddMemoryInput {
  content: string
  type: string
  scope?: 'global' | 'project'
  tags?: string[]
}

export interface EditMemoryInput {
  id: string
  content?: string
  type?: string
  scope?: 'global' | 'project'
  tags?: string[]
}

export interface DeleteMemoryInput {
  id: string
  scope?: 'global' | 'project'
}

export interface CompileContextInput {
  query?: string
  maxTokens?: number
}

export interface ListProjectsInput {
  includeCurrent?: boolean
}

export function resolveMemoryPath(
  context: McpToolContext,
  scope: 'global' | 'project' = 'project'
) {
  if (scope === 'global') {
    return context.globalMemoryPath ?? getGlobalMemoryPath()
  }

  return context.projectMemoryPath ?? getProjectMemoryPath(context.cwd)
}

export async function searchMemory(input: SearchMemoryInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)
  await indexAllMemories(basePath)

  const index = new MemoryIndex(basePath)
  const results = index.search({
    query: input.query,
    type: input.type,
    tag: input.tag,
    limit: input.limit ?? 10,
  })
  index.close()

  return results
}

export async function getMemory(input: GetMemoryInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)
  return readMemory(basePath, input.id)
}

export async function addMemory(input: AddMemoryInput, context: McpToolContext) {
  const scope = input.scope ?? 'project'
  const basePath = resolveMemoryPath(context, scope)

  return createMemory(basePath, {
    content: input.content,
    type: assertMemoryType(input.type),
    scope,
    tags: input.tags ?? [],
    source: 'mcp',
  })
}

export async function editMemory(input: EditMemoryInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)

  return updateMemory(basePath, input.id, {
    content: input.content,
    type: input.type ? assertMemoryType(input.type) : undefined,
    tags: input.tags,
  })
}

export async function removeMemory(input: DeleteMemoryInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)
  return deleteMemory(basePath, input.id)
}

export async function listProjects(input: ListProjectsInput, context: McpToolContext) {
  const projectBasePath = resolveMemoryPath(context, 'project')
  const linked = await loadLinkedProjects(projectBasePath)
  const projects = input.includeCurrent === false ? [] : [context.cwd]

  return [...projects, ...linked.projects]
}

export async function compileMemoryContext(input: CompileContextInput, context: McpToolContext) {
  return compileContext(
    resolveMemoryPath(context, 'global'),
    resolveMemoryPath(context, 'project'),
    {
      query: input.query,
      maxTokens: input.maxTokens,
    }
  )
}

export async function linkProject(projectPath: string, context: McpToolContext) {
  const projectBasePath = resolveMemoryPath(context, 'project')
  await addLinkedProject(projectBasePath, projectPath)
}
