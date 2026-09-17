import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SizePickerModal from './SizePickerModal'

describe('SizePickerModal', () => {
  it('starts custom width and height with the aspect ratio locked', () => {
    const markup = renderToStaticMarkup(
      <SizePickerModal
        currentSize="1600x2000"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(markup).toContain('aria-label="解除宽高比例锁定"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('比例已锁定，修改任一边会同步计算另一边。')
  })
})
