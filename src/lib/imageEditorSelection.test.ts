import { describe, expect, it } from 'vitest'
import { getPendingImageEditorResultAutoPreview } from './imageEditorSelection'

describe('image editor result auto preview', () => {
  it('selects the first image once for each completed output set', () => {
    const task = {
      id: 'task-1',
      status: 'done',
      outputImages: ['result-1', 'result-2'],
    }

    const firstPreview = getPendingImageEditorResultAutoPreview(task, null)
    expect(firstPreview).toEqual({
      signature: JSON.stringify(['task-1', 'result-1', 'result-2']),
      imageId: 'result-1',
    })
    expect(getPendingImageEditorResultAutoPreview(task, firstPreview!.signature)).toBeNull()
  })

  it('does not preview unfinished tasks and reacts to a changed output set', () => {
    expect(getPendingImageEditorResultAutoPreview({
      id: 'task-1',
      status: 'running',
      outputImages: [],
    }, null)).toBeNull()

    const previousSignature = JSON.stringify(['task-1', 'result-1'])
    expect(getPendingImageEditorResultAutoPreview({
      id: 'task-1',
      status: 'done',
      outputImages: ['result-3'],
    }, previousSignature)).toEqual({
      signature: JSON.stringify(['task-1', 'result-3']),
      imageId: 'result-3',
    })
  })
})
