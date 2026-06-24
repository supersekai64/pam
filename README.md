# Portable AI Memory (PAM)

Open-source platform for persistent, portable, and model-independent AI memory.

PAM lets you maintain user-controlled memory that works across multiple LLMs,
IDEs, agents, and tools. Memory lives in project files, can be inspected and
edited, and is exposed through the same CLI, MCP, API, and UI surfaces.

PAM is not another chat interface. It is a local memory layer for AI-assisted
work.

## Why PAM?

AI memory is often trapped inside one chat, IDE, vendor, or session. PAM gives
your tools a shared project memory store that you control.

Key advantages:

- Works across tools, agents, IDEs, and LLM providers.
- Keeps memory local, reviewable, editable, and user-controlled.
- Installs from npm and exposes a single `pam` CLI.
- Provides CLI, MCP, API, and UI access to the same memory store.
- Tracks durable context over time instead of losing it in chat history.
- Uses Markdown as the source of truth and SQLite/vector indexes as rebuildable
  derived data.

Any compatible agent can read the same context, propose or create updates, and
reuse project knowledge across sessions. PAM provides the shared memory layer;
your agent still needs the PAM MCP tools or generated hooks to capture memory.

## Installation

### From Npm

```bash
npm install -g @helloworlkd/pam-cli
```

This installs the `pam` command globally. PAM is published under the
`@helloworlkd` npm scope; `@helloworlkd/pam-cli` pulls the compatible core, API,
protocol, and UI packages.

If npm stays quiet during the first install, use:

```bash
npm install -g @helloworlkd/pam-cli --loglevel=info
```

On Windows, stop any running PAM UI or MCP server before updating the global
package. Native SQLite files can stay locked while `pam ui` or
`pam server start` is running. After PAM is installed, prefer:

```bash
pam upgrade
```

`pam upgrade` stops running PAM UI/MCP services before invoking npm and prints a
status file, log file, and platform-specific command for following progress.

### Project-Local Install

For a project that already uses npm/package.json:

```bash
cd your-project
npm install -D @helloworlkd/pam-cli
```

Local installs bootstrap the memory store automatically. PAM creates
`.ai-memory/`, but it does not guess which IDE or agent files you want. Run
`pam init` after install to choose project integrations interactively, or use
`pam init --integration <target>` for a non-interactive setup.

Set `PAM_SKIP_PROJECT_INIT=1` before install to opt out of project bootstrap.

### From Source

```bash
pnpm setup
```

This installs dependencies, builds all packages, and links the `pam` command
globally from `packages/cli`.

Manual development flow:

```bash
pnpm install
pnpm build
pnpm link:cli
```

## Quick Start

### 1. Initialize PAM

```bash
cd your-project
pam init
```

This creates `.ai-memory/` and asks which supported agent integrations to
generate. If you installed `@helloworlkd/pam-cli` locally with
`npm install -D @helloworlkd/pam-cli`, npm postinstall already ran this
memory bootstrap, but you can still run `pam init` to add integrations.

### 2. Configure MCP

Add PAM to your MCP-compatible tool:

```json
{
  "mcpServers": {
    "pam": {
      "command": "pam",
      "args": ["server", "start"]
    }
  }
}
```

See [docs/mcp.md](docs/mcp.md) for client-specific setup and generated
integration files.

### 3. Verify The Setup

```bash
pam doctor integrations
pam smoke-test agent
```

First-run success means:

- `pam doctor integrations` reports generated project files as OK.
- `pam smoke-test agent` creates an active memory and prints its ID.
- The printed `pam search ...` or `pam context --query ...` command finds that
  memory immediately.
- `pam ui --open` shows the same project memory store.

### 4. Work With Automatic Capture

By default, PAM uses **auto mode**. Integrated agents can write active memories
through MCP, and lifecycle hooks can capture redacted raw `exchange` memories as
Markdown evidence.

MCP capture is intelligent by default. When an agent saves a durable signal, PAM
looks for same-type, same-theme memories first: review-mode duplicates are
merged, active contradictions can be superseded in auto mode, and evidence links
are preserved through `source_ids`.

Inspect memory:

```bash
pam list --status active
pam search "database decision"
pam ui --open
```

### 5. Manual Capture

You can also add memories explicitly:

```bash
pam add -t decision -c "Use PostgreSQL for the main database" --concepts "Architecture"
pam list
pam search "database"
```

See [docs/capture-modes.md](docs/capture-modes.md) for manual, assisted, and
auto mode details.

## How Memory Discovery Works

PAM works like `.git`: it searches for `.ai-memory/` by walking up the directory
tree.

### Shared Memory

```text
~/projects/my-app/
  |-- .ai-memory/              <- Initialize here
  |-- backend/                 <- Uses parent memory
  `-- frontend/                <- Uses parent memory
```

```bash
cd ~/projects/my-app
pam init

cd backend
pam add -t decision -c "Use PostgreSQL for the main database"
# -> Stored in ~/projects/my-app/.ai-memory/

cd ../frontend
pam list
# -> Shows the same memory
```

### Isolated Memory

```text
~/projects/my-app/
  |-- backend/
  |   `-- .ai-memory/          <- Isolated backend memory
  `-- frontend/
      `-- .ai-memory/          <- Isolated frontend memory
```

```bash
cd ~/projects/my-app/backend
pam init
# -> Creates isolated memory for this project only
```

## Features

- Human-readable Markdown memory storage, including raw `exchange` memories.
- SQLite + FTS5 indexing.
- SQLite theme compilations for compact Instruction/Decision/Issue-style
  context.
- Text, tag, metadata, and semantic search.
- Automatic semantic vectors with built-in local hash embeddings, optional local
  model embeddings, or OpenAI embeddings.
- Export/import in ZIP, JSON, Markdown, and SQLite formats.
- Basic secret redaction.
- Context compilation for LLM prompts.
- Supersession chains for updated or conflicting memories.
- Agent handoffs for cross-session context transfer.
- Configurable memory decay and forget sweeps.
- MCP stdio server.
- Local web UI via `pam ui`.
- Three capture modes: auto (default), assisted, and manual.
- Settings UI for capture mode, semicolon-separated ignored concepts, and index
  rebuilds.
- LLM context page with copy-to-clipboard support.
- Strong concepts driven by client-provided semantic concepts, with content
  extraction fallback and user-configurable ignored concepts.
- Sidebar version status for core, protocol, UI, API, and CLI packages.
- Optional diagnostics: recommendations, cleanup, distillation, and Knowledge
  Graph previews.

## UI

```bash
pam ui --open
```

The dashboard shows memory activity, active context source count, selected LLM
context preview, strong concepts, Knowledge Graph metrics, SQLite index health,
package versions, and memory inventory. `/llm-context` shows the full generated
context and includes a copy button. `/settings` controls capture mode and
ignored concepts.

See [docs/ui.md](docs/ui.md).

## Semantic Search

PAM uses vector embeddings for semantic search and automatic indexing:

- **Default local**: deterministic hash embeddings, 384 dimensions, no setup.
- **Optional local model**: `Xenova/all-MiniLM-L6-v2`, 384 dimensions, offline
  after setup.
- **Optional OpenAI**: `text-embedding-3-small`, 1536 dimensions, requires an
  API key.

Optional local model:

```bash
npm install -g @xenova/transformers
```

OpenAI embeddings:

```bash
export EMBEDDING_PROVIDER=openai
export OPENAI_API_KEY=your_key_here
```

See [docs/concepts.md](docs/concepts.md#semantic-search).

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [CLI](docs/cli.md)
- [MCP](docs/mcp.md)
- [UI](docs/ui.md)
- [Intelligence Layer](docs/intelligence.md)
- [Capture Modes](docs/capture-modes.md)
- [Role Examples](docs/examples.md)
- [Glossary](docs/glossary.md)
- [Security](docs/security.md)
- [Concepts](docs/concepts.md)
- [FAQ](docs/faq.md)
- [Debug](docs/debug.md)

## Examples

- [CLI Workflow](examples/cli-workflow.md)
- [Export / Import](examples/export-import.md)
- [Shared Memory](examples/shared-memory.md)
- [MCP Config](examples/mcp-config.json)

## Development

```bash
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm lint
pnpm format
pnpm release:check
```

## Structure

```text
PAM/
|-- packages/
|   |-- core/       # Storage, indexing, search
|   |-- api/        # Local HTTP API for UI/Desktop/IDE clients
|   |-- cli/        # Command-line interface
|   |-- mcp/        # MCP server
|   `-- ui/         # Local web interface
|-- docs/           # Documentation
|-- examples/       # Usage examples
`-- scripts/        # Utility scripts
```

## License

MIT
