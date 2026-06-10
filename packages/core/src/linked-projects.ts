import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

export interface LinkedProjectsConfig {
  projects: string[]
}

interface NamedLinkedProjectsConfig {
  linked_projects?: unknown
}

export async function loadLinkedProjects(basePath: string): Promise<LinkedProjectsConfig> {
  const configPath = join(basePath, 'linked-projects.yaml')

  if (!existsSync(configPath)) {
    return { projects: [] }
  }

  try {
    const content = await readFile(configPath, 'utf-8')
    const config = yaml.load(content) as unknown

    const projects = normalizeLinkedProjects(config)

    if (projects.length === 0) {
      return { projects: [] }
    }

    return { projects }
  } catch (error) {
    console.warn(`Warning: Failed to parse linked-projects.yaml: ${error}`)
    return { projects: [] }
  }
}

function normalizeLinkedProjects(config: unknown): string[] {
  if (!config || typeof config !== 'object') {
    return []
  }

  const record = config as Record<string, unknown>
  if (Array.isArray(record.projects)) {
    return record.projects.filter((project): project is string => typeof project === 'string')
  }

  const projects: string[] = []
  for (const value of Object.values(record)) {
    if (!value || typeof value !== 'object') continue

    const named = value as NamedLinkedProjectsConfig
    if (Array.isArray(named.linked_projects)) {
      projects.push(
        ...named.linked_projects.filter((project): project is string => typeof project === 'string')
      )
    }
  }

  return [...new Set(projects)]
}

export async function saveLinkedProjects(
  basePath: string,
  config: LinkedProjectsConfig
): Promise<void> {
  const configPath = join(basePath, 'linked-projects.yaml')
  const content = yaml.dump(config, { indent: 2 })
  await writeFile(configPath, content, 'utf-8')
}

export async function addLinkedProject(basePath: string, projectPath: string): Promise<void> {
  const config = await loadLinkedProjects(basePath)

  if (!config.projects.includes(projectPath)) {
    config.projects.push(projectPath)
    await saveLinkedProjects(basePath, config)
  }
}

export async function removeLinkedProject(basePath: string, projectPath: string): Promise<void> {
  const config = await loadLinkedProjects(basePath)
  config.projects = config.projects.filter((p) => p !== projectPath)
  await saveLinkedProjects(basePath, config)
}
