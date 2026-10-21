import { normalizeHistoryPageSize } from './taskHistory'

export function getPlannerHistoryPage<T>(sessions: readonly T[], page: number, requestedPageSize: number) {
  const pageSize = normalizeHistoryPageSize(requestedPageSize)
  const pageCount = Math.max(1, Math.ceil(sessions.length / pageSize))
  const currentPage = Math.min(pageCount, Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1))
  const start = (currentPage - 1) * pageSize
  return { currentPage, pageSize, pageCount, items: sessions.slice(start, start + pageSize) }
}
