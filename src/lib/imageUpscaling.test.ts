import { describe, expect, it } from 'vitest'
import { getAPlusUpscalePlan, getCustomUpscalePlan, MAX_CUSTOM_UPSCALE_EDGE, getProportionalUpscalePlan } from './imageUpscaling'

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

  it('uses exact user dimensions for custom upscale, including non-proportional targets', () => {
    expect(getCustomUpscalePlan(1200, 900, { width: 2000, height: 1800 })).toMatchObject({
      sourceWidth: 1200,
      sourceHeight: 900,
      targetWidth: 2000,
      targetHeight: 1800,
      scaleX: 2000 / 1200,
      scaleY: 2,
      proportional: false,
      needsUpscale: true,
    })
  })

  it('rejects custom dimensions that do not perform a safe upscale', () => {
    expect(() => getCustomUpscalePlan(1200, 900, { width: 1200, height: 900 })).toThrow('目标尺寸必须大于原图尺寸')
    expect(() => getCustomUpscalePlan(1200, 900, { width: 1199, height: 1800 })).toThrow('自定义尺寸不能小于原图')
    expect(() => getCustomUpscalePlan(1200, 900, { width: MAX_CUSTOM_UPSCALE_EDGE + 1, height: 1800 })).toThrow('单边尺寸不能超过')
    expect(() => getCustomUpscalePlan(1200, 900, { width: 10000, height: 10000 })).toThrow('6400 万像素')
  })
})
