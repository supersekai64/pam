# Local UI

PAMH includes a local web UI for browsing and managing memory without leaving the machine.

## Start

```bash
memory ui --open
```

By default, the server binds to `127.0.0.1:3939`.

## Capabilities

- View the current project memory store
- Guide an empty store through the first capture path: integration doctor,
  smoke-test proposal, review queue, and context preview
- Browse Evidence as kanban-style type columns
- Search memories and filter by status
- Open memory details in a modal
- Create memories
- Edit display title, content, type, and tags
- Archive, restore, logically delete, or physically delete memories
- View local index statistics
- Preview the composed LLM context with selected sources and exclusion reasons
- Review action-first assisted maintenance recommendations with decision controls,
  safety copy, and linked evidence
- Inspect the Knowledge Graph in a separate tab
- Inspect evidence IDs for recommendations, graph entities, and graph relations

The LLM context concept map and the Knowledge Graph are separate views. The
concept map shows recurring signals and co-occurrence from the current composed
LLM context. The Knowledge Graph shows explicit entities and typed,
evidence-backed relations.

Memory titles are optional metadata. If a client AI agent has generated a short
title through MCP, CLI, or the local API, the Evidence and Knowledge Graph views
use it as the primary label; otherwise they fall back to a compact excerpt of
the memory content.

The LLM context preview is not a raw recent-memory list. The API composes it
from active project memories by prioritizing durable rules, decisions,
preferences, and knowledge before tasks, pitfalls, patterns, and client
context. General context excludes session activity; focused context may include
a small amount of matching recent session activity. Noise, deleted, archived,
proposed, duplicate implementation summaries, and lower-ranked overflow are
excluded from the LLM context. Exclusion reasons remain available in the UI
source panel as hygiene metadata, but are not rendered into the Markdown text
copied or sent to the LLM.

## Architecture

```text
Browser UI
    │
    ▼
Local HTTP API (127.0.0.1)
    │
    ▼
pamh-core
    │
    ▼
Markdown + SQLite
```

The UI is static and does not own persistence logic. All writes go through the local API, and the API delegates to `pamh-core`.

## Browser Smoke Test

The repository includes a Playwright smoke suite for the local UI:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

It builds the packages, starts the real local API/UI against a temporary
`.ai-memory` store, and verifies the empty-store onboarding, memory creation,
approval, context preview, Knowledge Graph, and Governance views.

## Future Clients

Desktop apps and IDE extensions should live in separate repositories. They can either:

- call the same local HTTP API exposed by `pamh-api`, or
- embed `pamh-core` directly when a local Node runtime is appropriate.

The recommended default is to use the local HTTP API so clients stay thin and tool-agnostic.

## Security

The server is local-first and binds to `127.0.0.1` by default. Do not bind to a public interface unless you understand the risk.
