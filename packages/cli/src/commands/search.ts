import { Command } from 'commander'
import {
  MemoryIndex,
  SemanticIndex,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  listMemories,
  readMemory,
} from '@pamh/core'

export function registerSearchCommand(program: Command) {
  program
    .command('search [query]')
    .description('Search memories')
    .option('--type <type>', 'Filter by type')
    .option('--scope <scope>', 'Filter by scope')
    .option('--tag <tag>', 'Filter by tag')
    .option('--limit <limit>', 'Maximum results', '50')
    .option('--semantic', 'Use semantic vector search')
    .option('--project', 'Use project memory instead of global')
    .action(async (query, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()
      const limit = parseInt(options.limit, 10)

      if (options.semantic) {
        if (!query) {
          console.error('Semantic search requires a query')
          process.exit(1)
        }

        console.log('Loading embedding model and indexing active memories...')

        const semanticIndex = new SemanticIndex(basePath)
        const memories = (await listMemories(basePath)).filter(
          (memory) => memory.metadata.status === 'active'
        )

        for (const memory of memories) {
          await semanticIndex.indexMemory(memory.metadata.id, memory.content)
        }

        const semanticResults = await semanticIndex.search(query, limit)
        semanticIndex.close()

        const hydratedResults = []
        for (const result of semanticResults) {
          const memory = await readMemory(basePath, result.id)
          if (!memory || memory.metadata.status !== 'active') continue
          if (options.type && memory.metadata.type !== options.type) continue
          if (options.scope && memory.metadata.scope !== options.scope) continue
          if (options.tag && !memory.metadata.tags.includes(options.tag)) continue
          hydratedResults.push({ memory, score: result.score })
        }

        if (hydratedResults.length === 0) {
          console.log('No memories found')
          return
        }

        for (const result of hydratedResults) {
          const preview = result.memory.content.slice(0, 60).replace(/\n/g, ' ')
          const tagStr =
            result.memory.metadata.tags.length > 0
              ? ` [${result.memory.metadata.tags.join(', ')}]`
              : ''
          const score = (result.score * 100).toFixed(1)
          console.log(
            `${result.memory.metadata.id} | ${result.memory.metadata.type} | ${result.memory.metadata.scope}${tagStr} | ${score}% | ${preview}...`
          )
        }

        console.log(`\nTotal: ${hydratedResults.length} results`)
        return
      }

      const index = new MemoryIndex(basePath)

      const results = index.search({
        query,
        type: options.type,
        scope: options.scope,
        tag: options.tag,
        limit,
      })

      index.close()

      if (results.length === 0) {
        console.log('No memories found')
        return
      }

      for (const result of results) {
        const preview = result.content.slice(0, 60).replace(/\n/g, ' ')
        const tagStr = result.tags.length > 0 ? ` [${result.tags.join(', ')}]` : ''
        console.log(`${result.id} | ${result.type} | ${result.scope}${tagStr} | ${preview}...`)
      }

      console.log(`\nTotal: ${results.length} results`)
    })
}
