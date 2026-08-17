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

function renderInlineMarkdown(value: string) {
  return escapeHtml(value).replace(/\*\*([^*\r\n]+)\*\*/g, '<strong>$1</strong>')
}

function readBoldSectionHeading(value: string) {
  const match = value.match(/^\*\*(.+?[:：])\*\*$/)
  return match?.[1]?.replace(/[:：]$/, '') ?? ''
}

export function normalizeListingLongDescriptionText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6])>/gi, '\n\n')
    .replace(/<(?:p|div|h[1-6])\b[^>]*>/gi, '')
    .replace(/<\/?(?:strong|b|em|i)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*\*([^*\r\n]+)\*\*/g, '$1')
    .replace(/__([^_\r\n]+)__/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeListingCopyResult(result: ListingCopyResult): ListingCopyResult {
  return {
    ...result,
    longDescription: {
      en: normalizeListingLongDescriptionText(result.longDescription.en),
      zh: normalizeListingLongDescriptionText(result.longDescription.zh),
    },
  }
}

export function listingDescriptionToHtml(value: string, options: { allowMarkdown?: boolean } = {}) {
  const source = options.allowMarkdown ? value.trim() : normalizeListingLongDescriptionText(value)
  const renderInline = options.allowMarkdown ? renderInlineMarkdown : escapeHtml
  const blocks = source.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)
  if (!blocks.length) return ''

  const html: string[] = []
  let index = 0
  if (blocks.length > 1 && !blocks[0].includes('\n') && blocks[0].length <= 160) {
    const boldTitle = options.allowMarkdown ? blocks[0].match(/^\*\*([^*\r\n]+)\*\*$/)?.[1] : undefined
    const markdownTitle = options.allowMarkdown ? blocks[0].match(/^#{1,3}\s+(.+)$/)?.[1] : undefined
    html.push(`<h2>${renderInline(boldTitle ?? markdownTitle ?? blocks[0])}</h2>`)
    index = 1
  }

  for (; index < blocks.length; index += 1) {
    const lines = blocks[index].split(/\n/).map((line) => line.trim()).filter(Boolean)
    if (!lines.length) continue
    const isList = lines.every((line) => /^(?:[•*-]|\d+[.)])\s+/.test(line))
    if (isList) {
      html.push(`<ul>${lines.map((line) => `<li>${renderInline(line.replace(/^(?:[•*-]|\d+[.)])\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    const boldSectionHeading = options.allowMarkdown ? readBoldSectionHeading(lines[0]) : ''
    const markdownSectionHeading = options.allowMarkdown ? lines[0].match(/^#{2,4}\s+(.+)$/)?.[1] ?? '' : ''
    if (lines.length === 1 && markdownSectionHeading) {
      html.push(`<h3>${renderInline(markdownSectionHeading)}</h3>`)
      continue
    }
    if (lines.length === 1 && boldSectionHeading) {
      html.push(`<h3>${escapeHtml(boldSectionHeading)}</h3>`)
      continue
    }
    if (lines.length === 1 && /[:：]$/.test(lines[0]) && lines[0].length <= 80) {
      html.push(`<h3>${renderInline(lines[0].replace(/[:：]$/, ''))}</h3>`)
      continue
    }
    if (lines.length > 1 && (markdownSectionHeading || boldSectionHeading || /[:：]$/.test(lines[0])) && lines.slice(1).every((line) => /^(?:[•*-]|\d+[.)])\s+/.test(line))) {
      const heading = markdownSectionHeading || boldSectionHeading || lines[0].replace(/[:：]$/, '')
      html.push(`<h3>${renderInline(heading)}</h3>`)
      html.push(`<ul>${lines.slice(1).map((line) => `<li>${renderInline(line.replace(/^(?:[•*-]|\d+[.)])\s+/, ''))}</li>`).join('')}</ul>`)
      continue
    }
    html.push(`<p>${lines.map(renderInline).join('<br>')}</p>`)
  }
  return html.join('\n')
}

export function createEmptyListingCopyResult(): ListingCopyResult {
  const empty = (): BilingualText => ({ en: '', zh: '' })
  return {
    titleAnalysis: '',
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
  if (!(result.titleAnalysis ?? '').trim()) issues.push('标题策划说明为空')
  else if ((result.titleAnalysis ?? '').trim().length < 80) issues.push('标题策划说明过短，未充分解释商品身份与关键词取舍')
  if (!result.itemName.en.trim()) issues.push('Item Name 英文为空')
  if (countVisibleCharacters(result.itemName.en) > ITEM_NAME_MAX_CHARACTERS) issues.push(`Item Name 超过 ${ITEM_NAME_MAX_CHARACTERS} 字符`)
  if (/[,，]/.test(result.itemName.en)) issues.push('Item Name 不能包含逗号')
  if (/\band\b/i.test(result.itemName.en)) issues.push('Item Name 不能包含 and')
  if (!result.itemHighlight.en.trim()) issues.push('Item Highlight 英文为空')
  if (countVisibleCharacters(result.itemHighlight.en) > ITEM_HIGHLIGHT_MAX_CHARACTERS) issues.push(`Item Highlight 超过 ${ITEM_HIGHLIGHT_MAX_CHARACTERS} 字符`)
  if (/[,，]/.test(result.itemHighlight.en)) issues.push('Item Highlight 不能包含逗号')
  if (/\band\b/i.test(result.itemHighlight.en)) issues.push('Item Highlight 不能包含 and')
  if (result.bullets.length !== 5) issues.push('五点描述数量不是 5 条')
  result.bullets.forEach((bullet, index) => {
    if (!bullet.en.trim() || !bullet.zh.trim()) issues.push(`第 ${index + 1} 条五点描述不完整`)
    const prefix = new RegExp(`^\\s*${index + 1}\\.\\s*\\[[^\\]\\r\\n]+\\]\\s*[:：]`)
    if (bullet.en.trim() && !prefix.test(bullet.en)) issues.push(`第 ${index + 1} 条英文五点缺少序号、方括号小标题或冒号`)
    if (bullet.zh.trim() && !prefix.test(bullet.zh)) issues.push(`第 ${index + 1} 条中文五点缺少序号、方括号小标题或冒号`)
    if (/\[(?:product form|basic information|missing information)\]/i.test(bullet.en) || /\[(?:产品形式|基本信息|缺失信息)\]/.test(bullet.zh)) {
      issues.push(`第 ${index + 1} 条五点使用了资料字段式小标题`)
    }
  })
  if (!result.longDescription.en.trim() || !result.longDescription.zh.trim()) issues.push('长描述不完整')
  const publicCopyFields: Array<[string, string]> = [
    ['Item Name', `${result.itemName.en}\n${result.itemName.zh}`],
    ['Item Highlight', `${result.itemHighlight.en}\n${result.itemHighlight.zh}`],
    ...result.bullets.map((bullet, index) => [`第 ${index + 1} 条五点`, `${bullet.en}\n${bullet.zh}`] as [string, string]),
    ['长描述', `${result.longDescription.en}\n${result.longDescription.zh}`],
  ]
  const internalAuditLanguage = /\b(?:not provided|not specified|not supplied|not included|cannot confirm|unable to confirm|missing information|information (?:is|was) unavailable|details? (?:are|is|were|was) unavailable|(?:product )?(?:data|information) (?:does not|did not) (?:include|specify))\b|未提供|未说明|未包含|未给出|资料不足|信息不足|无法确认|不能确认|信息缺失|尚未提供|没有提供|暂无(?:相关)?信息|适合需要(?:明确|了解)|消费者可根据.{0,24}(?:实际|个人).{0,12}需求/i
  publicCopyFields.forEach(([label, value]) => {
    if (internalAuditLanguage.test(value)) issues.push(`${label} 包含面向内部的缺失信息措辞`)
  })
  if (result.itemName.en.trim().toLowerCase() === result.itemHighlight.en.trim().toLowerCase()) issues.push('Item Highlight 与 Item Name 重复')
  return issues
}

export function formatListingCopyBullets(result: ListingCopyResult, language: keyof BilingualText) {
  return result.bullets.map((bullet, index) => {
    const value = bullet[language].trim()
    return /^\s*\d+\.\s*/.test(value) ? value : `${index + 1}. ${value}`
  }).join('\n')
}

export function formatAllEnglishListingCopy(result: ListingCopyResult) {
  return [
    `Item Name\n${result.itemName.en}`,
    `Item Highlight\n${result.itemHighlight.en}`,
    `Bullet Points\n${formatListingCopyBullets(result, 'en')}`,
    `Long Description\n${result.longDescription.en}`,
    `Core Keywords\n${result.coreKeywords.map((keyword) => keyword.en).filter(Boolean).join(', ')}`,
    `Backend Search Terms\n${result.backendSearchTerms.en}`,
  ].join('\n\n')
}
