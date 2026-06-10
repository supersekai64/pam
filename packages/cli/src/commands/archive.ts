import { Command } from 'commander'
import { archiveMemory, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerArchiveCommand(program: Command) {
  program
    .command('archive <id>')
    .description('Archive a memory')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const archived = await archiveMemory(basePath, id)

      if (!archived) {
        console.error(`Memory not found or already archived: ${id}`)
        process.exit(1)
      }

      console.log(`Memory archived: ${id}`)
    })
}
