const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'de',
  'des',
  'du',
  'for',
  'from',
  'how',
  'in',
  'is',
  'la',
  'le',
  'les',
  'of',
  'on',
  'or',
  'pour',
  'que',
  'the',
  'to',
  'un',
  'une',
  'what',
  'which',
  'with',
])

const SYNONYM_GROUPS = [
  ['api', 'endpoint', 'http', 'rest', 'server', 'route'],
  ['auth', 'authentication', 'login', 'oauth', 'session', 'signin', 'token'],
  ['backup', 'recover', 'restore', 'rollback', 'trash', 'undo'],
  ['bug', 'defect', 'error', 'failure', 'fix', 'issue', 'problem'],
  ['choice', 'choose', 'chosen', 'decide', 'decision', 'prefer', 'preference', 'selected'],
  ['cli', 'command', 'shell', 'terminal'],
  ['context', 'knowledge', 'memory', 'recall', 'remember'],
  [
    'database',
    'db',
    'mysql',
    'persistence',
    'persist',
    'postgres',
    'postgresql',
    'sql',
    'sqlite',
    'storage',
  ],
  ['docs', 'documentation', 'guide', 'readme'],
  ['frontend', 'interface', 'page', 'screen', 'ui', 'view'],
  ['install', 'init', 'onboarding', 'setup', 'start'],
  ['integration', 'agent', 'claude', 'codex', 'copilot', 'cursor', 'mcp', 'tool'],
  ['privacy', 'redaction', 'secret', 'security'],
  ['test', 'coverage', 'playwright', 'spec', 'tests', 'vitest'],
]

export interface NaturalQueryExpansion {
  groups: string[][]
  terms: string[]
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokenizeSearchQuery(query: string): string[] {
  return unique(
    normalizeSearchText(query)
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 1 && !STOP_WORDS.has(term))
  )
}

export function expandNaturalQuery(query: string): NaturalQueryExpansion {
  const tokens = tokenizeSearchQuery(query)
  const groups = tokens.map((token) => expandToken(token))
  const terms = unique(groups.flat())

  return { groups, terms }
}

export function matchesNaturalSearch(value: string, query: string): boolean {
  const normalizedValue = normalizeSearchText(value)
  const { groups } = expandNaturalQuery(query)
  if (groups.length === 0) return true

  return groups.some((group) => group.some((term) => normalizedValue.includes(term)))
}

function expandToken(token: string): string[] {
  const group = SYNONYM_GROUPS.find((terms) => terms.includes(token))
  return group ? unique([token, ...group]) : [token]
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
