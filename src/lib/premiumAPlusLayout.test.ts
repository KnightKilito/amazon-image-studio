import { describe, expect, it } from 'vitest'
import {
  PREMIUM_A_PLUS_LAYOUT_PRESETS,
  createPremiumAPlusGroup,
  getPremiumAPlusGroupSlotCost,
  getPremiumAPlusSlotCount,
  getMobileMotherImageSize,
  getPremiumMotherImageSize,
  normalizePremiumAPlusGroup,
} from './premiumAPlusLayout'

describe('Premium A+ composed layout', () => {
  it('maps 2-7 slices to one exact continuous mother-image request', () => {
    expect(Array.from({ length: 6 }, (_, index) => getPremiumMotherImageSize(index + 2))).toEqual([
      '2928x2400',
      '2928x3600',
      '2928x4800',
      '2928x6000',
      '2928x7200',
      '2928x8400',
    ])
  })

  it('maps 2-7 slices to matching Mobile A+ mother-image sizes', () => {
    expect(Array.from({ length: 6 }, (_, index) => getMobileMotherImageSize(index + 2))).toEqual([
      '1200x1800',
      '1200x2700',
      '1200x3600',
      '1200x4500',
      '1200x5400',
      '1200x6300',
    ])
  })

  it('counts continuous slices as slots while a carousel costs one slot', () => {
    const groups = [
      createPremiumAPlusGroup('continuous-canvas', { sliceCount: 3 }),
      createPremiumAPlusGroup('independent-image'),
      createPremiumAPlusGroup('lifestyle-carousel', { slideCount: 6 }),
    ]

    expect(groups.map(getPremiumAPlusGroupSlotCost)).toEqual([3, 1, 1])
    expect(getPremiumAPlusSlotCount(groups)).toBe(5)
  })

  it('keeps every built-in preset inside the seven-slot budget', () => {
    expect(PREMIUM_A_PLUS_LAYOUT_PRESETS.length).toBeGreaterThan(0)
    for (const preset of PREMIUM_A_PLUS_LAYOUT_PRESETS) {
      expect(getPremiumAPlusSlotCount(preset.groups)).toBeLessThanOrEqual(7)
    }
  })

  it('clamps persisted slice and carousel counts to supported ranges', () => {
    expect(normalizePremiumAPlusGroup({ kind: 'continuous-canvas', sliceCount: 99 }).sliceCount).toBe(7)
    expect(normalizePremiumAPlusGroup({ kind: 'continuous-canvas', sliceCount: 0 }).sliceCount).toBe(2)
    expect(normalizePremiumAPlusGroup({ kind: 'lifestyle-carousel', slideCount: 99 }).slideCount).toBe(6)
    expect(normalizePremiumAPlusGroup({ kind: 'lifestyle-carousel', slideCount: 0 }).slideCount).toBe(2)
  })
})
