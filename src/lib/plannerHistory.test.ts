import { describe, expect, it } from 'vitest'
import { getPlannerHistoryPage } from './plannerHistory'

describe('planner history pagination', () => {
  const sessions = Array.from({ length: 29 }, (_, index) => ({ id: `session-${index + 1}` }))

  it('shows only the requested page and preserves session order and identities', () => {
    const result = getPlannerHistoryPage(sessions, 2, 12)
    expect(result).toMatchObject({ currentPage: 2, pageSize: 12, pageCount: 3 })
    expect(result.items).toEqual(sessions.slice(12, 24))
    expect(result.items[0]).toBe(sessions[12])
    expect(sessions).toHaveLength(29)
  })

  it('renders the partial final page and supports all page size options', () => {
    expect(getPlannerHistoryPage(sessions, 3, 12).items).toEqual(sessions.slice(24))
    for (const size of [6, 12, 24, 48]) {
      expect(getPlannerHistoryPage(sessions, 1, size).items).toHaveLength(Math.min(size, 29))
    }
  })

  it('clamps the page immediately when the final page is removed', () => {
    const remaining = sessions.slice(0, 24)
    expect(getPlannerHistoryPage(remaining, 3, 12)).toMatchObject({ currentPage: 2, pageCount: 2, items: remaining.slice(12) })
    expect(getPlannerHistoryPage([], 3, 12)).toMatchObject({ currentPage: 1, pageCount: 1, items: [] })
  })

  it('normalizes invalid page and page size values', () => {
    expect(getPlannerHistoryPage(sessions, -1, 0)).toMatchObject({ currentPage: 1, pageSize: 12 })
    expect(getPlannerHistoryPage(sessions, NaN, 12).currentPage).toBe(1)
    expect(getPlannerHistoryPage(sessions, 2.9, 12).currentPage).toBe(2)
    expect(getPlannerHistoryPage(sessions, 99, 12).currentPage).toBe(3)
  })
})
