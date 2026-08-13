import { describe, expect, it } from 'vitest'
import {
  getAPlusLayoutProfile,
  getAPlusMotherImageSize,
  getAPlusSingleImageSize,
  isAPlusMotherImageSize,
  normalizeAPlusLayoutStates,
} from './aPlusLayout'

describe('shared A+ layout profiles', () => {
  it('uses content-specific generation geometry while keeping upload geometry stable', () => {
    expect(getAPlusLayoutProfile('premium', '4K')).toMatchObject({
      generationSliceWidth: 2928,
      generationSliceHeight: 1200,
      uploadSliceWidth: 1464,
      uploadSliceHeight: 600,
    })
    expect(getAPlusLayoutProfile('mobile', '2K')).toMatchObject({
      generationSliceWidth: 1200,
      generationSliceHeight: 900,
      uploadSliceWidth: 600,
      uploadSliceHeight: 450,
    })
    expect(getAPlusLayoutProfile('mobile', '4K')).toMatchObject({
      generationSliceWidth: 2400,
      generationSliceHeight: 1800,
      uploadSliceWidth: 600,
      uploadSliceHeight: 450,
    })
  })

  it('scales Mobile A+ single images and mother images with the selected tier', () => {
    expect(getAPlusSingleImageSize('mobile', '2K')).toBe('1200x900')
    expect(getAPlusSingleImageSize('mobile', '4K')).toBe('2400x1800')
    expect(getAPlusMotherImageSize('mobile', 3, '2K')).toBe('1200x2700')
    expect(getAPlusMotherImageSize('mobile', 3, '4K')).toBe('2400x5400')
    expect(isAPlusMotherImageSize('2400x12600')).toBe(true)
  })

  it('keeps Premium and Mobile layout state independent and migrates legacy Premium state only', () => {
    const states = normalizeAPlusLayoutStates({
      premium: { mode: 'composed' },
      mobile: { mode: 'independent' },
    })
    expect(states.premium.mode).toBe('composed')
    expect(states.mobile.mode).toBe('independent')

    const migrated = normalizeAPlusLayoutStates(null, { mode: 'composed' })
    expect(migrated.premium.mode).toBe('composed')
    expect(migrated.mobile.mode).toBe('independent')
  })
})
