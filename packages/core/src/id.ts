import { randomBytes } from 'node:crypto'

export function generateId(): string {
  return `mem_${randomBytes(8).toString('hex')}`
}
