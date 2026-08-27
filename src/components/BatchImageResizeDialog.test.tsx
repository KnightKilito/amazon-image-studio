import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import BatchImageResizeDialog from './BatchImageResizeDialog'

describe('BatchImageResizeDialog', () => {
  it('renders batch selection, sizing, format, quality, and estimate guidance', () => {
    const markup = renderToStaticMarkup(
      <BatchImageResizeDialog
        candidates={[
          { id: 'source-a', label: '当前主图', dataUrl: 'data:image/png;base64,AAAA' },
          { id: 'source-b', label: '结果 1', dataUrl: 'data:image/png;base64,BBBB' },
        ]}
        initialWidth={1200}
        initialHeight={900}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(markup).toContain('批量调整图片尺寸')
    expect(markup).toContain('已选择 2 / 2 张')
    expect(markup).toContain('当前主图')
    expect(markup).toContain('结果 1')
    expect(markup).toContain('目标宽度')
    expect(markup).toContain('解除宽高比例锁定')
    expect(markup).toContain('等比适应（不裁切）')
    expect(markup).toContain('输出格式')
    expect(markup).toContain('调整前显示编码文件大小预估')
  })
})
