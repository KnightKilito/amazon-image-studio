import { describe, expect, it } from 'vitest'
import {
  estimateResizedImageByteSize,
  formatImageFileSize,
  getDataUrlByteSize,
  getImageResizePlan,
} from './imageResizing'

describe('image resizing', () => {
  it('fits each source inside a target box without changing its aspect ratio', () => {
    expect(getImageResizePlan(1600, 900, { width: 800, height: 800, mode: 'contain' })).toMatchObject({
      targetWidth: 800,
      targetHeight: 450,
      proportional: true,
    })
    expect(getImageResizePlan(900, 1600, { width: 800, height: 800, mode: 'contain' })).toMatchObject({
      targetWidth: 450,
      targetHeight: 800,
      proportional: true,
    })
  })

  it('uses the exact requested dimensions in stretch mode', () => {
    expect(getImageResizePlan(1600, 900, { width: 1000, height: 1000, mode: 'stretch' })).toMatchObject({
      targetWidth: 1000,
      targetHeight: 1000,
      proportional: false,
    })
  })

  it('allows shrinking and enlarging while enforcing browser-safe limits', () => {
    expect(getImageResizePlan(400, 300, { width: 800, height: 600, mode: 'contain' }).targetWidth).toBe(800)
    expect(() => getImageResizePlan(400, 300, { width: 20000, height: 600, mode: 'stretch' })).toThrow('单边不能超过')
    expect(() => getImageResizePlan(400, 300, { width: 10000, height: 10000, mode: 'stretch' })).toThrow('6400 万像素')
  })

  it('reads base64 byte sizes and scales estimates by pixels, format, and quality', () => {
    const source = `data:image/png;base64,${'A'.repeat(4000)}`
    expect(getDataUrlByteSize(source)).toBe(3000)
    const plan = getImageResizePlan(100, 100, { width: 200, height: 200, mode: 'stretch' })
    const png = estimateResizedImageByteSize(source, plan, 'png', 100)
    const jpegHigh = estimateResizedImageByteSize(source, plan, 'jpeg', 90)
    const jpegLow = estimateResizedImageByteSize(source, plan, 'jpeg', 40)
    expect(png).toBe(12000)
    expect(jpegHigh).toBeLessThan(png)
    expect(jpegLow).toBeLessThan(jpegHigh)
  })

  it('formats display sizes for batch totals', () => {
    expect(formatImageFileSize(900)).toBe('900 B')
    expect(formatImageFileSize(1536)).toBe('1.5 KB')
    expect(formatImageFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})
