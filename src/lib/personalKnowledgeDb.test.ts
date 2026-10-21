import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { clearPersonalKnowledgeDocuments, deletePersonalKnowledgeDocument, getAllImages, getAllPersonalKnowledgeDocuments, getAllTasks, putPersonalKnowledgeDocument } from './db'
import type { PersonalKnowledgeDocument } from '../types'

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()))
afterEach(() => vi.unstubAllGlobals())

describe('personal knowledge IndexedDB', () => {
  it('upgrades v4 without deleting task or image history', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('amazon-image-studio', 4)
      request.onupgradeneeded = () => {
        for (const name of ['tasks', 'images', 'thumbnails', 'amazonPlannerSessions', 'listingCopySessions']) request.result.createObjectStore(name, { keyPath: 'id' })
        request.transaction!.objectStore('tasks').put({ id: 'kept-task', prompt: 'keep' })
        request.transaction!.objectStore('images').put({ id: 'kept-image', dataUrl: 'data:image/png;base64,kept' })
      }
      request.onsuccess = () => { request.result.close(); resolve() }
      request.onerror = () => reject(request.error)
    })
    expect(await getAllPersonalKnowledgeDocuments()).toEqual([])
    expect(await getAllTasks()).toEqual([{ id: 'kept-task', prompt: 'keep' }])
    expect(await getAllImages()).toEqual([{ id: 'kept-image', dataUrl: 'data:image/png;base64,kept' }])
  })

  it('persists originals, edits and opt-in state and clears only the knowledge store', async () => {
    const document: PersonalKnowledgeDocument = { id: 'doc', filename: 'rules.txt', mimeType: 'text/plain', byteSize: 4, originalFile: new Blob(['body']), text: 'body', summary: '', enabledForListing: false, createdAt: 1, updatedAt: 1 }
    await putPersonalKnowledgeDocument(document)
    const [restored] = await getAllPersonalKnowledgeDocuments()
    expect(await restored.originalFile.text()).toBe('body')
    expect(restored.enabledForListing).toBe(false)
    await putPersonalKnowledgeDocument({ ...restored, summary: '我的概要', enabledForListing: true, updatedAt: 2 })
    expect((await getAllPersonalKnowledgeDocuments())[0]).toMatchObject({ summary: '我的概要', enabledForListing: true })
    await deletePersonalKnowledgeDocument(document.id)
    expect(await getAllPersonalKnowledgeDocuments()).toEqual([])
    await putPersonalKnowledgeDocument(document)
    await clearPersonalKnowledgeDocuments()
    expect(await getAllPersonalKnowledgeDocuments()).toEqual([])
  })
})
