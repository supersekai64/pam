import { Command } from 'commander'
import { startPamhMcpServer } from '../mcp/server.js'

export function registerServerCommand(program: Command) {
  const server = program.command('server').description('Run PAMH servers')

  server
    .command('start')
    .description('Start the PAMH MCP server over stdio')
    .action(async () => {
      await startPamhMcpServer({ cwd: process.cwd() })
    })
}
