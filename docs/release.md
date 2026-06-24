# Release

Use GitHub Actions for npm releases. The first publication of each package needs
an npm automation token because npm trusted publishing can only be configured
after the package exists. After the first publish, configure trusted publishing
and remove the token dependency from the workflow.

## One-time npm setup

Before the first publish, create a GitHub Actions secret named `NPM_TOKEN` with
an npm token that can publish public packages under the `@supersekai64` scope.
The token owner must have publish rights for that npm user or organization
scope.

After each package exists on npm, open the package settings for
`@supersekai64/pam-core`, `@supersekai64/pam-ui`, `@supersekai64/pam-api`,
`@supersekai64/pam-protocol`, and `@supersekai64/pam-cli`, then add this trusted
publisher:

- Publisher: GitHub Actions
- Repository: `supersekai64/pam`
- Workflow: `npm-publish.yml`
- Environment: leave empty

Keep package publishing access set to allow 2FA or trusted publishing. Once all
packages trust the workflow, `NPM_TOKEN` can be removed from the repository
secrets and from the workflow.

## Publish

1. Bump package versions and dependency ranges.
2. Run `pnpm release:check`.
3. Push to `main`.
4. Run the `npm publish` workflow from GitHub Actions.

The workflow publishes packages in dependency order and skips versions that already exist on npm.

The workflow uses `pnpm pack` / `pnpm publish` instead of `npm pack` /
`npm publish` so workspace dependency ranges are rewritten to concrete npm
versions in the published manifests. Keep `pnpm pack:check` in the release check
before publishing; it fails if a packed package still contains `workspace:`.
