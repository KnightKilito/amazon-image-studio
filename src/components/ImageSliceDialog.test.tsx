import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import ImageSliceDialog from './ImageSliceDialog'

describe('ImageSliceDialog', () => {
  it('shows an explicit A+ type selector and validates against the selected default', () => {
    const markup = renderToStaticMarkup(
      <ImageSliceDialog
        source="data:image/png;base64,test"
        initialSliceCount={3}
        format="mobile"
        allowFormatSelection
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(markup).toContain('切割 A+ 母图')
    expect(markup).toContain('切割类型')
    expect(markup).toContain('手机 A+')
    expect(markup).toContain('按手机 A+比例辅助校验')
    expect(markup).toContain('按手机 A+校验')
  })

  it('keeps the editor workflow compact when format selection is disabled', () => {
    const markup = renderToStaticMarkup(
      <ImageSliceDialog
        source="data:image/png;base64,test"
        initialSliceCount={2}
        format="premium"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(markup).not.toContain('切割类型')
    expect(markup).toContain('按高级 A+校验')
  })
})
