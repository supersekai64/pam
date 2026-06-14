# Security

PAMH is local-first. Memory is stored on disk, owned by the user, and designed to remain readable and auditable.

## Data Storage

- Markdown is the source of truth.
- SQLite is an index and can be rebuilt.
- Project memory defaults to `./.ai-memory` or the nearest parent `.ai-memory`.

## Sensitive Data

PAMH includes basic redaction for common sensitive values:

- email addresses
- API keys
- bearer tokens
- AWS access keys
- passwords
- client secrets
- private keys

Use:

```bash
memory redact <id>
```

Redaction is intentionally conservative. Users should still review memories before exporting, sharing, or committing them.

## `.memoryignore`

`.memoryignore` works like `.gitignore` for memory ingestion and memory-related file handling.

Default exclusions include:

```text
.env
.env.*
*.pem
*.key
secrets/
node_modules/
vendor/
dist/
build/
.git/
*.db
*.sqlite
```

## Deletion

`memory delete` performs logical deletion by setting `status: deleted` in Markdown metadata.

Use:

```bash
memory restore <id>
```

Physical deletion is intentionally not part of the MVP default path.

## MCP

The MCP server runs over stdio and uses the current working directory as the project root.

Before enabling PAMH in an MCP client, review which project directory that client starts from.
