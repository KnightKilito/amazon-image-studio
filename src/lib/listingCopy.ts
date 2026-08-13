import type {
  BilingualText,
  ListingCopyInput,
  ListingCopyProfitInput,
  ListingCopyProfitResult,
  ListingCopyResult,
} from '../types'

export const ITEM_NAME_MAX_CHARACTERS = 75
export const ITEM_HIGHLIGHT_MAX_CHARACTERS = 125

export const DEFAULT_LISTING_COPY_INPUT: ListingCopyInput = {
  preset: 'footwear',
  productDescription: '',
  brand: '',
  category: '',
  material: '',
  features: '',
  colorAndSize: '',
  audience: '',
  useCases: '',
  requiredTerms: '',
  forbiddenTerms: '',
  heel: '',
  sole: '',
  closure: '',
  comfort: '',
}

export const DEFAULT_LISTING_COPY_PROFIT_INPUT: ListingCopyProfitInput = {
  purchaseCostCny: null,
  domesticShippingCny: null,
  netWeightG: null,
  packagingWeightG: 50,
  exchangeRate: 7,
  referralRatePercent: 15,
  targetMarginPercent: 30,
  yanwenRateCnyPerKg: 100,
  yanwenRegistrationFeeCny: 16,
  competitorMinPriceUsd: null,
  competitorMaxPriceUsd: null,
  fbaInboundCny: null,
  fbaFulfillmentFeeUsd: null,
  calculationPriceUsd: null,
}

export function countVisibleCharacters(value: string) {
  return Array.from(value.trim()).length
}

function finiteNonNegative(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function ceilCurrency(value: number) {
  return Math.ceil((value - Number.EPSILON) * 100) / 100
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function calibrateSuggestedPrice(targetPrice: number, min: number | null, max: number | null) {
  if (min != null && targetPrice < min) return { price: min, warning: '目标利润价低于竞品区间，建议按竞品最低价测试。' }
  if (max != null && targetPrice > max) return { price: targetPrice, warning: '目标利润价高于竞品最高价，当前成本结构可能缺乏竞争力。' }
  return { price: targetPrice, warning: '' }
}

export function calculateListingCopyProfit(input: ListingCopyProfitInput): ListingCopyProfitResult {
  const purchase = finiteNonNegative(input.purchaseCostCny)
  const domestic = finiteNonNegative(input.domesticShippingCny)
  const netWeight = finiteNonNegative(input.netWeightG)
  const packagingWeight = finiteNonNegative(input.packagingWeightG)
  const exchangeRate = finiteNonNegative(input.exchangeRate)
  const referralRate = finiteNonNegative(input.referralRatePercent)
  const targetMargin = finiteNonNegative(input.targetMarginPercent)
  const yanwenRate = finiteNonNegative(input.yanwenRateCnyPerKg)
  const registrationFee = finiteNonNegative(input.yanwenRegistrationFeeCny)
  const competitorMin = finiteNonNegative(input.competitorMinPriceUsd)
  const competitorMax = finiteNonNegative(input.competitorMaxPriceUsd)
  const calculationPrice = finiteNonNegative(input.calculationPriceUsd)
  const denominator = referralRate == null || targetMargin == null
    ? null
    : 1 - referralRate / 100 - targetMargin / 100

  const emptyFulfillment = {
    fixedCostUsd: 0,
    targetPriceUsd: null,
    suggestedPriceUsd: null,
    profitUsd: null,
    marginPercent: null,
    warning: '',
  }

  if (exchangeRate == null || exchangeRate <= 0) {
    return { billingWeightKg: null, yanwenFeeCny: null, calculationPriceUsd: calculationPrice, suggestedPriceUsd: null, fbm: emptyFulfillment, fba: null, error: '汇率必须大于 0。' }
  }
  if (denominator == null || denominator <= Number.EPSILON) {
    return { billingWeightKg: null, yanwenFeeCny: null, calculationPriceUsd: calculationPrice, suggestedPriceUsd: null, fbm: emptyFulfillment, fba: null, error: '佣金率与目标净利率之和必须小于 100%。' }
  }

  const billingWeightKg = netWeight == null || packagingWeight == null ? null : (netWeight + packagingWeight) / 1000
  const yanwenFeeCny = billingWeightKg == null || yanwenRate == null || registrationFee == null
    ? null
    : billingWeightKg * yanwenRate + registrationFee
  const commonCostReady = purchase != null && domestic != null
  const fbmReady = commonCostReady && yanwenFeeCny != null
  const fbaInbound = finiteNonNegative(input.fbaInboundCny)
  const fbaFee = finiteNonNegative(input.fbaFulfillmentFeeUsd)
  const fbaReady = commonCostReady && fbaInbound != null && fbaFee != null
  const effectiveReferralRate = (referralRate ?? 0) / 100

  const buildFulfillment = (fixedCostUsd: number, ready: boolean) => {
    if (!ready) return { ...emptyFulfillment, warning: '待补全成本数据。' }
    const targetPriceUsd = ceilCurrency(fixedCostUsd / denominator)
    const calibrated = calibrateSuggestedPrice(targetPriceUsd, competitorMin, competitorMax)
    const measuredPrice = calculationPrice ?? calibrated.price
    const profitUsd = roundCurrency(measuredPrice * (1 - effectiveReferralRate) - fixedCostUsd)
    return {
      fixedCostUsd: roundCurrency(fixedCostUsd),
      targetPriceUsd,
      suggestedPriceUsd: ceilCurrency(calibrated.price),
      profitUsd,
      marginPercent: measuredPrice > 0 ? Math.round((profitUsd / measuredPrice) * 10000) / 100 : null,
      warning: calibrated.warning,
    }
  }

  const fbmFixedCost = fbmReady ? ((purchase ?? 0) + (domestic ?? 0) + (yanwenFeeCny ?? 0)) / exchangeRate : 0
  const fbaFixedCost = fbaReady ? ((purchase ?? 0) + (domestic ?? 0) + (fbaInbound ?? 0)) / exchangeRate + (fbaFee ?? 0) : 0
  const fbm = buildFulfillment(fbmFixedCost, fbmReady)
  const fba = fbaReady ? buildFulfillment(fbaFixedCost, true) : null
  const suggestions = [fbm.suggestedPriceUsd, fba?.suggestedPriceUsd].filter((value): value is number => value != null)
  const suggestedPriceUsd = suggestions.length ? Math.max(...suggestions) : null
  const effectiveCalculationPrice = calculationPrice ?? suggestedPriceUsd

  if (effectiveCalculationPrice != null && calculationPrice == null) {
    const enrich = (value: typeof fbm) => {
      if (value.targetPriceUsd == null) return value
      const profitUsd = roundCurrency(effectiveCalculationPrice * (1 - effectiveReferralRate) - value.fixedCostUsd)
      return { ...value, profitUsd, marginPercent: Math.round((profitUsd / effectiveCalculationPrice) * 10000) / 100 }
    }
    return {
      billingWeightKg,
      yanwenFeeCny: yanwenFeeCny == null ? null : roundCurrency(yanwenFeeCny),
      calculationPriceUsd: effectiveCalculationPrice,
      suggestedPriceUsd,
      fbm: enrich(fbm),
      fba: fba ? enrich(fba) : null,
      error: '',
    }
  }

  return {
    billingWeightKg,
    yanwenFeeCny: yanwenFeeCny == null ? null : roundCurrency(yanwenFeeCny),
    calculationPriceUsd: effectiveCalculationPrice,
    suggestedPriceUsd,
    fbm,
    fba,
    error: '',
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function listingDescriptionToHtml(value: string) {
  return value
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

export function createEmptyListingCopyResult(): ListingCopyResult {
  const empty = (): BilingualText => ({ en: '', zh: '' })
  return {
    itemName: empty(),
    itemHighlight: empty(),
    bullets: [empty(), empty(), empty(), empty(), empty()],
    longDescription: empty(),
    coreKeywords: [],
    backendSearchTerms: empty(),
    missingFacts: [],
    complianceWarnings: [],
  }
}

export function validateListingCopyResult(result: ListingCopyResult) {
  const issues: string[] = []
  if (!result.itemName.en.trim()) issues.push('Item Name 英文为空')
  if (countVisibleCharacters(result.itemName.en) > ITEM_NAME_MAX_CHARACTERS) issues.push(`Item Name 超过 ${ITEM_NAME_MAX_CHARACTERS} 字符`)
  if (!result.itemHighlight.en.trim()) issues.push('Item Highlight 英文为空')
  if (countVisibleCharacters(result.itemHighlight.en) > ITEM_HIGHLIGHT_MAX_CHARACTERS) issues.push(`Item Highlight 超过 ${ITEM_HIGHLIGHT_MAX_CHARACTERS} 字符`)
  if (result.bullets.length !== 5) issues.push('五点描述数量不是 5 条')
  result.bullets.forEach((bullet, index) => {
    if (!bullet.en.trim() || !bullet.zh.trim()) issues.push(`第 ${index + 1} 条五点描述不完整`)
  })
  if (!result.longDescription.en.trim() || !result.longDescription.zh.trim()) issues.push('长描述不完整')
  if (result.itemName.en.trim().toLowerCase() === result.itemHighlight.en.trim().toLowerCase()) issues.push('Item Highlight 与 Item Name 重复')
  return issues
}

export function formatAllEnglishListingCopy(result: ListingCopyResult) {
  return [
    `Item Name\n${result.itemName.en}`,
    `Item Highlight\n${result.itemHighlight.en}`,
    `Bullet Points\n${result.bullets.map((bullet, index) => `${index + 1}. ${bullet.en}`).join('\n')}`,
    `Long Description\n${result.longDescription.en}`,
    `Core Keywords\n${result.coreKeywords.map((keyword) => keyword.en).filter(Boolean).join(', ')}`,
    `Backend Search Terms\n${result.backendSearchTerms.en}`,
  ].join('\n\n')
}
