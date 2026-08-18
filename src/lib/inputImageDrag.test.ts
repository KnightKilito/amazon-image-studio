import { describe, expect, it } from 'vitest'
import { resolveInputImageDropIndex, type InputImageDropRect } from './inputImageDrag'

const rects: InputImageDropRect[] = [
  { index: 0, left: 0, right: 52, top: 0, bottom: 52 },
  { index: 1, left: 64, right: 116, top: 0, bottom: 52 },
  { index: 2, left: 0, right: 52, top: 64, bottom: 116 },
  { index: 3, left: 64, right: 116, top: 64, bottom: 116 },
]

describe('resolveInputImageDropIndex', () => {
  it('resolves before and after a thumbnail from its midpoint', () => {
    expect(resolveInputImageDropIndex(rects, 10, 20)).toBe(0)
    expect(resolveInputImageDropIndex(rects, 45, 20)).toBe(1)
  })

  it('keeps resolving in horizontal gaps between thumbnails', () => {
    expect(resolveInputImageDropIndex(rects, 58, 20)).toBe(1)
  })

  it('selects the nearest visual row in vertical gaps', () => {
    expect(resolveInputImageDropIndex(rects, 10, 57)).toBe(0)
    expect(resolveInputImageDropIndex(rects, 10, 59)).toBe(2)
  })

  it('resolves the end insertion point after the final thumbnail in a row', () => {
    expect(resolveInputImageDropIndex(rects, 140, 90)).toBe(4)
  })

  it('returns null when there are no measurable thumbnails', () => {
    expect(resolveInputImageDropIndex([], 10, 10)).toBeNull()
    expect(resolveInputImageDropIndex([
      { index: 0, left: 0, right: 0, top: 0, bottom: 0 },
    ], 10, 10)).toBeNull()
  })
})
