import type { EmbeddingProvider } from './embedding.js'
import { MemoryIndex, type SearchOptions, type SearchResult } from './indexer.js'
import { SemanticIndex, semanticMemoryText } from './semantic.js'
import { indexAllMemories, listMemories } from './storage.js'
import { normalizeMemoryTheme } from './themes.js'

export type HybridSearchSource = 'lexical-exact' | 'lexical-natural' | 'semantic'

export interface HybridSearchMatch {
  sources: HybridSearchSource[]
  lexicalRank?: number
  naturalRank?: number
  semanticScore?: number
  reason: string
}

export interface HybridSearchResult extends SearchResult {
  score: number
  match: HybridSearchMatch
}

export interface HybridSearchOptions extends Omit<SearchOptions, 'natural'> {
  /**
   * Minimum lexical hits before PAM considers the lexical pass sufficient.
   * Lower values make exact FTS more dominant; higher values invite semantic fusion sooner.
   */
  minLexicalResults?: number
  semanticLimit?: number
  vague?: boolean
  embeddingProvider?: EmbeddingProvider
}

interface SemanticCandidate {
  result: SearchResult
  score: number
}

interface Candidate {
  result: SearchResult
  score: number
  sources: Set<HybridSearchSource>
  lexicalRank?: number
  naturalRank?: number
  semanticScore?: number
}

const DEFAULT_LIMIT = 10
const DEFAULT_MIN_LEXICAL_RESULTS = 3

const VAGUE_QUERY_TERMS = new Set([
  'approach',
  'architecture',
  'best',
  'can',
  'comment',
  'commentaire',
  'commentaires',
  'could',
  'devrait',
  'devrais',
  'dois',
  'erreur',
  'faut',
  'how',
  'issue',
  'plan',
  'pourquoi',
  'problem',
  'probleme',
  'quelle',
  'quelles',
  'quel',
  'quels',
  'quoi',
  'recommend',
  'recommande',
  'recommander',
  'should',
  'strategie',
  'strategy',
  'what',
  'which',
  'why',
])

export async function hybridSearchMemories(
  basePath: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const limit = normalizeLimit(options.limit)
  const query = options.query?.trim()
  const minLexicalResults = Math.max(1, options.minLexicalResults ?? DEFAULT_MIN_LEXICAL_RESULTS)
  const semanticLimit = normalizeLimit(options.semanticLimit ?? Math.max(limit * 3, 10))

  await indexAllMemories(basePath)

  const index = new MemoryIndex(basePath)
  try {
    if (!query) {
      const filteredResults = index.search({
        ...options,
        limit,
        natural: false,
      })
      return rankLexicalOnly(filteredResults, 'lexical-exact', limit)
    }

    const exactResults = index.search({
      ...options,
      query,
      limit,
      natural: false,
    })

    const vagueQuery = options.vague ?? isVagueMemoryQuery(query)
    const shouldExpandBeyondExact = exactResults.length < minLexicalResults || vagueQuery

    if (!shouldExpandBeyondExact) {
      return rankLexicalOnly(exactResults, 'lexical-exact', limit)
    }

    const naturalResults =
      exactResults.length === 0
        ? index.search({
            ...options,
            query,
            limit,
            natural: true,
          })
        : []

    const lexicalCoverage = new Set([...exactResults, ...naturalResults].map((result) => result.id))
    const shouldUseSemantic =
      vagueQuery || lexicalCoverage.size < minLexicalResults || naturalResults.length === 0

    const semanticResults = shouldUseSemantic
      ? await searchSemanticCandidates(basePath, index, options, semanticLimit)
      : []

    return mergeHybridResults(exactResults, naturalResults, semanticResults, limit)
  } finally {
    index.close()
  }
}

export function isVagueMemoryQuery(query: string): boolean {
  const normalized = normalizeQuery(query)
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  if (query.includes('?')) return true
  if (tokens.length >= 5) return true
  return tokens.some((token) => VAGUE_QUERY_TERMS.has(token))
}

function rankLexicalOnly(
  results: SearchResult[],
  source: HybridSearchSource,
  limit: number
): HybridSearchResult[] {
  return results.slice(0, limit).map((result, index) => ({
    ...result,
    score: lexicalScore(source, index),
    match: {
      sources: [source],
      lexicalRank: source === 'lexical-exact' ? index + 1 : undefined,
      naturalRank: source === 'lexical-natural' ? index + 1 : undefined,
      reason: source === 'lexical-exact' ? 'exact lexical match' : 'related lexical match',
    },
  }))
}

async function searchSemanticCandidates(
  basePath: string,
  index: MemoryIndex,
  options: HybridSearchOptions,
  limit: number
): Promise<SemanticCandidate[]> {
  const query = options.query?.trim()
  if (!query) return []

  let semanticIndex: SemanticIndex | null = null
  try {
    semanticIndex = new SemanticIndex(basePath, options.embeddingProvider)
    const memories = (await listMemories(basePath)).filter(
      (memory) => memory.metadata.status === 'active'
    )

    for (const memory of memories) {
      await semanticIndex.indexMemory(memory.metadata.id, semanticMemoryText(memory))
    }

    const semanticResults = await semanticIndex.search(query, limit)
    const hydrated: SemanticCandidate[] = []

    for (const result of semanticResults) {
      if (!Number.isFinite(result.score) || result.score <= 0) continue
      const memory = index.getMemoryById(result.id)
      if (!memory || !matchesSearchFilters(memory, options)) continue
      hydrated.push({ result: memory, score: result.score })
    }

    return hydrated
  } catch {
    return []
  } finally {
    semanticIndex?.close()
  }
}

function mergeHybridResults(
  exactResults: SearchResult[],
  naturalResults: SearchResult[],
  semanticResults: SemanticCandidate[],
  limit: number
): HybridSearchResult[] {
  const candidates = new Map<string, Candidate>()

  exactResults.forEach((result, index) => {
    addCandidate(candidates, result, 'lexical-exact', lexicalScore('lexical-exact', index), {
      lexicalRank: index + 1,
    })
  })

  naturalResults.forEach((result, index) => {
    if (exactResults.some((exact) => exact.id === result.id)) return
    addCandidate(candidates, result, 'lexical-natural', lexicalScore('lexical-natural', index), {
      naturalRank: index + 1,
    })
  })

  semanticResults.forEach((candidate, index) => {
    addCandidate(candidates, candidate.result, 'semantic', semanticScore(candidate.score, index), {
      semanticScore: candidate.score,
    })
  })

  return [...candidates.values()]
    .map(toHybridResult)
    .sort((a, b) => b.score - a.score || b.updated_at.localeCompare(a.updated_at))
    .slice(0, limit)
}

function addCandidate(
  candidates: Map<string, Candidate>,
  result: SearchResult,
  source: HybridSearchSource,
  score: number,
  metadata: Pick<Candidate, 'lexicalRank' | 'naturalRank' | 'semanticScore'>
) {
  const existing = candidates.get(result.id)
  if (!existing) {
    candidates.set(result.id, {
      result,
      score,
      sources: new Set([source]),
      ...metadata,
    })
    return
  }

  existing.sources.add(source)
  existing.score += score * 0.45
  existing.lexicalRank = existing.lexicalRank ?? metadata.lexicalRank
  existing.naturalRank = existing.naturalRank ?? metadata.naturalRank
  existing.semanticScore = Math.max(existing.semanticScore ?? 0, metadata.semanticScore ?? 0)
}

function toHybridResult(candidate: Candidate): HybridSearchResult {
  const sources = sourcePriority([...candidate.sources])
  return {
    ...candidate.result,
    score: Number(candidate.score.toFixed(4)),
    match: {
      sources,
      lexicalRank: candidate.lexicalRank,
      naturalRank: candidate.naturalRank,
      semanticScore: candidate.semanticScore,
      reason: describeMatch(sources),
    },
  }
}

function lexicalScore(source: HybridSearchSource, index: number): number {
  const base = source === 'lexical-exact' ? 100 : 72
  return base - Math.min(index, 40)
}

function semanticScore(score: number, index: number): number {
  return Math.max(0, score) * 45 + 30 - Math.min(index, 25)
}

function sourcePriority(sources: HybridSearchSource[]): HybridSearchSource[] {
  const priority: Record<HybridSearchSource, number> = {
    'lexical-exact': 0,
    'lexical-natural': 1,
    semantic: 2,
  }
  return sources.sort((a, b) => priority[a] - priority[b])
}

function describeMatch(sources: HybridSearchSource[]): string {
  if (sources.includes('lexical-exact') && sources.includes('semantic')) {
    return 'exact lexical and semantic match'
  }
  if (sources.includes('lexical-natural') && sources.includes('semantic')) {
    return 'related lexical and semantic match'
  }
  if (sources.includes('lexical-exact')) return 'exact lexical match'
  if (sources.includes('lexical-natural')) return 'related lexical match'
  return 'semantic vector match'
}

function matchesSearchFilters(result: SearchResult, options: HybridSearchOptions): boolean {
  const normalizedTheme = normalizeMemoryTheme(options.theme) ?? options.theme
  if (result.status !== 'active') return false
  if (options.type && result.type !== options.type) return false
  if (options.scope && result.scope !== options.scope) return false
  if (options.tag && !result.tags.includes(options.tag)) return false
  if (normalizedTheme && result.theme !== normalizedTheme) return false
  return true
}

function normalizeLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit < 1) return DEFAULT_LIMIT
  return Math.floor(limit)
}

function normalizeQuery(query: string): string {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
