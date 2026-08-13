import type {
  APlusComposableContentType,
  APlusGroupKind,
  APlusGroupPurpose,
  APlusLayoutGroup,
  APlusLayoutState,
  APlusLayoutStates,
} from '../types'
import type { SizeTier } from './size'

export const A_PLUS_LAYOUT_MAX_SLOTS = 7
export const PREMIUM_A_PLUS_SLICE_WIDTH = 2928
export const PREMIUM_A_PLUS_SLICE_HEIGHT = 1200
export const PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH = 1464
export const PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT = 600
export const MOBILE_A_PLUS_SLICE_WIDTH = 1200
export const MOBILE_A_PLUS_SLICE_HEIGHT = 900
export const MOBILE_A_PLUS_4K_SLICE_WIDTH = 2400
export const MOBILE_A_PLUS_4K_SLICE_HEIGHT = 1800
export const MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH = 600
export const MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT = 450
export const MIN_A_PLUS_MOTHER_SLICES = 2
export const MAX_A_PLUS_MOTHER_SLICES = 7
export const MIN_A_PLUS_CAROUSEL_SLIDES = 2
export const MAX_A_PLUS_CAROUSEL_SLIDES = 6

export interface APlusLayoutProfile {
  contentType: APlusComposableContentType
  label: string
  slotPrefix: string
  maxSlots: number
  uploadSliceWidth: number
  uploadSliceHeight: number
  generationSliceWidth: number
  generationSliceHeight: number
}

export interface APlusLayoutPreset {
  id: string
  label: string
  description: string
  groups: APlusLayoutGroup[]
}

const PURPOSE_LABELS: Record<APlusGroupPurpose, string> = {
  auto: 'AI 自主规划',
  hero: '视觉首图',
  lifestyle: '模特与场景',
  'technical-detail': '技术细节',
  'comfort-structure': '舒适结构',
  'material-detail': '材质细节',
  'color-lineup': '多色展示',
  'size-fit': '尺码与适配',
  comparison: '产品对比',
  custom: '自定义',
}

const PURPOSE_OBJECTIVES: Record<APlusGroupPurpose, string> = {
  auto: '由 AI 根据产品卖点和整套视觉节奏决定当前模块的具体职责。',
  hero: '用高冲击力画面建立 A+ 的第一视觉，并准确呈现产品。',
  lifestyle: '通过适合目标人群的模特、穿搭和真实场景建立使用想象。',
  'technical-detail': '用结构化信息设计解释产品功能、工艺或关键细节。',
  'comfort-structure': '突出鞋底、鞋垫、支撑、缓震或穿着舒适性证据。',
  'material-detail': '展示真实材质、纹理、做工和局部品质证据。',
  'color-lineup': '清晰展示可选颜色、款式或系列组合，并保持产品一致。',
  'size-fit': '用易读方式呈现尺码、测量或穿着适配信息。',
  comparison: '以事实为基础对比产品方案、使用场景或系列差异。',
  custom: '按照用户填写的自定义要求完成该模块。',
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(numeric)))
}

export function getAPlusLayoutProfile(contentType: APlusComposableContentType, tier: SizeTier = '2K'): APlusLayoutProfile {
  if (contentType === 'mobile') {
    const use4K = tier === '4K'
    return {
      contentType,
      label: '手机 A+',
      slotPrefix: 'A+MF',
      maxSlots: A_PLUS_LAYOUT_MAX_SLOTS,
      uploadSliceWidth: MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH,
      uploadSliceHeight: MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT,
      generationSliceWidth: use4K ? MOBILE_A_PLUS_4K_SLICE_WIDTH : MOBILE_A_PLUS_SLICE_WIDTH,
      generationSliceHeight: use4K ? MOBILE_A_PLUS_4K_SLICE_HEIGHT : MOBILE_A_PLUS_SLICE_HEIGHT,
    }
  }
  return {
    contentType,
    label: '高级 A+',
    slotPrefix: 'A+F',
    maxSlots: A_PLUS_LAYOUT_MAX_SLOTS,
    uploadSliceWidth: PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH,
    uploadSliceHeight: PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT,
    generationSliceWidth: PREMIUM_A_PLUS_SLICE_WIDTH,
    generationSliceHeight: PREMIUM_A_PLUS_SLICE_HEIGHT,
  }
}

export function getAPlusSingleImageSize(contentType: APlusComposableContentType, tier: SizeTier = '2K') {
  const profile = getAPlusLayoutProfile(contentType, tier)
  return `${profile.generationSliceWidth}x${profile.generationSliceHeight}`
}

export function getAPlusMotherImageSize(contentType: APlusComposableContentType, sliceCount: number, tier: SizeTier = '2K') {
  const profile = getAPlusLayoutProfile(contentType, tier)
  const count = clampInteger(sliceCount, MIN_A_PLUS_MOTHER_SLICES, MAX_A_PLUS_MOTHER_SLICES, 2)
  return `${profile.generationSliceWidth}x${profile.generationSliceHeight * count}`
}

export function isAPlusMotherImageSize(size: string) {
  const canonical = size.trim().toLowerCase()
  return (['premium', 'mobile'] as const).some((contentType) => (
    (['2K', '4K'] as const).some((tier) => (
      Array.from(
        { length: MAX_A_PLUS_MOTHER_SLICES - MIN_A_PLUS_MOTHER_SLICES + 1 },
        (_, index) => getAPlusMotherImageSize(contentType, index + MIN_A_PLUS_MOTHER_SLICES, tier),
      ).includes(canonical)
    ))
  ))
}

export function createAPlusLayoutGroup(
  kind: APlusGroupKind,
  overrides: Partial<APlusLayoutGroup> = {},
): APlusLayoutGroup {
  const purpose = overrides.purpose ?? 'auto'
  return normalizeAPlusLayoutGroup({
    id: overrides.id ?? `a-plus-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    purpose,
    label: overrides.label ?? getAPlusGroupKindLabel(kind),
    objective: overrides.objective ?? PURPOSE_OBJECTIVES[purpose],
    customInstruction: overrides.customInstruction ?? '',
    sliceCount: overrides.sliceCount ?? (kind === 'continuous-canvas' ? 3 : undefined),
    slideCount: overrides.slideCount ?? (kind === 'lifestyle-carousel' ? 3 : undefined),
  })
}

export function normalizeAPlusLayoutGroup(group: Partial<APlusLayoutGroup>): APlusLayoutGroup {
  const kind: APlusGroupKind = group.kind === 'continuous-canvas' || group.kind === 'lifestyle-carousel'
    ? group.kind
    : 'independent-image'
  const purpose = group.purpose && group.purpose in PURPOSE_LABELS ? group.purpose : 'auto'
  return {
    id: typeof group.id === 'string' && group.id.trim()
      ? group.id
      : `a-plus-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    purpose,
    label: typeof group.label === 'string' && group.label.trim() ? group.label.trim() : getAPlusGroupKindLabel(kind),
    objective: typeof group.objective === 'string' && group.objective.trim()
      ? group.objective.trim()
      : PURPOSE_OBJECTIVES[purpose],
    customInstruction: typeof group.customInstruction === 'string' ? group.customInstruction.trim() : '',
    ...(kind === 'continuous-canvas'
      ? { sliceCount: clampInteger(group.sliceCount, MIN_A_PLUS_MOTHER_SLICES, MAX_A_PLUS_MOTHER_SLICES, 3) }
      : {}),
    ...(kind === 'lifestyle-carousel'
      ? { slideCount: clampInteger(group.slideCount, MIN_A_PLUS_CAROUSEL_SLIDES, MAX_A_PLUS_CAROUSEL_SLIDES, 3) }
      : {}),
  }
}

export function getAPlusGroupSlotCost(group: Pick<APlusLayoutGroup, 'kind' | 'sliceCount'>) {
  return group.kind === 'continuous-canvas'
    ? clampInteger(group.sliceCount, MIN_A_PLUS_MOTHER_SLICES, MAX_A_PLUS_MOTHER_SLICES, 2)
    : 1
}

export function getAPlusLayoutSlotCount(groups: APlusLayoutGroup[]) {
  return groups.reduce((total, group) => total + getAPlusGroupSlotCost(group), 0)
}

export function getAPlusPurposeLabel(purpose: APlusGroupPurpose) {
  return PURPOSE_LABELS[purpose]
}

export function getAPlusPurposeObjective(purpose: APlusGroupPurpose) {
  return PURPOSE_OBJECTIVES[purpose]
}

export function getAPlusGroupKindLabel(kind: APlusGroupKind) {
  switch (kind) {
    case 'continuous-canvas':
      return '连续母图'
    case 'lifestyle-carousel':
      return '轮播图'
    default:
      return '独立大图'
  }
}

function group(kind: APlusGroupKind, purpose: APlusGroupPurpose, count?: number) {
  return createAPlusLayoutGroup(kind, {
    purpose,
    ...(kind === 'continuous-canvas' ? { sliceCount: count } : {}),
    ...(kind === 'lifestyle-carousel' ? { slideCount: count } : {}),
  })
}

export const A_PLUS_LAYOUT_PRESETS: APlusLayoutPreset[] = [
  { id: 'continuous-7', label: '整套连续母图 · 7片', description: '一次生成一张七片纵向母图。', groups: [group('continuous-canvas', 'auto', 7)] },
  { id: 'continuous-6', label: '整套连续母图 · 6片', description: '一次生成一张六片纵向母图，并预留一个槽位。', groups: [group('continuous-canvas', 'auto', 6)] },
  { id: 'continuous-5', label: '整套连续母图 · 5片', description: '一次生成一张五片纵向母图，并预留两个槽位。', groups: [group('continuous-canvas', 'auto', 5)] },
  { id: 'continuous-3-4', label: '3 + 4 连续叙事', description: '三片冲击首图衔接四片产品故事。', groups: [group('continuous-canvas', 'hero', 3), group('continuous-canvas', 'auto', 4)] },
  {
    id: 'editorial-rhythm', label: '2 + 1 + 3 + 1 编辑节奏', description: '连续画面和独立证据图交替。', groups: [
      group('continuous-canvas', 'hero', 2), group('independent-image', 'technical-detail'),
      group('continuous-canvas', 'lifestyle', 3), group('independent-image', 'color-lineup'),
    ],
  },
  {
    id: 'editorial-mix', label: '情绪与证据交替', description: '场景、结构、材质和轮播共同组成完整叙事。', groups: [
      group('independent-image', 'hero'), group('independent-image', 'comfort-structure'),
      group('continuous-canvas', 'lifestyle', 2), group('independent-image', 'material-detail'),
      group('independent-image', 'color-lineup'), group('lifestyle-carousel', 'lifestyle', 3),
    ],
  },
]

export function getAPlusLayoutPreset(id: string) {
  return A_PLUS_LAYOUT_PRESETS.find((preset) => preset.id === id) ?? A_PLUS_LAYOUT_PRESETS[5]
}

export function normalizeAPlusLayoutGroups(groups?: Array<Partial<APlusLayoutGroup>> | null) {
  const normalized = (groups ?? []).map(normalizeAPlusLayoutGroup)
  if (normalized.length) return normalized
  return getAPlusLayoutPreset('editorial-mix').groups.map((item) => ({ ...item }))
}

export function createDefaultAPlusLayoutState(): APlusLayoutState {
  return { mode: 'independent', groups: normalizeAPlusLayoutGroups(null) }
}

export function normalizeAPlusLayoutState(state?: Partial<APlusLayoutState> | null): APlusLayoutState {
  return {
    mode: state?.mode === 'composed' ? 'composed' : 'independent',
    groups: normalizeAPlusLayoutGroups(state?.groups),
  }
}

export function normalizeAPlusLayoutStates(
  states?: Partial<Record<APlusComposableContentType, Partial<APlusLayoutState>>> | null,
  legacyPremium?: Partial<APlusLayoutState> | null,
): APlusLayoutStates {
  return {
    premium: normalizeAPlusLayoutState(states?.premium ?? legacyPremium),
    mobile: normalizeAPlusLayoutState(states?.mobile),
  }
}

export const A_PLUS_PURPOSE_OPTIONS = Object.entries(PURPOSE_LABELS).map(([value, label]) => ({
  value: value as APlusGroupPurpose,
  label,
}))
