import { describe, expect, it } from 'vitest'
import { getAPlusUpscalePlan, getProportionalUpscalePlan } from './imageUpscaling'

describe('proportional A+ upscaling', () => {
  it('doubles an undersized Premium A+ slice to the web minimum', () => {
    expect(getAPlusUpscalePlan(732, 300, 'premium')).toMatchObject({
      targetWidth: 1464,
      targetHeight: 600,
      scale: 2,
      needsUpscale: true,
    })
  })

  it('uses the larger required scale without changing aspect ratio', () => {
    const plan = getProportionalUpscalePlan(1000, 300, 1464, 600)
    expect(plan).toMatchObject({
      targetWidth: 2000,
      targetHeight: 600,
      scale: 2,
      needsUpscale: true,
    })
    expect(plan.targetWidth / plan.targetHeight).toBeCloseTo(1000 / 300)
  })

  it('still offers a meaningful 2x upscale when the image already meets the minimum', () => {
    expect(getAPlusUpscalePlan(2928, 1200, 'premium')).toMatchObject({
      targetWidth: 5856,
      targetHeight: 2400,
      scale: 2,
      needsUpscale: true,
    })
  })

  it('uses the Mobile A+ minimum for mobile outputs', () => {
    expect(getAPlusUpscalePlan(300, 225, 'mobile')).toMatchObject({
      targetWidth: 600,
      targetHeight: 450,
      scale: 2,
      needsUpscale: true,
    })
  })
})
