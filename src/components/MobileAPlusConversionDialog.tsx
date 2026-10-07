import { useEffect, useMemo, useState } from 'react'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { MAX_PREMIUM_MOTHER_SLICES } from '../lib/premiumAPlusLayout'
import { CloseIcon } from './icons'
import Select from './Select'
import { getAPlusConversionSize } from '../lib/aPlusConversion'
import type { APlusConversionTarget } from '../types'

interface Props {
  target?: APlusConversionTarget
  initialPanelCount: number
  busy?: boolean
  onClose: () => void
  onConfirm: (panelCount: number) => void
}

function normalizePanelCount(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.min(MAX_PREMIUM_MOTHER_SLICES, Math.max(1, Math.trunc(numeric)))
}

export default function APlusConversionDialog({ target = 'mobile', initialPanelCount, busy = false, onClose, onConfirm }: Props) {
  const [panelCount, setPanelCount] = useState(() => normalizePanelCount(initialPanelCount))
  const targetSize = getAPlusConversionSize(target, panelCount)
  const targetLabel = target === 'mobile' ? '手机 A+' : '高级 A+'
  const options = useMemo(
    () => Array.from({ length: MAX_PREMIUM_MOTHER_SLICES }, (_, index) => {
      const count = index + 1
      return {
        value: count,
        label: `${count} 张合成 · ${getAPlusConversionSize(target, count)}`,
      }
    }),
    [target],
  )

  useEffect(() => {
    setPanelCount(normalizePanelCount(initialPanelCount))
  }, [initialPanelCount])

  useCloseOnEscape(!busy, onClose)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg overflow-visible rounded-2xl border border-white/50 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-white/[0.08]">
          <div className="min-w-0 pr-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">转为{targetLabel}</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              选择转换后的母图包含几张{targetLabel}图片。每片为 {getAPlusConversionSize(target, 1)}，生成完成后可在图片详情中切割。
            </p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/[0.06]" aria-label="关闭转换窗口">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">合成图片数量</span>
            <Select
              value={panelCount}
              onChange={(value) => setPanelCount(normalizePanelCount(value))}
              options={options}
              disabled={busy}
              className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm outline-none transition hover:border-gray-300 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200"
            />
          </label>

          <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-100">
            <div className="font-semibold">目标画布：{targetSize}</div>
            <div className="mt-1 text-xs leading-relaxed opacity-80">
              {panelCount === 1
                ? `按一张普通${targetLabel}图片重新排版。`
                : `按一张上下连续的 ${panelCount} 片母图重新排版，不会在生成阶段自动切割。`}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            历史任务可能没有保存母图张数，因此这里的默认值仅供参考，最终以你本次选择为准。
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-white/[0.08]">
          <button type="button" disabled={busy} onClick={onClose} className="h-9 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.05]">取消</button>
          <button type="button" disabled={busy} onClick={() => onConfirm(panelCount)} className="h-9 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? '正在准备...' : `确认转为 ${targetSize}`}
          </button>
        </div>
      </div>
    </div>
  )
}
