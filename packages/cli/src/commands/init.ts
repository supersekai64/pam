import { Command } from 'commander'
import { initGlobalMemory, initProjectMemory } from '@pamh/core'

export function registerInitCommand(program: Command) {
  const init = program.command('init').description('Initialize memory storage')

  init
    .command('global')
    .description('Initialize global memory in ~/ai-memory')
    .action(async () => {
      const path = await initGlobalMemory()
      console.log(`Global memory initialized at: ${path}`)
    })

  init
    .command('project')
    .description('Initialize project memory in ./.ai-memory')
    .action(async () => {
      const path = await initProjectMemory(process.cwd())
      console.log(`Project memory initialized at: ${path}`)
    })
}
