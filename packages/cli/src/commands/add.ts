import { Command } from 'commander'
import {
  createMemory,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  MEMORY_SCOPES,
  MEMORY_TYPES,
} from '@pamh/core'

export function registerAddCommand(program: Command) {
  program
    .command('add')
    .description('Add a new memory')
    .requiredOption('-t, --type <type>', `Memory type (${MEMORY_TYPES.join(', ')})`)
    .requiredOption('-c, --content <content>', 'Memory content')
    .option('-s, --scope <scope>', 'Memory scope (global, project)', 'global')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--supersedes <id>', 'ID of the memory this one supersedes')
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
      const salience = parseFloat(options.salience)

      const memory = await createMemory(basePath, {
        type: options.type,
        scope: options.scope,
        content: options.content,
        tags,
        supersedes: options.supersedes,
        salience,
      })

      console.log(`Memory created: ${memory.metadata.id}`)
      if (options.supersedes) {
        console.log(`Supersedes: ${options.supersedes}`)
      }
    })
}
