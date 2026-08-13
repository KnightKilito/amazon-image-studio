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
  it('bundles the three requested source files and uses titlePrompt.txt verbatim', () => {
    expect(LISTING_COPY_KNOWLEDGE_SOURCES.map((source) => source.filename)).toEqual([
      '标题Prompt.txt',
      '【笔记】20250813-标题1.md',
      '【笔记】20251013-标题2.md',
    ])
    expect(DEFAULT_LISTING_TITLE_PROMPT).toBe(LISTING_COPY_KNOWLEDGE_SOURCES[0]?.content)
    expect(DEFAULT_LISTING_TITLE_PROMPT).toContain('严格控制在75个字符以内')
    expect(DEFAULT_LISTING_TITLE_PROMPT).toContain('严格控制在125个字符以内')
  })

  it('provides focused defaults for bullets and long description', () => {
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('设计与穿戴方式')
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('鞋头与关键结构')
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('鞋跟、鞋底与功能')
    expect(DEFAULT_LISTING_BULLETS_PROMPT).toContain('注意事项')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('稳定模板')
    expect(DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT).toContain('结尾补充必要的尺码')
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
  })
})
