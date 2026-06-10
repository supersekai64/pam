import { Command } from 'commander'
import { restoreMemory, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerRestoreCommand(program: Command) {
  program
    .command('restore <id>')
    .description('Restore a deleted memory')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const restored = await restoreMemory(basePath, id)

      if (!restored) {
        console.error(`Memory not found or not deleted: ${id}`)
        process.exit(1)
      }

      console.log(`Memory restored: ${id}`)
    })
}
