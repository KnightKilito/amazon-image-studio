import { describe, expect, it } from 'vitest'
import { parseDocumentationFile } from './documentation'

describe('parseDocumentationFile', () => {
  it('parses Front Matter and Markdown content', () => {
    const document = parseDocumentationFile(`---
id: listing
title: Listing 图
navTitle: Listing
description: 主图与附图
eyebrow: 图片策划
icon: photo
order: 10
tags:
  - 主图
  - 附图
---

## 01 开始

正文`, 'listing.md')

    expect(document).toMatchObject({
      id: 'listing',
      title: 'Listing 图',
      navTitle: 'Listing',
      description: '主图与附图',
      eyebrow: '图片策划',
      icon: 'photo',
      order: 10,
      tags: ['主图', '附图'],
    })
    expect(document.content).toBe('## 01 开始\n\n正文')
  })

  it('uses optional metadata defaults', () => {
    const document = parseDocumentationFile(`---
id: basics
title: 基础操作
description: 常用操作
order: 30
---

正文`, 'basics.md')

    expect(document.navTitle).toBe('基础操作')
    expect(document.eyebrow).toBe('使用文档')
    expect(document.icon).toBe('book')
    expect(document.tags).toEqual([])
  })

  it('rejects missing Front Matter', () => {
    expect(() => parseDocumentationFile('# Title', 'broken.md')).toThrow('must start with YAML Front Matter')
  })

  it('rejects invalid metadata types', () => {
    expect(() => parseDocumentationFile(`---
id: broken
title: Broken
description: Broken document
order: first
---`, 'broken.md')).toThrow('field "order" must be a number')
  })
})
