import { Command } from 'commander'
import {
  readMemory,
  updateMemory,
  redactContent,
  getGlobalMemoryPath,
  getProjectMemoryPath,
} from 'pamh-core'

export function registerRedactCommand(program: Command) {
  program
    .command('redact <id>')
    .description('Redact sensitive information from a memory')
    .option('--project', 'Use project memory instead of global')
    .action(async (id, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const memory = await readMemory(basePath, id)
      if (!memory) {
        console.error(`Memory not found: ${id}`)
        process.exit(1)
      }

      const result = redactContent(memory.content)

      if (result.redactions.length === 0) {
        console.log('No sensitive information found to redact')
        return
      }

      await updateMemory(basePath, id, { content: result.content })

      console.log(`Redacted ${result.redactions.length} item(s):`)
      for (const redaction of result.redactions) {
        console.log(`  - ${redaction.type}: ${redaction.count}`)
      }
    })
}
