import type { TextNote } from '../types'

export const TEXT_NOTES_STORAGE_KEY = 'amazon-image-studio.text-notes.v1'
export const TEXT_NOTES_CHANGED_EVENT = 'amazon-image-studio:text-notes-changed'

type TextNotesStorage = Pick<Storage, 'getItem' | 'setItem'>

function getDefaultStorage(): TextNotesStorage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeTextNote(value: unknown): TextNote | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Partial<TextNote>
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 120) : ''
  const content = typeof input.content === 'string' ? input.content.trim().slice(0, 20_000) : ''
  if (!id || !title || !content) return null

  const createdAt = Number.isFinite(input.createdAt) ? Math.max(0, Number(input.createdAt)) : 0
  const updatedAt = Number.isFinite(input.updatedAt) ? Math.max(createdAt, Number(input.updatedAt)) : createdAt
  return { id, title, content, createdAt, updatedAt }
}

export function normalizeTextNotes(value: unknown): TextNote[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<string, TextNote>()
  for (const item of value) {
    const note = normalizeTextNote(item)
    if (!note) continue
    const previous = byId.get(note.id)
    if (!previous || note.updatedAt >= previous.updatedAt) byId.set(note.id, note)
  }
  return [...byId.values()].sort((left, right) => right.updatedAt - left.updatedAt)
}

export function readTextNotes(storage: TextNotesStorage | null = getDefaultStorage()) {
  if (!storage) return []
  try {
    const saved = storage.getItem(TEXT_NOTES_STORAGE_KEY)
    return saved ? normalizeTextNotes(JSON.parse(saved)) : []
  } catch {
    return []
  }
}

export function saveTextNotes(notes: readonly TextNote[], storage: TextNotesStorage | null = getDefaultStorage()) {
  const normalized = normalizeTextNotes(notes)
  let persisted = false
  if (storage) {
    try {
      storage.setItem(TEXT_NOTES_STORAGE_KEY, JSON.stringify(normalized))
      persisted = true
    } catch {
      // localStorage 不可用时，调用方仍可保留当前会话状态。
    }
  }
  if (persisted && typeof window !== 'undefined') window.dispatchEvent(new Event(TEXT_NOTES_CHANGED_EVENT))
  return normalized
}

export function mergeTextNotes(currentNotes: unknown, incomingNotes: unknown) {
  return normalizeTextNotes([
    ...normalizeTextNotes(currentNotes),
    ...normalizeTextNotes(incomingNotes),
  ])
}

export function upsertTextNote(notes: readonly TextNote[], note: TextNote) {
  return normalizeTextNotes([note, ...notes.filter((item) => item.id !== note.id)])
}

export function removeTextNote(notes: readonly TextNote[], noteId: string) {
  return notes.filter((note) => note.id !== noteId)
}

export function searchTextNotes(notes: readonly TextNote[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return [...notes]
  return notes.filter((note) => `${note.title}\n${note.content}`.toLocaleLowerCase().includes(normalizedQuery))
}
