import './styles.css'

type Store = 'project' | 'global'

interface MemoryMetadata {
  id: string
  type: string
  scope: string
  status: string
  created_at: string
  updated_at: string
  tags: string[]
  source: string
}

interface Memory {
  metadata: MemoryMetadata
  content: string
}

interface SearchResult extends MemoryMetadata {
  content: string
  file_path: string
}

interface Stats {
  total: number
  active: number
  deleted: number
  archived: number
  proposed: number
  byType: Record<string, number>
  byScope: Record<string, number>
  tags: Record<string, number>
}

interface State {
  store: Store
  query: string
  status: string
  selectedId: string | null
  memories: Array<Memory | SearchResult>
  selected: Memory | null
  stats: Stats | null
  message: string
}

const memoryTypes = [
  'decision',
  'knowledge',
  'mistake',
  'rule',
  'preference',
  'session',
  'task',
  'client',
  'project',
  'pattern',
]
const memoryScopes = ['global', 'project', 'client', 'stack', 'temporary', 'archived']
const statuses = ['', 'active', 'archived', 'deleted', 'proposed']

const state: State = {
  store: 'project',
  query: '',
  status: '',
  selectedId: null,
  memories: [],
  selected: null,
  stats: null,
  message: '',
}

const app = document.querySelector<HTMLMainElement>('#app')
if (!app) throw new Error('App container not found')

render()
void refresh()

async function refresh(): Promise<void> {
  await Promise.all([loadStats(), loadMemories()])
  if (state.selectedId) {
    await selectMemory(state.selectedId)
  }
  render()
}

async function loadStats(): Promise<void> {
  const response = await api<{ stats: Stats }>(`/api/stats?store=${state.store}`)
  state.stats = response.stats
}

async function loadMemories(): Promise<void> {
  const params = new URLSearchParams({ store: state.store, limit: '200' })
  if (state.query) params.set('query', state.query)
  if (state.status) params.set('status', state.status)
  const response = await api<{ memories: Array<Memory | SearchResult> }>(
    `/api/memories?${params.toString()}`
  )
  state.memories = response.memories
}

async function selectMemory(id: string): Promise<void> {
  state.selectedId = id
  const response = await api<{ memory: Memory }>(`/api/memories/${id}?store=${state.store}`)
  state.selected = response.memory
  render()
}

async function createFromForm(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form)
  const content = String(data.get('content') ?? '').trim()
  if (!content) return

  const response = await api<{ memory: Memory }>(`/api/memories?store=${state.store}`, {
    method: 'POST',
    body: JSON.stringify({
      type: data.get('type'),
      scope: data.get('scope'),
      tags: parseTags(String(data.get('tags') ?? '')),
      content,
      source: 'ui',
    }),
  })
  state.message = `Created ${response.memory.metadata.id}`
  form.reset()
  state.selectedId = response.memory.metadata.id
  await refresh()
}

async function updateFromForm(form: HTMLFormElement): Promise<void> {
  if (!state.selected) return

  const data = new FormData(form)
  const response = await api<{ memory: Memory }>(
    `/api/memories/${state.selected.metadata.id}?store=${state.store}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        type: data.get('type'),
        scope: data.get('scope'),
        tags: parseTags(String(data.get('tags') ?? '')),
        content: String(data.get('content') ?? ''),
      }),
    }
  )
  state.selected = response.memory
  state.message = `Updated ${response.memory.metadata.id}`
  await refresh()
}

async function runAction(
  action: 'archive' | 'restore' | 'delete' | 'physical-delete' | 'approve' | 'reject'
): Promise<void> {
  if (!state.selected) return

  const id = state.selected.metadata.id
  if (action === 'delete' || action === 'physical-delete') {
    await api(`/api/memories/${id}?store=${state.store}&physical=${action === 'physical-delete'}`, {
      method: 'DELETE',
    })
    state.message = action === 'physical-delete' ? `Physically deleted ${id}` : `Deleted ${id}`
    state.selected = null
    state.selectedId = null
  } else {
    await api(`/api/memories/${id}/${action}?store=${state.store}`, { method: 'POST' })
    state.message = `${capitalize(action)}d ${id}`
    if (action === 'approve' || action === 'reject') {
      state.selected = null
      state.selectedId = null
    }
  }

  await refresh()
}

function render(): void {
  app.innerHTML = `
    <section class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Portable AI Memory Hub</p>
          <h1>Local Memory Console</h1>
          <p class="lede">A localhost-only interface over your Markdown memory source of truth.</p>
        </div>
        <div class="store-switch" role="group" aria-label="Memory store">
          ${renderStoreButton('project')}
          ${renderStoreButton('global')}
        </div>
      </header>

      ${state.message ? `<div class="notice">${escapeHtml(state.message)}</div>` : ''}

      <section class="stats">
        ${renderStat('Total', state.stats?.total)}
        ${renderStat('Active', state.stats?.active)}
        ${renderStat('Proposed', state.stats?.proposed)}
        ${renderStat('Archived', state.stats?.archived)}
        ${renderStat('Deleted', state.stats?.deleted)}
      </section>

      <section class="workspace">
        <aside class="panel list-panel">
          <div class="toolbar">
            <input id="query" placeholder="Search memories" value="${escapeAttribute(state.query)}" />
            <select id="status">
              ${statuses.map((status) => `<option value="${status}" ${state.status === status ? 'selected' : ''}>${status || 'any status'}</option>`).join('')}
            </select>
          </div>
          <div class="memory-list">
            ${state.memories.map(renderMemoryRow).join('') || '<p class="empty">No memories found.</p>'}
          </div>
        </aside>

        <section class="panel detail-panel">
          ${state.selected ? renderEditor(state.selected) : renderCreateForm()}
        </section>
      </section>
    </section>
  `

  bindEvents()
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-store]').forEach((button) => {
    button.addEventListener('click', () => {
      state.store = button.dataset.store as Store
      state.selected = null
      state.selectedId = null
      void refresh()
    })
  })

  document.querySelector<HTMLInputElement>('#query')?.addEventListener('input', (event) => {
    state.query = (event.target as HTMLInputElement).value
    void loadMemories().then(render)
  })

  document.querySelector<HTMLSelectElement>('#status')?.addEventListener('change', (event) => {
    state.status = (event.target as HTMLSelectElement).value
    void loadMemories().then(render)
  })

  document.querySelectorAll<HTMLButtonElement>('[data-memory-id]').forEach((button) => {
    button.addEventListener('click', () => void selectMemory(button.dataset.memoryId ?? ''))
  })

  document.querySelector<HTMLButtonElement>('#new-memory')?.addEventListener('click', () => {
    state.selected = null
    state.selectedId = null
    render()
  })

  document.querySelector<HTMLFormElement>('#create-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    void createFromForm(event.currentTarget)
  })

  document.querySelector<HTMLFormElement>('#edit-form')?.addEventListener('submit', (event) => {
    event.preventDefault()
    void updateFromForm(event.currentTarget)
  })

  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => void runAction(button.dataset.action as never))
  })
}

function renderStoreButton(store: Store): string {
  return `<button data-store="${store}" class="${state.store === store ? 'active' : ''}">${store}</button>`
}

function renderStat(label: string, value?: number): string {
  return `<article><span>${label}</span><strong>${value ?? '-'}</strong></article>`
}

function renderMemoryRow(memory: Memory | SearchResult): string {
  const metadata = 'metadata' in memory ? memory.metadata : memory
  const content = memory.content
  const selected = metadata.id === state.selectedId ? 'selected' : ''
  const proposed = metadata.status === 'proposed' ? 'proposed' : ''
  const statusBadge =
    metadata.status === 'proposed' ? '<span class="badge proposed">PROPOSED</span>' : ''

  return `
    <button class="memory-row ${selected} ${proposed}" data-memory-id="${metadata.id}">
      <span class="row-title">${escapeHtml(metadata.type)} / ${escapeHtml(metadata.scope)} ${statusBadge}</span>
      <span class="row-content">${escapeHtml(content.slice(0, 110))}</span>
      <span class="row-meta">${escapeHtml(metadata.status)} · ${escapeHtml(metadata.tags.join(', ') || 'no tags')}</span>
    </button>
  `
}

function renderCreateForm(): string {
  return `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Create</p>
        <h2>New memory</h2>
      </div>
    </div>
    <form id="create-form" class="memory-form">
      ${renderTypeScopeFields('knowledge', state.store)}
      <input name="tags" placeholder="tags, comma separated" />
      <textarea name="content" placeholder="Write a memory..." required></textarea>
      <button class="primary" type="submit">Create memory</button>
    </form>
  `
}

function renderEditor(memory: Memory): string {
  const isProposed = memory.metadata.status === 'proposed'
  const actionsHtml = isProposed
    ? `
        <div class="actions">
          <button class="primary" type="button" data-action="approve">Approve</button>
          <button class="danger" type="button" data-action="reject">Reject</button>
        </div>
      `
    : `
        <div class="actions">
          <button class="primary" type="submit">Save</button>
          <button type="button" data-action="archive">Archive</button>
          <button type="button" data-action="restore">Restore</button>
          <button type="button" data-action="delete">Delete</button>
          <button class="danger" type="button" data-action="physical-delete">Physical delete</button>
        </div>
      `

  return `
    <div class="detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(memory.metadata.id)}</p>
        <h2>${isProposed ? 'Review proposed memory' : 'Edit memory'}</h2>
      </div>
      <button id="new-memory">New</button>
    </div>
    <form id="edit-form" class="memory-form">
      ${renderTypeScopeFields(memory.metadata.type, memory.metadata.scope)}
      <input name="tags" value="${escapeAttribute(memory.metadata.tags.join(', '))}" />
      <textarea name="content" required ${isProposed ? 'readonly' : ''}>${escapeHtml(memory.content)}</textarea>
      ${actionsHtml}
    </form>
  `
}

function renderTypeScopeFields(type: string, scope: string): string {
  return `
    <div class="field-grid">
      <select name="type">${memoryTypes.map((item) => option(item, type)).join('')}</select>
      <select name="scope">${memoryScopes.map((item) => option(item, scope)).join('')}</select>
    </div>
  `
}

function option(value: string, selected: string): string {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`
}

async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
  const body = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `Request failed: ${response.status}`)
  return body
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    }
    return entities[char]
  })
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
