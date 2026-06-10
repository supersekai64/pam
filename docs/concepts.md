# Concepts

## Memory

A memory is a Markdown document with YAML frontmatter metadata.

Example:

```markdown
---
id: mem_abc123
type: decision
scope: project
status: active
created_at: '2026-01-01T00:00:00.000Z'
updated_at: '2026-01-01T00:00:00.000Z'
tags:
  - architecture
source: manual
---

Use SQLite for the local memory index.
```

## Source Of Truth

Markdown is always the source of truth. SQLite, FTS5, and vector indexes are derived artifacts.

If an index is corrupted or missing, it can be rebuilt from Markdown files.

## Memory Types

Supported types:

- `decision`
- `knowledge`
- `mistake`
- `rule`
- `preference`
- `session`
- `task`
- `client`
- `project`
- `pattern`

## Memory Scopes

Supported scopes:

- `global`
- `project`
- `client`
- `stack`
- `temporary`
- `archived`

## Global Memory

Global memory is shared across projects and tools.

Default path:

```text
~/ai-memory
```

Use it for preferences, broad knowledge, patterns, and reusable decisions.

## Project Memory

Project memory belongs to one repository.

Default path:

```text
./.ai-memory
```

Use it for architecture, local decisions, project state, sessions, and tasks.

## Linked Projects

Linked projects allow a project to pull context from related repositories.

Configuration lives in:

```text
.ai-memory/linked-projects.yaml
```

Example:

```yaml
projects:
  - ../project-docs
  - ../project-web
```

## Context Compilation

Compiled context combines memory sources in this order:

1. Global memory
2. Project memory
3. Linked projects
4. Search results

Use:

```bash
memory context --query "architecture" --output
```

This writes `compiled-context.md` to project memory.
