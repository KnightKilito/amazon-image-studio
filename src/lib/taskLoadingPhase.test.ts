import { describe, expect, it } from 'vitest'
import { getTaskLoadingPhase } from './taskLoadingPhase'

describe('task loading phase', () => {
  it('shows downloading when a recovering provider returns its image URL', () => {
    expect(getTaskLoadingPhase({ status: 'error', falRecoverable: true, rawImageUrls: ['https://images.example/result.png'] })).toBe('downloading')
  })
  it('changes to downloading as soon as an image URL arrives', () => {
    expect(getTaskLoadingPhase({ status: 'running', rawImageUrls: [] })).toBe('generating')
    expect(getTaskLoadingPhase({ status: 'running', rawImageUrls: ['https://images.example/result.png'] })).toBe('downloading')
  })

  it('keeps completed and failed tasks out of the loading state', () => {
    const rawImageUrls = ['https://images.example/result.png']
    expect(getTaskLoadingPhase({ status: 'done', rawImageUrls })).toBeNull()
    expect(getTaskLoadingPhase({ status: 'error', rawImageUrls })).toBeNull()
  })
})
