import { useEffect, useMemo, useState } from 'react'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { getImageDimensions } from '../lib/canvasImage'
import {
  estimateResizedImageByteSize,
  formatImageFileSize,
  getDataUrlByteSize,
  getImageResizePlan,
  MAX_IMAGE_RESIZE_EDGE,
  type ImageResizeMode,
  type ImageResizeOptions,
  type ImageResizeOutputFormat,
} from '../lib/imageResizing'
import { ensureImageCached } from '../store'
import { CloseIcon } from './icons'
import Select from './Select'

export interface BatchResizeCandidate {
  id: string
  label: string
  dataUrl?: string
}

interface LoadedCandidate extends BatchResizeCandidate {
  source?: string
  width?: number
  height?: number
  error?: string
}

interface Props {
  candidates: BatchResizeCandidate[]
  initialWidth?: number
  initialHeight?: number
  busy?: boolean
  onClose: () => void
  onConfirm: (imageIds: string[], options: ImageResizeOptions) => void
}

function normalizeDimension(value: string) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0
}

export default function BatchImageResizeDialog({
  candidates,
  initialWidth = 0,
  initialHeight = 0,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const [selectedIds, setSelectedIds] = useState(() => candidates.map(({ id }) => id))
  const [loadedCandidates, setLoadedCandidates] = useState<Record<string, LoadedCandidate>>({})
  const [width, setWidth] = useState(String(initialWidth || 1024))
  const [height, setHeight] = useState(String(initialHeight || 1024))
  const [mode, setMode] = useState<ImageResizeMode>('contain')
  const [outputFormat, setOutputFormat] = useState<ImageResizeOutputFormat>('png')
  const [quality, setQuality] = useState(85)

  useCloseOnEscape(!busy, onClose)

  useEffect(() => {
    let cancelled = false
    void Promise.all(candidates.map(async (candidate) => {
      try {
        const source = candidate.dataUrl || await ensureImageCached(candidate.id)
        if (!source) throw new Error('图片读取失败')
        const dimensions = await getImageDimensions(source)
        return { ...candidate, source, ...dimensions } satisfies LoadedCandidate
      } catch (error) {
        return {
          ...candidate,
          error: error instanceof Error ? error.message : '图片读取失败',
        } satisfies LoadedCandidate
      }
    })).then((items) => {
      if (cancelled) return
      setLoadedCandidates(Object.fromEntries(items.map((item) => [item.id, item])))
    })
    return () => { cancelled = true }
  }, [candidates])

  const targetWidth = normalizeDimension(width)
  const targetHeight = normalizeDimension(height)
  const selectedRows = useMemo(() => selectedIds.map((id) => {
    const candidate = loadedCandidates[id]
    if (!candidate?.source || !candidate.width || !candidate.height) {
      return { id, candidate, plan: null, estimate: 0, error: candidate?.error || '' }
    }
    try {
      const plan = getImageResizePlan(candidate.width, candidate.height, {
        width: targetWidth,
        height: targetHeight,
        mode,
      })
      return {
        id,
        candidate,
        plan,
        estimate: estimateResizedImageByteSize(candidate.source, plan, outputFormat, quality),
        error: '',
      }
    } catch (error) {
      return {
        id,
        candidate,
        plan: null,
        estimate: 0,
        error: error instanceof Error ? error.message : '目标尺寸无效',
      }
    }
  }), [loadedCandidates, mode, outputFormat, quality, selectedIds, targetHeight, targetWidth])
  const totalEstimate = selectedRows.reduce((sum, row) => sum + row.estimate, 0)
  const firstError = selectedRows.find((row) => row.error)?.error ?? ''
  const loading = selectedRows.some((row) => !row.candidate)
  const canConfirm = selectedIds.length > 0 && !loading && !firstError && !busy

  const toggleSelected = (imageId: string) => {
    if (busy) return
    setSelectedIds((current) => current.includes(imageId)
      ? current.filter((id) => id !== imageId)
      : [...current, imageId])
  }

  const handleClose = () => {
    if (!busy) onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between border-b border-gray-200 px-4 py-3.5 dark:border-white/[0.08] sm:px-5">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">批量调整图片尺寸</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">全部在浏览器 Canvas 中处理，不上传图片；调整前显示编码文件大小预估。</p>
          </div>
          <button type="button" disabled={busy} onClick={handleClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/[0.06]" aria-label="关闭批量调整窗口">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
          <section className="min-h-0 border-b border-gray-200 p-4 dark:border-white/[0.08] lg:overflow-y-auto lg:border-b-0 lg:border-r custom-scrollbar">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">选择图片</div>
                <div className="mt-0.5 text-xs text-gray-400">已选择 {selectedIds.length} / {candidates.length} 张</div>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => setSelectedIds(candidates.map(({ id }) => id))} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]">全选</button>
                <button type="button" disabled={busy} onClick={() => setSelectedIds([])} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]">清空</button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {candidates.map((candidate) => {
                const loaded = loadedCandidates[candidate.id]
                const row = selectedRows.find((item) => item.id === candidate.id)
                const selected = selectedIds.includes(candidate.id)
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    onClick={() => toggleSelected(candidate.id)}
                    className={`flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition ${selected
                      ? 'border-blue-400 bg-blue-50/80 ring-2 ring-blue-500/10 dark:border-blue-400/60 dark:bg-blue-500/10'
                      : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/[0.08] dark:bg-white/[0.025] dark:hover:border-white/[0.16]'}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 text-transparent dark:border-white/20'}`}>✓</span>
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-black/20">
                      {(loaded?.source || candidate.dataUrl) ? <img src={loaded?.source || candidate.dataUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{candidate.label}</span>
                      <span className="mt-1 block text-[10px] text-gray-400">
                        {loaded?.width ? `${loaded.width} × ${loaded.height} · ${formatImageFileSize(getDataUrlByteSize(loaded.source || ''))}` : loaded?.error || '正在读取…'}
                      </span>
                      {selected && row?.plan && (
                        <span className="mt-0.5 block text-[10px] font-medium text-blue-600 dark:text-blue-300">
                          → {row.plan.targetWidth} × {row.plan.targetHeight} · 预估 {formatImageFileSize(row.estimate)}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <aside className="space-y-4 p-4 lg:overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">目标宽度</span>
                <input type="number" min={1} max={MAX_IMAGE_RESIZE_EDGE} step={1} value={width} disabled={busy} onChange={(event) => setWidth(event.target.value)} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
              </label>
              <span className="pb-2.5 text-xs text-gray-400">×</span>
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">目标高度</span>
                <input type="number" min={1} max={MAX_IMAGE_RESIZE_EDGE} step={1} value={height} disabled={busy} onChange={(event) => setHeight(event.target.value)} className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100" />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">尺寸方式</span>
              <Select
                value={mode}
                disabled={busy}
                onChange={(value) => setMode(value as ImageResizeMode)}
                options={[
                  { value: 'contain', label: '等比适应（不裁切）' },
                  { value: 'stretch', label: '固定宽高（可能拉伸）' },
                ]}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">输出格式</span>
              <Select
                value={outputFormat}
                disabled={busy}
                onChange={(value) => setOutputFormat(value as ImageResizeOutputFormat)}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'jpeg', label: 'JPEG' },
                  { value: 'webp', label: 'WebP' },
                ]}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm transition hover:border-gray-300 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200"
              />
            </label>

            {outputFormat !== 'png' && (
              <label className="block rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                <span className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
                  <span>编码质量</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-300">{quality}%</span>
                </span>
                <input type="range" min={20} max={100} step={1} value={quality} disabled={busy} onChange={(event) => setQuality(Number(event.target.value))} className="mt-2 w-full accent-blue-600" />
                <span className="mt-1 block text-[10px] leading-relaxed text-gray-400">质量越高通常文件越大。透明背景导出 JPEG 时会填充为白色。</span>
              </label>
            )}

            <div className={`rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${firstError || selectedIds.length === 0 ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100' : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100'}`}>
              {selectedIds.length === 0 ? (
                <span>请至少选择一张图片。</span>
              ) : firstError ? (
                <span>{firstError}</span>
              ) : loading ? (
                <span>正在读取所选图片尺寸…</span>
              ) : (
                <>
                  <div className="font-semibold">预计输出 {selectedIds.length} 张 · 共 {formatImageFileSize(totalEstimate)}</div>
                  <div className="mt-1 opacity-80">文件大小为本地编码前预估，实际大小会受图片内容和浏览器编码器影响。</div>
                </>
              )}
            </div>
          </aside>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-white/[0.08] sm:px-5">
          <span className="hidden text-xs text-gray-400 sm:block">处理结果会保存为一条新任务，并保留全部源图引用。</span>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled={busy} onClick={handleClose} className="h-9 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]">取消</button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => onConfirm(selectedIds, { width: targetWidth, height: targetHeight, mode, outputFormat, quality })}
              className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-white/[0.08] dark:disabled:text-gray-500"
            >
              {busy ? `正在调整 ${selectedIds.length} 张…` : `调整并保存 ${selectedIds.length} 张`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
