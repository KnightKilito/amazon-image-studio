import { AMAZON_GENERATION_DEFAULTS, DEFAULT_PARAMS, type APlusBatchDraft, type APlusConversionTarget, type TaskRecord } from '../types'
import { getAPlusSingleImageSize, getAPlusMotherImageSize } from './aPlusLayout'

export const DEFAULT_APLUS_CONVERSION_PROMPT = '请根据源图重新设计适合亚马逊美国站 A+ 展示的画面排版。保持产品外观、颜色、材质、细节和清晰度，合理重排文字、背景与装饰元素。不得通过拉伸、压缩、裁切或变形整张图片来适配比例。'
export const APLUS_BATCH_CONCURRENCY = 9

export function normalizeAPlusPanelCount(value: unknown) {
  const count = Number(value)
  return Number.isFinite(count) ? Math.min(7, Math.max(1, Math.trunc(count))) : 1
}

export function getAPlusConversionSize(target: APlusConversionTarget, count: number) {
  return count <= 1 ? getAPlusSingleImageSize(target) : getAPlusMotherImageSize(target, normalizeAPlusPanelCount(count))
}

export function buildAPlusConversionSpec(target: APlusConversionTarget, count: number, description: string, sourceTask?: TaskRecord) {
  const panelCount = normalizeAPlusPanelCount(count)
  const size = getAPlusConversionSize(target, panelCount)
  const label = target === 'premium' ? '高级 A+' : '手机 A+'
  const constraints = `本次转换的目标是${label}，目标画布 ${size}。${panelCount === 1
    ? '输出一张普通 A+ 图片。'
    : `输出一张包含 ${panelCount} 片、上下连续的完整母图，每片比例符合${label}，不得返回 ${panelCount} 张独立图片。`}仅第一张输入图是本任务源图。以本段目标类型、片数和尺寸为准。`
  return {
    prompt: `${description.trim()}\n\n${constraints}`,
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
      prompt: typeof row.prompt === 'string' ? row.prompt : DEFAULT_APLUS_CONVERSION_PROMPT,
      taskId: typeof row.taskId === 'string' ? row.taskId : null,
      status: row.status === 'done' || row.status === 'error' || row.status === 'stopped' ? row.status : row.status === 'ready' ? 'ready' : 'stopped',
      error: row.status === 'queued' || row.status === 'running' ? '页面已刷新，请手动续跑。' : typeof row.error === 'string' ? row.error : null,
    })),
  }
}
