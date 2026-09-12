import { describe, expect, it } from 'vitest'
import {
  mergeTextNotes,
  normalizeTextNotes,
  readTextNotes,
  removeTextNote,
  saveTextNotes,
  searchTextNotes,
  TEXT_NOTES_STORAGE_KEY,
  upsertTextNote,
} from './textNotes'

const note = (id: string, updatedAt: number, title = id) => ({ id, title, content: `content-${id}`, createdAt: 1, updatedAt })

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    values,
  }
}

describe('text notes', () => {
  it('normalizes, deduplicates and sorts notes', () => {
    expect(normalizeTextNotes([note('a', 2), note('b', 3), note('a', 4), { id: '', title: '', content: '' }]).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('persists and reloads notes from local storage', () => {
    const storage = memoryStorage()
    saveTextNotes([note('a', 2)], storage)
    expect(storage.values.has(TEXT_NOTES_STORAGE_KEY)).toBe(true)
    expect(readTextNotes(storage)).toEqual([note('a', 2)])
  })

  it('keeps normalized notes available when storage writes fail', () => {
    const saved = saveTextNotes([note('a', 2)], {
      getItem: () => null,
      setItem: () => { throw new Error('storage blocked') },
    })

    expect(saved).toEqual([note('a', 2)])
  })

  it('merges imports by id using the newest update', () => {
    const merged = mergeTextNotes([note('same', 5, 'local'), note('local', 2)], [note('same', 3, 'older'), note('imported', 4)])
    expect(merged.map((item) => [item.id, item.title])).toEqual([
      ['same', 'local'],
      ['imported', 'imported'],
      ['local', 'local'],
    ])
  })

  it('supports search, update and delete', () => {
    const notes = [note('a', 2, 'Listing Prompt'), note('b', 1, 'Other')]
    expect(searchTextNotes(notes, 'listing').map((item) => item.id)).toEqual(['a'])
    expect(upsertTextNote(notes, { ...notes[1], title: 'Updated', updatedAt: 3 })[0].title).toBe('Updated')
    expect(removeTextNote(notes, 'a').map((item) => item.id)).toEqual(['b'])
  })
})
