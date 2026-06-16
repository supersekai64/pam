# PAMH Role Examples

Use these flows as starting points. PAMH is project-local by default: each flow
assumes you run commands from the project root that owns `.ai-memory/`.

## Solo Developer

Goal: keep project decisions and gotchas available across agent sessions.

```bash
memory init
memory doctor integrations
memory smoke-test agent
memory review
```

Capture manually when the agent cannot call MCP:

```bash
memory add -t decision -c "Use PostgreSQL for the main application database" --tags "database,architecture"
memory add -t mistake -c "Do not run migrations from the UI process" --tags "deploy"
memory search "database choice"
memory context --query "deployment gotchas"
```

## Team Committing Project Memory

Goal: share durable project knowledge in Git while keeping local indexes and
observations out of review noise.

Recommended:

- Commit curated Markdown memories under `.ai-memory/`.
- Review proposed memories before committing them.
- Rebuild the local index after pulling memory changes.
- Keep `.ai-memory/memory.db`, observations, and backups local unless your team
  explicitly wants to review them.

```bash
memory review
memory approve mem_abc123
memory doctor check
memory index rebuild
```

## Codex Agent

Goal: let Codex read and propose project memories through MCP.

```bash
memory init
memory init --codex-global
memory doctor integrations
memory smoke-test agent
```

Restart Codex after changing global MCP configuration. In assisted mode, Codex
proposes memories and you approve them with:

```bash
memory review
memory approve mem_abc123
```

## Claude Code With Hooks

Goal: record lifecycle observations and use MCP tools when available.

```bash
memory init
memory doctor integrations
```

Generated Claude instructions and hooks should call current `memory` commands
without deprecated `--project` flags. After initialization, start a fresh Claude
Code session so it reloads project instructions.

Use the review queue after sessions:

```bash
memory review
memory status --verbose
```

## Sensitive Or Manual-Only User

Goal: keep full control over durable memory.

Set capture mode to manual in `.ai-memory/config.json` or through the UI before
working with agents. Manual mode keeps MCP checkpoint calls from creating durable
memories automatically.

Recommended routine:

```bash
memory init --no-integrations
memory add -t preference -c "Do not store private customer names in PAMH" --tags "privacy"
memory redact mem_abc123
memory export backup.zip
```

When using physical deletion, PAMH writes a local backup first:

```bash
memory delete mem_abc123 --physical --yes
memory restore mem_abc123
```
