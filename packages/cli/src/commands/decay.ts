import { Command } from 'commander'
import {
  forgetSweep,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  type DecayConfig,
} from '@pamh/core'

export function registerDecayCommand(program: Command) {
  const decay = program.command('decay').description('Memory decay management')

  decay
    .command('sweep')
    .description('Run forget sweep (soft-delete memories below threshold)')
    .option('--lambda <lambda>', 'Temporal decay rate', '0.02')
    .option('--sigma <sigma>', 'Access reinforcement weight', '0.6')
    .option('--mu <mu>', 'Access decay rate', '0.04')
    .option('--threshold <threshold>', 'Cold threshold', '0.20')
    .option('--hard-delete-days <days>', 'Days before hard-delete', '180')
    .option('--dry-run', 'Preview without making changes')
    .option('--project', 'Use project memory instead of global')
    .action(async (options) => {
      const basePath = options.project ? getProjectMemoryPath(process.cwd()) : getGlobalMemoryPath()

      const config: DecayConfig = {
        lambda: parseFloat(options.lambda),
        sigma: parseFloat(options.sigma),
        mu: parseFloat(options.mu),
        coldThreshold: parseFloat(options.threshold),
        hardDeleteAfterDays: parseInt(options.hardDeleteDays, 10),
      }

      console.log('Running forget sweep...')
      if (options.dryRun) {
        console.log('(dry run - no changes will be made)\n')
      }

      const result = await forgetSweep(basePath, config, options.dryRun)

      console.log(`\nResults:`)
      console.log(`  Soft-deleted: ${result.softDeleted.length}`)
      console.log(`  Hard-deleted: ${result.hardDeleted.length}`)
      console.log(`  Preserved: ${result.preserved.length}`)

      if (result.softDeleted.length > 0) {
        console.log(`\nSoft-deleted memories:`)
        result.softDeleted.forEach((m) => {
          console.log(`  - ${m.metadata.id}: ${m.content.substring(0, 60)}...`)
        })
      }

      if (result.hardDeleted.length > 0) {
        console.log(`\nHard-deleted memories:`)
        result.hardDeleted.forEach((m) => {
          console.log(`  - ${m.metadata.id}: ${m.content.substring(0, 60)}...`)
        })
      }
    })
}
