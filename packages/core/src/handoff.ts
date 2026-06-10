import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { generateId } from './id.js'
import type { Handoff, HandoffStatus } from './types.js'

const HANDOFFS_DIR = 'handoffs'

/**
 * Begin a handoff (create an open handoff for the next agent)
 */
export async function beginHandoff(
  basePath: string,
  summary: string,
  agentFrom?: string,
  openQuestions?: string[],
  nextSteps?: string[]
): Promise<Handoff> {
  const handoffsDir = join(basePath, HANDOFFS_DIR)

  // Create handoffs directory if it doesn't exist
  if (!existsSync(handoffsDir)) {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(handoffsDir, { recursive: true })
  }

  const id = generateId()
  const now = new Date().toISOString()

  const handoff: Handoff = {
    id,
    project_path: process.cwd(),
    status: 'open',
    created_at: now,
    agent_from: agentFrom,
    summary,
    open_questions: openQuestions,
    next_steps: nextSteps,
  }

  const filePath = join(handoffsDir, `${id}.json`)
  await writeFile(filePath, JSON.stringify(handoff, null, 2), 'utf-8')

  return handoff
}

/**
 * Accept a handoff (mark it as accepted by the next agent)
 */
export async function acceptHandoff(
  basePath: string,
  handoffId: string,
  agentTo?: string
): Promise<Handoff | null> {
  const handoffsDir = join(basePath, HANDOFFS_DIR)
  const filePath = join(handoffsDir, `${handoffId}.json`)

  if (!existsSync(filePath)) {
    return null
  }

  const raw = await readFile(filePath, 'utf-8')
  const handoff: Handoff = JSON.parse(raw)

  if (handoff.status !== 'open') {
    throw new Error(`Handoff ${handoffId} is not open (status: ${handoff.status})`)
  }

  handoff.status = 'accepted'
  handoff.accepted_at = new Date().toISOString()
  handoff.agent_to = agentTo

  await writeFile(filePath, JSON.stringify(handoff, null, 2), 'utf-8')

  return handoff
}

/**
 * Get the latest open handoff
 */
export async function getOpenHandoff(basePath: string): Promise<Handoff | null> {
  const handoffsDir = join(basePath, HANDOFFS_DIR)

  if (!existsSync(handoffsDir)) {
    return null
  }

  const files = await readdir(handoffsDir)
  const handoffFiles = files.filter((f) => f.endsWith('.json'))

  // Read all handoffs and find the latest open one
  const handoffs: Handoff[] = []
  for (const file of handoffFiles) {
    const filePath = join(handoffsDir, file)
    const raw = await readFile(filePath, 'utf-8')
    handoffs.push(JSON.parse(raw))
  }

  // Sort by created_at descending and find the first open one
  handoffs.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return handoffs.find((h) => h.status === 'open') ?? null
}

/**
 * List all handoffs
 */
export async function listHandoffs(
  basePath: string,
  status?: HandoffStatus
): Promise<Handoff[]> {
  const handoffsDir = join(basePath, HANDOFFS_DIR)

  if (!existsSync(handoffsDir)) {
    return []
  }

  const files = await readdir(handoffsDir)
  const handoffFiles = files.filter((f) => f.endsWith('.json'))

  const handoffs: Handoff[] = []
  for (const file of handoffFiles) {
    const filePath = join(handoffsDir, file)
    const raw = await readFile(filePath, 'utf-8')
    const handoff: Handoff = JSON.parse(raw)

    if (!status || handoff.status === status) {
      handoffs.push(handoff)
    }
  }

  // Sort by created_at descending
  handoffs.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return handoffs
}

/**
 * Expire old open handoffs (older than maxAgeDays)
 */
export async function expireOldHandoffs(
  basePath: string,
  maxAgeDays: number = 7
): Promise<number> {
  const handoffsDir = join(basePath, HANDOFFS_DIR)

  if (!existsSync(handoffsDir)) {
    return 0
  }

  const files = await readdir(handoffsDir)
  const handoffFiles = files.filter((f) => f.endsWith('.json'))

  const now = Date.now()
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
  let expiredCount = 0

  for (const file of handoffFiles) {
    const filePath = join(handoffsDir, file)
    const raw = await readFile(filePath, 'utf-8')
    const handoff: Handoff = JSON.parse(raw)

    if (handoff.status === 'open') {
      const age = now - new Date(handoff.created_at).getTime()
      if (age > maxAgeMs) {
        handoff.status = 'expired'
        await writeFile(filePath, JSON.stringify(handoff, null, 2), 'utf-8')
        expiredCount++
      }
    }
  }

  return expiredCount
}
