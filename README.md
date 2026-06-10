# Portable AI Memory Hub (PAMH)

Plateforme open-source pour une mémoire IA persistante, portable et indépendante des modèles.

PAMH permet de conserver une mémoire contrôlable par l'utilisateur, utilisable depuis plusieurs LLMs, IDEs, agents et outils.

## Installation

```bash
pnpm install
pnpm build
```

## Usage Rapide

```bash
memory init project
memory add --project -t decision -s project -c "Use SQLite as a local rebuildable index."
memory search "SQLite" --project
memory context --project --query "architecture" --output
```

## Fonctionnalités MVP

- mémoire Markdown lisible par humain
- index SQLite + FTS5
- recherche texte, tags, scopes
- recherche sémantique locale ou OpenAI
- export/import ZIP, JSON, Markdown, plus SQLite export
- redaction basique des secrets
- compilation de contexte
- serveur MCP stdio
- UI web locale via `memory ui`

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [CLI](docs/cli.md)
- [MCP](docs/mcp.md)
- [UI](docs/ui.md)
- [Security](docs/security.md)
- [Concepts](docs/concepts.md)
- [FAQ](docs/faq.md)

## Exemples

- [CLI Workflow](examples/cli-workflow.md)
- [Export / Import](examples/export-import.md)
- [MCP Config](examples/mcp-config.json)
- [Linked Projects](examples/linked-projects.yaml)

## MCP

```bash
memory server start
```

Voir [docs/mcp.md](docs/mcp.md).

## UI Locale

```bash
memory ui --open
```

Voir [docs/ui.md](docs/ui.md).

## Développement

```bash
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm release:check
```

## Structure

```text
pamh/
├── packages/
│   ├── core/       # Stockage, indexation, recherche
│   ├── api/        # API HTTP locale pour clients UI/Desktop/IDE
│   ├── cli/        # Interface en ligne de commande
│   ├── mcp/        # Serveur MCP
│   └── ui/         # Interface web locale
├── docs/           # Documentation
├── examples/       # Exemples d'utilisation
└── scripts/        # Scripts utilitaires
```

## Licence

MIT
