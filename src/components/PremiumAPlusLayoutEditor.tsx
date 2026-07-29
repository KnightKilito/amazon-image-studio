import type { PremiumAPlusGroupKind, PremiumAPlusGroupPurpose, PremiumAPlusLayoutGroup } from '../types'
import {
  MAX_PREMIUM_CAROUSEL_SLIDES,
  MAX_PREMIUM_MOTHER_SLICES,
  MIN_PREMIUM_CAROUSEL_SLIDES,
  MIN_PREMIUM_MOTHER_SLICES,
  PREMIUM_A_PLUS_LAYOUT_PRESETS,
  PREMIUM_A_PLUS_MAX_SLOTS,
  PREMIUM_A_PLUS_PURPOSE_OPTIONS,
  createPremiumAPlusGroup,
  getPremiumAPlusGroupKindLabel,
  getPremiumAPlusGroupSlotCost,
  getPremiumAPlusPurposeObjective,
  getPremiumAPlusSlotCount,
  getPremiumMotherImageSize,
  normalizePremiumAPlusGroup,
} from '../lib/premiumAPlusLayout'
import { ArrowDownIcon, PlusIcon, TrashIcon } from './icons'
import Select from './Select'

interface Props {
  groups: PremiumAPlusLayoutGroup[]
  onChange: (groups: PremiumAPlusLayoutGroup[]) => void
  brandStoryEnabled: boolean
  onBrandStoryEnabledChange: (enabled: boolean) => void
  brandStoryCardCount: number
  onBrandStoryCardCountChange: (count: number) => void
  disabled?: boolean
}

const SELECT_CLASS = 'h-9 rounded-xl border border-gray-200/70 bg-white/70 px-3 text-xs text-gray-700 shadow-sm outline-none transition hover:border-gray-300 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:hover:bg-white/[0.06]'
const INPUT_CLASS = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200'

function clonePresetGroups(groups: PremiumAPlusLayoutGroup[]) {
  return groups.map((group, index) => normalizePremiumAPlusGroup({
    ...group,
    id: `premium-group-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  }))
}

export default function PremiumAPlusLayoutEditor({
  groups,
  onChange,
  brandStoryEnabled,
  onBrandStoryEnabledChange,
  brandStoryCardCount,
  onBrandStoryCardCountChange,
  disabled = false,
}: Props) {
  const slotCount = getPremiumAPlusSlotCount(groups)
  const remainingSlots = PREMIUM_A_PLUS_MAX_SLOTS - slotCount

  const replaceGroup = (index: number, patch: Partial<PremiumAPlusLayoutGroup>) => {
    const next = groups.map((group, itemIndex) => itemIndex === index ? normalizePremiumAPlusGroup({ ...group, ...patch }) : group)
    if (getPremiumAPlusSlotCount(next) <= PREMIUM_A_PLUS_MAX_SLOTS) onChange(next)
  }

  const addGroup = (kind: PremiumAPlusGroupKind) => {
    const next = [...groups, createPremiumAPlusGroup(kind, {
      ...(kind === 'continuous-canvas' ? { sliceCount: Math.max(MIN_PREMIUM_MOTHER_SLICES, Math.min(3, remainingSlots)) } : {}),
    })]
    if (getPremiumAPlusSlotCount(next) <= PREMIUM_A_PLUS_MAX_SLOTS) onChange(next)
  }

  const moveGroup = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= groups.length) return
    const next = [...groups]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">自由编排</div>
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            连续组只生成一张母图；完成后在图片详情页按计划切割。
          </div>
        </div>
        <div className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${slotCount === PREMIUM_A_PLUS_MAX_SLOTS ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'}`}>
          主内容槽位 {slotCount}/{PREMIUM_A_PLUS_MAX_SLOTS}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">编排预设</span>
        <Select
          value=""
          disabled={disabled}
          onChange={(value) => {
              const preset = PREMIUM_A_PLUS_LAYOUT_PRESETS.find((item) => item.id === value)
              if (preset) onChange(clonePresetGroups(preset.groups))
          }}
          options={[
            { label: '选择预设并应用', value: '' },
            ...PREMIUM_A_PLUS_LAYOUT_PRESETS.map((preset) => ({ label: preset.label, value: preset.id })),
          ]}
          className={`${SELECT_CLASS} w-full`}
        />
      </label>

      <div className="space-y-2">
        {groups.map((group, index) => {
          const slotCost = getPremiumAPlusGroupSlotCost(group)
          const maxSliceCount = Math.min(MAX_PREMIUM_MOTHER_SLICES, remainingSlots + slotCost)
          return (
            <div key={group.id} className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-white/[0.08] dark:bg-gray-900">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">{index + 1}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getPremiumAPlusGroupKindLabel(group.kind)}</span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">占 {slotCost} 槽</span>
                    {group.kind === 'continuous-canvas' && (
                      <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{getPremiumMotherImageSize(group.sliceCount ?? 2)}</span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">内容定位</span>
                      <Select
                        value={group.purpose}
                        disabled={disabled}
                        onChange={(value) => {
                          const purpose = value as PremiumAPlusGroupPurpose
                          replaceGroup(index, { purpose, objective: getPremiumAPlusPurposeObjective(purpose) })
                        }}
                        className={`${SELECT_CLASS} w-full`}
                        options={PREMIUM_A_PLUS_PURPOSE_OPTIONS}
                      />
                    </label>
                    {group.kind === 'continuous-canvas' && (
                      <label>
                        <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">母图切片数</span>
                        <Select
                          value={group.sliceCount ?? 2}
                          disabled={disabled}
                          onChange={(value) => replaceGroup(index, { sliceCount: Number(value) })}
                          className={`${SELECT_CLASS} w-full`}
                          options={Array.from({ length: maxSliceCount - MIN_PREMIUM_MOTHER_SLICES + 1 }, (_, itemIndex) => itemIndex + MIN_PREMIUM_MOTHER_SLICES).map((count) => ({
                            label: `${count} 片 · ${getPremiumMotherImageSize(count)}`,
                            value: count,
                          }))}
                        />
                      </label>
                    )}
                    {group.kind === 'lifestyle-carousel' && (
                      <label>
                        <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">轮播图片数</span>
                        <Select
                          value={group.slideCount ?? 3}
                          disabled={disabled}
                          onChange={(value) => replaceGroup(index, { slideCount: Number(value) })}
                          className={`${SELECT_CLASS} w-full`}
                          options={Array.from({ length: MAX_PREMIUM_CAROUSEL_SLIDES - MIN_PREMIUM_CAROUSEL_SLIDES + 1 }, (_, itemIndex) => itemIndex + MIN_PREMIUM_CAROUSEL_SLIDES).map((count) => ({
                            label: `${count} 张`,
                            value: count,
                          }))}
                        />
                      </label>
                    )}
                  </div>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">补充要求</span>
                    <textarea
                      value={group.customInstruction}
                      disabled={disabled}
                      onChange={(event) => replaceGroup(index, { customInstruction: event.target.value })}
                      rows={2}
                      placeholder="例如：首屏使用三张连续模特图，背景从室内延伸到户外。"
                      className={`${INPUT_CLASS} resize-y`}
                    />
                  </label>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={disabled || index === 0} onClick={() => moveGroup(index, -1)} className="flex h-8 w-8 rotate-180 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-30 dark:border-white/[0.08] dark:hover:bg-white/[0.05]" aria-label="上移模块"><ArrowDownIcon className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={disabled || index === groups.length - 1} onClick={() => moveGroup(index, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:opacity-30 dark:border-white/[0.08] dark:hover:bg-white/[0.05]" aria-label="下移模块"><ArrowDownIcon className="h-3.5 w-3.5" /></button>
                  <button type="button" disabled={disabled || groups.length <= 1} onClick={() => onChange(groups.filter((_, itemIndex) => itemIndex !== index))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50 disabled:opacity-30 dark:border-red-400/20 dark:hover:bg-red-400/10" aria-label="删除模块"><TrashIcon className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['independent-image', '独立大图'],
          ['continuous-canvas', '连续母图'],
          ['lifestyle-carousel', '场景轮播'],
        ] as const).map(([kind, label]) => {
          const minimumCost = kind === 'continuous-canvas' ? MIN_PREMIUM_MOTHER_SLICES : 1
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled || remainingSlots < minimumCost}
              onClick={() => addGroup(kind)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/20"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {label}
            </button>
          )
        })}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-100">同时策划品牌故事</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">品牌故事单独计算，不占高级 A+ 的 7 个主内容槽位。</div>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBrandStoryEnabledChange(!brandStoryEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${brandStoryEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            role="switch"
            aria-checked={brandStoryEnabled}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${brandStoryEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {brandStoryEnabled && (
          <label className="mt-3 block">
            <span className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">品牌故事卡片数</span>
            <input
              type="number"
              min={1}
              max={5}
              value={brandStoryCardCount}
              disabled={disabled}
              onChange={(event) => onBrandStoryCardCountChange(Math.min(5, Math.max(1, Number(event.target.value) || 1)))}
              className={`${INPUT_CLASS} max-w-28`}
            />
          </label>
        )}
      </div>
    </div>
  )
}
