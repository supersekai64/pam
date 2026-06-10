# Shared Memory Example

## Scenario

You have a monorepo with multiple projects:

```text
~/projects/my-app/
  ├── backend/
  └── frontend/
```

## Setup

Initialize memory in the parent directory:

```bash
cd ~/projects/my-app
memory init
```

This creates `~/projects/my-app/.ai-memory/`.

## Usage

From any subdirectory, PAMH automatically uses the parent memory:

```bash
cd ~/projects/my-app/backend
memory add -t decision -c "Use PostgreSQL for the main database"
# → Stored in ~/projects/my-app/.ai-memory/

cd ~/projects/my-app/frontend
memory list
# → Shows the same memory
```

## Checking Which Memory Is Used

Use `memory status` to see which memory directory is currently active:

```bash
cd ~/projects/my-app/backend
memory status
# Using memory: ~/projects/my-app/.ai-memory/
# Global memory: ~/ai-memory/
# Memories: 1 active, 0 proposed, 0 archived, 0 deleted
```

## Isolated Memory

If you want isolated memory for a specific project:

```bash
cd ~/projects/my-app/backend
memory init
# → Creates ~/projects/my-app/backend/.ai-memory/
# → Now this project has its own memory
```

```bash
memory status
# Using memory: ~/projects/my-app/backend/.ai-memory/
# Global memory: ~/ai-memory/
# Memories: 0 active, 0 proposed, 0 archived, 0 deleted
```

## Global Memory

You can also initialize global memory for cross-project preferences:

```bash
memory init global
# → Creates ~/ai-memory/

memory add -t preference -s global -c "Always use TypeScript strict mode"
# → Stored in ~/ai-memory/
```

Global memory is always available, regardless of which project you're in.
