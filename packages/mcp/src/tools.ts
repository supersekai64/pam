import {
  MemoryIndex,
  compileContext,
  createMemory,
  deleteMemory,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  indexAllMemories,
  loadAutoCaptureConfig,
  readMemory,
  updateMemory,
  assertMemoryType,
  assertMemoryScope,
  supersedeMemory,
  getSupersessionChain,
  getLatestVersion,
  beginHandoff,
  acceptHandoff,
  getOpenHandoff,
  forgetSweep,
  recordHookEvent,
  type MemoryStatus,
  type DecayConfig,
  type HookEventType,
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
  status?: MemoryStatus
  supersedes?: string  // ID of the memory this one supersedes
  salience?: number  // Importance score (0-1, default: 0.5)
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

  const config = await loadAutoCaptureConfig(basePath)
  let status: MemoryStatus = input.status ?? 'active'

  if (!input.status && config.mode === 'assisted') {
    status = 'proposed'
  }

  return createMemory(basePath, {
    content: input.content,
    type: assertMemoryType(input.type),
    scope: assertMemoryScope(scope),
    tags: input.tags ?? [],
    source: 'mcp',
    status,
    supersedes: input.supersedes,
    salience: input.salience ?? 0.5,
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
  const projects = input.includeCurrent === false ? [] : [context.cwd]
  return projects
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

// Supersession tools
export interface SupersedeMemoryInput {
  old_id: string
  content: string
  type: string
  scope?: 'global' | 'project'
  tags?: string[]
  salience?: number
}

export async function supersedeMemoryTool(input: SupersedeMemoryInput, context: McpToolContext) {
  const scope = input.scope ?? 'project'
  const basePath = resolveMemoryPath(context, scope)

  return supersedeMemory(basePath, input.old_id, {
    content: input.content,
    type: assertMemoryType(input.type),
    scope: assertMemoryScope(scope),
    tags: input.tags ?? [],
    source: 'mcp',
    salience: input.salience ?? 0.5,
  })
}

export interface GetSupersessionChainInput {
  memory_id: string
  scope?: 'global' | 'project'
}

export async function getSupersessionChainTool(
  input: GetSupersessionChainInput,
  context: McpToolContext
) {
  const basePath = resolveMemoryPath(context, input.scope)
  return getSupersessionChain(basePath, input.memory_id)
}

export interface GetLatestVersionInput {
  memory_id: string
  scope?: 'global' | 'project'
}

export async function getLatestVersionTool(input: GetLatestVersionInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)
  return getLatestVersion(basePath, input.memory_id)
}

// Handoff tools
export interface HandoffBeginInput {
  summary: string
  agent_from?: string
  open_questions?: string[]
  next_steps?: string[]
  scope?: 'global' | 'project'
}

export async function handoffBeginTool(input: HandoffBeginInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)
  return beginHandoff(
    basePath,
    input.summary,
    input.agent_from,
    input.open_questions,
    input.next_steps
  )
}

export interface HandoffAcceptInput {
  handoff_id?: string  // If not provided, accepts the latest open handoff
  agent_to?: string
  scope?: 'global' | 'project'
}

export async function handoffAcceptTool(input: HandoffAcceptInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)

  if (input.handoff_id) {
    return acceptHandoff(basePath, input.handoff_id, input.agent_to)
  }

  const openHandoff = await getOpenHandoff(basePath)
  if (!openHandoff) {
    return null
  }

  return acceptHandoff(basePath, openHandoff.id, input.agent_to)
}

// Decay tools
export interface ForgetSweepInput {
  lambda?: number
  sigma?: number
  mu?: number
  cold_threshold?: number
  hard_delete_after_days?: number
  dry_run?: boolean
  scope?: 'global' | 'project'
}

export async function forgetSweepTool(input: ForgetSweepInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)

  const config: DecayConfig = {
    lambda: input.lambda ?? 0.02,
    sigma: input.sigma ?? 0.6,
    mu: input.mu ?? 0.04,
    coldThreshold: input.cold_threshold ?? 0.20,
    hardDeleteAfterDays: input.hard_delete_after_days ?? 180,
  }

  return forgetSweep(basePath, config, input.dry_run ?? false)
}

// Hook tools (lifecycle events)
export interface RecordHookEventInput {
  type: HookEventType
  agent?: string
  session_id?: string
  data?: Record<string, unknown>
  scope?: 'global' | 'project'
}

export async function recordHookEventTool(input: RecordHookEventInput, context: McpToolContext) {
  const basePath = resolveMemoryPath(context, input.scope)

  return recordHookEvent(basePath, {
    type: input.type,
    agent: input.agent,
    session_id: input.session_id,
    project_path: context.cwd,
    data: input.data ?? {},
  })
}
