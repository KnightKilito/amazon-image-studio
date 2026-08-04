import { type FormEvent, useEffect, useId, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import Select from './Select'

export type PaginationItem = number | 'ellipsis-left' | 'ellipsis-right'

interface PaginationProps {
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  pageSizeOptions?: readonly number[]
  onPageSizeChange?: (pageSize: number) => void
  ariaLabel?: string
}

export function getPaginationItems(page: number, pageCount: number): PaginationItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1)

  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis-right', pageCount]
  if (page >= pageCount - 3) {
    return [1, 'ellipsis-left', pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  }
  return [1, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', pageCount]
}

export function normalizeJumpPage(value: string | number, pageCount: number) {
  const parsed = Math.trunc(Number(value))
  if (!Number.isFinite(parsed)) return 1
  return Math.min(Math.max(1, parsed), Math.max(1, pageCount))
}

export default function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  ariaLabel = '分页导航',
}: PaginationProps) {
  const [jumpValue, setJumpValue] = useState('')
  const jumpInputId = useId()
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const firstItem = (currentPage - 1) * pageSize + 1
  const lastItem = Math.min(currentPage * pageSize, totalItems)
  const items = getPaginationItems(currentPage, pageCount)
  const availablePageSizes = pageSizeOptions ?? []
  const showPageSizeSelect = Boolean(availablePageSizes.length && onPageSizeChange)

  useEffect(() => {
    setJumpValue('')
  }, [currentPage, pageCount])

  if (totalItems === 0) return null

  const handleJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!jumpValue.trim()) return
    onPageChange(normalizeJumpPage(jumpValue, pageCount))
    setJumpValue('')
  }

  return (
    <nav
      data-no-drag-select
      aria-label={ariaLabel}
      className="flex min-h-10 flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {firstItem}-{lastItem} / {totalItems}
        </span>
        {showPageSizeSelect && (
          <div className="w-24">
            <Select
              value={pageSize}
              onChange={(value) => onPageSizeChange?.(Number(value))}
              options={availablePageSizes.map((value) => ({ label: `${value} 条/页`, value }))}
              className="h-9 rounded-md border border-gray-200 bg-white px-2.5 text-xs text-gray-600 transition-colors hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            aria-label="上一页"
            title="上一页"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <div className="hidden items-center gap-1 sm:flex">
            {items.map((item) => typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === currentPage ? 'page' : undefined}
                aria-label={`第 ${item} 页`}
                className={`h-9 min-w-9 rounded-md border px-2 text-sm tabular-nums transition-colors ${
                  item === currentPage
                    ? 'border-blue-500 bg-blue-500 font-medium text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="inline-flex h-9 w-7 items-center justify-center text-sm text-gray-400" aria-hidden>
                ...
              </span>
            ))}
          </div>

          <span className="min-w-20 text-center text-sm tabular-nums text-gray-600 dark:text-gray-300 sm:hidden">
            第 {currentPage} / {pageCount} 页
          </span>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === pageCount}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]"
            aria-label="下一页"
            title="下一页"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleJump} className="flex items-center gap-1.5">
          <label htmlFor={jumpInputId} className="sr-only">跳转页码</label>
          <input
            id={jumpInputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={pageCount}
            value={jumpValue}
            onChange={(event) => setJumpValue(event.target.value)}
            placeholder="页码"
            className="h-9 w-16 rounded-md border border-gray-200 bg-white px-2 text-center text-sm tabular-nums text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500"
            aria-label="跳转页码"
          />
          <button
            type="submit"
            disabled={!jumpValue.trim()}
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            跳转
          </button>
        </form>
      </div>
    </nav>
  )
}
