import type { TaskRecord } from '../types'

/** 图片服务给出原始链接后，任务仍在运行表示浏览器正在取回并保存图片。 */
export function getTaskLoadingPhase(task: Pick<TaskRecord, 'status' | 'rawImageUrls' | 'falRecoverable' | 'customRecoverable'>) {
  if (task.status !== 'running' && !(task.status === 'error' && (task.falRecoverable || task.customRecoverable))) return null
  return task.rawImageUrls?.some((url) => /^https?:\/\//i.test(url)) ? 'downloading' : 'generating'
}
