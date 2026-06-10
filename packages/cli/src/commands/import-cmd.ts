import { Command } from 'commander'
import { importMemories, getGlobalMemoryPath, getProjectMemoryPath } from '@pamh/core'
import { resolve } from 'node:path'

export function registerImportCommand(program: Command) {
  program
    .command('import <input>')
    .description('Import memories from a file')
    .option('-f, --format <format>', 'Import format (zip, json, markdown)', 'json')
    .option('--project', 'Use project memory instead of global')
    .action(async (input, options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()
      const inputPath = resolve(input)

      console.log(`Importing memories from ${inputPath}...`)

      try {
        const result = await importMemories({
          format: options.format,
          inputPath,
          basePath,
        })

        console.log(`\nImport completed:`)
        console.log(`  Imported: ${result.imported}`)
        console.log(`  Skipped: ${result.skipped}`)

        if (result.errors.length > 0) {
          console.log(`\nErrors:`)
          for (const error of result.errors) {
            console.log(`  - ${error}`)
          }
        }
      } catch (error) {
        console.error(`Import failed: ${error}`)
        process.exit(1)
      }
    })
}
