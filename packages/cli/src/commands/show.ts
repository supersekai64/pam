import { Command } from 'commander'
import { readMemory, getGlobalMemoryPath, getProjectMemoryPath } from '@pamh/core'

export function registerShowCommand(program: Command) {
  program
    .command('show <id>')
    .description('Show a memory by ID')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const memory = await readMemory(basePath, id)

      if (!memory) {
        console.error(`Memory not found: ${id}`)
        process.exit(1)
      }

      console.log('---')
      console.log(`ID: ${memory.metadata.id}`)
      console.log(`Type: ${memory.metadata.type}`)
      console.log(`Scope: ${memory.metadata.scope}`)
      console.log(`Status: ${memory.metadata.status}`)
      console.log(`Created: ${memory.metadata.created_at}`)
      console.log(`Updated: ${memory.metadata.updated_at}`)
      console.log(`Tags: ${memory.metadata.tags.join(', ') || 'none'}`)
      console.log(`Source: ${memory.metadata.source}`)
      console.log('---')
      console.log()
      console.log(memory.content)
    })
}
