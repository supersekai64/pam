# CLI Workflow Example

This example creates project memory, adds memories, searches them, and compiles context.

## Initialize

```bash
memory init project
```

## Add Memories

```bash
memory add --project -t decision -s project --tags "architecture,sqlite" -c "Use SQLite as a rebuildable local index."
memory add --project -t knowledge -s project --tags "typescript" -c "Core packages must stay independent from CLI and MCP."
memory add --project -t mistake -s project --tags "security" -c "Do not store secrets in memory files."
```

## List And Search

```bash
memory list --project
memory search "SQLite" --project
memory search --tag security --project
memory search "local index" --semantic --project
```

## Compile Context

```bash
memory context --project --query "architecture" --output
```

The compiled context is written to:

```text
.ai-memory/compiled-context.md
```
