import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LISTING_TARGET_SIZE,
  formatListingTargetSize,
  getListingPresetSize,
  getPlannerSessionListingTargetSize,
  normalizeListingTargetSize,
} from './listingImageSize'

describe('listing image size', () => {
  it('keeps the existing 2K and 4K square presets', () => {
    expect(getListingPresetSize('2k')).toBe('2048x2048')
    expect(getListingPresetSize('4k')).toBe('2880x2880')
  })

  it('normalizes and formats a custom target size', () => {
    expect(normalizeListingTargetSize('1600 × 2000')).toBe('1600x2000')
    expect(formatListingTargetSize('1600x2000')).toBe('1600 × 2000')
  })

  it('restores custom session sizes and falls back for legacy sessions', () => {
    expect(getPlannerSessionListingTargetSize({ resolution: '2k', listingTargetSize: '1600x2000' })).toBe('1600x2000')
    expect(getPlannerSessionListingTargetSize({ resolution: '4k' })).toBe('2880x2880')
    expect(normalizeListingTargetSize('invalid')).toBe(DEFAULT_LISTING_TARGET_SIZE)
  })
})
