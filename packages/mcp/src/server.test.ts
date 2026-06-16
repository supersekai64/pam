import { describe, expect, it } from 'vitest'
import { createPamhMcpServer } from './server.js'

describe('PAMH MCP server contract', () => {
  it('registers the documented memory and intelligence tools', () => {
    const server = createPamhMcpServer({ cwd: process.cwd() })
    const registeredTools = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools
    )

    expect(registeredTools).toEqual(
      expect.arrayContaining([
        'search_memory',
        'get_memory',
        'add_memory',
        'memory_checkpoint',
        'edit_memory',
        'delete_memory',
        'compile_context',
        'recommend_memory_maintenance',
        'preview_memory_distillation',
        'preview_knowledge_graph',
        'apply_memory_recommendation',
      ])
    )
  })

  it('ships explicit capture workflow instructions to MCP clients', () => {
    const server = createPamhMcpServer({ cwd: process.cwd() })
    const instructions = (server as unknown as { server: { _instructions?: string } }).server
      ._instructions

    expect(instructions).toContain('At the start of every task')
    expect(instructions).toContain('memory_checkpoint')
    expect(instructions).toContain('PAMH is project-only')
  })
})
