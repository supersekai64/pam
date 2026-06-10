import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface IntegrationResult {
  path: string
  status: 'created' | 'updated' | 'unchanged' | 'skipped'
  reason?: string
}

export interface ConfigureProjectIntegrationsResult {
  results: IntegrationResult[]
}

const START_MARKER = '<!-- PAMH:START -->'
const END_MARKER = '<!-- PAMH:END -->'

const MEMORY_INSTRUCTIONS = `${START_MARKER}
## PAMH Memory

Use PAMH as the project memory layer.

PAMH uses **assisted capture mode** by default: when you call \`add_memory\`, the memory is created with \`status: proposed\` and requires user approval before becoming active.

**Language requirement**: Always write memory content in English, regardless of the conversation language.

At the start of a task:
- Search PAMH memory for relevant project context.
- Use \`compile_context\` when broader context is useful.

During or after a task:
- When you make a durable project decision, call \`add_memory\`.
- When you finish meaningful work, call \`add_memory\` with a short session summary.
- When you discover a mistake, constraint, or reusable fact, call \`add_memory\`.

Use these memory types:
- \`decision\` for technical decisions.
- \`session\` for completed work summaries.
- \`knowledge\` for reusable facts.
- \`mistake\` for lessons learned.
- \`task\` for follow-up work.

Use scope \`project\` by default.

Do not store secrets, API keys, tokens, passwords, private credentials, or transient logs.
${END_MARKER}
`

const PAMH_MCP_SERVER = {
  type: 'local',
  command: ['memory', 'server', 'start'],
  enabled: true,
}

export async function configureProjectIntegrations(
  projectPath: string
): Promise<ConfigureProjectIntegrationsResult> {
  const results: IntegrationResult[] = []

  results.push(await upsertMarkdownBlock(join(projectPath, 'AGENTS.md'), '# Project Instructions'))
  results.push(await upsertMarkdownBlock(join(projectPath, 'CLAUDE.md'), '# Claude Instructions'))
  results.push(
    await upsertMarkdownBlock(
      join(projectPath, '.github', 'copilot-instructions.md'),
      '# GitHub Copilot Instructions'
    )
  )
  results.push(
    await upsertMarkdownBlock(
      join(projectPath, '.cursor', 'rules', 'pamh.mdc'),
      '---\nalwaysApply: true\n---'
    )
  )
  results.push(await upsertOpenCodeConfig(join(projectPath, 'opencode.json')))
  results.push(await upsertMcpConfig(join(projectPath, '.mcp.json')))
  results.push(await upsertMcpConfig(join(projectPath, '.cursor', 'mcp.json')))

  return { results }
}

async function upsertMarkdownBlock(filePath: string, heading: string): Promise<IntegrationResult> {
  await mkdir(dirname(filePath), { recursive: true })

  if (!existsSync(filePath)) {
    await writeFile(filePath, `${heading}\n\n${MEMORY_INSTRUCTIONS}`, 'utf-8')
    return { path: filePath, status: 'created' }
  }

  const existing = await readFile(filePath, 'utf-8')
  if (existing.includes(START_MARKER) && existing.includes(END_MARKER)) {
    const updated = replaceMarkedBlock(existing, MEMORY_INSTRUCTIONS)
    if (updated === existing) {
      return { path: filePath, status: 'unchanged' }
    }

    await writeFile(filePath, updated, 'utf-8')
    return { path: filePath, status: 'updated' }
  }

  await writeFile(filePath, `${existing.trimEnd()}\n\n${MEMORY_INSTRUCTIONS}`, 'utf-8')
  return { path: filePath, status: 'updated' }
}

async function upsertOpenCodeConfig(filePath: string): Promise<IntegrationResult> {
  const defaultConfig = {
    $schema: 'https://opencode.ai/config.json',
    instructions: ['AGENTS.md'],
    mcp: {
      pamh: PAMH_MCP_SERVER,
    },
  }

  if (!existsSync(filePath)) {
    await writeJson(filePath, defaultConfig)
    return { path: filePath, status: 'created' }
  }

  try {
    const config = JSON.parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>
    const instructions = Array.isArray(config.instructions) ? config.instructions : []
    const nextInstructions = instructions.includes('AGENTS.md')
      ? instructions
      : [...instructions, 'AGENTS.md']
    const mcp = isRecord(config.mcp) ? config.mcp : {}
    const updated = {
      ...config,
      $schema: typeof config.$schema === 'string' ? config.$schema : defaultConfig.$schema,
      instructions: nextInstructions,
      mcp: {
        ...mcp,
        pamh: PAMH_MCP_SERVER,
      },
    }

    const existing = JSON.stringify(config)
    const next = JSON.stringify(updated)
    if (existing === next) {
      return { path: filePath, status: 'unchanged' }
    }

    await writeJson(filePath, updated)
    return { path: filePath, status: 'updated' }
  } catch (error) {
    return {
      path: filePath,
      status: 'skipped',
      reason: `Could not parse existing JSON: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function upsertMcpConfig(filePath: string): Promise<IntegrationResult> {
  const defaultConfig = {
    mcpServers: {
      pamh: {
        command: 'memory',
        args: ['server', 'start'],
      },
    },
  }

  await mkdir(dirname(filePath), { recursive: true })

  if (!existsSync(filePath)) {
    await writeJson(filePath, defaultConfig)
    return { path: filePath, status: 'created' }
  }

  try {
    const config = JSON.parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>
    const mcpServers = isRecord(config.mcpServers) ? config.mcpServers : {}
    const updated = {
      ...config,
      mcpServers: {
        ...mcpServers,
        pamh: defaultConfig.mcpServers.pamh,
      },
    }

    const existing = JSON.stringify(config)
    const next = JSON.stringify(updated)
    if (existing === next) {
      return { path: filePath, status: 'unchanged' }
    }

    await writeJson(filePath, updated)
    return { path: filePath, status: 'updated' }
  } catch (error) {
    return {
      path: filePath,
      status: 'skipped',
      reason: `Could not parse existing JSON: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function replaceMarkedBlock(content: string, block: string): string {
  const start = content.indexOf(START_MARKER)
  const end = content.indexOf(END_MARKER)

  if (start === -1 || end === -1 || end < start) {
    return `${content.trimEnd()}\n\n${block}`
  }

  return `${content.slice(0, start).trimEnd()}\n\n${block}${content.slice(end + END_MARKER.length).trimStart()}`
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
