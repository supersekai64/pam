import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type AddressInfo } from 'node:net'
import { expect, test, type Page } from '@playwright/test'
import { createMemory, initProjectMemory } from '../../packages/core/dist/index.js'
import { createLocalApiServer, type LocalApiServerOptions } from '../../packages/api/dist/index.js'

test('empty store shows the first capture path', async ({ page }) => {
  const app = await startUiFixture()

  try {
    await page.goto(app.url)

    await expect(page.getByRole('heading', { name: 'Project overview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'LLM context preview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'First capture path' })).toBeVisible()
    await expect(page.getByText('memory doctor integrations')).toBeVisible()
    await expect(page.getByText('memory smoke-test agent')).toBeVisible()
    await expect(page.getByText('memory review')).toBeVisible()

    await page.getByRole('button', { name: 'Concepts map' }).click()
    await expect(page.getByRole('heading', { name: 'LLM context preview' })).toBeHidden()

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await page.getByRole('button', { name: 'Preview context' }).click()
    await expect(page.getByRole('heading', { name: 'What the LLM would read' })).toBeVisible()
    await expect(page.getByText('No strong concepts selected')).toBeVisible()

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await page.getByRole('button', { name: 'Review queue' }).click()
    await expect(page.getByRole('heading', { name: '0 matching memories' })).toBeVisible()
  } finally {
    await app.close()
  }
})

test('UI can create, approve, inspect context, and load graph/governance views', async ({
  page,
}) => {
  const app = await startUiFixture({
    seed: async (basePath) => {
      await createMemory(basePath, {
        type: 'decision',
        scope: 'project',
        status: 'active',
        title: 'Local SQLite index',
        tags: ['onboarding-proof', 'sqlite'],
        content: 'Use SQLite as the local index for first-run proof.',
      })
      await createMemory(basePath, {
        type: 'knowledge',
        scope: 'project',
        status: 'active',
        tags: ['onboarding-proof', 'mcp'],
        content: 'MCP tools provide the agent capture path for PAMH.',
      })
      await createMemory(basePath, {
        type: 'preference',
        scope: 'project',
        status: 'active',
        tags: ['onboarding-proof', 'ui'],
        content: 'The UI should make proposed memories easy to review.',
      })
      await createMemory(basePath, {
        type: 'knowledge',
        scope: 'project',
        status: 'proposed',
        tags: ['review-proof'],
        content: 'Approve this proposed memory from the UI smoke test.',
      })
    },
  })

  try {
    await page.goto(app.url)

    await page.getByRole('button', { name: 'Proposed 1' }).click()
    await page.getByRole('button', { name: /Approve this proposed memory/ }).click()
    await withinDialog(page).getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByText(/Approved/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Proposed 0' })).toBeVisible()

    await page.getByRole('button', { name: 'New memory' }).click()
    await withinDialog(page).getByLabel('Display title').fill('E2E-created memory')
    await withinDialog(page)
      .getByPlaceholder('Write a concise, durable memory...')
      .fill('Created through the Playwright E2E smoke test.')
    await withinDialog(page).getByRole('button', { name: 'Create memory' }).click()
    await expect(page.getByText(/Created mem_/)).toBeVisible()
    await withinDialog(page).getByRole('button', { name: 'Close memory detail' }).click()
    await expect(withinDialog(page)).toBeHidden()

    await page.getByRole('button', { name: 'LLM context' }).click()
    await expect(page.getByRole('heading', { name: 'What the LLM would read' })).toBeVisible()
    await expect(page.getByText('Use SQLite as the local index for first-run proof.')).toBeVisible()
    await expect(page.getByText('Created through the Playwright E2E smoke test.')).toBeVisible()

    await page.getByRole('button', { name: 'Knowledge graph' }).click()
    await expect(page.getByRole('heading', { name: 'Relation explorer' })).toBeVisible()
    await expect(page.getByText('Local SQLite index').first()).toBeVisible()
    await expect(
      page.getByText('MCP tools provide the agent capture path for PAMH.').first()
    ).toBeVisible()

    await page.getByRole('button', { name: 'Governance' }).click()
    await expect(page.getByRole('heading', { name: 'Recommendations' })).toBeVisible()
    await expect(page.getByText(/open suggestion|All clean!/)).toBeVisible()
    await expect(page.getByText(/Review queue|All clean!/)).toBeVisible()
    await expect(page.getByText(/Recommended action|All clean!/)).toBeVisible()
  } finally {
    await app.close()
  }
})

function withinDialog(page: Page) {
  return page.getByRole('dialog')
}

async function startUiFixture(
  options: {
    seed?: (basePath: string) => Promise<void>
  } = {}
): Promise<{ close: () => Promise<void>; url: string }> {
  const projectPath = await mkdtemp(join(tmpdir(), 'pamh-ui-e2e-'))
  const memoryPath = await initProjectMemory(projectPath)

  if (options.seed) {
    await options.seed(memoryPath)
  }

  const server = createLocalApiServer({ cwd: projectPath } satisfies LocalApiServerOptions)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await rm(projectPath, { recursive: true, force: true })
    },
  }
}
