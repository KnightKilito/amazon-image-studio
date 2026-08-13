import type { AmazonImageKind, AmazonPromptDraft } from './amazonPrompt'
import type {
  APlusComposableContentType,
  APlusLayoutGroup,
  APlusPlanContext,
  AmazonStyleDensityMode,
} from '../types'
import { calculateImageSize, type SizeTier } from './size'
import {
  getAPlusGroupKindLabel,
  getAPlusGroupSlotCost,
  getAPlusLayoutProfile,
  getAPlusMotherImageSize,
  getAPlusPurposeLabel,
  getAPlusSingleImageSize,
  normalizeAPlusLayoutGroups,
} from './aPlusLayout'

export type AmazonPlannerMode = 'listing' | 'aplus'
export type { AmazonStyleDensityMode } from '../types'
export type APlusContentType = 'standard' | 'standard-large' | 'premium' | 'mobile' | 'brand-story'
export type APlusModuleKind =
  | 'header-banner'
  | 'single-image'
  | 'highlight-tile'
  | 'hero-banner'
  | 'feature-image'
  | 'brand-story'
  | 'continuous-canvas'
  | 'carousel-slide'
  | 'brand-story-background'
  | 'brand-story-card'
  | 'logo'
  | 'comparison-thumbnail'

export const A_PLUS_CONTENT_TYPES: APlusContentType[] = ['standard-large', 'standard', 'premium', 'mobile', 'brand-story']
export const MIN_A_PLUS_MODULE_COUNT = 1
export const MAX_A_PLUS_MODULE_COUNT = 12
export const DEFAULT_BRAND_STORY_CARD_COUNT = 3
export const MIN_BRAND_STORY_CARD_COUNT = 1
export const MAX_BRAND_STORY_CARD_COUNT = 5

const A_PLUS_MODULE_KINDS: APlusModuleKind[] = [
  'header-banner',
  'single-image',
  'highlight-tile',
  'hero-banner',
  'feature-image',
  'brand-story',
  'continuous-canvas',
  'carousel-slide',
  'brand-story-background',
  'brand-story-card',
  'logo',
  'comparison-thumbnail',
]

export interface ListingParseResult {
  title: string
  bullets: string[]
  inferred: Partial<AmazonPromptDraft>
}

export interface AmazonImagePlan {
  slot: string
  label: string
  kind?: AmazonImageKind
  planMarkdown: string
  prompt: string
  negativePrompt: string
}

export interface AmazonAPlusModuleSpec {
  contentType: APlusContentType | 'optional'
  slot: string
  label: string
  displayLabel: string
  moduleType: APlusModuleKind
  uploadWidth: number
  uploadHeight: number
  objective: string
  planContext?: APlusPlanContext
  exactGenerationWidth?: number
  exactGenerationHeight?: number
}

export interface AmazonAPlusPlan {
  slot: string
  label: string
  moduleType: APlusModuleKind
  uploadSize: string
  generationSize: string
  summary: string
  planMarkdown: string
  textTitle: string
  textBody: string
  prompt: string
  negativePrompt: string
  planContext?: APlusPlanContext
}

export function normalizeBrandStoryCardCount(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_BRAND_STORY_CARD_COUNT
  return Math.min(MAX_BRAND_STORY_CARD_COUNT, Math.max(MIN_BRAND_STORY_CARD_COUNT, Math.trunc(numeric)))
}

/**
 * Build the shared Amazon "From the brand" image set. The background and cards
 * are separate from Premium A+ main-content slots, even when planned together.
 */
export function buildBrandStoryModuleSpecs(
  cardCount: unknown = DEFAULT_BRAND_STORY_CARD_COUNT,
  contentType: 'premium' | 'brand-story' = 'brand-story',
): AmazonAPlusModuleSpec[] {
  const normalizedCardCount = normalizeBrandStoryCardCount(cardCount)
  const groupId = contentType === 'premium' ? 'premium-brand-story' : 'standalone-brand-story'
  const specs: AmazonAPlusModuleSpec[] = [{
    contentType,
    slot: 'A+BS-BG',
    label: 'From the Brand Background',
    displayLabel: '品牌故事背景',
    moduleType: 'brand-story-background',
    uploadWidth: 1464,
    uploadHeight: 625,
    exactGenerationWidth: 2928,
    exactGenerationHeight: 1250,
    objective: '为 From the brand 设计通栏背景。必须由模特准确穿着当前页面商品作为视觉锚点，并向卡片覆盖区域延展安静场景；是否露脸由商品展示重点、姿态和构图决定。',
    planContext: {
      layoutMode: 'composed',
      groupId,
      groupKind: 'brand-story',
      itemIndex: 0,
      slotCost: 0,
      plannedGenerationSize: '2928x1250',
    },
  }]

  for (let index = 0; index < normalizedCardCount; index += 1) {
    const itemNumber = index + 1
    const isBrandIntroduction = index === 0
    const objective = isBrandIntroduction
      ? '这是整组唯一的品牌介绍卡。使用真实品牌名，以简短定位、设计理念或目标穿着体验介绍品牌；仅使用输入资料支持的事实，资料不足时降级为保守的品牌设计定位，禁止虚构品牌起源、年份、使命、奖项、认证或承诺。'
      : index === 1
        ? '这是当前商品的模特穿搭卡。优先使用全身或三分之二身模特准确穿着本品，表现目标人群、穿搭风格与核心使用场合，不得重复品牌介绍。'
        : index === 2
          ? '这是当前商品的穿着证据卡。优先使用脚部穿着近景、行走姿态或商品细节，呈现版型、材质、舒适结构或稳定性证据，不得重复品牌介绍。'
          : '这是当前商品的扩展卡。使用不同场合、造型、姿态、景别、颜色或有事实依据的适配证据补充转化信息；模特图优先，不得重复品牌介绍或前序卡片。'
    specs.push({
      contentType,
      slot: `A+BS-C${String(itemNumber).padStart(2, '0')}`,
      label: isBrandIntroduction ? 'Brand Introduction Card' : `Product Story Card ${itemNumber - 1}`,
      displayLabel: isBrandIntroduction ? '品牌介绍卡' : `商品故事卡 ${itemNumber - 1}`,
      moduleType: 'brand-story-card',
      uploadWidth: 463,
      uploadHeight: 625,
      exactGenerationWidth: 926,
      exactGenerationHeight: 1250,
      objective,
      planContext: {
        layoutMode: 'composed',
        groupId,
        groupKind: 'brand-story',
        itemIndex: itemNumber,
        slotCost: 0,
        plannedGenerationSize: '926x1250',
      },
    })
  }

  return specs
}

export function buildAPlusComposedMainModuleSpecs(
  contentType: APlusComposableContentType,
  groups: Array<Partial<APlusLayoutGroup>>,
  tier: SizeTier = '2K',
): AmazonAPlusModuleSpec[] {
  const normalizedGroups = normalizeAPlusLayoutGroups(groups)
  const profile = getAPlusLayoutProfile(contentType, tier)
  const specs: AmazonAPlusModuleSpec[] = []

  normalizedGroups.forEach((group, groupIndex) => {
    const groupNumber = String(groupIndex + 1).padStart(2, '0')
    const slotCost = getAPlusGroupSlotCost(group)
    const baseContext = {
      layoutMode: 'composed' as const,
      groupId: group.id,
      groupKind: group.kind,
      groupPurpose: group.purpose,
      slotCost,
      aPlusType: contentType,
      generationSliceWidth: profile.generationSliceWidth,
      generationSliceHeight: profile.generationSliceHeight,
    }
    const objective = [group.objective, group.customInstruction].filter(Boolean).join(' ')

    if (group.kind === 'continuous-canvas') {
      const sliceCount = group.sliceCount ?? 2
      specs.push({
        contentType,
        slot: `${profile.slotPrefix}${groupNumber}-M`,
        label: `${sliceCount}-Panel Continuous Mother Image`,
        displayLabel: `${sliceCount}片连续母图`,
        moduleType: 'continuous-canvas',
        uploadWidth: profile.uploadSliceWidth,
        uploadHeight: profile.uploadSliceHeight,
        exactGenerationWidth: profile.generationSliceWidth,
        exactGenerationHeight: profile.generationSliceHeight * sliceCount,
        objective,
        planContext: {
          ...baseContext,
          itemIndex: 0,
          sliceCount,
          plannedGenerationSize: getAPlusMotherImageSize(contentType, sliceCount, tier),
        },
      })
      return
    }

    if (group.kind === 'lifestyle-carousel') {
      const slideCount = group.slideCount ?? 3
      const purposeLabel = getAPlusPurposeLabel(group.purpose)
      const sharedCarouselObjective = `内容定位为“${purposeLabel}”，该定位优先于轮播展示形式。这是同一轮播组中的独立图片，需与组内其他图片保持产品身份、品牌视觉系统和图像语言一致。`
      const carouselVariationObjective = group.purpose === 'lifestyle'
        ? '围绕模特与场景定位保持人物和造型一致，同时变化姿态、场景、取景或使用时刻。'
        : '围绕当前内容定位变化构图、证据重点、取景或信息层级。'
      for (let slideIndex = 0; slideIndex < slideCount; slideIndex += 1) {
        specs.push({
          contentType,
          slot: `${profile.slotPrefix}${groupNumber}-C${String(slideIndex + 1).padStart(2, '0')}`,
          label: `Carousel Slide ${slideIndex + 1}`,
          displayLabel: `轮播图 ${slideIndex + 1}`,
          moduleType: 'carousel-slide',
          uploadWidth: profile.uploadSliceWidth,
          uploadHeight: profile.uploadSliceHeight,
          exactGenerationWidth: profile.generationSliceWidth,
          exactGenerationHeight: profile.generationSliceHeight,
          objective: `${objective} ${sharedCarouselObjective} 当前为第 ${slideIndex + 1} 张。${carouselVariationObjective}`,
          planContext: {
            ...baseContext,
            itemIndex: slideIndex,
            plannedGenerationSize: getAPlusSingleImageSize(contentType, tier),
          },
        })
      }
      return
    }

    specs.push({
      contentType,
      slot: `${profile.slotPrefix}${groupNumber}`,
      label: `${getAPlusPurposeLabel(group.purpose)} Independent Image`,
      displayLabel: group.label || getAPlusGroupKindLabel(group.kind),
      moduleType: 'feature-image',
      uploadWidth: profile.uploadSliceWidth,
      uploadHeight: profile.uploadSliceHeight,
      exactGenerationWidth: profile.generationSliceWidth,
      exactGenerationHeight: profile.generationSliceHeight,
      objective,
      planContext: {
        ...baseContext,
        itemIndex: 0,
        plannedGenerationSize: getAPlusSingleImageSize(contentType, tier),
      },
    })
  })

  return specs
}

/** @deprecated Prefer buildAPlusComposedMainModuleSpecs and append Brand Story separately. */
export function buildPremiumAPlusComposedModuleSpecs(
  groups: Array<Partial<APlusLayoutGroup>>,
  options: { brandStoryEnabled?: boolean; brandStoryCardCount?: number; tier?: SizeTier } = {},
): AmazonAPlusModuleSpec[] {
  const specs = buildAPlusComposedMainModuleSpecs('premium', groups, options.tier)
  if (options.brandStoryEnabled) specs.push(...buildBrandStoryModuleSpecs(options.brandStoryCardCount, 'premium'))
  return specs
}

export const STANDARD_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  {
    contentType: 'standard',
    slot: 'A+S01',
    label: 'Header Banner',
    displayLabel: '顶部横幅',
    moduleType: 'header-banner',
    uploadWidth: 970,
    uploadHeight: 300,
    objective: '用横幅建立品牌质感和核心产品利益点。',
  },
  ...Array.from({ length: 3 }, (_, index) => ({
    contentType: 'standard' as const,
    slot: `A+S0${index + 2}`,
    label: `Single Image ${index + 1}`,
    displayLabel: `大图模块 ${index + 1}`,
    moduleType: 'single-image' as const,
    uploadWidth: 970,
    uploadHeight: 600,
    objective: '用单图模块讲清一个关键卖点或使用场景。',
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    contentType: 'standard' as const,
    slot: `A+S0${index + 5}`,
    label: `Highlight Tile ${index + 1}`,
    displayLabel: `卖点方块 ${index + 1}`,
    moduleType: 'highlight-tile' as const,
    uploadWidth: 220,
    uploadHeight: 220,
    objective: '用方形图块快速呈现一个产品亮点。',
  })),
]

export const STANDARD_LARGE_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  {
    contentType: 'standard-large',
    slot: 'A+L01',
    label: 'Header Banner',
    displayLabel: '顶部横幅',
    moduleType: 'header-banner',
    uploadWidth: 970,
    uploadHeight: 300,
    objective: '用横幅建立品牌质感和核心产品利益点。',
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    contentType: 'standard-large' as const,
    slot: `A+L0${index + 2}`,
    label: `Single Image ${index + 1}`,
    displayLabel: `大图模块 ${index + 1}`,
    moduleType: 'single-image' as const,
    uploadWidth: 970,
    uploadHeight: 600,
    objective: '用整张大图讲清一个关键卖点、使用场景或细节证据。',
  })),
]

export const PREMIUM_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  {
    contentType: 'premium',
    slot: 'A+P01',
    label: 'Hero Banner',
    displayLabel: '高级首屏横幅',
    moduleType: 'hero-banner',
    uploadWidth: 1464,
    uploadHeight: 600,
    objective: '用高级横幅建立首屏视觉冲击和品牌氛围。',
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    contentType: 'premium' as const,
    slot: `A+P0${index + 2}`,
    label: `Feature Image ${index + 1}`,
    displayLabel: `高级大图模块 ${index + 1}`,
    moduleType: 'feature-image' as const,
    uploadWidth: 1464,
    uploadHeight: 600,
    objective: [
      '用大图模块展示最重要的商品功能、结构或核心利益点。',
      '用模特穿着和真实场景建立目标人群的使用与搭配想象。',
      '用近景、材质或结构化信息提供可信的商品细节证据。',
      '用不同场合、姿态或穿搭延展商品使用情境，避免重复前序画面。',
      '用颜色、尺码适配、系列选择或核心购买信息完成商品向收束。',
    ][index]!,
  })),
]

export const BRAND_STORY_MODULE_SPECS: AmazonAPlusModuleSpec[] = buildBrandStoryModuleSpecs()

export const MOBILE_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  {
    contentType: 'mobile',
    slot: 'A+M01',
    label: 'Mobile Hero',
    displayLabel: '手机首屏',
    moduleType: 'hero-banner',
    uploadWidth: 600,
    uploadHeight: 450,
    objective: '用移动端首屏图建立产品核心卖点和清晰视觉吸引力。',
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    contentType: 'mobile' as const,
    slot: `A+M0${index + 2}`,
    label: `Mobile Feature ${index + 1}`,
    displayLabel: `手机卖点图 ${index + 1}`,
    moduleType: 'feature-image' as const,
    uploadWidth: 600,
    uploadHeight: 450,
    objective: '用移动端友好的 4:3 图片讲清一个关键卖点、细节证据或使用场景。',
  })),
]

export const OPTIONAL_A_PLUS_MODULE_SPECS: AmazonAPlusModuleSpec[] = [
  {
    contentType: 'optional',
    slot: 'A+LOGO',
    label: 'Logo Image',
    displayLabel: '品牌 Logo',
    moduleType: 'logo',
    uploadWidth: 600,
    uploadHeight: 180,
    objective: '用于已有品牌标志素材，不默认生成虚构 Logo。',
  },
  {
    contentType: 'optional',
    slot: 'A+CMP',
    label: 'Comparison Thumbnail',
    displayLabel: '对比缩略图',
    moduleType: 'comparison-thumbnail',
    uploadWidth: 150,
    uploadHeight: 300,
    objective: '用于同品牌 SKU 对比，不默认生成不确定对比信息。',
  },
]

const CJK_ON_IMAGE_TEXT_RE = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/
const STYLE_REFERENCE_GUARD = [
  'Style reference rule:',
  '- The last input image is a hidden style reference selected by the user.',
  '- Use it only for color palette, lighting, contrast, material finish, typography feel, and overall visual polish.',
  '- The selected visual style text block is higher priority than any conflicting aesthetic language in the image task or series style guide.',
  '- Do not copy any placeholder words, fixed layout, color swatch positions, exact composition, product arrangement, product count, props, scene, or information density from the style reference board.',
  '- Follow the image task, layout density, and negative prompt sections for the actual content and arrangement.',
].join('\n')

const STYLE_DENSITY_GUIDES: Record<AmazonStyleDensityMode, string> = {
  rich: [
    'Layout density:',
    '- Use a polished, information-rich Amazon gallery layout when the selected image type benefits from explanation.',
    '- Build clear hierarchy with mobile-readable US-English copy, multiple well-spaced callouts, detail crops, comparison areas, measurement arrows, or use-case zones as appropriate.',
    '- Keep the composition premium and organized; information-rich should still be readable, balanced, and uncluttered.',
  ].join('\n'),
  minimal: [
    'Layout density:',
    '- Use a refined minimal Amazon layout with fewer callouts, generous balanced spacing, light icon or line treatment, and restrained US-English copy.',
    '- Keep the product and one or two strongest messages dominant, with clean hierarchy and no clutter.',
  ].join('\n'),
}

export const DEFAULT_LISTING_IMAGE_COUNT = 7
export const MIN_LISTING_IMAGE_COUNT = 7
export const MAX_LISTING_IMAGE_COUNT = 12
export const LISTING_IMAGE_COUNT_OPTIONS = Array.from(
  { length: MAX_LISTING_IMAGE_COUNT - MIN_LISTING_IMAGE_COUNT + 1 },
  (_, index) => MIN_LISTING_IMAGE_COUNT + index,
)

export function normalizeListingImageCount(value: unknown): number {
  const count = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : DEFAULT_LISTING_IMAGE_COUNT
  if (!Number.isFinite(count)) return DEFAULT_LISTING_IMAGE_COUNT
  return Math.min(MAX_LISTING_IMAGE_COUNT, Math.max(MIN_LISTING_IMAGE_COUNT, Math.trunc(count)))
}

export function getAmazonListingImageSlots(count: unknown = DEFAULT_LISTING_IMAGE_COUNT): string[] {
  const normalizedCount = normalizeListingImageCount(count)
  return [
    'MAIN',
    ...Array.from({ length: normalizedCount - 1 }, (_, index) => `PT${String(index + 1).padStart(2, '0')}`),
  ]
}

export function formatAmazonListingSlotRange(count: unknown = DEFAULT_LISTING_IMAGE_COUNT): string {
  const slots = getAmazonListingImageSlots(count)
  const tailSlots = slots.slice(1)
  if (!tailSlots.length) return slots[0] ?? 'MAIN'
  return `MAIN + ${tailSlots[0]}-${tailSlots[tailSlots.length - 1]}`
}

export function isAmazonListingMainSlot(slot?: string | null): boolean {
  return slot?.trim().toUpperCase() === 'MAIN'
}

export function normalizeOnImageCopy(copy: string): string {
  return copy
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !CJK_ON_IMAGE_TEXT_RE.test(line))
    .join('\n')
}

function cleanPlanSummaryLine(line: string) {
  return line
    .replace(/^#+\s*/, '')
    .replace(/^\s*[-*]\s*/, '')
    .replace(/^\*\*(.+)\*\*$/, '$1')
    .trim()
}

const A_PLUS_SUMMARY_METADATA_RE = /^(?:A\+[A-Z]?\d+\s*)?(?:模块方案|模块策划|策划方案|模块定位|策划概述|生图输出要求|英文生图提示词|prompt|negative(?:\s+prompt)?|上传(?:尺寸)?|生成(?:尺寸)?|画布尺寸)(?:\s*[:：].*)?$/i

export function extractAPlusPlanSummary(planMarkdown: string) {
  const lines = planMarkdown
    .split(/\r?\n/)
    .map(cleanPlanSummaryLine)
    .filter(Boolean)

  for (const line of lines) {
    const labeledSummary = line.match(/^(?:策划概述|概述|核心内容|画面策略)\s*[:：]\s*(.+)$/)
    if (labeledSummary?.[1]?.trim()) return labeledSummary[1].trim()
    if (A_PLUS_SUMMARY_METADATA_RE.test(line)) continue
    if (/^(?:上传|生成|最终上传|尺寸|比例)\s*[:：]?\s*\d+\s*[xX×]\s*\d+/i.test(line)) continue
    return line
  }

  return ''
}

export function getAPlusPlanSummary(
  plan: Pick<AmazonAPlusPlan, 'planMarkdown'> & { summary?: string | null },
  fallback = '',
) {
  return plan.summary?.trim() || extractAPlusPlanSummary(plan.planMarkdown) || fallback.trim()
}

const PALETTE_COLOR_RULES: Array<[RegExp, string]> = [
  [/\bcognac\b/i, '#A65A3A'],
  [/\b(?:warm\s+)?ivory\b/i, '#F5F0E4'],
  [/\bsand(?:y)?(?:\s+beige)?\b/i, '#D6C19D'],
  [/\bpale\s+oak\b|\boak\b/i, '#D8BC91'],
  [/\bsage(?:\s+green)?\b/i, '#A7B29A'],
  [/\b(?:muted|antique|soft)?\s*gold\b/i, '#B49A5A'],
  [/\blinen(?:\s+cream)?\b|\bcream\b/i, '#EEE5D2'],
  [/\bsun[-\s]?washed\s+brown\b|\bbrown\b/i, '#98715B'],
  [/\btaupe\b/i, '#A99887'],
  [/\bterracotta\b/i, '#C66F50'],
  [/\bnavy\b/i, '#243B53'],
  [/\bcharcoal\b/i, '#374151'],
  [/\bforest\s+green\b/i, '#315847'],
  [/\bolive\b/i, '#75805B'],
  [/\bteal\b/i, '#3F7C78'],
  [/\bblue\b/i, '#5B7FA3'],
  [/\bgreen\b/i, '#6F8F72'],
  [/\bred\b/i, '#B85C57'],
  [/\borange\b/i, '#C97A45'],
  [/\byellow\b/i, '#D2B45F'],
  [/\bpurple\b|\bviolet\b/i, '#806A91'],
  [/\bpink\b|\brose\b/i, '#C58A91'],
  [/\bblack\b/i, '#111827'],
  [/\bwhite\b/i, '#F9FAFB'],
  [/\bgr[ae]y\b/i, '#9CA3AF'],
]

export function getPaletteSwatchColor(value: string) {
  const color = value.trim()
  const embeddedHex = color.match(/#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/i)?.[0]
  if (embeddedHex) return embeddedHex
  if (/^(?:rgb|hsl)a?\([^)]*\)$/i.test(color) || /^(?:oklch|oklab|lab|lch|color)\([^)]*\)$/i.test(color)) return color

  const mappedColor = PALETTE_COLOR_RULES.find(([pattern]) => pattern.test(color))?.[1]
  if (mappedColor) return mappedColor

  let hash = 2166136261
  for (const char of color.toLowerCase()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const unsignedHash = hash >>> 0
  const hue = unsignedHash % 360
  const saturation = 34 + ((unsignedHash >>> 8) % 18)
  const lightness = 46 + ((unsignedHash >>> 16) % 16)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function formatPromptBlock(options: {
  prompt: string
  negativePrompt?: string
  seriesStyleGuide?: string | null
  visualStyleEnabled?: boolean
  styleReferenceAttached?: boolean
  styleDensityMode?: AmazonStyleDensityMode
  selectedVisualStyle?: {
    label: string
    description: string
    palette: string[]
  } | null
}) {
  const selectedVisualStyle = (options.visualStyleEnabled ?? options.styleReferenceAttached) ? options.selectedVisualStyle : null
  const selectedStyleBlock = selectedVisualStyle
    ? [
      'Selected visual style (highest priority):',
      `- Style reference: ${selectedVisualStyle.label}.`,
      `- Style direction: ${selectedVisualStyle.description}`,
      selectedVisualStyle.palette.length ? `- Palette anchors: ${selectedVisualStyle.palette.join(', ')}.` : '',
      '- This selected visual style is the highest-priority visual system for background, palette, typography, lighting, decorative accents, material finish, and information-panel styling.',
      '- If the image task prompt or Series style guide contains a conflicting aesthetic, background mood, color palette, typography direction, or decorative accent, override that conflict with this selected visual style while preserving product facts and required copy.',
    ].filter(Boolean).join('\n')
    : ''
  const seriesStyleGuideLabel = selectedStyleBlock
    ? 'Series style guide (lower priority than the selected visual style):'
    : 'Series style guide:'
  const sections = [
    options.prompt.trim(),
    selectedStyleBlock,
    options.seriesStyleGuide?.trim()
      ? `${seriesStyleGuideLabel}\n${options.seriesStyleGuide.trim()}`
      : '',
    options.styleReferenceAttached ? STYLE_DENSITY_GUIDES[options.styleDensityMode ?? 'rich'] : '',
    options.negativePrompt?.trim()
      ? `Negative prompt:\n${options.negativePrompt.trim()}`
      : '',
    options.styleReferenceAttached ? STYLE_REFERENCE_GUARD : '',
  ].filter(Boolean)

  return sections.join('\n\n')
}

export function buildAmazonPlanPrompt(plan: Pick<AmazonImagePlan, 'prompt' | 'negativePrompt'> & {
  seriesStyleGuide?: string | null
  visualStyleEnabled?: boolean
  styleReferenceAttached?: boolean
  styleDensityMode?: AmazonStyleDensityMode
  selectedVisualStyle?: {
    label: string
    description: string
    palette: string[]
  } | null
}): string {
  return formatPromptBlock(plan)
}

function formatAPlusUploadSize(spec: Pick<AmazonAPlusModuleSpec, 'uploadWidth' | 'uploadHeight'>): string {
  return `${spec.uploadWidth}x${spec.uploadHeight}`
}

function getSafeAPlusRatio(width: number, height: number): string {
  const ratio = width / height
  if (ratio > 3) return '3:1'
  if (ratio < 1 / 3) return '1:3'
  return `${width}:${height}`
}

function getAPlusGenerationSizeFromDimensions(width: number, height: number, tier: SizeTier): string {
  if (width === 600 && height === 450) return tier === '4K' ? '2400x1800' : '1200x900'
  if (tier === '2K' && width === 1464 && height === 600) return '2928x1200'
  return calculateImageSize(tier, getSafeAPlusRatio(width, height)) ?? (tier === '4K' ? '2880x2880' : '2048x2048')
}

function getAPlusModuleSlotPrefix(type: APlusContentType): string {
  switch (type) {
    case 'brand-story':
      return 'A+BS'
    case 'premium':
      return 'A+P'
    case 'mobile':
      return 'A+M'
    case 'standard-large':
      return 'A+L'
    default:
      return 'A+S'
  }
}

function isAPlusModuleKind(value: unknown): value is APlusModuleKind {
  return typeof value === 'string' && A_PLUS_MODULE_KINDS.includes(value as APlusModuleKind)
}

function getAPlusModuleTypeText(type: APlusContentType, moduleType: APlusModuleKind, ordinal: number) {
  const suffix = ordinal > 1 || !['header-banner', 'hero-banner', 'logo', 'comparison-thumbnail'].includes(moduleType)
    ? ` ${ordinal}`
    : ''

  switch (moduleType) {
    case 'header-banner':
      return {
        label: `Header Banner${suffix}`,
        displayLabel: `顶部横幅${suffix}`,
      }
    case 'single-image':
      return {
        label: `Single Image${suffix}`,
        displayLabel: `大图模块${suffix}`,
      }
    case 'highlight-tile':
      return {
        label: `Highlight Tile${suffix}`,
        displayLabel: `卖点方块${suffix}`,
      }
    case 'hero-banner':
      return type === 'mobile'
        ? {
            label: `Mobile Hero${suffix}`,
            displayLabel: `手机首屏${suffix}`,
          }
        : {
            label: `Hero Banner${suffix}`,
            displayLabel: `高级首屏横幅${suffix}`,
          }
    case 'feature-image':
      return type === 'mobile'
        ? {
            label: `Mobile Feature${suffix}`,
            displayLabel: `手机卖点图${suffix}`,
          }
        : {
            label: `Feature Image${suffix}`,
            displayLabel: `高级大图模块${suffix}`,
          }
    case 'brand-story':
      return {
        label: `Brand Story${suffix}`,
        displayLabel: `品牌故事${suffix}`,
      }
    case 'logo':
      return {
        label: `Logo Image${suffix}`,
        displayLabel: `品牌 Logo${suffix}`,
      }
    case 'comparison-thumbnail':
      return {
        label: `Comparison Thumbnail${suffix}`,
        displayLabel: `对比缩略图${suffix}`,
      }
    default:
      return {
        label: `A+ Module${suffix}`,
        displayLabel: `A+ 模块${suffix}`,
      }
  }
}

function cloneAPlusModuleSpec(spec: AmazonAPlusModuleSpec): AmazonAPlusModuleSpec {
  return { ...spec }
}

function normalizeAPlusDimension(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.trunc(numeric)
}

export function normalizeAPlusModuleSpecs(
  type: APlusContentType,
  specs?: Array<Partial<AmazonAPlusModuleSpec>> | null,
): AmazonAPlusModuleSpec[] {
  const fallbackSpecs = getAPlusModuleSpecs(type)
  const sourceSpecs = Array.isArray(specs) && specs.length ? specs : fallbackSpecs
  const fallbackByModuleType = new Map(fallbackSpecs.map((spec) => [spec.moduleType, spec]))
  const moduleTypeCounts = new Map<APlusModuleKind, number>()
  const maxCount = sourceSpecs.some((spec) => spec.planContext?.layoutMode === 'composed') ? 24 : MAX_A_PLUS_MODULE_COUNT
  const normalizedSource = sourceSpecs
    .slice(0, maxCount)
    .filter((spec) => isAPlusModuleKind(spec.moduleType))

  const safeSource = normalizedSource.length ? normalizedSource : fallbackSpecs
  return safeSource.slice(0, maxCount).map((spec, index) => {
    const fallback = fallbackByModuleType.get(spec.moduleType as APlusModuleKind) ?? fallbackSpecs[index] ?? fallbackSpecs[0]
    const moduleType = isAPlusModuleKind(spec.moduleType) ? spec.moduleType : fallback.moduleType
    const nextOrdinal = (moduleTypeCounts.get(moduleType) ?? 0) + 1
    moduleTypeCounts.set(moduleType, nextOrdinal)
    const text = getAPlusModuleTypeText(type, moduleType, nextOrdinal)
    return {
      contentType: type,
      slot: spec.planContext?.layoutMode === 'composed' && spec.slot ? spec.slot : `${getAPlusModuleSlotPrefix(type)}${String(index + 1).padStart(2, '0')}`,
      label: spec.planContext?.layoutMode === 'composed' && spec.label ? spec.label : text.label,
      displayLabel: spec.planContext?.layoutMode === 'composed' && spec.displayLabel ? spec.displayLabel : text.displayLabel,
      moduleType,
      uploadWidth: normalizeAPlusDimension(spec.uploadWidth, fallback.uploadWidth),
      uploadHeight: normalizeAPlusDimension(spec.uploadHeight, fallback.uploadHeight),
      objective: typeof spec.objective === 'string' && spec.objective.trim() ? spec.objective : fallback.objective,
      ...(spec.planContext ? { planContext: { ...spec.planContext } } : {}),
      ...(spec.exactGenerationWidth ? { exactGenerationWidth: normalizeAPlusDimension(spec.exactGenerationWidth, spec.uploadWidth ?? fallback.uploadWidth) } : {}),
      ...(spec.exactGenerationHeight ? { exactGenerationHeight: normalizeAPlusDimension(spec.exactGenerationHeight, spec.uploadHeight ?? fallback.uploadHeight) } : {}),
    }
  })
}

export function insertAPlusModuleSpecAfter(
  type: APlusContentType,
  specs: Array<Partial<AmazonAPlusModuleSpec>>,
  index: number,
): AmazonAPlusModuleSpec[] {
  const normalizedSpecs = normalizeAPlusModuleSpecs(type, specs)
  if (normalizedSpecs.length >= MAX_A_PLUS_MODULE_COUNT) return normalizedSpecs
  const insertIndex = Math.min(Math.max(index, 0), normalizedSpecs.length - 1)
  const source = normalizedSpecs[insertIndex] ?? normalizedSpecs[normalizedSpecs.length - 1]
  return normalizeAPlusModuleSpecs(type, [
    ...normalizedSpecs.slice(0, insertIndex + 1),
    cloneAPlusModuleSpec(source),
    ...normalizedSpecs.slice(insertIndex + 1),
  ])
}

export function removeAPlusModuleSpecAt(
  type: APlusContentType,
  specs: Array<Partial<AmazonAPlusModuleSpec>>,
  index: number,
): AmazonAPlusModuleSpec[] {
  const normalizedSpecs = normalizeAPlusModuleSpecs(type, specs)
  if (normalizedSpecs.length <= MIN_A_PLUS_MODULE_COUNT) return normalizedSpecs
  const removeIndex = Math.min(Math.max(index, 0), normalizedSpecs.length - 1)
  return normalizeAPlusModuleSpecs(type, normalizedSpecs.filter((_, itemIndex) => itemIndex !== removeIndex))
}

export function areAPlusModuleSpecsEquivalent(
  left: Array<Partial<AmazonAPlusModuleSpec>>,
  right: Array<Partial<AmazonAPlusModuleSpec>>,
): boolean {
  if (left.length !== right.length) return false
  return left.every((spec, index) => {
    const other = right[index]
    return spec.moduleType === other?.moduleType &&
      spec.uploadWidth === other.uploadWidth &&
      spec.uploadHeight === other.uploadHeight
  })
}

export function getAPlusModuleSpecs(type: APlusContentType): AmazonAPlusModuleSpec[] {
  switch (type) {
    case 'brand-story':
      return BRAND_STORY_MODULE_SPECS.map(cloneAPlusModuleSpec)
    case 'premium':
      return PREMIUM_A_PLUS_MODULE_SPECS.map(cloneAPlusModuleSpec)
    case 'mobile':
      return MOBILE_A_PLUS_MODULE_SPECS.map(cloneAPlusModuleSpec)
    case 'standard-large':
      return STANDARD_LARGE_A_PLUS_MODULE_SPECS.map(cloneAPlusModuleSpec)
    default:
      return STANDARD_A_PLUS_MODULE_SPECS.map(cloneAPlusModuleSpec)
  }
}

export function findAPlusModuleSpec(slot: string): AmazonAPlusModuleSpec | undefined {
  return [...STANDARD_A_PLUS_MODULE_SPECS, ...STANDARD_LARGE_A_PLUS_MODULE_SPECS, ...PREMIUM_A_PLUS_MODULE_SPECS, ...MOBILE_A_PLUS_MODULE_SPECS, ...BRAND_STORY_MODULE_SPECS, ...OPTIONAL_A_PLUS_MODULE_SPECS]
    .find((spec) => spec.slot === slot)
}

export function getAPlusContentTypeLabel(type: APlusContentType): string {
  switch (type) {
    case 'brand-story':
      return '品牌故事'
    case 'premium':
      return '高级A+'
    case 'mobile':
      return '手机A+'
    case 'standard-large':
      return '普通A+'
    default:
      return '标准A+'
  }
}

export function getAPlusModuleDisplayName(module: (Pick<AmazonAPlusPlan, 'slot' | 'moduleType'> | Pick<AmazonAPlusModuleSpec, 'slot' | 'moduleType'>) & { displayLabel?: string }): string {
  if (module.displayLabel) return module.displayLabel
  const spec = findAPlusModuleSpec(module.slot)
  if (spec && spec.moduleType === module.moduleType) return spec.displayLabel

  switch (module.moduleType) {
    case 'header-banner':
      return '顶部横幅'
    case 'single-image':
      return '大图模块'
    case 'highlight-tile':
      return '卖点方块'
    case 'hero-banner':
      return '高级首屏横幅'
    case 'feature-image':
      return '高级大图模块'
    case 'brand-story':
      return '品牌故事'
    case 'continuous-canvas':
      return '连续母图'
    case 'carousel-slide':
      return '轮播图'
    case 'brand-story-background':
      return '品牌故事背景'
    case 'brand-story-card':
      return '品牌故事卡片'
    case 'logo':
      return '品牌 Logo'
    case 'comparison-thumbnail':
      return '对比缩略图'
    default:
      return 'A+ 模块'
  }
}

export function getAPlusModuleEnglishName(module: Pick<AmazonAPlusPlan, 'slot' | 'label' | 'moduleType'> | Pick<AmazonAPlusModuleSpec, 'slot' | 'label' | 'moduleType'>): string {
  const spec = findAPlusModuleSpec(module.slot)
  if (spec && spec.moduleType === module.moduleType) return spec.label
  return module.label ?? module.moduleType
}

export function isAPlusTextModule(module: Pick<AmazonAPlusPlan, 'moduleType'> | Pick<AmazonAPlusModuleSpec, 'moduleType'>): boolean {
  return module.moduleType === 'highlight-tile'
}

export function formatAPlusModuleText(plan: Pick<AmazonAPlusPlan, 'textTitle' | 'textBody'>): string {
  return [plan.textTitle.trim(), plan.textBody.trim()].filter(Boolean).join('\n\n')
}

export function getAPlusModuleUploadSize(spec: Pick<AmazonAPlusModuleSpec, 'uploadWidth' | 'uploadHeight' | 'planContext'>): string {
  if (spec.planContext?.groupKind === 'continuous-canvas' && spec.planContext.sliceCount) {
    return `${spec.uploadWidth}x${spec.uploadHeight} × ${spec.planContext.sliceCount}片`
  }
  return formatAPlusUploadSize(spec)
}

export function getAPlusModuleGenerationSize(spec: Pick<AmazonAPlusModuleSpec, 'uploadWidth' | 'uploadHeight' | 'exactGenerationWidth' | 'exactGenerationHeight' | 'planContext'>, tier: SizeTier): string {
  if (spec.planContext?.groupKind === 'continuous-canvas' && spec.planContext.sliceCount) {
    return getAPlusMotherImageSize(spec.planContext.aPlusType ?? 'premium', spec.planContext.sliceCount, tier)
  }
  if (spec.planContext?.aPlusType) return getAPlusSingleImageSize(spec.planContext.aPlusType, tier)
  if (spec.planContext?.plannedGenerationSize) return spec.planContext.plannedGenerationSize
  if (spec.exactGenerationWidth && spec.exactGenerationHeight) return `${spec.exactGenerationWidth}x${spec.exactGenerationHeight}`
  return getAPlusGenerationSizeFromDimensions(spec.uploadWidth, spec.uploadHeight, tier)
}

export function getAPlusPlanGenerationSize(plan: Pick<AmazonAPlusPlan, 'slot' | 'uploadSize' | 'planContext'>, tier: SizeTier): string {
  if (plan.planContext?.groupKind === 'continuous-canvas' && plan.planContext.sliceCount) {
    return getAPlusMotherImageSize(plan.planContext.aPlusType ?? 'premium', plan.planContext.sliceCount, tier)
  }
  if (plan.planContext?.aPlusType) return getAPlusSingleImageSize(plan.planContext.aPlusType, tier)
  if (plan.planContext?.plannedGenerationSize) return plan.planContext.plannedGenerationSize
  const match = plan.uploadSize.match(/^(\d+)x(\d+)$/)
  if (match) return getAPlusGenerationSizeFromDimensions(Number(match[1]), Number(match[2]), tier)

  const spec = findAPlusModuleSpec(plan.slot)
  if (spec) return getAPlusModuleGenerationSize(spec, tier)
  return tier === '4K' ? '2880x2880' : '2048x2048'
}

const CONTINUOUS_POST_PROCESS_SECTION_RE = /(?:输出|生成|尺寸|后期|后处理).*(?:裁切|切片|拆分|上传)|(?:裁切|切片|拆分).*(?:输出|尺寸|上传|后期|后处理)/

export function sanitizeContinuousCanvasPlanMarkdown(markdown: string) {
  const lines = markdown.trim().split(/\r?\n/)
  const kept: string[] = []
  let skippedHeadingLevel: number | null = null

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (skippedHeadingLevel != null) {
      if (!heading || heading[1].length > skippedHeadingLevel) continue
      skippedHeadingLevel = null
    }

    if (heading && CONTINUOUS_POST_PROCESS_SECTION_RE.test(heading[2].replace(/[：:｜|]/g, ''))) {
      skippedHeadingLevel = heading[1].length
      continue
    }
    kept.push(line)
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function withAPlusGenerationSizes(plans: AmazonAPlusPlan[], tier: SizeTier): AmazonAPlusPlan[] {
  return plans.map((plan) => ({
    ...plan,
    planMarkdown: plan.planContext?.groupKind === 'continuous-canvas'
      ? sanitizeContinuousCanvasPlanMarkdown(plan.planMarkdown)
      : plan.planMarkdown,
    generationSize: getAPlusPlanGenerationSize(plan, tier),
  }))
}

export function buildAmazonAPlusPlanPrompt(plan: Pick<AmazonAPlusPlan, 'prompt' | 'negativePrompt'> & {
  uploadSize: string
  generationSize: string
  planContext?: APlusPlanContext
  seriesStyleGuide?: string | null
  visualStyleEnabled?: boolean
  styleReferenceAttached?: boolean
  styleDensityMode?: AmazonStyleDensityMode
  selectedVisualStyle?: {
    label: string
    description: string
    palette: string[]
  } | null
}): string {
  const prompt = normalizeAPlusPromptOutputSize(plan.prompt, plan.uploadSize, plan.generationSize)
  return formatPromptBlock({
    ...plan,
    prompt: [prompt, formatAPlusGenerationRequirement(plan)].filter(Boolean).join('\n\n'),
  })
}

function normalizeAPlusPromptOutputSize(prompt: string, uploadSize: string, generationSize: string) {
  if (!uploadSize || !generationSize || uploadSize === generationSize) return prompt.trim()
  const escapedUploadSize = uploadSize.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return prompt.trim().replace(new RegExp(escapedUploadSize, 'gi'), generationSize)
}

function parseImageDimensions(size: string) {
  const match = size.match(/^(\d+)x(\d+)$/i)
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}

function formatAPlusGenerationRequirement(plan: Pick<AmazonAPlusPlan, 'uploadSize' | 'generationSize' | 'planContext'>) {
  const sliceCount = plan.planContext?.groupKind === 'continuous-canvas' ? plan.planContext.sliceCount : null
  const dimensions = parseImageDimensions(plan.generationSize)
  const boundaryHeight = sliceCount && dimensions ? Math.round(dimensions.height / sliceCount) : null
  const continuousRules = sliceCount
    ? [
        `- The full ${plan.generationSize} canvas is one uninterrupted master composition. Design the complete mother image first; the complete image takes priority over making future website-managed regions look like independent panels.`,
        dimensions
          ? `- Canvas orientation is fixed: width ${dimensions.width}px, total height ${dimensions.height}px, aspect ratio ${(dimensions.width / dimensions.height).toFixed(3)}:1. Do not swap width and height or reinterpret the request as ${sliceCount} portrait posters.`
          : '',
        `- Use one scene, one camera/perspective, one lighting system, and one continuous visual hierarchy from top to bottom. Do not assign separate upper/lower scenes, separate hero/still-life treatments, or separate headline systems to future slices.`,
        boundaryHeight ? `- Treat each horizontal position every ${boundaryHeight} px as an invisible composition safety boundary used later by the website. Do not draw divider lines, seams, gutters, borders, panel frames, abrupt background changes, or centered horizontal transitions there.` : '',
        '- Continue scene planes, architecture, floor lines, fabric, shadows, light, color fields, and other non-critical visual forms naturally across every safety boundary so the result reads as one image.',
        `- Only avoid bisecting faces, the exact product, logos, measurements, and complete text blocks. Do not isolate all content inside separate safe-zone boxes.`,
        `- Generate and return exactly one complete ${plan.generationSize} image. Do not crop, slice, resize, split, or return ${sliceCount} separate images; all later processing is handled by the website.`,
        '- If any earlier plan describes upper/lower panel strategies or separate per-slice compositions, override it and merge those ideas into one continuous master scene.',
      ]
    : []
  return [
    'A+ output size requirements (highest priority):',
    `- Generate the image canvas at exactly ${plan.generationSize} px.`,
    ...(sliceCount ? [] : [`- ${plan.uploadSize} px is only the final Amazon Seller Central upload/display size.`]),
    ...continuousRules,
    '- If any earlier sentence treats the upload size as the generation canvas, override it with the generation size above.',
  ].join('\n')
}

export function buildAmazonAPlusPlanOnlyPrompt(plan: Pick<AmazonAPlusPlan, 'planMarkdown' | 'uploadSize' | 'generationSize' | 'planContext'>) {
  const sliceCount = plan.planContext?.groupKind === 'continuous-canvas' ? plan.planContext.sliceCount : null
  const dimensions = parseImageDimensions(plan.generationSize)
  const boundaryHeight = sliceCount && dimensions ? Math.round(dimensions.height / sliceCount) : null
  const continuousRules = sliceCount
    ? [
        `- 完整 ${plan.generationSize} 画布是一张不可中断的母图，必须按一张完整大图设计；完整画面的整体效果优先。`,
        dimensions
          ? `- 画布方向固定为宽 ${dimensions.width}px、总高 ${dimensions.height}px、宽高比 ${(dimensions.width / dimensions.height).toFixed(3)}:1，不得交换宽高，也不得理解成 ${sliceCount} 张竖版海报。`
          : '',
        '- 从上到下保持同一场景、同一镜头与透视、同一光线系统和同一视觉层级；禁止分别策划上片/下片，禁止在边界处切换成另一套模特图、产品静物、背景或标题系统。',
        boundaryHeight ? `- 每隔 ${boundaryHeight}px 的横向位置只是供网站后续处理使用的隐形构图安全边界，不得出现分隔线、接缝、留白沟槽、边框、模块框、背景突变或刻意居中的横向过渡。` : '',
        '- 地面、建筑线条、纱帘、布料、阴影、光线、色块和其他非关键视觉元素应自然跨越每个边界，让上下拼接后仍是一张完整图片。',
        '- 只需避免人脸、产品主体、Logo、尺寸标注和完整文字块跨越安全边界，不要把所有内容分别关进上下两个安全区。',
        `- AI 只需生成并返回一张完整的 ${plan.generationSize} 图片，不得裁切、拆分、缩放或返回 ${sliceCount} 张图片；后续处理全部由网站完成。`,
        '- 如果前面的策划案包含“上片/下片”或分片独立构图，以这里为准，将所有内容重新融合成一张连续母图。',
      ]
    : []
  return [
    plan.planMarkdown.trim(),
    '',
    '生图输出要求（最高优先级）：',
    `- 生成画布尺寸：${plan.generationSize} px。`,
    ...(sliceCount ? [] : [`- 亚马逊 Seller Central 最终上传/展示尺寸：${plan.uploadSize} px。`]),
    ...continuousRules,
    '- 如果策划案其他位置把上传尺寸写成了生成画布尺寸，以这里的生成画布尺寸为准。',
  ].join('\n')
}
