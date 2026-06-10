import { Command } from 'commander'
import { rejectMemory, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerRejectCommand(program: Command) {
  program
    .command('reject <id>')
    .description('Reject a proposed memory')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const rejected = await rejectMemory(basePath, id)

      if (!rejected) {
        console.error(`Memory not found or not proposed: ${id}`)
        process.exit(1)
      }

      console.log(`Memory rejected: ${id}`)
    })
}
