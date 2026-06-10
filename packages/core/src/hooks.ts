import { readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { generateId } from './id.js'

// Lifecycle hook event types
export type HookEventType =
  | 'session-start'
  | 'user-prompt'
  | 'pre-tool-use'
  | 'post-tool-use'
  | 'pre-compact'
  | 'notification'
  | 'stop'
  | 'session-end'
  | 'other'

export interface HookEvent {
  id: string
  type: HookEventType
  timestamp: string
  agent?: string  // e.g. "claude-code", "codex", "opencode"
  session_id?: string
  project_path?: string
  data: Record<string, unknown>  // Event-specific data
}

const SESSIONS_DIR = 'sessions'
const OBSERVATIONS_DIR = 'observations'

/**
 * Record a lifecycle hook event (fire-and-forget)
 */
export async function recordHookEvent(
  basePath: string,
  event: Omit<HookEvent, 'id' | 'timestamp'>
): Promise<HookEvent> {
  const observationsDir = join(basePath, OBSERVATIONS_DIR)

  // Create observations directory if it doesn't exist
  if (!existsSync(observationsDir)) {
    await mkdir(observationsDir, { recursive: true })
  }

  const id = generateId()
  const timestamp = new Date().toISOString()

  const fullEvent: HookEvent = {
    id,
    timestamp,
    ...event,
  }

  // Write to observations log (append-only)
  const logFile = join(observationsDir, `${timestamp.split('T')[0]}.jsonl`)
  await writeFile(logFile, JSON.stringify(fullEvent) + '\n', { flag: 'a', encoding: 'utf-8' })

  // If it's a session-end event, create a session summary
  if (event.type === 'session-end' && event.session_id) {
    await createSessionSummary(basePath, event.session_id)
  }

  return fullEvent
}

/**
 * Create a session summary from hook events
 */
async function createSessionSummary(basePath: string, sessionId: string): Promise<void> {
  const sessionsDir = join(basePath, SESSIONS_DIR)

  // Create sessions directory if it doesn't exist
  if (!existsSync(sessionsDir)) {
    await mkdir(sessionsDir, { recursive: true })
  }

  // Read all observations for this session
  const events = await getSessionEvents(basePath, sessionId)

  if (events.length === 0) return

  // Create a simple rule-based summary
  const summary = {
    session_id: sessionId,
    started_at: events[0]?.timestamp,
    ended_at: events[events.length - 1]?.timestamp,
    agent: events[0]?.agent,
    event_count: events.length,
    prompts: events.filter((e) => e.type === 'user-prompt').length,
    tool_calls: events.filter((e) => e.type === 'post-tool-use').length,
    summary: generateRuleBasedSummary(events),
  }

  const summaryFile = join(sessionsDir, `${sessionId}.json`)
  await writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf-8')
}

/**
 * Generate a rule-based summary from events
 */
function generateRuleBasedSummary(events: HookEvent[]): string {
  const prompts = events.filter((e) => e.type === 'user-prompt')
  const toolCalls = events.filter((e) => e.type === 'post-tool-use')

  let summary = `Session with ${prompts.length} prompts and ${toolCalls.length} tool calls.`

  if (prompts.length > 0) {
    const firstPrompt = prompts[0]?.data?.text as string | undefined
    if (firstPrompt) {
      summary += ` First prompt: "${firstPrompt.substring(0, 100)}..."`
    }
  }

  return summary
}

/**
 * Get all events for a session
 */
export async function getSessionEvents(
  basePath: string,
  sessionId?: string
): Promise<HookEvent[]> {
  const observationsDir = join(basePath, OBSERVATIONS_DIR)

  if (!existsSync(observationsDir)) {
    return []
  }

  const files = await readdir(observationsDir)
  const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

  const events: HookEvent[] = []

  for (const file of jsonlFiles) {
    const filePath = join(observationsDir, file)
    const content = await readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n')

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event: HookEvent = JSON.parse(line)
        if (!sessionId || event.session_id === sessionId) {
          events.push(event)
        }
      } catch {
        // Skip invalid lines
      }
    }
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return events
}

/**
 * Get recent events (last N days)
 */
export async function getRecentEvents(
  basePath: string,
  days: number = 7
): Promise<HookEvent[]> {
  const observationsDir = join(basePath, OBSERVATIONS_DIR)

  if (!existsSync(observationsDir)) {
    return []
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const files = await readdir(observationsDir)
  const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

  const events: HookEvent[] = []

  for (const file of jsonlFiles) {
    // Check if file is within the date range
    const fileDate = new Date(file.replace('.jsonl', ''))
    if (fileDate < cutoff) continue

    const filePath = join(observationsDir, file)
    const content = await readFile(filePath, 'utf-8')
    const lines = content.trim().split('\n')

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event: HookEvent = JSON.parse(line)
        events.push(event)
      } catch {
        // Skip invalid lines
      }
    }
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return events
}
