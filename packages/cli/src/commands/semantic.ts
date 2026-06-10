import { Command } from 'commander'
import { SemanticIndex, readMemory, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerSemanticCommand(program: Command) {
  program
    .command('semantic-search <query>')
    .description('Search memories using semantic similarity')
    .option('-l, --limit <number>', 'Maximum number of results', '10')
    .option('--project', 'Use project memory instead of global')
    .action(async (query: string, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()
      const limit = parseInt(options.limit, 10)

      console.log(`Searching semantically for: "${query}"`)
      console.log('Loading embedding model (first run may take a moment)...\n')

      try {
        const semanticIndex = new SemanticIndex(basePath)
        const results = await semanticIndex.search(query, limit)

        if (results.length === 0) {
          console.log('No results found.')
          semanticIndex.close()
          return
        }

        console.log(`Found ${results.length} result(s):\n`)

        for (const result of results) {
          const memory = await readMemory(basePath, result.id)

          if (!memory) {
            continue
          }

          const score = (result.score * 100).toFixed(1)
          const preview = memory.content.slice(0, 100).replace(/\n/g, ' ')

          console.log(`[${score}%] ${memory.metadata.id}`)
          console.log(`  Type: ${memory.metadata.type} | Scope: ${memory.metadata.scope}`)
          console.log(`  Tags: ${memory.metadata.tags.join(', ') || 'none'}`)
          console.log(`  Preview: ${preview}...`)
          console.log()
        }

        semanticIndex.close()
      } catch (error) {
        console.error('Error during semantic search:', error)
        process.exit(1)
      }
    })
}
