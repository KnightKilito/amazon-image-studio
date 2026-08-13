import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LISTING_COPY_PROFIT_INPUT,
  calculateListingCopyProfit,
  countVisibleCharacters,
  createEmptyListingCopyResult,
  listingDescriptionToHtml,
  validateListingCopyResult,
} from './listingCopy'

describe('listing copy rules', () => {
  it('counts spaces and punctuation', () => {
    expect(countVisibleCharacters(' Shoe, Test ')).toBe(10)
  })

  it('flags title limits without truncating the result', () => {
    const result = createEmptyListingCopyResult()
    result.itemName.en = 'A'.repeat(76)
    result.itemHighlight.en = 'B'.repeat(126)
    const issues = validateListingCopyResult(result)
    expect(issues).toContain('Item Name 超过 75 字符')
    expect(issues).toContain('Item Highlight 超过 125 字符')
    expect(result.itemName.en).toHaveLength(76)
  })

  it('escapes long description HTML', () => {
    expect(listingDescriptionToHtml('<script>alert(1)</script>\nnext')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;<br>next</p>')
  })
})

describe('listing profit calculator', () => {
  it('calculates Yanwen fee from billing kilograms', () => {
    const result = calculateListingCopyProfit({
      ...DEFAULT_LISTING_COPY_PROFIT_INPUT,
      purchaseCostCny: 30,
      domesticShippingCny: 5,
      netWeightG: 500,
    })
    expect(result.billingWeightKg).toBe(0.55)
    expect(result.yanwenFeeCny).toBe(71)
  })

  it('does not calculate FBA from missing required costs', () => {
    const result = calculateListingCopyProfit({
      ...DEFAULT_LISTING_COPY_PROFIT_INPUT,
      purchaseCostCny: 30,
      domesticShippingCny: 5,
      netWeightG: 500,
    })
    expect(result.fba).toBeNull()
  })

  it('rejects an impossible referral and target margin combination', () => {
    const result = calculateListingCopyProfit({
      ...DEFAULT_LISTING_COPY_PROFIT_INPUT,
      referralRatePercent: 70,
      targetMarginPercent: 30,
    })
    expect(result.error).toContain('小于 100%')
  })

  it('calibrates a low target price to the competitor minimum', () => {
    const result = calculateListingCopyProfit({
      ...DEFAULT_LISTING_COPY_PROFIT_INPUT,
      purchaseCostCny: 10,
      domesticShippingCny: 0,
      netWeightG: 100,
      competitorMinPriceUsd: 20,
    })
    expect(result.fbm.suggestedPriceUsd).toBe(20)
  })
})
