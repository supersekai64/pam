import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

const DEFAULT_IGNORE_PATTERNS = [
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  'secrets/',
  'node_modules/',
  'vendor/',
  'dist/',
  'build/',
  '.git/',
  '*.db',
  '*.sqlite',
]

export interface MemoryIgnore {
  patterns: string[]
  isIgnored: (path: string) => boolean
}

export async function loadMemoryIgnore(basePath: string): Promise<MemoryIgnore> {
  const ignorePath = join(basePath, '.memoryignore')
  let patterns = [...DEFAULT_IGNORE_PATTERNS]

  if (existsSync(ignorePath)) {
    const content = await readFile(ignorePath, 'utf-8')
    const userPatterns = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    patterns = [...patterns, ...userPatterns]
  }

  return {
    patterns,
    isIgnored: (path: string) => matchesAnyPattern(path, patterns),
  }
}

function matchesAnyPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchesPattern(path, pattern)) {
      return true
    }
  }
  return false
}

function matchesPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    const dirPattern = pattern.slice(0, -1)
    return path.includes(dirPattern + '/') || path.startsWith(dirPattern + '/')
  }

  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$')
    return regex.test(path) || regex.test(getFileName(path))
  }

  return path === pattern || path.endsWith('/' + pattern) || getFileName(path) === pattern
}

function getFileName(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

export function getDefaultIgnorePatterns(): string[] {
  return [...DEFAULT_IGNORE_PATTERNS]
}
