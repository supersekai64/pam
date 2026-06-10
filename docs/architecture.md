# Architecture

## Overview

```text
Global Memory
      │
      ▼
Project Memories
      │
      ▼
Memory Core
      │
      ├── CLI
      ├── MCP
      ├── Local API
      └── Local UI
```

## Memory Layers

### Global Memory

Location: `~/ai-memory`

Contains cross-project knowledge such as identity, preferences, patterns, and decisions.

### Project Memory

Location: `repo/.ai-memory`

Contains project-specific knowledge such as architecture, current state, tasks, and sessions.

## Packages

### @pamh/core

Responsible for storage, indexing, search, import, export, context compilation, and semantic search. It has no CLI or MCP dependency.

### @pamh/cli

Command-line interface. Depends on core.

### @pamh/api

Local HTTP API for human-facing clients. It binds to `127.0.0.1` by default and delegates all persistence to core. Future desktop apps and IDE extensions can use this API boundary from separate repositories.

### @pamh/mcp

MCP server for integration with IDEs and AI agents. Depends on core.

### @pamh/ui

Static local web UI served by the local API server. It does not own data or contain persistence logic.

## Storage

- **Source of truth** : Markdown
- **Index** : SQLite (memory.db)

## Search

- Text search (FTS5)
- Tag search
- Scope search
- Semantic search (sqlite-vec)

## Lifecycle

```text
Create
  │
  ▼
Validate
  │
  ▼
Index
  │
  ▼
Search
  │
  ▼
Update / Archive / Delete / Restore
```

## Context Resolution

```text
Global Memory
      +
Project Memory
      +
Linked Projects
      +
Search Results
      =
Compiled Context
```
