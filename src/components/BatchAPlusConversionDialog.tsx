import { useEffect, useRef, useState } from 'react'
import type { APlusBatchRow, APlusConversionTarget, TaskRecord } from '../types'
import { getImage } from '../lib/db'
import { getImageDimensions } from '../lib/canvasImage'
import { buildAPlusConversionSpec, getAPlusConversionSize, normalizeAPlusPanelCount, updateDefaultAPlusConversionPrompt } from '../lib/aPlusConversion'
import { addAPlusBatchSources, enqueueAPlusBatchRows, removeAPlusBatchRow, stopAllAPlusBatchRows, stopAPlusBatchRow } from '../lib/aPlusConversionBatch'
import { estimateResizedImageByteSize, formatImageFileSize, getDataUrlByteSize } from '../lib/imageResizing'
import { getTaskLoadingPhase } from '../lib/taskLoadingPhase'
import { createInputImageFromFile, ensureImageCached, ensureImageThumbnailCached, useStore } from '../store'
import { getActiveApiProfile } from '../lib/apiProfiles'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import Select from './Select'
import { CloseIcon } from './icons'

const buttonClass = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-200'
const selectClass = 'h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-700 dark:border-white/10 dark:bg-gray-950 dark:text-gray-200'

function ImageSizeCell({ row, target, task }: { row: APlusBatchRow; target: APlusConversionTarget; task?: TaskRecord }) {
  const [source, setSource] = useState<{ width: number; height: number; estimate: number } | null>(null)
  const [actual, setActual] = useState<{ size: string; bytes: number } | null>(null)
  useEffect(() => {
    let cancelled = false
    void getImage(row.sourceImageId).then(async (image) => {
      if (!image) return
      const dimensions = image.width && image.height ? { width: image.width, height: image.height } : await getImageDimensions(image.dataUrl)
      const estimate = estimateResizedImageByteSize(image.dataUrl, {
        sourceWidth: dimensions.width, sourceHeight: dimensions.height, targetWidth: dimensions.width, targetHeight: dimensions.height,
      }, 'png', 100)
      if (!cancelled) setSource({ ...dimensions, estimate })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [row.sourceImageId])
  useEffect(() => {
    let cancelled = false
    setActual(null)
    if (task?.status !== 'done') return
    void Promise.all(task.outputImages.map(getImage)).then(async (images) => {
      const image = images[0]
      if (!image) return
      const dimensions = image.width && image.height ? { width: image.width, height: image.height } : await getImageDimensions(image.dataUrl)
      if (!cancelled) setActual({ size: `${dimensions.width} × ${dimensions.height}`, bytes: images.reduce((sum, item) => sum + getDataUrlByteSize(item?.dataUrl ?? ''), 0) })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [task?.id, task?.status, task?.outputImages])
  const size = getAPlusConversionSize(target, row.panelCount)
  const [width, height] = size.split('x').map(Number)
  const estimate = source ? source.estimate * width * height / (source.width * source.height) : 0
  return <div className="whitespace-nowrap text-xs">
    <div className="font-mono">{actual?.size ?? size.replace('x', ' × ')}</div>
    <div className="mt-1 text-gray-400" title="AI 会重新排版，生成前的文件体积仅为粗估。">{actual ? `实际 ${formatImageFileSize(actual.bytes)}` : `粗估 ${formatImageFileSize(estimate)}`}</div>
  </div>
}

function SourceThumbnail({ imageId, label, onPreview }: { imageId: string; label: string; onPreview: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let cancelled = false
    void ensureImageThumbnailCached(imageId).then((image) => { if (!cancelled) setSrc(image?.dataUrl ?? '') }).catch(() => {})
    return () => { cancelled = true }
  }, [imageId])
  return <button type="button" onClick={onPreview} className="flex items-center gap-2 text-left" title="预览源图">
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-white/5">
      {src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : <span className="text-[10px] text-gray-400">读取中</span>}
    </span><span className="max-w-24 break-words text-xs font-medium">{label}</span>
  </button>
}

export default function BatchAPlusConversionDialog({ onClose }: { onClose: () => void }) {
  const draft = useStore((state) => state.aPlusBatchDraft)
  const tasks = useStore((state) => state.tasks)
  const setDraft = useStore((state) => state.setAPlusBatchDraft)
  const showToast = useStore((state) => state.showToast)
  const settings = useStore((state) => state.settings)
  const panelRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [promptEditor, setPromptEditor] = useState<{ id: string; text: string } | null>(null)
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null)
  usePreventBackgroundScroll(true, panelRef)
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      if (promptEditor) setPromptEditor(null)
      else if (preview) setPreview(null)
      else onClose()
    }
    window.addEventListener('keydown', handleEscape, true)
    return () => window.removeEventListener('keydown', handleEscape, true)
  }, [onClose, preview, promptEditor])

  const rows = draft?.rows ?? []
  const target = draft?.target ?? 'premium'
  const busy = rows.some((row) => row.status === 'queued' || row.status === 'running')
  const profile = getActiveApiProfile(settings)
  const editRow = (id: string, patch: Partial<APlusBatchRow>) => setDraft((current) => current
    ? { ...current, rows: current.rows.map((row) => row.id === id && row.status !== 'queued' && row.status !== 'running'
      ? { ...row, ...patch, prompt: patch.prompt ?? updateDefaultAPlusConversionPrompt(row.prompt, current.target, row.panelCount, current.target, patch.panelCount ?? row.panelCount), status: 'ready', error: null, taskId: null } : row) } : current)
  const addCurrentMaterials = () => {
    addAPlusBatchSources(useStore.getState().inputImages.map((image, index) => ({ id: image.id, label: `素材 ${index + 1}` })), target)
  }
  const submit = (ids: string[]) => {
    try { enqueueAPlusBatchRows(ids) } catch (error) { showToast(error instanceof Error ? error.message : '无法提交', 'error') }
  }
  const upload = async (files: File[]) => {
    setUploading(true)
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) { showToast(`${file.name} 不是图片`, 'error'); continue }
        try {
          const image = await createInputImageFromFile(file)
          if (image) addAPlusBatchSources([{ id: image.id, label: file.name }], target)
        } catch (error) { showToast(error instanceof Error ? error.message : '上传失败', 'error') }
      }
    } finally { setUploading(false) }
  }
  const previewImage = async (row: APlusBatchRow) => {
    try {
      const src = await ensureImageCached(row.sourceImageId)
      if (!src) throw new Error('图片已不存在')
      setPreview({ src, label: row.label })
    } catch (error) { showToast(error instanceof Error ? error.message : '图片读取失败', 'error') }
  }
  const editorRow = rows.find((row) => row.id === promptEditor?.id)

  return <div ref={panelRef} data-no-drag-select onDragOver={(event) => { event.preventDefault(); event.stopPropagation() }}
    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); void upload(Array.from(event.dataTransfer.files)) }}
    className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-5">
    <div role="dialog" aria-modal="true" aria-label="批量转为 A+" className="flex max-h-[92vh] w-full max-w-[1400px] flex-col overflow-hidden rounded-2xl border border-white/40 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-white/10">
        <div><h2 className="font-semibold text-gray-900 dark:text-white">批量转为 A+</h2>
          <p className="mt-1 text-xs text-gray-500">每行独立转换；最多同时执行 9 条。关闭窗口或切换页面会继续执行，刷新后手动续跑。</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="关闭批量转换"><CloseIcon className="h-5 w-5" /></button>
      </header>
      <div className="flex flex-wrap items-end gap-3 border-b border-gray-200 p-4 dark:border-white/10">
        <div className="w-40"><label className="mb-1 block text-xs text-gray-500">转换类型</label><Select value={target} disabled={busy}
          onChange={(value) => setDraft((current) => current ? { ...current, target: value as APlusConversionTarget, rows: current.rows.map((row) => ({ ...row, prompt: updateDefaultAPlusConversionPrompt(row.prompt, current.target, row.panelCount, value as APlusConversionTarget, row.panelCount), status: 'ready', taskId: null, error: null })) } : current)}
          options={[{ label: '高级 A+', value: 'premium' }, { label: '手机 A+', value: 'mobile' }]} className={selectClass} /></div>
        <button type="button" onClick={addCurrentMaterials} className={buttonClass}>添加当前素材</button>
        <button type="button" onClick={() => uploadRef.current?.click()} disabled={uploading} className={buttonClass}>{uploading ? '上传中…' : '上传图片'}</button>
        <input ref={uploadRef} type="file" multiple accept="image/*" className="hidden" onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = '' }} />
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" disabled={!rows.some((row) => row.status === 'ready')} onClick={() => submit(rows.filter((row) => row.status === 'ready').map((row) => row.id))} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40">提交全部待处理</button>
          <button type="button" disabled={!busy} onClick={stopAllAPlusBatchRows} className={buttonClass}>停止全部</button>
        </div>
        <p className="w-full text-xs text-gray-400">生图配置：{profile.name} · {profile.model} · PNG / high / 无压缩。合成数量表示一张母图包含几片，输出数量始终为 1。</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        <table className="w-full min-w-[1020px] border-collapse text-left text-gray-700 dark:text-gray-200">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500 dark:bg-gray-950"><tr>
            {['图片', '合成图片数量', '提示词（点击编辑）', '预计尺寸与大小', '任务状态', '操作'].map((label) => <th key={label} className="border-b border-gray-200 px-4 py-3 font-semibold dark:border-white/10">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map((row) => {
            const task = row.taskId ? tasks.find((item) => item.id === row.taskId) : undefined
            const locked = row.status === 'queued' || row.status === 'running'
            const done = task?.status === 'done' || row.status === 'done'
            const phase = done ? '成功' : row.status === 'queued' ? '排队中' : row.status === 'running'
              ? task && getTaskLoadingPhase(task) === 'downloading' ? '下载中' : task?.falRecoverable || task?.customRecoverable ? '重连中' : '生成中'
              : row.status === 'error' ? '失败' : row.status === 'stopped' ? '已停止' : '待提交'
            const color = done ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-400/10' : phase === '下载中' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-400/10'
              : row.status === 'error' ? 'text-red-600 bg-red-50 dark:bg-red-400/10' : locked ? 'text-blue-600 bg-blue-50 dark:bg-blue-400/10' : 'text-gray-500 bg-gray-100 dark:bg-white/5'
            return <tr key={row.id} className="border-b border-gray-100 align-top dark:border-white/5">
              <td className="p-4"><SourceThumbnail imageId={row.sourceImageId} label={row.label} onPreview={() => void previewImage(row)} /></td>
              <td className="w-36 p-4"><Select disabled={locked} value={row.panelCount} onChange={(count) => editRow(row.id, { panelCount: normalizeAPlusPanelCount(count) })}
                options={Array.from({ length: 7 }, (_, index) => ({ value: index + 1, label: `${index + 1} 片` }))} className={selectClass} /></td>
              <td className="w-[32%] p-4"><button type="button" disabled={locked} onClick={() => setPromptEditor({ id: row.id, text: row.prompt })} className="w-full rounded-lg bg-gray-50 p-2.5 text-left text-xs leading-relaxed transition hover:bg-blue-50 disabled:cursor-default dark:bg-white/5 dark:hover:bg-blue-500/10"><span className="line-clamp-3 whitespace-pre-wrap break-words">{row.prompt || '点击填写提示词'}</span></button></td>
              <td className="p-4"><ImageSizeCell row={row} target={target} task={task} /></td>
              <td className="p-4"><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${color}`}>
                {locked && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}{phase}</span>
                {row.error && <p className="mt-2 max-w-44 break-words text-[11px] text-red-500">{row.error}</p>}</td>
              <td className="p-4"><div className="flex flex-col items-start gap-2">
                {locked ? <button type="button" onClick={() => stopAPlusBatchRow(row.id)} className={buttonClass}>{row.status === 'queued' ? '取消排队' : '停止'}</button>
                  : <button type="button" onClick={() => submit([row.id])} className={buttonClass}>{done || row.status === 'error' || row.status === 'stopped' ? '重新提交' : '提交'}</button>}
                {task?.status === 'done' && <button type="button" onClick={() => { onClose(); useStore.getState().setDetailTaskId(task.id) }} className="text-xs font-semibold text-blue-600">查看结果 / 下载</button>}
                <button type="button" disabled={locked} onClick={() => removeAPlusBatchRow(row.id)} className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-30">移除</button>
              </div></td>
            </tr>
          })}</tbody>
        </table>
        {!rows.length && <div className="py-16 text-center text-sm text-gray-400">暂无素材，添加当前素材或上传图片开始。</div>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 text-xs text-gray-500 dark:border-white/10">
        <span>共 {rows.length} 条 · 待提交 {rows.filter((row) => row.status === 'ready').length} · 排队 {rows.filter((row) => row.status === 'queued').length} · 执行 {rows.filter((row) => row.status === 'running').length} · 成功 {rows.filter((row) => row.status === 'done').length} · 失败 {rows.filter((row) => row.status === 'error').length}</span>
        <button type="button" onClick={onClose} className={buttonClass}>关闭窗口</button>
      </footer>
    </div>
    {promptEditor && editorRow && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="编辑转换提示词" className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900">
        <h3 className="font-semibold text-gray-800 dark:text-white">编辑转换提示词 · {editorRow.label}</h3>
        <p className="mt-2 text-xs text-gray-400">可自由修改转换描述。目标类型、片数和尺寸会按表格设置自动附加。</p>
        <textarea autoFocus value={promptEditor.text} onChange={(event) => setPromptEditor({ ...promptEditor, text: event.target.value })} className="mt-3 min-h-48 w-full resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-800 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-gray-950 dark:text-gray-200" />
        <details className="mt-3 min-h-0 overflow-y-auto text-xs text-gray-500"><summary className="cursor-pointer">完整请求预览</summary><p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 dark:bg-white/5">{buildAPlusConversionSpec(target, editorRow.panelCount, promptEditor.text).prompt}</p></details>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setPromptEditor(null)} className={buttonClass}>取消</button><button type="button" disabled={!promptEditor.text.trim()} onClick={() => { editRow(promptEditor.id, { prompt: promptEditor.text }); setPromptEditor(null) }} className={buttonClass}>保存提示词</button></div>
      </div>
    </div>}
    {preview && <div role="dialog" aria-modal="true" aria-label="转换源图预览" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-8" onClick={() => setPreview(null)}>
      <img src={preview.src} alt={preview.label} className="max-h-[85vh] max-w-[90vw] object-contain" />
      <button type="button" className="absolute right-5 top-5 p-2 text-white" aria-label="关闭源图预览" onClick={() => setPreview(null)}><CloseIcon className="h-6 w-6" /></button>
    </div>}
  </div>
}
