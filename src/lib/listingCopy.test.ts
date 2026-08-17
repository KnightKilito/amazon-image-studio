import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LISTING_COPY_PROFIT_INPUT,
  calculateListingCopyProfit,
  countVisibleCharacters,
  createEmptyListingCopyResult,
  formatAllEnglishListingCopy,
  formatListingCopyBullets,
  listingDescriptionToHtml,
  normalizeListingLongDescriptionText,
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

  it('flags forbidden title punctuation and the standalone word and', () => {
    const result = createEmptyListingCopyResult()
    result.itemName = { en: 'Women Sandals, Slip On', zh: '女士凉鞋' }
    result.itemHighlight = { en: 'Comfort and Style', zh: '舒适风格' }
    result.bullets = Array.from({ length: 5 }, (_, index) => ({ en: `${index + 1}. [Feature] Detail`, zh: `${index + 1}. [特点] 详情` })) as typeof result.bullets
    result.longDescription = { en: 'Heading\n\nParagraph.\n\nClosing.', zh: '大标题\n\n正文。\n\n收尾。' }
    const issues = validateListingCopyResult(result)
    expect(issues).toContain('Item Name 不能包含逗号')
    expect(issues).toContain('Item Highlight 不能包含 and')
  })

  it('flags bullet formatting without matching numbers and bracket headings', () => {
    const result = createEmptyListingCopyResult()
    result.itemName = { en: 'Women Mule Sandals', zh: '女士穆勒凉鞋' }
    result.itemHighlight = { en: 'Slip On Comfort for Office Wear', zh: '套脚舒适通勤穿着' }
    result.bullets = Array.from({ length: 5 }, (_, index) => ({ en: `${index + 1}. Detail`, zh: `${index + 1}. 详情` })) as typeof result.bullets
    result.longDescription = { en: 'Heading\n\nParagraph.\n\nClosing.', zh: '大标题\n\n正文。\n\n收尾。' }
    const issues = validateListingCopyResult(result)
    expect(issues).toContain('第 1 条英文五点缺少序号、方括号小标题或冒号')
    expect(issues).toContain('第 1 条中文五点缺少序号、方括号小标题或冒号')
  })

  it('removes unsupported long-description markup before rendering', () => {
    expect(normalizeListingLongDescriptionText('<p>Elegant <strong>summer</strong></p><br>next')).toBe('Elegant summer\n\nnext')
    expect(listingDescriptionToHtml('<script>alert(1)</script>\nnext')).toBe('<p>alert(1)<br>next</p>')
  })

  it('renders a safe heading and list for rich-text preview', () => {
    expect(listingDescriptionToHtml('Elegant Summer\n\nKey Features:\n\n• Soft lining\n• Rubber sole\n\nGraceful closing.')).toBe(
      '<h2>Elegant Summer</h2>\n<h3>Key Features</h3>\n<ul><li>Soft lining</li><li>Rubber sole</li></ul>\n<p>Graceful closing.</p>',
    )
  })

  it('cleans legacy Markdown from long descriptions before preview', () => {
    expect(listingDescriptionToHtml('**Polished Summer**\n\n**A refined silhouette** for daily styling.\n\n**Perfect For:**\n\n• **Office** looks\n\n**Step out with confidence.**')).toBe(
      '<h2>Polished Summer</h2>\n<p>A refined silhouette for daily styling.</p>\n<h3>Perfect For</h3>\n<ul><li>Office looks</li></ul>\n<p>Step out with confidence.</p>',
    )
  })

  it('renders Markdown headings safely for the title planning brief', () => {
    expect(listingDescriptionToHtml('### 商品身份判断\n\n**Women → Mules** 是核心商品身份。\n\n### 关键词取舍\n\n主标题优先品类。', { allowMarkdown: true })).toBe(
      '<h2>商品身份判断</h2>\n<p><strong>Women → Mules</strong> 是核心商品身份。</p>\n<h3>关键词取舍</h3>\n<p>主标题优先品类。</p>',
    )
  })

  it('flags internal audit language in customer-facing copy', () => {
    const result = createEmptyListingCopyResult()
    result.itemName = { en: 'Women Stiletto Pumps', zh: '女士细高跟鞋' }
    result.itemHighlight = { en: 'PU Upper with Rubber Outsole for Statement Styling', zh: 'PU鞋面搭配橡胶鞋底塑造醒目造型' }
    result.bullets = Array.from({ length: 5 }, (_, index) => ({
      en: `${index + 1}. [Style Feature]: ${index === 0 ? 'Closure details were not provided.' : 'A polished detail for evening styling.'}`,
      zh: `${index + 1}. [风格卖点]：${index === 0 ? '闭合方式未提供。' : '精致细节适合晚间造型。'}`,
    })) as typeof result.bullets
    result.longDescription = {
      en: '**Statement Height**\n\n**A dramatic silhouette.**\n\n**Perfect For:**\n• Evening looks\n\n**Specifications:**\n• Heel: 16 cm\n\n**Own every entrance.**',
      zh: '**瞩目高度**\n\n**利落轮廓展现鲜明风格。**\n\n**完美适用于：**\n• 晚间造型\n\n**规格说明：**\n• 鞋跟：16厘米\n\n**以自信姿态走入每一个重要时刻。**',
    }
    const issues = validateListingCopyResult(result)
    expect(issues).toContain('第 1 条五点 包含面向内部的缺失信息措辞')

    result.bullets[0] = { en: '1. [Statement Heel]: A dramatic profile for evening styling.', zh: '1. [瞩目高跟]：鲜明轮廓适合晚间造型。' }
    result.longDescription.zh = result.longDescription.zh.replace('利落轮廓展现鲜明风格。', '现有资料未包含闭合方式。')
    expect(validateListingCopyResult(result)).toContain('长描述 包含面向内部的缺失信息措辞')
  })

  it('does not duplicate bullet numbers when copying all English fields', () => {
    const result = createEmptyListingCopyResult()
    result.bullets = Array.from({ length: 5 }, (_, index) => ({
      en: `${index + 1}. [Feature] Detail`,
      zh: `${index + 1}. [特点] 详情`,
    })) as typeof result.bullets
    expect(formatAllEnglishListingCopy(result)).toContain('Bullet Points\n1. [Feature] Detail\n2. [Feature] Detail')
    expect(formatAllEnglishListingCopy(result)).not.toContain('1. 1. [Feature]')
    expect(formatListingCopyBullets(result, 'en')).toBe([
      '1. [Feature] Detail',
      '2. [Feature] Detail',
      '3. [Feature] Detail',
      '4. [Feature] Detail',
      '5. [Feature] Detail',
    ].join('\n'))
    expect(formatListingCopyBullets(result, 'zh')).toContain('1. [特点] 详情\n2. [特点] 详情')
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
