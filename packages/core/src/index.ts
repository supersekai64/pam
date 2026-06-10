export { VERSION } from './version.js'
export * from './types.js'
export { generateId } from './id.js'
export { parseMarkdown, serializeMarkdown } from './markdown.js'
export {
  getGlobalMemoryPath,
  getProjectMemoryPath,
  initGlobalMemory,
  initProjectMemory,
  createMemory,
  readMemory,
  updateMemory,
  deleteMemory,
  archiveMemory,
  listMemories,
  indexAllMemories,
  checkIndexConsistency,
  findMemoryFile,
  type ConsistencyReport,
  GLOBAL_SUBDIRS,
  type DeleteMemoryOptions,
} from './storage.js'
export { MemoryIndex, type SearchOptions, type SearchResult, type IndexStats } from './indexer.js'
export { loadMemoryIgnore, getDefaultIgnorePatterns, type MemoryIgnore } from './memoryignore.js'
export { redactContent, getRedactionPatterns, type RedactionResult } from './redaction.js'
export { restoreMemory } from './restore.js'
export { exportMemories, type ExportFormat, type ExportOptions } from './export.js'
export {
  importMemories,
  type ImportFormat,
  type ImportOptions,
  type ImportResult,
} from './import.js'
export {
  loadLinkedProjects,
  saveLinkedProjects,
  addLinkedProject,
  removeLinkedProject,
  type LinkedProjectsConfig,
} from './linked-projects.js'
export {
  compileContext,
  writeCompiledContext,
  type CompileContextOptions,
  type CompiledContext,
} from './context.js'
export {
  createEmbeddingProvider,
  LocalEmbeddingProvider,
  OpenAIEmbeddingProvider,
  type EmbeddingProvider,
} from './embedding.js'
export { SemanticIndex, type SemanticSearchResult } from './semantic.js'
