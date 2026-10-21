import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaskDraft } from '../types'

const { state } = vi.hoisted(() => ({ state: {
  maskDraft: null as MaskDraft | null,
  setLightboxImageId: vi.fn(), setMaskEditorImageId: vi.fn(),
} }))
vi.mock('../store', () => ({ useStore: (selector: (value: typeof state) => unknown) => selector(state) }))
import PlannerReferenceImage from './PlannerReferenceImage'

const image = { id: 'reference', dataUrl: 'data:image/png;base64,image' }
const render = () => renderToStaticMarkup(<PlannerReferenceImage image={image} index={0} imageIds={[image.id, 'second']} onRemove={vi.fn()} />)

describe('planner reference image actions', () => {
  beforeEach(() => { state.maskDraft = null })
  it('exposes independent accessible preview, mask and remove actions', () => {
    const html = render()
    expect(html).toContain('aria-label="预览参考图 1"')
    expect(html).toContain('aria-label="添加遮罩参考图 1"')
    expect(html).toContain('aria-label="删除参考图 1"')
    expect(html).not.toContain('disabled=""')
    expect(html.match(/<button /g)).toHaveLength(3)
  })
  it('marks the current mask and exposes editing instead of adding another mask', () => {
    state.maskDraft = { targetImageId: image.id, maskDataUrl: 'data:image/png;base64,mask', updatedAt: 1 }
    const html = render()
    expect(html).toContain('MASK')
    expect(html).toContain('border-blue-500')
    expect(html).toContain('aria-label="编辑遮罩参考图 1"')
    expect(html).not.toContain('disabled=""')
  })
  it('prevents a second mask without disabling preview or removal', () => {
    state.maskDraft = { targetImageId: 'another-image', maskDataUrl: 'data:image/png;base64,mask', updatedAt: 1 }
    const html = render()
    expect(html).toContain('只能有一张遮罩图')
    expect(html.match(/disabled=""/g)).toHaveLength(1)
    expect(html).toContain('aria-label="预览参考图 1"')
    expect(html).toContain('aria-label="删除参考图 1"')
  })
})
