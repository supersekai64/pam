import { Command } from 'commander'
import {
  compileContext,
  createMemory,
  initProjectMemory,
  listMemories,
  readMemory,
} from 'pamh-core'

export function registerSmokeTestCommand(program: Command) {
  const smoke = program.command('smoke-test').description('Run PAMH end-to-end smoke tests')

  smoke
    .command('agent')
    .description('Create and verify a proposed memory as an agent-capture proof')
    .action(async () => {
      const cwd = process.cwd()
      const basePath = await initProjectMemory(cwd)
      const marker = `pamh-smoke-${Date.now()}`

      const memory = await createMemory(basePath, {
        type: 'knowledge',
        scope: 'project',
        status: 'proposed',
        source: 'smoke-test',
        tags: ['smoke-test', marker],
        salience: 0.5,
        content:
          'PAMH smoke test memory: this proposed memory proves the local store, index, review queue, and context path are reachable.',
      })

      const loaded = await readMemory(basePath, memory.metadata.id)
      const proposed = (await listMemories(basePath)).some(
        (item) => item.metadata.id === memory.metadata.id && item.metadata.status === 'proposed'
      )
      const context = await compileContext(basePath, { query: marker, maxTokens: 1200 })

      console.log('PAMH agent smoke test\n')
      console.log(`Created proposed memory: ${memory.metadata.id}`)
      console.log(`Store: ${basePath}`)
      console.log(`Visible in review queue: ${proposed}`)
      console.log(`Readable from disk: ${Boolean(loaded)}`)
      console.log(
        `Visible after approval: ${context.sources.project.length > 0 ? 'yes' : 'pending approval'}`
      )
      console.log(`\nNext: approve it with \`memory approve ${memory.metadata.id}\`.`)
      console.log(
        `Then verify recall with \`memory search ${marker}\` or \`memory context --query ${marker}\`.`
      )
    })
}
