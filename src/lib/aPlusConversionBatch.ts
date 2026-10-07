import type { APlusBatchRow, APlusConversionTarget, AppSettings } from '../types'
import { getActiveApiProfile } from './apiProfiles'
import { APLUS_BATCH_CONCURRENCY, buildAPlusConversionSpec, DEFAULT_APLUS_CONVERSION_PROMPT } from './aPlusConversion'
import { captureAPlusRequestSettings, deleteImageIfUnreferenced, ensureImageCached, getSuggestedAPlusOutputConversionSliceCount, stopImageTask, submitExplicitImageTask, useStore } from '../store'

type Job = { batchId: string; row: APlusBatchRow; target: APlusConversionTarget; settings: AppSettings; controller: AbortController; taskId: string | null }
const queue: Job[] = []
const active = new Map<string, Job>()
const id = () => `aplus-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

function patchRow(batchId: string, rowId: string, patch: Partial<APlusBatchRow>) {
  useStore.getState().setAPlusBatchDraft((draft) => draft?.id === batchId
    ? { ...draft, rows: draft.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row) }
    : draft)
}

export function addAPlusBatchSources(images: Array<{ id: string; label: string }>, target: APlusConversionTarget) {
  useStore.getState().setAPlusBatchDraft((current) => {
    const draft = current ?? { id: id(), target, rows: [] }
    const seen = new Set(draft.rows.map((row) => row.sourceImageId))
    const added: APlusBatchRow[] = []
    for (const image of images) {
      if (seen.has(image.id)) continue
      seen.add(image.id)
      const task = useStore.getState().tasks.find((item) => item.outputImages.includes(image.id))
      added.push({ id: id(), sourceImageId: image.id, label: image.label, panelCount: task ? getSuggestedAPlusOutputConversionSliceCount(task) : 1,
        prompt: DEFAULT_APLUS_CONVERSION_PROMPT, status: 'ready', taskId: null, error: null })
    }
    return { ...draft, rows: [...draft.rows, ...added] }
  })
}

export function enqueueAPlusBatchRows(rowIds: string[]) {
  const draft = useStore.getState().aPlusBatchDraft
  if (!draft) return
  const settings = captureAPlusRequestSettings()
  const profile = getActiveApiProfile(settings)
  for (const row of draft.rows) {
    if (!rowIds.includes(row.id) || row.status === 'queued' || row.status === 'running' || active.has(row.id)) continue
    const error = !row.prompt.trim() ? '请输入转换提示词。' : row.panelCount > 1 &&
      (profile.motherImageSupport === 'unsupported' || row.panelCount > (profile.maxMotherSlices ?? 7))
      ? `当前生图配置不支持 ${row.panelCount} 片母图。` : null
    if (error) { patchRow(draft.id, row.id, { status: 'error', error }); continue }
    queue.push({ batchId: draft.id, row: { ...row }, target: draft.target, settings, controller: new AbortController(), taskId: null })
    patchRow(draft.id, row.id, { status: 'queued', error: null, taskId: null })
  }
  pump()
}

async function run(job: Job) {
  patchRow(job.batchId, job.row.id, { status: 'running' })
  try {
    const dataUrl = await ensureImageCached(job.row.sourceImageId)
    if (useStore.getState().aPlusBatchDraft?.id !== job.batchId) job.controller.abort()
    job.controller.signal.throwIfAborted()
    if (!dataUrl) throw new Error('源图已不存在，请重新上传。')
    const sourceTask = useStore.getState().tasks.find((task) => task.outputImages.includes(job.row.sourceImageId))
    const spec = buildAPlusConversionSpec(job.target, job.row.panelCount, job.row.prompt, sourceTask)
    const handle = await submitExplicitImageTask({ ...spec,
      inputImages: [{ id: job.row.sourceImageId, dataUrl }], styleReferenceImage: null, maskDraft: null,
      aPlusConversion: { sourceImageId: job.row.sourceImageId, target: job.target, panelCount: job.row.panelCount, batchId: job.batchId, rowId: job.row.id },
    }, job.settings, job.controller.signal, (taskId) => {
      job.taskId = taskId
      patchRow(job.batchId, job.row.id, { taskId })
    })
    const task = await handle.completion
    patchRow(job.batchId, job.row.id, task?.status === 'done'
      ? { status: 'done', error: null }
      : { status: job.controller.signal.aborted ? 'stopped' : 'error', error: task?.error ?? '任务记录已移除。' })
  } catch (error) {
    patchRow(job.batchId, job.row.id, { status: job.controller.signal.aborted ? 'stopped' : 'error',
      error: job.controller.signal.aborted ? '已停止' : error instanceof Error ? error.message : String(error) })
  } finally {
    active.delete(job.row.id)
    pump()
    if (!active.size && !queue.length && useStore.getState().aPlusBatchDraft?.id === job.batchId) {
      const rows = useStore.getState().aPlusBatchDraft!.rows
      useStore.getState().showToast(`本批次已结束：成功 ${rows.filter((row) => row.status === 'done').length}，失败 ${rows.filter((row) => row.status === 'error').length}，停止 ${rows.filter((row) => row.status === 'stopped').length}`, 'info')
    }
  }
}

function pump() {
  while (active.size < APLUS_BATCH_CONCURRENCY && queue.length) {
    const job = queue.shift()!
    if (job.controller.signal.aborted || useStore.getState().aPlusBatchDraft?.id !== job.batchId) continue
    active.set(job.row.id, job)
    void run(job)
  }
}

export function stopAPlusBatchRow(rowId: string) {
  const queuedIndex = queue.findIndex((job) => job.row.id === rowId)
  if (queuedIndex >= 0) {
    const [job] = queue.splice(queuedIndex, 1)
    job.controller.abort()
    patchRow(job.batchId, rowId, { status: 'stopped', error: '已取消排队' })
  }
  const job = active.get(rowId)
  if (!job) return
  if (job.taskId) stopImageTask(job.taskId)
  job.controller.abort()
  patchRow(job.batchId, rowId, { status: 'stopped', error: '已停止' })
}

export function stopAllAPlusBatchRows() {
  for (const rowId of [...queue.map((job) => job.row.id), ...active.keys()]) stopAPlusBatchRow(rowId)
}

export function removeAPlusBatchRow(rowId: string) {
  const draft = useStore.getState().aPlusBatchDraft
  const row = draft?.rows.find((item) => item.id === rowId)
  if (!draft || !row || row.status === 'queued' || row.status === 'running') return
  useStore.getState().setAPlusBatchDraft({ ...draft, rows: draft.rows.filter((item) => item.id !== rowId) })
  void deleteImageIfUnreferenced(row.sourceImageId)
}
