import { useEffect, useMemo, useState } from 'react'
import { getImageDimensions } from '../lib/canvasImage'
import {
  MAX_PREMIUM_MOTHER_SLICES,
  MIN_PREMIUM_MOTHER_SLICES,
} from '../lib/premiumAPlusLayout'
import { normalizePremiumSliceCount, validateAPlusMotherGeometry, type APlusSliceFormat } from '../lib/imageSlicing'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { CloseIcon } from './icons'
import Select from './Select'

interface Props {
  source: string
  initialSliceCount: number
  format?: APlusSliceFormat
  busy?: boolean
  onClose: () => void
  onConfirm: (sliceCount: number) => void
}

export default function ImageSliceDialog({ source, initialSliceCount, format = 'premium', busy = false, onClose, onConfirm }: Props) {
  const [sliceCount, setSliceCount] = useState(() => normalizePremiumSliceCount(initialSliceCount))
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const formatLabel = format === 'mobile' ? '手机 A+' : '高级 A+'
  const validation = useMemo(
    () => validateAPlusMotherGeometry(dimensions.width, dimensions.height, sliceCount, format),
    [dimensions.height, dimensions.width, format, sliceCount],
  )

  useCloseOnEscape(!busy, onClose)

  useEffect(() => {
    let cancelled = false
    void getImageDimensions(source).then((next) => {
      if (!cancelled) setDimensions(next)
    })
    return () => { cancelled = true }
  }, [source])

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-white/[0.08]">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">切割{formatLabel} 母图</div>
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">仅按高度等分，不拉伸、不压缩、不修改原图。</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/[0.06]" aria-label="关闭切割窗口"><CloseIcon className="h-5 w-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="overflow-hidden rounded-lg bg-gray-100 p-2 dark:bg-black/25">
            <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md">
              <img src={source} alt="" className="block max-h-[54vh] max-w-full object-contain" />
              {Array.from({ length: sliceCount - 1 }, (_, index) => (
                <div key={index} className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-red-500/90" style={{ top: `${((index + 1) / sliceCount) * 100}%` }}>
                  <span className="absolute left-2 top-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label>
              <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">切片数量</span>
              <Select
                value={sliceCount}
                disabled={busy}
                onChange={(value) => setSliceCount(normalizePremiumSliceCount(value))}
                options={Array.from({ length: MAX_PREMIUM_MOTHER_SLICES - MIN_PREMIUM_MOTHER_SLICES + 1 }, (_, index) => index + MIN_PREMIUM_MOTHER_SLICES).map((count) => ({ value: count, label: `${count} 张` }))}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition hover:border-gray-300 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200"
              />
            </label>
            <div className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${validation.valid && !validation.lowResolution ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100'}`}>
              <div className="font-semibold">实际尺寸 {dimensions.width || '-'}x{dimensions.height || '-'}</div>
              <div className="mt-1">{dimensions.width ? validation.message : '正在读取图片尺寸...'}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-white/[0.08]">
          <button type="button" disabled={busy} onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]">取消</button>
          <button type="button" disabled={busy || dimensions.width <= 0 || dimensions.height <= 0} onClick={() => onConfirm(sliceCount)} className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-white/[0.08] dark:disabled:text-gray-500">
            {busy ? '正在切割...' : `切割并保存 ${sliceCount} 张`}
          </button>
        </div>
      </div>
    </div>
  )
}
