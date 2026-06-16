import { createConnection } from 'node:net'
import { get, request as httpRequest } from 'node:http'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { Command } from 'commander'

interface UiCommandOptions {
  host?: string
  port?: string
  open?: boolean
}

interface PamhServerProbe {
  token: string
}

export function registerUiCommand(program: Command) {
  program
    .command('ui')
    .description('Start the local PAMH web UI')
    .option('--host <host>', 'Host to bind', '127.0.0.1')
    .option('-p, --port <port>', 'Port to bind', '3939')
    .option('--open', 'Open the UI in the default browser')
    .action(async (options: UiCommandOptions) => {
      const port = Number.parseInt(options.port ?? '3939', 10)
      if (!Number.isFinite(port)) {
        console.error(`Invalid port: ${options.port}`)
        process.exit(1)
      }

      const host = options.host ?? '127.0.0.1'
      const url = `http://${host}:${port}`

      try {
        const app = await startUiServer(host, port)

        console.log(`PAMH UI running at ${app.url}`)
        console.log('Press Ctrl+C to stop.')

        if (options.open) {
          openBrowser(app.url)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          const running = await probePamhServer(url, process.cwd())
          if (running) {
            console.log(`Stopping existing PAMH UI instance on port ${port}...`)
            await shutdownServer(url, running.token)
            const freed = await waitForPortFree(host, port, 3000)
            if (!freed) {
              console.error(
                `Existing PAMH UI on port ${port} did not stop. Stop it manually or choose --port.`
              )
              process.exit(1)
            }

            const app = await startUiServer(host, port)
            console.log(`PAMH UI running at ${app.url}`)
            console.log('Press Ctrl+C to stop.')
            if (options.open) openBrowser(app.url)
            return
          }
          console.error(
            `Port ${port} is already in use by another process. Use --port to specify a different port.`
          )
          process.exit(1)
        }
        if (isPamhPackageMismatch(error)) {
          console.error(
            'PAMH UI cannot start because the installed pamh-cli, pamh-api, and pamh-core packages are incompatible.'
          )
          console.error(
            'Update all published PAMH packages together, or use a workspace-linked CLI build.'
          )
          console.error(error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
        throw error
      }
    })
}

async function startUiServer(host: string, port: number) {
  const { startLocalApiServer } = await import('pamh-api')
  return startLocalApiServer({
    cwd: process.cwd(),
    host,
    port,
  })
}

function isPamhPackageMismatch(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    /requested module 'pamh-core' does not provide an export named/i.test(error.message)
  )
}

async function probePamhServer(
  url: string,
  expectedProjectPath: string
): Promise<PamhServerProbe | null> {
  const health = await getJson<{
    ok?: boolean
    name?: string
    projectPath?: string
  }>(`${url}/api/health`)

  if (
    !health ||
    health.ok !== true ||
    health.name !== 'pamh' ||
    !health.projectPath ||
    resolve(health.projectPath) !== resolve(expectedProjectPath)
  ) {
    return null
  }

  const session = await getJson<{ token?: string }>(`${url}/api/session`)
  if (!session?.token) return null

  return { token: session.token }
}

function getJson<T>(url: string): Promise<T | null> {
  return new Promise((resolve) => {
    const req = get(url, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null)
          return
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T)
        } catch {
          resolve(null)
        }
      })
    })
    req.on('error', () => resolve(null))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(null)
    })
  })
}

function shutdownServer(url: string, token: string): Promise<void> {
  return new Promise((resolve) => {
    const parsed = new URL(`${url}/api/shutdown`)
    const req = httpRequest(
      {
        host: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: { 'x-pamh-session': token },
      },
      (res) => {
        res.resume()
        resolve()
      }
    )
    req.on('error', () => resolve())
    req.setTimeout(3000, () => {
      req.destroy()
      resolve()
    })
    req.end()
  })
}

function waitForPortFree(host: string, port: number, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const check = () => {
      const sock = createConnection({ host, port })
      sock.once('connect', () => {
        sock.destroy()
        if (Date.now() < deadline) setTimeout(check, 200)
        else resolve(false)
      })
      sock.once('error', () => {
        sock.destroy()
        resolve(true)
      })
    }
    setTimeout(check, 300)
  })
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}
