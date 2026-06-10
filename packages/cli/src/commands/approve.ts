import { Command } from 'commander'
import { approveMemory, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerApproveCommand(program: Command) {
  program
    .command('approve <id>')
    .description('Approve a proposed memory')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const approved = await approveMemory(basePath, id)

      if (!approved) {
        console.error(`Memory not found or not proposed: ${id}`)
        process.exit(1)
      }

      console.log(`Memory approved: ${id}`)
    })
}
