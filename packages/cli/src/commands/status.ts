import { Command } from 'commander'
import { findMemoryBase, getProjectMemoryPath, listMemories } from 'pamh-core'

export function registerStatusCommand(program: Command) {
  program
    .command('status')
    .description('Show current memory status')
    .action(async () => {
      const cwd = process.cwd()
      const memoryPath = findMemoryBase(cwd) ?? getProjectMemoryPath(cwd)

      console.log(`Using memory: ${memoryPath ?? 'none'}`)

      if (memoryPath) {
        const memories = await listMemories(memoryPath)
        const active = memories.filter((m) => m.metadata.status === 'active').length
        const proposed = memories.filter((m) => m.metadata.status === 'proposed').length
        const archived = memories.filter((m) => m.metadata.status === 'archived').length
        const deleted = memories.filter((m) => m.metadata.status === 'deleted').length
        console.log(
          `Memories: ${active} active, ${proposed} proposed, ${archived} archived, ${deleted} deleted`
        )
      }
    })
}
