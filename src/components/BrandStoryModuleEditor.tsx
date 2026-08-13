import {
  MAX_BRAND_STORY_CARD_COUNT,
  MIN_BRAND_STORY_CARD_COUNT,
  buildBrandStoryModuleSpecs,
  normalizeBrandStoryCardCount,
} from '../lib/listingPlanner'

interface Props {
  cardCount: number
  onCardCountChange: (count: number) => void
  disabled?: boolean
  compact?: boolean
}

const INPUT_CLASS = 'h-9 w-24 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200'

export default function BrandStoryModuleEditor({
  cardCount,
  onCardCountChange,
  disabled = false,
  compact = false,
}: Props) {
  const normalizedCount = normalizeBrandStoryCardCount(cardCount)
  const specs = buildBrandStoryModuleSpecs(normalizedCount)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">From the brand 图片结构</div>
          <div className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            一张通栏商品模特背景；仅第一张卡介绍品牌，其余卡片优先展示当前商品的模特穿搭与穿着证据。
          </div>
        </div>
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">前景卡片</span>
          <input
            type="number"
            min={MIN_BRAND_STORY_CARD_COUNT}
            max={MAX_BRAND_STORY_CARD_COUNT}
            value={normalizedCount}
            disabled={disabled}
            onChange={(event) => onCardCountChange(normalizeBrandStoryCardCount(event.target.value))}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className={compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
        {specs.map((spec) => (
          <div key={spec.slot} className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">{spec.slot}</span>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{spec.displayLabel}</span>
              <span className="font-mono text-[10px] text-gray-400">{spec.uploadWidth}×{spec.uploadHeight}</span>
            </div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{spec.objective}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
        品牌资料不足时不会阻止策划：品牌介绍卡会降级为基于现有商品事实的设计定位卡，不会虚构品牌历史、年份、奖项或承诺。
      </div>
    </div>
  )
}

