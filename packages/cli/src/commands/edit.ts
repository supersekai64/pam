import { Command } from 'commander'
import { updateMemory, getProjectMemoryPath, MEMORY_TYPES } from 'pamh-core'

export function registerEditCommand(program: Command) {
  program
    .command('edit <id>')
    .description('Edit a memory')
    .option('-c, --content <content>', 'New content')
    .option('-t, --type <type>', `New type (${MEMORY_TYPES.join(', ')})`)
    .option('--tags <tags>', 'New comma-separated tags')
    .action(async (id, options) => {
      if (options.type && !MEMORY_TYPES.includes(options.type)) {
        console.error(`Invalid type. Must be one of: ${MEMORY_TYPES.join(', ')}`)
        process.exit(1)
      }

      const basePath = getProjectMemoryPath(process.cwd())

      const tags = options.tags ? options.tags.split(',').map((t: string) => t.trim()) : undefined

      const memory = await updateMemory(basePath, id, {
        content: options.content,
        type: options.type,
        tags,
      })

      if (!memory) {
        console.error(`Memory not found: ${id}`)
        process.exit(1)
      }

      console.log(`Memory updated: ${id}`)
    })
}
