import { Command } from 'commander'
import {
  updateMemory,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  MEMORY_SCOPES,
  MEMORY_TYPES,
} from 'pamh-core'

export function registerEditCommand(program: Command) {
  program
    .command('edit <id>')
    .description('Edit a memory')
    .option('-c, --content <content>', 'New content')
    .option('-t, --type <type>', `New type (${MEMORY_TYPES.join(', ')})`)
    .option('-s, --scope <scope>', 'New scope')
    .option('--tags <tags>', 'New comma-separated tags')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      if (options.type && !MEMORY_TYPES.includes(options.type)) {
        console.error(`Invalid type. Must be one of: ${MEMORY_TYPES.join(', ')}`)
        process.exit(1)
      }

      if (options.scope && !MEMORY_SCOPES.includes(options.scope)) {
        console.error(`Invalid scope. Must be one of: ${MEMORY_SCOPES.join(', ')}`)
        process.exit(1)
      }

      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined

      const memory = await updateMemory(basePath, id, {
        content: options.content,
        type: options.type,
        scope: options.scope,
        tags,
      })

      if (!memory) {
        console.error(`Memory not found: ${id}`)
        process.exit(1)
      }

      console.log(`Memory updated: ${id}`)
    })
}
