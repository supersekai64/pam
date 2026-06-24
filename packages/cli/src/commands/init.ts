import { Command } from 'commander'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  configureCodexGlobalIntegration,
  configureProjectIntegrations,
  getAllProjectIntegrationTargets,
  initAutoCaptureConfig,
  initProjectMemory,
  type ProjectIntegrationTarget,
} from '@helloworlkd/pam-core'

interface InitProjectOptions {
  allIntegrations?: boolean
  codexGlobal?: boolean
  integration?: string[]
  integrations?: boolean
}

export function registerInitCommand(program: Command) {
  const init = program.command('init').description('Initialize memory storage')

  init
    .option('--codex-global', 'Also configure the global Codex MCP server in ~/.codex/config.toml')
    .option('--no-integrations', 'Skip project agent and IDE integration files')
    .option('--all-integrations', 'Generate every supported project integration file')
    .option(
      '--integration <target>',
      'Generate one project integration target. Repeatable. Targets: agents, claude, codex, copilot, cursor, opencode, mcp, vscode',
      collectIntegrationTarget,
      []
    )
    .action(async (options: InitProjectOptions) => {
      const cwd = process.cwd()
      const path = await initProjectMemory(cwd)
      await initAutoCaptureConfig(path)
      console.log(`Memory initialized at: ${path}`)

      const targets = await resolveIntegrationTargets(options)
      if (targets.length > 0) {
        const { results } = await configureProjectIntegrations(cwd, { targets })
        printIntegrationResults(results)
      } else if (options.integrations !== false) {
        console.log('\nProject integrations skipped.')
        console.log(
          'Run `pam init --integration <target>` or `pam init --all-integrations` when you know which tool files you want.'
        )
      }

      if (options.codexGlobal) {
        const result = await configureCodexGlobalIntegration()
        const suffix = result.reason ? ` (${result.reason})` : ''
        console.log('\nCodex global integration:')
        console.log(`  ${result.status}: ${result.path}${suffix}`)
        console.log('  Restart Codex for the MCP server to be available in new sessions.')
      }
    })
}

function collectIntegrationTarget(value: string, previous: string[]): string[] {
  return [...previous, value]
}

async function resolveIntegrationTargets(
  options: InitProjectOptions
): Promise<ProjectIntegrationTarget[]> {
  if (options.integrations === false) return []
  if (options.allIntegrations) return getAllProjectIntegrationTargets()

  const explicit = normalizeIntegrationTargets(options.integration ?? [])
  if (explicit.length > 0) return explicit

  if (!process.stdin.isTTY || !process.stdout.isTTY) return []
  return promptForIntegrationTargets()
}

function normalizeIntegrationTargets(values: string[]): ProjectIntegrationTarget[] {
  const allTargets = new Set(getAllProjectIntegrationTargets())
  const normalized = values.flatMap((value) =>
    value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )

  const invalid = normalized.filter((value) => !allTargets.has(value as ProjectIntegrationTarget))
  if (invalid.length > 0) {
    console.error(`Invalid integration target(s): ${invalid.join(', ')}`)
    console.error(`Valid targets: ${getAllProjectIntegrationTargets().join(', ')}`)
    process.exit(1)
  }

  return [...new Set(normalized)] as ProjectIntegrationTarget[]
}

async function promptForIntegrationTargets(): Promise<ProjectIntegrationTarget[]> {
  const targets = getAllProjectIntegrationTargets()
  console.log('\nWhich project integrations should PAM generate?')
  targets.forEach((target, index) => {
    console.log(`  ${index + 1}. ${target}`)
  })
  console.log('  0. none')

  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(
      'Select numbers or names separated by commas (default: none): '
    )
    const trimmed = answer.trim()
    if (!trimmed) return []
    if (trimmed === '0' || trimmed.toLowerCase() === 'none') return []

    const selected = trimmed.split(',').map((entry) => entry.trim())
    const mapped = selected.map((entry) => {
      const numeric = Number.parseInt(entry, 10)
      if (Number.isFinite(numeric) && String(numeric) === entry) {
        return targets[numeric - 1] ?? entry
      }
      return entry
    })
    return normalizeIntegrationTargets(mapped)
  } finally {
    rl.close()
  }
}

function printIntegrationResults(
  results: Array<{ status: string; path: string; reason?: string }>
) {
  console.log('\nProject integrations:')
  for (const result of results) {
    const suffix = result.reason ? ` (${result.reason})` : ''
    console.log(`  ${result.status}: ${result.path}${suffix}`)
  }
}
