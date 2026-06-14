import { Command } from 'commander'
import { deleteMemory, getProjectMemoryPath } from 'pamh-core'

export function registerDeleteCommand(program: Command) {
  program
    .command('delete <id>')
    .description('Delete a memory')
    .option('--physical', 'Physically remove the Markdown file and index row')
    .action(async (id, options) => {
      const basePath = getProjectMemoryPath(process.cwd())

      const deleted = await deleteMemory(basePath, id, { physical: options.physical })

      if (!deleted) {
        console.error(`Memory not found: ${id}`)
        process.exit(1)
      }

      console.log(options.physical ? `Memory physically deleted: ${id}` : `Memory deleted: ${id}`)
    })
}
