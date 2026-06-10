import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadLinkedProjects,
  saveLinkedProjects,
  addLinkedProject,
  removeLinkedProject,
} from './linked-projects.js'

describe('linked-projects', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'pamh-linked-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('loadLinkedProjects', () => {
    it('should return empty config when file does not exist', async () => {
      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toEqual([])
    })

    it('should load valid YAML config', async () => {
      const yamlContent = 'projects:\n  - /path/to/project1\n  - /path/to/project2\n'
      await writeFile(join(tempDir, 'linked-projects.yaml'), yamlContent, 'utf-8')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toEqual(['/path/to/project1', '/path/to/project2'])
    })

    it('should return empty config for invalid YAML', async () => {
      await writeFile(join(tempDir, 'linked-projects.yaml'), 'invalid: yaml: content:', 'utf-8')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toEqual([])
    })

    it('should return empty config when projects is not an array', async () => {
      const yamlContent = 'projects: "not an array"\n'
      await writeFile(join(tempDir, 'linked-projects.yaml'), yamlContent, 'utf-8')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toEqual([])
    })

    it('should load SPEC-style linked project groups', async () => {
      const yamlContent = `product-suite:
  linked_projects:
    - product-docs
    - product-site
`
      await writeFile(join(tempDir, 'linked-projects.yaml'), yamlContent, 'utf-8')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toEqual(['product-docs', 'product-site'])
    })
  })

  describe('saveLinkedProjects', () => {
    it('should save config to YAML file', async () => {
      await saveLinkedProjects(tempDir, {
        projects: ['/path/to/project1', '/path/to/project2'],
      })

      const loaded = await loadLinkedProjects(tempDir)
      expect(loaded.projects).toEqual(['/path/to/project1', '/path/to/project2'])
    })
  })

  describe('addLinkedProject', () => {
    it('should add a new project', async () => {
      await addLinkedProject(tempDir, '/path/to/project1')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toContain('/path/to/project1')
    })

    it('should not add duplicate projects', async () => {
      await addLinkedProject(tempDir, '/path/to/project1')
      await addLinkedProject(tempDir, '/path/to/project1')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects.filter((p) => p === '/path/to/project1')).toHaveLength(1)
    })
  })

  describe('removeLinkedProject', () => {
    it('should remove an existing project', async () => {
      await addLinkedProject(tempDir, '/path/to/project1')
      await addLinkedProject(tempDir, '/path/to/project2')

      await removeLinkedProject(tempDir, '/path/to/project1')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).not.toContain('/path/to/project1')
      expect(config.projects).toContain('/path/to/project2')
    })

    it('should handle removing non-existent project', async () => {
      await addLinkedProject(tempDir, '/path/to/project1')

      await removeLinkedProject(tempDir, '/path/to/nonexistent')

      const config = await loadLinkedProjects(tempDir)
      expect(config.projects).toEqual(['/path/to/project1'])
    })
  })
})
