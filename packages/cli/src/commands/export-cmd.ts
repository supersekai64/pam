import { Command } from 'commander'
import { exportMemories, getGlobalMemoryPath, getProjectMemoryPath } from '@pamh/core'
import { resolve } from 'node:path'

export function registerExportCommand(program: Command) {
  program
    .command('export <output>')
    .description('Export memories to a file')
    .option('-f, --format <format>', 'Export format (zip, json, markdown, sqlite)', 'zip')
    .option('--project', 'Use project memory instead of global')
    .action(async (output, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()
      const outputPath = resolve(output)

      console.log(`Exporting memories to ${outputPath}...`)

      try {
        await exportMemories({
          format: options.format,
          outputPath,
          basePath,
        })

        console.log(`Export completed: ${outputPath}`)
      } catch (error) {
        console.error(`Export failed: ${error}`)
        process.exit(1)
      }
    })
}
