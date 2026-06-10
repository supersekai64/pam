# Getting Started

## Prerequisites

- Node.js >= 20.0.0
- PNPM >= 9.0.0

## Installation

**One-command setup** (recommended):

```bash
pnpm setup
```

This installs dependencies, builds all packages, and links the `memory` command globally.

**Manual installation** (if you need more control):

```bash
pnpm install
```

## Build

```bash
pnpm build
```

## Link The CLI

```bash
pnpm link:cli
```

This links the `memory` command globally from `packages/cli`. Use this root script instead of `pnpm --filter @pamh/cli link --global`, because `pnpm link` does not support filtered workspace execution consistently across PNPM versions and also requires a configured PNPM global bin directory.

## Initialize Memory

### Project Memory

```bash
memory init
```

This creates `.ai-memory/` in the current directory and auto-configures supported project-level agent integrations. Use `memory init --no-integrations` for memory storage only.

### Global Memory

```bash
memory init global
```

This creates `~/ai-memory/` for cross-project preferences and patterns.

## How Memory Discovery Works

PAMH searches for `.ai-memory/` by walking up the directory tree, similar to how `.git` works.

**Example 1: Shared memory (monorepo)**

```bash
cd ~/projects/my-app
memory init
# → Creates ~/projects/my-app/.ai-memory/

cd backend
memory add -t decision -c "Use PostgreSQL for the main database"
# → Uses ~/projects/my-app/.ai-memory/

cd ../frontend
memory list
# → Shows the same memory
```

**Example 2: Isolated memory**

```bash
cd ~/projects/my-app/backend
memory init
# → Creates ~/projects/my-app/backend/.ai-memory/
# → This project now has its own isolated memory
```

## Basic Usage

```bash
# Add a memory
memory add -t decision -s project -c "Use PostgreSQL for the main database"

# List memories
memory list

# Search memories
memory search "database"

# Show memory status
memory status

# Compile context
memory context --query "architecture" --output
```

## Development

```bash
pnpm test
pnpm lint
pnpm format
```
