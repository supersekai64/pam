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

## Semantic Search

PAMH uses vector embeddings for semantic search. By default, it runs a local embedding model with no external API calls.

### Default: Local Embeddings

- **Model**: `Xenova/all-MiniLM-L6-v2` (384 dimensions)
- **Runtime**: ONNX via `@xenova/transformers`
- **Storage**: SQLite with `sqlite-vec` extension
- **First run**: Automatically downloads the model (~80MB)

The model runs entirely on your machine. No data leaves your system.

### Optional: OpenAI Embeddings

You can switch to OpenAI's embedding API:

```bash
export EMBEDDING_PROVIDER=openai
export OPENAI_API_KEY=your_key_here
```

This uses `text-embedding-3-small` (1536 dimensions) by default.

### When to Use Each

- **Local embeddings**: Default choice. Works offline, no API costs, privacy-friendly.
- **OpenAI embeddings**: Higher quality for complex semantic queries, but requires network and API key.

## Capture Control

PAMH uses explicit capture by default. It does not scrape editor sessions, terminal output, or LLM conversations.

PAMH supports three capture modes:

- **manual** - You explicitly call `memory add`
- **assisted** (default) - Agent proposes memories via MCP, you approve them
- **auto** - Agent creates memories directly based on configured rules

Use one of these capture paths:

- CLI: `memory add`
- UI: `memory ui`
- MCP: an agent calls `add_memory`

The capture mode is configured in `.ai-memory/auto-capture.yaml`. See [docs/capture-modes.md](capture-modes.md) for details.

Explicit capture keeps memory auditable and prevents accidental storage of private or transient information.
