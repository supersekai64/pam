import { createReadStream, existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import {
  MemoryIndex,
  archiveMemory,
  createMemory,
  deleteMemory,
  getGlobalMemoryPath,
  getProjectMemoryPath,
  indexAllMemories,
  listMemories,
  readMemory,
  restoreMemory,
  updateMemory,
  type CreateMemoryInput,
  type UpdateMemoryInput,
} from '@pamh/core'
import { getUiDistPath } from '@pamh/ui'

export interface LocalApiServerOptions {
  cwd?: string
  host?: string
  port?: number
  staticDir?: string
}

export interface LocalApiServer {
  server: Server
  url: string
  close: () => Promise<void>
}

type Store = 'global' | 'project'

interface ApiErrorResponse {
  error: string
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 3939

export function createLocalApiServer(options: LocalApiServerOptions = {}): Server {
  const cwd = options.cwd ?? process.cwd()
  const staticDir = options.staticDir ?? getUiDistPath()

  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, cwd, staticDir)
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  })
}

export async function startLocalApiServer(
  options: LocalApiServerOptions = {}
): Promise<LocalApiServer> {
  const host = options.host ?? DEFAULT_HOST
  const port = options.port ?? DEFAULT_PORT
  const server = createLocalApiServer(options)

  await new Promise<void>((resolveServer) => server.listen(port, host, resolveServer))

  return {
    server,
    url: `http://${host}:${port}`,
    close: () => new Promise((resolveClose) => server.close(() => resolveClose())),
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  cwd: string,
  staticDir: string
): Promise<void> {
  const method = request.method ?? 'GET'
  const url = new URL(request.url ?? '/', 'http://localhost')

  if (url.pathname.startsWith('/api/')) {
    await handleApiRequest(request, response, method, url, cwd)
    return
  }

  await serveStatic(response, staticDir, url.pathname)
}

async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  method: string,
  url: URL,
  cwd: string
): Promise<void> {
  if (method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { ok: true })
    return
  }

  const store = parseStore(url)
  const basePath = resolveBasePath(cwd, store)

  if (method === 'GET' && url.pathname === '/api/memories') {
    await indexAllMemories(basePath)
    const query = url.searchParams.get('query') ?? undefined
    const type = url.searchParams.get('type') ?? undefined
    const scope = url.searchParams.get('scope') ?? undefined
    const tag = url.searchParams.get('tag') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const limit = Number(url.searchParams.get('limit') ?? 100)

    if (query || type || scope || tag) {
      const index = new MemoryIndex(basePath)
      const results = index.search({ query, type, scope, tag, limit })
      index.close()
      sendJson(response, 200, {
        memories: status ? results.filter((m) => m.status === status) : results,
      })
      return
    }

    const memories = await listMemories(basePath)
    sendJson(response, 200, {
      memories: memories
        .filter((memory) => !status || memory.metadata.status === status)
        .slice(0, Number.isFinite(limit) ? limit : 100),
    })
    return
  }

  if (method === 'POST' && url.pathname === '/api/memories') {
    const body = (await readJson(request)) as CreateMemoryInput
    const memory = await createMemory(basePath, body)
    sendJson(response, 201, { memory })
    return
  }

  const memoryMatch = url.pathname.match(/^\/api\/memories\/([^/]+)(?:\/(archive|restore))?$/)
  if (memoryMatch) {
    const id = decodeURIComponent(memoryMatch[1])
    const action = memoryMatch[2]

    if (method === 'GET' && !action) {
      const memory = await readMemory(basePath, id)
      if (!memory) return sendJson(response, 404, notFound(id))
      sendJson(response, 200, { memory })
      return
    }

    if (method === 'PATCH' && !action) {
      const body = (await readJson(request)) as UpdateMemoryInput
      const memory = await updateMemory(basePath, id, body)
      if (!memory) return sendJson(response, 404, notFound(id))
      sendJson(response, 200, { memory })
      return
    }

    if (method === 'DELETE' && !action) {
      const deleted = await deleteMemory(basePath, id, {
        physical: url.searchParams.get('physical') === 'true',
      })
      if (!deleted) return sendJson(response, 404, notFound(id))
      sendJson(response, 200, { deleted: true })
      return
    }

    if (method === 'POST' && action === 'archive') {
      const archived = await archiveMemory(basePath, id)
      if (!archived) return sendJson(response, 404, notFound(id))
      sendJson(response, 200, { archived: true })
      return
    }

    if (method === 'POST' && action === 'restore') {
      const restored = await restoreMemory(basePath, id)
      if (!restored) return sendJson(response, 404, notFound(id))
      sendJson(response, 200, { restored: true })
      return
    }
  }

  if (method === 'GET' && url.pathname === '/api/stats') {
    await indexAllMemories(basePath)
    const index = new MemoryIndex(basePath)
    const stats = index.getStats()
    index.close()
    sendJson(response, 200, { stats })
    return
  }

  sendJson(response, 404, { error: 'Not found' })
}

function parseStore(url: URL): Store {
  return url.searchParams.get('store') === 'global' ? 'global' : 'project'
}

function resolveBasePath(cwd: string, store: Store): string {
  return store === 'global' ? getGlobalMemoryPath() : getProjectMemoryPath(cwd)
}

function notFound(id: string): ApiErrorResponse {
  return { error: `Memory not found: ${id}` }
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'))
}

async function serveStatic(
  response: ServerResponse,
  staticDir: string,
  pathname: string
): Promise<void> {
  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = resolveStaticPath(staticDir, requestedPath)
  const pathToServe = existsSync(filePath) ? filePath : join(staticDir, 'index.html')

  if (!existsSync(pathToServe)) {
    sendJson(response, 404, { error: 'UI build not found. Run pnpm build first.' })
    return
  }

  response.writeHead(200, { 'content-type': getContentType(pathToServe) })
  createReadStream(pathToServe).pipe(response)
}

function resolveStaticPath(staticDir: string, pathname: string): string {
  const safePath = normalize(pathname).replace(/^([/\\])+/, '')
  const filePath = resolve(staticDir, safePath)
  const root = resolve(staticDir)

  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    return join(staticDir, 'index.html')
  }

  return filePath
}

function getContentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.js':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}
