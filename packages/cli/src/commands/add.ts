import { Command } from 'commander'
import {
  createMemory,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  MEMORY_SCOPES,
  MEMORY_TYPES,
  assertSalience,
} from '@pamh/core'

export function registerAddCommand(program: Command) {
  program
    .command('add')
    .description('Add a new memory')
    .requiredOption('-t, --type <type>', `Memory type (${MEMORY_TYPES.join(', ')})`)
    .requiredOption('-c, --content <content>', 'Memory content')
    .option('-s, --scope <scope>', 'Memory scope (global, project)', 'global')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--salience <score>', 'Importance score (0-1, default: 0.5)', '0.5')
    .option('--project', 'Use project memory instead of global')
    .action(async (options) => {
      if (!MEMORY_TYPES.includes(options.type)) {
        console.error(`Invalid type. Must be one of: ${MEMORY_TYPES.join(', ')}`)
        process.exit(1)
      }

      if (!MEMORY_SCOPES.includes(options.scope)) {
        console.error(`Invalid scope. Must be one of: ${MEMORY_SCOPES.join(', ')}`)
        process.exit(1)
      }

      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : []
      let salience: number
      try {
        salience = assertSalience(options.salience)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }

      const memory = await createMemory(basePath, {
        type: options.type,
        scope: options.scope,
        content: options.content,
        tags,
        salience,
      })

      console.log(`Memory created: ${memory.metadata.id}`)
    })
}
