import { Command } from 'commander'
import { indexAllMemories, getGlobalMemoryPath, getProjectMemoryPath } from 'pamh-core'

export function registerIndexCommand(program: Command) {
  const index = program.command('index').description('Index management commands')

  index
    .command('build')
    .description('Index all memories into SQLite')
    .option('--project', 'Use project memory instead of global')
    .action(async (options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      console.log('Indexing memories...')
      const count = await indexAllMemories(basePath)
      console.log(`Indexed ${count} memories`)
    })

  index
    .command('rebuild')
    .description('Rebuild the entire index from scratch')
    .option('--project', 'Use project memory instead of global')
    .action(async (options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      console.log('Rebuilding index...')
      const count = await indexAllMemories(basePath)
      console.log(`Rebuilt index with ${count} memories`)
    })

  program
    .command('reindex')
    .description('Rebuild the entire index from scratch')
    .option('--project', 'Use project memory instead of global')
    .action(async (options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      console.log('Rebuilding index...')
      const count = await indexAllMemories(basePath)
      console.log(`Rebuilt index with ${count} memories`)
    })
}
