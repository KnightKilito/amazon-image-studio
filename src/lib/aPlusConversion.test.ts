import { describe, expect, it } from 'vitest'
import { buildAPlusConversionSpec, getAPlusConversionSize, restoreAPlusBatchDraft } from './aPlusConversion'

describe('A+ conversion specifications', () => {
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
