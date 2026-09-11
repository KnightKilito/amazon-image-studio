import { describe, expect, it } from 'vitest'
import { replaceInputImagesWithReferenceImages } from './referenceImageSync'

const image = (id: string) => ({ id, dataUrl: `data:image/png;base64,${id}` })

describe('reference image sync', () => {
  it('replaces homepage images with Listing images in their original order', () => {
    const result = replaceInputImagesWithReferenceImages([image('listing-a'), image('listing-a'), image('listing-b')], 16)

    expect(result.images.map((item) => item.id)).toEqual(['listing-a', 'listing-b'])
    expect(result.duplicateCount).toBe(1)
    expect(result.skippedCount).toBe(0)
  })

  it('limits replacement images to homepage capacity', () => {
    const result = replaceInputImagesWithReferenceImages([image('a'), image('b'), image('c')], 2)

    expect(result.images.map((item) => item.id)).toEqual(['a', 'b'])
    expect(result.skippedCount).toBe(1)
  })
})
