import { Command } from 'commander'

export function registerServerCommand(program: Command) {
  const server = program.command('server').description('Run PAMH servers')

  server
    .command('start')
    .description('Start the PAMH MCP server over stdio')
    .action(async () => {
      const { startPamhMcpServer } = await import('../mcp/server.js')
      await startPamhMcpServer({ cwd: process.cwd() })
    })
}
