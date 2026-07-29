import type {
  PremiumAPlusGroupKind,
  PremiumAPlusGroupPurpose,
  PremiumAPlusLayoutGroup,
} from '../types'

export const PREMIUM_A_PLUS_MAX_SLOTS = 7
export const PREMIUM_A_PLUS_SLICE_WIDTH = 2928
export const PREMIUM_A_PLUS_SLICE_HEIGHT = 1200
export const PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH = 1464
export const PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT = 600
export const MOBILE_A_PLUS_SLICE_WIDTH = 1200
export const MOBILE_A_PLUS_SLICE_HEIGHT = 900
export const MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH = 600
export const MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT = 450
export const MIN_PREMIUM_MOTHER_SLICES = 2
export const MAX_PREMIUM_MOTHER_SLICES = 7
export const MIN_PREMIUM_CAROUSEL_SLIDES = 2
export const MAX_PREMIUM_CAROUSEL_SLIDES = 6

export interface PremiumAPlusLayoutPreset {
  id: string
  label: string
  description: string
  groups: PremiumAPlusLayoutGroup[]
}

const PURPOSE_LABELS: Record<PremiumAPlusGroupPurpose, string> = {
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

const PURPOSE_OBJECTIVES: Record<PremiumAPlusGroupPurpose, string> = {
  auto: '由 AI 根据产品卖点和整套视觉节奏决定当前模块的具体职责。',
  hero: '用高冲击力画面建立高级 A+ 的第一视觉，并准确呈现产品。',
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

export function createPremiumAPlusGroup(
  kind: PremiumAPlusGroupKind,
  overrides: Partial<PremiumAPlusLayoutGroup> = {},
): PremiumAPlusLayoutGroup {
  const purpose = overrides.purpose ?? (kind === 'lifestyle-carousel' ? 'lifestyle' : 'auto')
  return normalizePremiumAPlusGroup({
    id: overrides.id ?? `premium-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    purpose,
    label: overrides.label ?? getPremiumAPlusGroupKindLabel(kind),
    objective: overrides.objective ?? PURPOSE_OBJECTIVES[purpose],
    customInstruction: overrides.customInstruction ?? '',
    sliceCount: overrides.sliceCount ?? (kind === 'continuous-canvas' ? 3 : undefined),
    slideCount: overrides.slideCount ?? (kind === 'lifestyle-carousel' ? 3 : undefined),
  })
}

export function normalizePremiumAPlusGroup(group: Partial<PremiumAPlusLayoutGroup>): PremiumAPlusLayoutGroup {
  const kind: PremiumAPlusGroupKind = group.kind === 'continuous-canvas' || group.kind === 'lifestyle-carousel'
    ? group.kind
    : 'independent-image'
  const purpose = group.purpose && group.purpose in PURPOSE_LABELS ? group.purpose : 'auto'
  return {
    id: typeof group.id === 'string' && group.id.trim()
      ? group.id
      : `premium-group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    purpose,
    label: typeof group.label === 'string' && group.label.trim() ? group.label.trim() : getPremiumAPlusGroupKindLabel(kind),
    objective: typeof group.objective === 'string' && group.objective.trim()
      ? group.objective.trim()
      : PURPOSE_OBJECTIVES[purpose],
    customInstruction: typeof group.customInstruction === 'string' ? group.customInstruction.trim() : '',
    ...(kind === 'continuous-canvas'
      ? { sliceCount: clampInteger(group.sliceCount, MIN_PREMIUM_MOTHER_SLICES, MAX_PREMIUM_MOTHER_SLICES, 3) }
      : {}),
    ...(kind === 'lifestyle-carousel'
      ? { slideCount: clampInteger(group.slideCount, MIN_PREMIUM_CAROUSEL_SLIDES, MAX_PREMIUM_CAROUSEL_SLIDES, 3) }
      : {}),
  }
}

export function normalizePremiumAPlusGroups(groups?: Array<Partial<PremiumAPlusLayoutGroup>> | null) {
  const normalized = (groups ?? []).map(normalizePremiumAPlusGroup)
  if (normalized.length) return normalized
  return getPremiumAPlusLayoutPreset('editorial-mix').groups.map((group) => ({ ...group }))
}

export function getPremiumAPlusGroupSlotCost(group: Pick<PremiumAPlusLayoutGroup, 'kind' | 'sliceCount'>) {
  return group.kind === 'continuous-canvas'
    ? clampInteger(group.sliceCount, MIN_PREMIUM_MOTHER_SLICES, MAX_PREMIUM_MOTHER_SLICES, 2)
    : 1
}

export function getPremiumAPlusSlotCount(groups: PremiumAPlusLayoutGroup[]) {
  return groups.reduce((total, group) => total + getPremiumAPlusGroupSlotCost(group), 0)
}

export function getPremiumMotherImageSize(sliceCount: number) {
  const count = clampInteger(sliceCount, MIN_PREMIUM_MOTHER_SLICES, MAX_PREMIUM_MOTHER_SLICES, 2)
  return `${PREMIUM_A_PLUS_SLICE_WIDTH}x${PREMIUM_A_PLUS_SLICE_HEIGHT * count}`
}

export function getMobileMotherImageSize(sliceCount: number) {
  const count = clampInteger(sliceCount, MIN_PREMIUM_MOTHER_SLICES, MAX_PREMIUM_MOTHER_SLICES, 2)
  return `${MOBILE_A_PLUS_SLICE_WIDTH}x${MOBILE_A_PLUS_SLICE_HEIGHT * count}`
}

export function isPremiumMotherImageSize(size: string) {
  return Array.from(
    { length: MAX_PREMIUM_MOTHER_SLICES - MIN_PREMIUM_MOTHER_SLICES + 1 },
    (_, index) => getPremiumMotherImageSize(index + MIN_PREMIUM_MOTHER_SLICES),
  ).includes(size.trim().toLowerCase())
}

export function isMobileMotherImageSize(size: string) {
  return Array.from(
    { length: MAX_PREMIUM_MOTHER_SLICES - MIN_PREMIUM_MOTHER_SLICES + 1 },
    (_, index) => getMobileMotherImageSize(index + MIN_PREMIUM_MOTHER_SLICES),
  ).includes(size.trim().toLowerCase())
}

export function isAPlusMotherImageSize(size: string) {
  return isPremiumMotherImageSize(size) || isMobileMotherImageSize(size)
}

export function getPremiumAPlusPurposeLabel(purpose: PremiumAPlusGroupPurpose) {
  return PURPOSE_LABELS[purpose]
}

export function getPremiumAPlusPurposeObjective(purpose: PremiumAPlusGroupPurpose) {
  return PURPOSE_OBJECTIVES[purpose]
}

export function getPremiumAPlusGroupKindLabel(kind: PremiumAPlusGroupKind) {
  switch (kind) {
    case 'continuous-canvas':
      return '连续母图'
    case 'lifestyle-carousel':
      return '模特场景轮播'
    default:
      return '独立大图'
  }
}

function group(kind: PremiumAPlusGroupKind, purpose: PremiumAPlusGroupPurpose, count?: number) {
  return createPremiumAPlusGroup(kind, {
    purpose,
    ...(kind === 'continuous-canvas' ? { sliceCount: count } : {}),
    ...(kind === 'lifestyle-carousel' ? { slideCount: count } : {}),
  })
}

export const PREMIUM_A_PLUS_LAYOUT_PRESETS: PremiumAPlusLayoutPreset[] = [
  {
    id: 'continuous-7',
    label: '整套连续母图 · 7片',
    description: '一次生成一张 2928x8400 纵向母图，完成后切成 7 张高级 A+ 大图。',
    groups: [group('continuous-canvas', 'auto', 7)],
  },
  {
    id: 'continuous-6',
    label: '整套连续母图 · 6片',
    description: '一次生成一张 2928x7200 纵向母图，预留 1 个高级 A+ 槽位。',
    groups: [group('continuous-canvas', 'auto', 6)],
  },
  {
    id: 'continuous-5',
    label: '整套连续母图 · 5片',
    description: '一次生成一张 2928x6000 纵向母图，预留 2 个高级 A+ 槽位。',
    groups: [group('continuous-canvas', 'auto', 5)],
  },
  {
    id: 'continuous-3-4',
    label: '3 + 4 连续叙事',
    description: '三片模特冲击首图，衔接四片产品卖点故事。',
    groups: [
      group('continuous-canvas', 'hero', 3),
      group('continuous-canvas', 'auto', 4),
    ],
  },
  {
    id: 'editorial-rhythm',
    label: '2 + 1 + 3 + 1 编辑节奏',
    description: '连续画面和独立证据图交替，适合鞋类高级 A+。',
    groups: [
      group('continuous-canvas', 'hero', 2),
      group('independent-image', 'technical-detail'),
      group('continuous-canvas', 'lifestyle', 3),
      group('independent-image', 'color-lineup'),
    ],
  },
  {
    id: 'editorial-mix',
    label: '情绪与证据交替',
    description: '模特场景、产品结构、材质细节和轮播共同组成完整叙事。',
    groups: [
      group('independent-image', 'hero'),
      group('independent-image', 'comfort-structure'),
      group('continuous-canvas', 'lifestyle', 2),
      group('independent-image', 'material-detail'),
      group('independent-image', 'color-lineup'),
      group('lifestyle-carousel', 'lifestyle', 3),
    ],
  },
]

export function getPremiumAPlusLayoutPreset(id: string) {
  return PREMIUM_A_PLUS_LAYOUT_PRESETS.find((preset) => preset.id === id) ?? PREMIUM_A_PLUS_LAYOUT_PRESETS[5]
}

export const PREMIUM_A_PLUS_PURPOSE_OPTIONS = Object.entries(PURPOSE_LABELS).map(([value, label]) => ({
  value: value as PremiumAPlusGroupPurpose,
  label,
}))
