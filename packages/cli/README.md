# Portable AI Memory (PAM)

CLI for persistent, portable, model-independent AI memory.

Published package: `@helloworlkd/pam-cli`.

## Installation

```bash
npm install -g @helloworlkd/pam-cli
```

This installs the `pam` command.

For future global updates, stop any running `pam ui` or `pam server start`
processes, then run:

```bash
npm install -g @helloworlkd/pam-cli@latest
```

Stopping PAM services first avoids Windows native-file locks during updates.

For automatic project bootstrap:

```bash
cd your-project
npm install -D @helloworlkd/pam-cli
```

Local install creates `.ai-memory/`. Run `pam init` after install to choose
which agent/IDE integration files to generate.

## Quick Start

```bash
pam init
pam add -t decision -c "Use SQLite for the local pam index"
pam checkpoint --summary "Finished CLI setup" --fact "PAM stores project memory in .ai-memory" --concept Architecture
pam search "SQLite"
pam server start
```

See the full documentation at https://github.com/supersekai64/pam.
