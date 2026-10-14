import { AMAZON_GENERATION_DEFAULTS, DEFAULT_PARAMS, type APlusBatchDraft, type APlusConversionTarget, type TaskRecord } from '../types'
import { getAPlusSingleImageSize, getAPlusMotherImageSize } from './aPlusLayout'

// 旧草稿的默认短文案，仅用于识别迁移；新转换使用 getDefaultAPlusConversionPrompt。
export const DEFAULT_APLUS_CONVERSION_PROMPT = '请根据源图重新设计适合亚马逊美国站 A+ 展示的画面排版。保持产品外观、颜色、材质、细节和清晰度，合理重排文字、背景与装饰元素。不得通过拉伸、压缩、裁切或变形整张图片来适配比例。'
export const APLUS_BATCH_CONCURRENCY = 9

export function normalizeAPlusPanelCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) ? Math.min(7, Math.max(1, Math.trunc(count))) : 1
}

export function getAPlusConversionSize(target: APlusConversionTarget, count: number) {
  const panelCount = normalizeAPlusPanelCount(count)
  return panelCount === 1 ? getAPlusSingleImageSize(target) : getAPlusMotherImageSize(target, panelCount)
}

/** 首页与编辑页共用的完整转换文案；尺寸始终按目标类型和片数生成。 */
export function getDefaultAPlusConversionPrompt(target: APlusConversionTarget, count: number) {
  const panelCount = normalizeAPlusPanelCount(count)
  const size = getAPlusConversionSize(target, panelCount)
  const targetLabel = target === 'premium' ? '高级A+' : '移动端高级A+'
  const motherImageRequirement = panelCount > 1
    ? `当前参考图是一张 ${panelCount} 片连续母图，请继续将输出设计为一张完整、上下连贯的连续母图，目标画布为 ${size}，不得拆成 ${panelCount} 张独立图片或独立海报。`
    : ''
  return `我是一名亚马逊美国站专业卖家。请将这张高级A+图片的画布尺寸调整为 ${size}，以适配亚马逊${targetLabel}展示需求。${motherImageRequirement}保持产品本身完全不变，包括产品外观、颜色、材质、角度、光影、细节及清晰度，不得修改或重新设计产品。仅调整整体画面排版和元素布局，合理重新安排文字、背景及装饰元素，使画面在 ${size} 画布下依然美观、平衡且具有高级感。禁止对整张图片进行拉伸、压缩、裁切或变形，不要通过缩放或拉伸来适配比例，而是通过重新布局画面内容完成适配。`
}

export function updateDefaultAPlusConversionPrompt(prompt: string, previousTarget: APlusConversionTarget, previousCount: number, target: APlusConversionTarget, count: number) {
  return prompt === DEFAULT_APLUS_CONVERSION_PROMPT || prompt === getDefaultAPlusConversionPrompt(previousTarget, previousCount)
    ? getDefaultAPlusConversionPrompt(target, count)
    : prompt
}

export function buildAPlusConversionSpec(target: APlusConversionTarget, count: number, description: string, sourceTask?: TaskRecord) {
  const panelCount = normalizeAPlusPanelCount(count)
  const size = getAPlusConversionSize(target, panelCount)
  const label = target === 'premium' ? '高级 A+' : '手机 A+'
  const constraints = `本次转换的目标是${label}，目标画布 ${size}。${panelCount === 1
    ? '输出一张普通 A+ 图片。'
    : `输出一张包含 ${panelCount} 片、上下连续的完整母图，每片比例符合${label}，不得返回 ${panelCount} 张独立图片。`}仅第一张输入图是本任务源图。以本段目标类型、片数和尺寸为准。`
  return {
    prompt: `${description.trim() === DEFAULT_APLUS_CONVERSION_PROMPT ? getDefaultAPlusConversionPrompt(target, panelCount) : description.trim()}\n\n${constraints}`,
    params: { ...DEFAULT_PARAMS, ...AMAZON_GENERATION_DEFAULTS, size, n: 1 },
    category: {
      workflow: 'amazon-aplus' as const,
      aPlusType: target,
      productTitle: sourceTask?.category?.productTitle,
      amazonSlot: sourceTask?.category?.amazonSlot,
      ...(panelCount > 1 ? { aPlusPlanContext: {
        groupId: `aplus-conversion-${sourceTask?.id ?? 'upload'}`,
        groupKind: 'continuous-canvas' as const,
        layoutMode: 'composed' as const,
        itemIndex: 0,
        sliceCount: panelCount,
        slotCost: panelCount,
        plannedGenerationSize: size,
      } } : {}),
    },
  }
}

export function restoreAPlusBatchDraft(value: unknown): APlusBatchDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as APlusBatchDraft
  if (typeof draft.id !== 'string' || !Array.isArray(draft.rows)) return null
  return {
    id: draft.id,
    target: draft.target === 'mobile' ? 'mobile' : 'premium',
    rows: draft.rows.filter((row) => row && typeof row.id === 'string' && typeof row.sourceImageId === 'string').map((row) => ({
      id: row.id,
      sourceImageId: row.sourceImageId,
      label: typeof row.label === 'string' ? row.label : '素材',
      panelCount: normalizeAPlusPanelCount(row.panelCount),
      prompt: typeof row.prompt === 'string'
        ? updateDefaultAPlusConversionPrompt(row.prompt, draft.target === 'mobile' ? 'mobile' : 'premium', row.panelCount, draft.target === 'mobile' ? 'mobile' : 'premium', row.panelCount)
        : getDefaultAPlusConversionPrompt(draft.target === 'mobile' ? 'mobile' : 'premium', row.panelCount),
      taskId: typeof row.taskId === 'string' ? row.taskId : null,
      status: row.status === 'done' || row.status === 'error' || row.status === 'stopped' ? row.status : row.status === 'ready' ? 'ready' : 'stopped',
      error: row.status === 'queued' || row.status === 'running' ? '页面已刷新，请手动续跑。' : typeof row.error === 'string' ? row.error : null,
    })),
  }
}
