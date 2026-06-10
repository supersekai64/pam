# FAQ

## Does PAMH replace an LLM memory feature?

No. PAMH gives users an independent memory layer that can be used across LLMs, editors, agents, and tools.

## Where is my data stored?

By default:

- global memory: `~/ai-memory`
- project memory: `./.ai-memory`

## Is SQLite the source of truth?

No. Markdown is the source of truth. SQLite is an index.

## Can I use PAMH offline?

Yes for core storage, text search, CLI, export/import, and MCP. Semantic search uses local embeddings by default, but the first local model download may require network access.

## Does semantic search require OpenAI?

No. PAMH uses a local embedding provider by default. OpenAI can be enabled explicitly with:

```bash
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=...
```

## What happens when I delete a memory?

The memory is logically deleted by setting `status: deleted`. It can be restored with:

```bash
memory restore <id>
```

## Can I export my memory?

Yes. Supported MVP export formats:

- ZIP
- JSON
- Markdown

Example:

```bash
memory export backup.zip
```

## Can MCP clients modify memory?

Yes. The MCP server exposes tools for adding, editing, deleting, searching, and compiling context.

## Does PAMH automatically record OpenCode or other AI sessions?

No. PAMH does not observe tools in the background. OpenCode, an IDE, or another agent must be configured as an MCP client and must explicitly call PAMH tools such as `add_memory`. You can always add memories manually with `memory add` or through `memory ui`.

Example:

```bash
memory add --project -t session -s project --tags "opencode" -c "Implemented the initial React page with Tailwind and shadcn."
```

## Should I commit `.ai-memory` to Git?

That depends on the project. If memory contains only project knowledge and no secrets, committing it can make memory portable with the repository. Review `docs/security.md` before doing so.
