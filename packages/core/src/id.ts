import { randomBytes } from 'node:crypto'

export const MEMORY_ID_PATTERN = /^mem_[A-Za-z0-9_-]{1,124}$/

export function generateId(): string {
  return `mem_${randomBytes(8).toString('hex')}`
}

export function isMemoryId(value: unknown): value is string {
  return typeof value === 'string' && MEMORY_ID_PATTERN.test(value)
}

export function assertMemoryId(value: unknown, name = 'memory id'): string {
  if (!isMemoryId(value)) {
    throw new Error(
      `Invalid ${name}: ${String(value)}. Expected ${MEMORY_ID_PATTERN.source} and max length 128.`
    )
  }
  return value
}
