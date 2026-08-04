import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Pagination, { getPaginationItems, normalizeJumpPage } from './Pagination'

describe('Pagination', () => {
  it('builds compact page ranges around the current page', () => {
    expect(getPaginationItems(1, 12)).toEqual([1, 2, 3, 4, 5, 'ellipsis-right', 12])
    expect(getPaginationItems(6, 12)).toEqual([1, 'ellipsis-left', 5, 6, 7, 'ellipsis-right', 12])
    expect(getPaginationItems(12, 12)).toEqual([1, 'ellipsis-left', 8, 9, 10, 11, 12])
  })

  it('renders the current range, page count, and accessible navigation labels', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={2}
        pageSize={12}
        totalItems={29}
        onPageChange={vi.fn()}
        pageSizeOptions={[6, 12, 24, 48]}
        onPageSizeChange={vi.fn()}
        ariaLabel="历史记录分页"
      />,
    )

    expect(html).toContain('aria-label="历史记录分页"')
    expect(html).toContain('13-24 / 29')
    expect(html).toContain('第 2 / 3 页')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('aria-label="上一页"')
    expect(html).toContain('aria-label="下一页"')
    expect(html).toContain('12 条/页')
    expect(html).toContain('aria-label="跳转页码"')
    expect(html).toContain('>跳转</button>')
  })

  it('keeps page-size and jump controls available when all items fit on one page', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={1}
        pageSize={24}
        totalItems={12}
        onPageChange={vi.fn()}
        pageSizeOptions={[6, 12, 24, 48]}
        onPageSizeChange={vi.fn()}
      />,
    )

    expect(html).toContain('24 条/页')
    expect(html).toContain('12 / 12')
    expect(html).toContain('aria-label="跳转页码"')
  })

  it('clamps direct page jumps to the valid range', () => {
    expect(normalizeJumpPage('0', 8)).toBe(1)
    expect(normalizeJumpPage('4.9', 8)).toBe(4)
    expect(normalizeJumpPage('99', 8)).toBe(8)
    expect(normalizeJumpPage('invalid', 8)).toBe(1)
  })
})
