import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  addMemory,
  compileMemoryContext,
  editMemory,
  getMemory,
  listProjects,
  removeMemory,
  searchMemory,
  type McpToolContext,
} from './tools.js'

const scopeSchema = z.enum(['global', 'project']).optional()

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

export function createPamhMcpServer(context: McpToolContext) {
  const server = new McpServer({
    name: 'pamh',
    version: '0.1.0',
  })

  server.registerTool(
    'search_memory',
    {
      title: 'Search Memory',
      description: 'Search PAMH memories by text, type, tag, and scope.',
      inputSchema: {
        query: z.string().optional(),
        scope: scopeSchema,
        type: z.string().optional(),
        tag: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    async (input) => jsonResult(await searchMemory(input, context))
  )

  server.registerTool(
    'get_memory',
    {
      title: 'Get Memory',
      description: 'Get a PAMH memory by ID.',
      inputSchema: {
        id: z.string(),
        scope: scopeSchema,
      },
    },
    async (input) => jsonResult(await getMemory(input, context))
  )

  server.registerTool(
    'add_memory',
    {
      title: 'Add Memory',
      description: 'Add a new PAMH memory.',
      inputSchema: {
        content: z.string(),
        type: z.string(),
        scope: z.enum(['global', 'project']).default('project'),
        tags: z.array(z.string()).optional(),
      },
    },
    async (input) => jsonResult(await addMemory(input, context))
  )

  server.registerTool(
    'edit_memory',
    {
      title: 'Edit Memory',
      description: 'Edit an existing PAMH memory.',
      inputSchema: {
        id: z.string(),
        content: z.string().optional(),
        type: z.string().optional(),
        scope: scopeSchema,
        tags: z.array(z.string()).optional(),
      },
    },
    async (input) => jsonResult(await editMemory(input, context))
  )

  server.registerTool(
    'delete_memory',
    {
      title: 'Delete Memory',
      description: 'Logically delete a PAMH memory.',
      inputSchema: {
        id: z.string(),
        scope: scopeSchema,
      },
    },
    async (input) => jsonResult({ deleted: await removeMemory(input, context) })
  )

  server.registerTool(
    'list_projects',
    {
      title: 'List Projects',
      description: 'List current and linked PAMH projects.',
      inputSchema: {
        includeCurrent: z.boolean().optional(),
      },
    },
    async (input) => jsonResult(await listProjects(input, context))
  )

  server.registerTool(
    'compile_context',
    {
      title: 'Compile Context',
      description: 'Compile context from global, project, linked, and search memories.',
      inputSchema: {
        query: z.string().optional(),
        maxTokens: z.number().int().positive().optional(),
      },
    },
    async (input) => jsonResult(await compileMemoryContext(input, context))
  )

  return server
}

export async function startPamhMcpServer(context: McpToolContext) {
  const server = createPamhMcpServer(context)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
