import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LISTING_BULLETS_PROMPT,
  DEFAULT_LISTING_COPY_PROMPTS,
  DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT,
  DEFAULT_LISTING_TITLE_PROMPT,
  LISTING_COPY_KNOWLEDGE_SOURCES,
  normalizeListingCopyPrompts,
} from './listingCopyKnowledge'

describe('listing copy prompts and source viewer', () => {
  it('bundles the three requested source files and uses titlePrompt.txt without extra prose', () => {
    expect(LISTING_COPY_KNOWLEDGE_SOURCES.map((source) => source.filename)).toEqual([
      '标题Prompt.txt',
      '【笔记】20250813-标题1.md',
      '【笔记】20251013-标题2.md',
    ])
    expect(DEFAULT_LISTING_TITLE_PROMPT).toBe(LISTING_COPY_KNOWLEDGE_SOURCES[0]?.content)
    expect(DEFAULT_LISTING_TITLE_PROMPT).toContain('严格控制在75个字符以内')
    expect(DEFAULT_LISTING_TITLE_PROMPT).toContain('严格控制在125个字符以内')
    expect(DEFAULT_LISTING_TITLE_PROMPT).not.toContain('标题格式补充要求')
  })

  it('provides focused defaults for bullets and long description', () => {
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('请大胆写出五条让买家产生拥有欲')
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('1. [16 cm Statement Stiletto]:')
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('审美表达、情绪价值和合理的穿搭场景可以充分发挥')
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('不要使用 Product Form')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('Perfect For: / 完美适用于：')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('Specifications: / 规格说明：')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('高级创意文案')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('精致、华丽、有层次、有情绪张力')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('穿上这份闪耀与锋芒')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('不输出 Markdown 语法或 HTML 标签')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).not.toContain('**')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).not.toContain('加粗')
    expect(DEFAULT_LISTING_COPY_PROMPTS).toEqual({
      title: DEFAULT_LISTING_TITLE_PROMPT,
      bullets: DEFAULT_LISTING_BULLETS_PROMPT,
      longDescription: DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT,
    })
  })

  it('restores three saved prompts and migrates a customized legacy prompt', () => {
    const saved = { title: 'title', bullets: 'bullets', longDescription: 'description' }
    expect(normalizeListingCopyPrompts(saved)).toEqual(saved)

    const migrated = normalizeListingCopyPrompts(undefined, 'Keep my special requirement')
    expect(migrated.title).toContain('历史自定义补充要求：\nKeep my special requirement')
    expect(migrated.bullets).toContain('历史自定义补充要求：\nKeep my special requirement')
    expect(migrated.longDescription).toContain('历史自定义补充要求：\nKeep my special requirement')

    const previousDefaultTitle = `${LISTING_COPY_KNOWLEDGE_SOURCES[0]?.content}\n\n标题格式补充要求：Item Name 和 Item Highlight 都不要使用英文逗号、中文逗号，也不要使用独立单词 and。需要连接属性时使用自然的空格、介词或 with 等结构，避免用逗号堆砌关键词。`
    expect(normalizeListingCopyPrompts({ title: previousDefaultTitle }).title).toBe(DEFAULT_LISTING_TITLE_PROMPT)
  })

  it('migrates the former restrained defaults without overwriting a custom title prompt', () => {
    const normalized = normalizeListingCopyPrompts({
      title: 'Keep my title strategy',
      bullets: '你正在为 Amazon.com 买家撰写能促成购买的五点描述。绝对禁止在五点中出现任何缺失说明，缺少的资料只能写入 missingFacts。',
      longDescription: '你正在撰写面向 Amazon.com 买家的品牌感长描述，英文建议约 250–450 词。绝对禁止在长描述中出现缺失信息。',
    })
    expect(normalized.title).toBe('Keep my title strategy')
    expect(normalized.bullets).toBe(DEFAULT_LISTING_BULLETS_PROMPT)
    expect(normalized.longDescription).toBe(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT)
  })

  it('migrates the former Markdown long-description default to clean plain text', () => {
    const normalized = normalizeListingCopyPrompts({
      title: 'custom title',
      bullets: 'custom bullets',
      longDescription: '你是一位为时尚与生活方式品牌撰稿的高级创意文案。\n\n以一个有画面感的加粗大标题开场，并展开销售故事。\n\n返回 Markdown 纯文本，不输出 HTML。',
    })
    expect(normalized.title).toBe('custom title')
    expect(normalized.bullets).toBe('custom bullets')
    expect(normalized.longDescription).toBe(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT)
    expect(normalized.longDescription).not.toContain('**')
  })
})
