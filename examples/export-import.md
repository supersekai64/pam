# Export And Import Example

## Export

```bash
memory export backup.zip --project
memory export backup.json --format json --project
memory export backup.md --format markdown --project
memory export memory.sqlite --format sqlite --project
```

## Import

```bash
memory import backup.json --format json --project
memory import backup.zip --format zip --project
memory import memory.md --format markdown --project
```

## Audit After Import

```bash
memory audit --project
memory doctor check --project
```
