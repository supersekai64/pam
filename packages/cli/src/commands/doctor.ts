import { Command } from 'commander'
import {
  checkIndexConsistency,
  MemoryIndex,
  getGlobalMemoryPath,
  getProjectMemoryPath,
} from '@pamh/core'

export function registerDoctorCommand(program: Command) {
  const doctor = program.command('doctor').description('Diagnose memory system health')

  doctor
    .command('check')
    .description('Check consistency between Markdown files and SQLite index')
    .option('--project', 'Use project memory instead of global')
    .action(async (options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      console.log('Checking index consistency...')
      const report = await checkIndexConsistency(basePath)

      console.log(`\nFiles found: ${report.totalFiles}`)
      console.log(`Indexed: ${report.totalIndexed}`)

      if (report.missingInIndex.length > 0) {
        console.log(`\nMissing from index (${report.missingInIndex.length}):`)
        for (const id of report.missingInIndex) {
          console.log(`  - ${id}`)
        }
      }

      if (report.missingInFiles.length > 0) {
        console.log(`\nMissing from files (${report.missingInFiles.length}):`)
        for (const id of report.missingInFiles) {
          console.log(`  - ${id}`)
        }
      }

      if (report.missingInIndex.length === 0 && report.missingInFiles.length === 0) {
        console.log('\n✓ Index is consistent')
      }
    })

  doctor
    .command('stats')
    .description('Show memory statistics')
    .option('--project', 'Use project memory instead of global')
    .action((options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const index = new MemoryIndex(basePath)
      const stats = index.getStats()
      index.close()

      console.log(`\nTotal memories: ${stats.total}`)
      console.log(`Active: ${stats.active}`)
      console.log(`Deleted: ${stats.deleted}`)

      if (Object.keys(stats.byType).length > 0) {
        console.log('\nBy type:')
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${type}: ${count}`)
        }
      }

      if (Object.keys(stats.byScope).length > 0) {
        console.log('\nBy scope:')
        for (const [scope, count] of Object.entries(stats.byScope)) {
          console.log(`  ${scope}: ${count}`)
        }
      }

      if (Object.keys(stats.tags).length > 0) {
        console.log('\nTags:')
        for (const [tag, count] of Object.entries(stats.tags)) {
          console.log(`  ${tag}: ${count}`)
        }
      }
    })
}
