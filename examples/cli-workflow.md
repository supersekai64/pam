# CLI Workflow Example

This example demonstrates manual CLI usage for adding memories, searching, and compiling context.

**Note:** For automatic memory capture with your AI agent (Cursor, Copilot, Claude Code, etc.), see [MCP Configuration](../docs/mcp.md) and the [Getting Started guide](../docs/getting-started.md#automatic-memory-capture-default).

## Initialize

```bash
memory init
```

## Add Memories

```bash
memory add -t decision --tags "architecture,sqlite" -c "Use SQLite as a rebuildable local index."
memory add -t knowledge --tags "typescript" -c "Core packages must stay independent from CLI and MCP."
memory add -t mistake --tags "security" -c "Do not store secrets in memory files."
```

## List And Search

```bash
memory list
memory search "SQLite"
memory search --tag security
memory search "local index" --semantic
```

## Compile Context

```bash
memory context --query "architecture" --output
```

The compiled context is written to:

```text
.ai-memory/compiled-context.md
```
