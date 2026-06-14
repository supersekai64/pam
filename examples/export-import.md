# Export And Import Example

## Export

```bash
memory export backup.zip
memory export backup.json --format json
memory export backup.md --format markdown
memory export memory.sqlite --format sqlite
```

## Import

```bash
memory import backup.json --format json
memory import backup.zip --format zip
memory import memory.md --format markdown
```

## Audit After Import

```bash
memory audit
memory doctor check
```
