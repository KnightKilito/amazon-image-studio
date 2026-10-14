import { describe, expect, it } from 'vitest'
import { buildAPlusConversionSpec, DEFAULT_APLUS_CONVERSION_PROMPT, getAPlusConversionSize, getDefaultAPlusConversionPrompt, restoreAPlusBatchDraft, updateDefaultAPlusConversionPrompt } from './aPlusConversion'

describe('A+ conversion specifications', () => {
  it('keeps prompt resolution, request resolution and panel count in sync for both formats', () => {
    for (const target of ['premium', 'mobile'] as const) {
      for (let count = 1; count <= 7; count++) {
        const size = target === 'premium' ? `2928x${1200 * count}` : `1200x${900 * count}`
        const prompt = getDefaultAPlusConversionPrompt(target, count)
        const spec = buildAPlusConversionSpec(target, count, prompt)
        expect(spec.params).toMatchObject({ size, n: 1 })
        expect(prompt).toContain(`画布尺寸调整为 ${size}`)
        expect(prompt).toContain('我是一名亚马逊美国站专业卖家')
        expect(prompt).toContain('角度、光影、细节及清晰度')
        if (count > 1) expect(prompt).toContain(`不得拆成 ${count} 张独立图片`)
        else expect(prompt).not.toContain('连续母图')
      }
    }
  })

  it('refreshes default copy when count or target changes without overwriting custom copy', () => {
    const previous = getDefaultAPlusConversionPrompt('premium', 1)
    const next = updateDefaultAPlusConversionPrompt(previous, 'premium', 1, 'mobile', 3)
    expect(next).toBe(getDefaultAPlusConversionPrompt('mobile', 3))
    expect(next).not.toContain('2928x1200')
    expect(updateDefaultAPlusConversionPrompt('手动提示词', 'premium', 1, 'mobile', 3)).toBe('手动提示词')
    expect(updateDefaultAPlusConversionPrompt(DEFAULT_APLUS_CONVERSION_PROMPT, 'mobile', 1, 'mobile', 2)).toBe(getDefaultAPlusConversionPrompt('mobile', 2))
  })

  it('upgrades only legacy default batch descriptions when restoring a draft', () => {
    const restored = restoreAPlusBatchDraft({ id: 'legacy', target: 'mobile', rows: [
      { id: 'a', sourceImageId: 'a', panelCount: 2, prompt: DEFAULT_APLUS_CONVERSION_PROMPT, status: 'ready' },
      { id: 'b', sourceImageId: 'b', panelCount: 3, prompt: '用户自定义', status: 'ready' },
    ] })!
    expect(restored.rows[0].prompt).toBe(getDefaultAPlusConversionPrompt('mobile', 2))
    expect(restored.rows[1].prompt).toBe('用户自定义')
  })

  it('generates one output with the selected internal panel count and preserves editable descriptions', () => {
    const spec = buildAPlusConversionSpec('premium', 3, '使用暖色背景，不修改产品。')
    expect(spec.params).toMatchObject({ size: '2928x3600', n: 1, output_format: 'png', quality: 'high', output_compression: null })
    expect(spec.prompt).toContain('使用暖色背景，不修改产品。')
    expect(spec.prompt).toContain('3 片')
    expect(spec.category.aPlusPlanContext?.sliceCount).toBe(3)
    expect(getAPlusConversionSize('mobile', 7)).toBe('1200x6300')
    expect(getAPlusConversionSize('premium', 1)).toBe('2928x1200')
  })

  it('restores queued/running rows for manual continuation while preserving prompts and IDs', () => {
    const draft = restoreAPlusBatchDraft({ id: 'batch', target: 'mobile', rows: [
      { id: 'one', sourceImageId: 'source', label: 'source.png', panelCount: 3, prompt: '手动描述', status: 'queued', taskId: null },
      { id: 'two', sourceImageId: 'source2', panelCount: 2, prompt: '第二行', status: 'running', taskId: 'task2' },
    ] })!
    expect(draft.rows.map((row) => row.status)).toEqual(['stopped', 'stopped'])
    expect(draft.rows[0]).toMatchObject({ prompt: '手动描述', panelCount: 3, sourceImageId: 'source' })
    expect(draft.rows[1].taskId).toBe('task2')
  })
})
