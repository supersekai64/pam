import { Command } from 'commander'
import { deleteMemory, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerDeleteCommand(program: Command) {
  program
    .command('delete <id>')
    .description('Delete a memory')
    .option('--project', 'Use project memory instead of global')
    .option('--physical', 'Physically remove the Markdown file and index row')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const deleted = await deleteMemory(basePath, id, { physical: options.physical })

      if (!deleted) {
        console.error(`Memory not found: ${id}`)
        process.exit(1)
      }

      console.log(options.physical ? `Memory physically deleted: ${id}` : `Memory deleted: ${id}`)
    })
}
