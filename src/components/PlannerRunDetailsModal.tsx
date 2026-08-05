import { useEffect, useRef, useState } from 'react'
import type { ApiMode } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import type { PlannerAttemptInfo, PlannerRequestStatus } from '../lib/listingPlannerApi'
import { Checkbox } from './Checkbox'
import { CloseIcon, CopyIcon } from './icons'

export type PlannerRunStatus = 'preparing' | PlannerRequestStatus | 'success' | 'error' | 'stopped'

interface PlannerRunDetailsModalProps {
  status: PlannerRunStatus
  startedAt: number | null
  finishedAt: number | null
  profileName: string
  model: string
  apiMode: ApiMode
  attempt: PlannerAttemptInfo | null
  responseText: string
  error: string
  running: boolean
  onClose: () => void
  onStop: () => void
}

const STATUS_LABELS: Record<PlannerRunStatus, string> = {
  preparing: '准备参考图',
  waiting: '等待接口响应',
  streaming: '正在接收',
  parsing: '正在解析',
  success: '策划完成',
  error: '策划失败',
  stopped: '已停止',
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}分${String(seconds).padStart(2, '0')}秒` : `${seconds}秒`
}

export default function PlannerRunDetailsModal({
  status,
  startedAt,
  finishedAt,
  profileName,
  model,
  apiMode,
  attempt,
  responseText,
  error,
  running,
  onClose,
  onStop,
}: PlannerRunDetailsModalProps) {
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(Date.now())
  const scrollRef = useRef<HTMLDivElement>(null)

  useCloseOnEscape(true, onClose)
  usePreventBackgroundScroll(true, scrollRef)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!autoScroll) return
    const element = scrollRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [autoScroll, responseText, error])

  const copyText = async () => {
    const text = responseText || error
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const elapsedEnd = running ? now : finishedAt ?? now
  const elapsed = startedAt ? formatElapsed(elapsedEnd - startedAt) : '0秒'
  const apiModeLabel = apiMode === 'responses' ? 'Responses API' : apiMode === 'chat' ? 'Chat Completions' : 'Images API'
  const statusTone = status === 'success'
    ? 'bg-emerald-500'
    : status === 'error'
      ? 'bg-red-500'
      : status === 'stopped'
        ? 'bg-gray-400'
        : 'bg-blue-500 animate-pulse'

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planner-run-details-title"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm dark:bg-black/55" />
      <div
        className="relative z-10 flex h-[min(780px,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-white/70 bg-white shadow-2xl ring-1 ring-black/5 dark:border-white/[0.08] dark:bg-gray-950 dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/[0.08] sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusTone}`} />
              <h2 id="planner-run-details-title" className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                AI 策划运行详情
              </h2>
            </div>
            <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
              {profileName} · {model} · {apiModeLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"
            aria-label="关闭策划运行详情"
            title="关闭"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-gray-100 bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.08] sm:grid-cols-4">
          {[
            ['状态', STATUS_LABELS[status]],
            ['耗时', elapsed],
            ['当前尝试', attempt?.label || '准备请求'],
            ['传输', attempt?.streaming ? '流式' : '非流式'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 bg-white px-3 py-2.5 dark:bg-gray-950 sm:px-4">
              <div className="text-[11px] text-gray-400 dark:text-gray-500">{label}</div>
              <div className="mt-0.5 truncate text-xs font-medium text-gray-700 dark:text-gray-200" title={value}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">接口返回内容</div>
            <div className="flex items-center gap-3">
              <Checkbox checked={autoScroll} onChange={setAutoScroll} label="自动滚动" />
              <button
                type="button"
                onClick={copyText}
                disabled={!responseText && !error}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-gray-200 bg-gray-950 p-3 custom-scrollbar dark:border-white/[0.08]"
          >
            {responseText ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-gray-100">{responseText}</pre>
            ) : error ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-red-300">{error}</pre>
            ) : (
              <div className="flex h-full min-h-32 items-center justify-center text-sm text-gray-500">
                {running ? '等待接口返回内容...' : '本次请求没有返回可显示的文本'}
              </div>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-white/[0.08] sm:px-5">
          <span className="text-xs text-gray-500 dark:text-gray-400">关闭窗口不会停止策划</span>
          <div className="flex items-center gap-2">
            {running && (
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-400/20 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-400/10"
              >
                停止策划
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
            >
              关闭
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
