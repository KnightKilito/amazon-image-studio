import { describe, expect, it } from 'vitest'
import {
  getAPlusMotherExpectedRatio,
  getVerticalSliceBounds,
  getPremiumMotherExpectedRatio,
  validateAPlusMotherGeometry,
  validatePremiumMotherGeometry,
} from './imageSlicing'

describe('Premium A+ vertical slicing geometry', () => {
  it('accepts exact and proportionally scaled mother images', () => {
    expect(validatePremiumMotherGeometry(2928, 3600, 3)).toMatchObject({
      valid: true,
      lowResolution: false,
      sliceWidth: 2928,
      sliceHeight: 1200,
    })
    expect(validatePremiumMotherGeometry(1464, 1800, 3)).toMatchObject({
      valid: true,
      lowResolution: false,
      sliceWidth: 1464,
      sliceHeight: 600,
    })
  })

  it('flags wrong ratios with a warning without treating them as valid geometry', () => {
    const validation = validatePremiumMotherGeometry(2928, 3200, 3)
    expect(validation.valid).toBe(false)
    expect(validation.expectedRatio).toBeCloseTo(getPremiumMotherExpectedRatio(3))
    expect(validation.message).toContain('仍可按高度等分切割')
  })

  it('warns when each resulting panel is below the Amazon upload size', () => {
    expect(validatePremiumMotherGeometry(732, 900, 3)).toMatchObject({
      valid: true,
      lowResolution: true,
    })
  })

  it('covers every source pixel exactly once even when heights do not divide evenly', () => {
    const bounds = getVerticalSliceBounds(1001, 3)
    const last = bounds[bounds.length - 1]!
    expect(bounds[0].y).toBe(0)
    expect(last.y + last.height).toBe(1001)
    expect(bounds.reduce((total, item) => total + item.height, 0)).toBe(1001)
    expect(bounds[0].y + bounds[0].height).toBe(bounds[1].y)
    expect(bounds[1].y + bounds[1].height).toBe(bounds[2].y)
  })
})

describe('Mobile A+ vertical slicing geometry', () => {
  it('accepts Mobile A+ mother images using 1200x900 panels', () => {
    expect(validateAPlusMotherGeometry(1200, 2700, 3, 'mobile')).toMatchObject({
      valid: true,
      lowResolution: false,
      sliceWidth: 1200,
      sliceHeight: 900,
    })
    expect(validateAPlusMotherGeometry(600, 1350, 3, 'mobile')).toMatchObject({
      valid: true,
      lowResolution: false,
      sliceWidth: 600,
      sliceHeight: 450,
    })
  })

  it('does not mistake Premium A+ mother geometry for Mobile A+ geometry', () => {
    const validation = validateAPlusMotherGeometry(2928, 3600, 3, 'mobile')
    expect(validation.valid).toBe(false)
    expect(validation.expectedRatio).toBeCloseTo(getAPlusMotherExpectedRatio(3, 'mobile'))
  })
})
