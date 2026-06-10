import { Command } from 'commander'
import { listMemories, getGlobalMemoryPath, getProjectMemoryPath } from '@pamh/core'

export function registerListCommand(program: Command) {
  program
    .command('list')
    .description('List all memories')
    .option('--project', 'Use project memory instead of global')
    .option('--type <type>', 'Filter by type')
    .option('--scope <scope>', 'Filter by scope')
    .option('--tag <tag>', 'Filter by tag')
    .action(async (options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      let memories = await listMemories(basePath)

      if (options.type) {
        memories = memories.filter((m) => m.metadata.type === options.type)
      }
      if (options.scope) {
        memories = memories.filter((m) => m.metadata.scope === options.scope)
      }
      if (options.tag) {
        memories = memories.filter((m) => m.metadata.tags.includes(options.tag))
      }

      if (memories.length === 0) {
        console.log('No memories found')
        return
      }

      for (const memory of memories) {
        const { id, type, scope, status, tags } = memory.metadata
        const preview = memory.content.slice(0, 50).replace(/\n/g, ' ')
        const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
        console.log(`${id} | ${type} | ${scope} | ${status}${tagStr} | ${preview}...`)
      }

      console.log(`\nTotal: ${memories.length} memories`)
    })
}
