export const MEMORY_TYPES = [
  'decision',
  'knowledge',
  'mistake',
  'rule',
  'preference',
  'session',
  'task',
  'client',
  'project',
  'pattern',
] as const

export type MemoryType = (typeof MEMORY_TYPES)[number]

export function isMemoryType(value: unknown): value is MemoryType {
  return typeof value === 'string' && MEMORY_TYPES.includes(value as MemoryType)
}

export const MEMORY_SCOPES = [
  'global',
  'project',
  'client',
  'stack',
  'temporary',
  'archived',
] as const

export type MemoryScope = (typeof MEMORY_SCOPES)[number]

export function isMemoryScope(value: unknown): value is MemoryScope {
  return typeof value === 'string' && MEMORY_SCOPES.includes(value as MemoryScope)
}

export const MEMORY_STATUSES = ['active', 'deleted', 'archived'] as const

export type MemoryStatus = (typeof MEMORY_STATUSES)[number]

export function isMemoryStatus(value: unknown): value is MemoryStatus {
  return typeof value === 'string' && MEMORY_STATUSES.includes(value as MemoryStatus)
}

export function assertMemoryType(value: unknown): MemoryType {
  if (!isMemoryType(value)) {
    throw new Error(`Invalid memory type: ${String(value)}`)
  }
  return value
}

export function assertMemoryScope(value: unknown): MemoryScope {
  if (!isMemoryScope(value)) {
    throw new Error(`Invalid memory scope: ${String(value)}`)
  }
  return value
}

export function assertMemoryStatus(value: unknown): MemoryStatus {
  if (!isMemoryStatus(value)) {
    throw new Error(`Invalid memory status: ${String(value)}`)
  }
  return value
}

export interface MemoryMetadata {
  id: string
  type: MemoryType
  scope: MemoryScope
  status: MemoryStatus
  created_at: string
  updated_at: string
  tags: string[]
  source: string
}

export interface Memory {
  metadata: MemoryMetadata
  content: string
}

export interface CreateMemoryInput {
  type: MemoryType
  scope: MemoryScope
  content: string
  tags?: string[]
  source?: string
}

export interface UpdateMemoryInput {
  content?: string
  tags?: string[]
  type?: MemoryType
  scope?: MemoryScope
}
