import { spawn } from 'node:child_process'
import { Command } from 'commander'
import { startLocalApiServer } from '@pamh/api'

interface UiCommandOptions {
  host?: string
  port?: string
  open?: boolean
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

      const app = await startLocalApiServer({
        cwd: process.cwd(),
        host: options.host,
        port,
      })

      console.log(`PAMH UI running at ${app.url}`)
      console.log('Press Ctrl+C to stop.')

      if (options.open) {
        openBrowser(app.url)
      }
    })
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.unref()
}
