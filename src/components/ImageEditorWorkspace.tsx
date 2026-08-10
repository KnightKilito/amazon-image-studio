import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  createAPlusSliceTaskFromImage,
  createAPlusUpscaleTaskFromImage,
  createInputImageFromFile,
  ensureImageCached,
  openImageEditor,
  prepareAPlusConversionFromImage,
  useStore,
} from '../store'
import { getImageDimensions } from '../lib/canvasImage'
import { getAPlusUpscalePlan, type APlusUpscaleFormat } from '../lib/imageUpscaling'
import { downloadImageIds } from '../lib/downloadImages'
import type { APlusOutputConversionTarget } from '../store'
import type { APlusSliceFormat } from '../lib/imageSlicing'
import InputBar from './InputBar'
import ImageSliceDialog from './ImageSliceDialog'
import Select from './Select'
import TaskGrid from './TaskGrid'

function EditorImageThumb({ imageId, dataUrl, label, active, onClick }: {
  imageId: string
  dataUrl?: string
  label: string
  active: boolean
  onClick: () => void
}) {
  const [src, setSrc] = useState(dataUrl ?? '')

  useEffect(() => {
    if (dataUrl) {
      setSrc(dataUrl)
      return
    }
    let cancelled = false
    void ensureImageCached(imageId).then((next) => {
      if (!cancelled) setSrc(next ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [dataUrl, imageId])

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-gray-100 transition dark:bg-white/[0.04] ${active
        ? 'border-blue-500 ring-2 ring-blue-500/20'
        : 'border-gray-200 hover:border-blue-300 dark:border-white/[0.08] dark:hover:border-blue-400/60'
        }`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" draggable={false} /> : <span className="text-[10px] text-gray-400">读取中</span>}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">{label}</span>
    </button>
  )
}

function ToolButton({ children, onClick, disabled = false, tone = 'neutral', title }: {
  children: string
  onClick: () => void
  disabled?: boolean
  tone?: 'neutral' | 'primary'
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-full rounded-xl border px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${tone === 'primary'
        ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
        : 'border-gray-200 bg-white/70 text-gray-700 hover:border-blue-300 hover:bg-blue-50/60 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:hover:border-blue-400/50 dark:hover:bg-blue-500/10'
        }`}
    >
      {children}
    </button>
  )
}

export default function ImageEditorWorkspace() {
  const inputImages = useStore((s) => s.inputImages)
  const styleReferenceImage = useStore((s) => s.styleReferenceImage)
  const tasks = useStore((s) => s.tasks)
  const adminAccess = useStore((s) => s.adminAccess)
  const editorActiveImageId = useStore((s) => s.editorActiveImageId)
  const editorActiveTaskId = useStore((s) => s.editorActiveTaskId)
  const setEditorActiveImageId = useStore((s) => s.setEditorActiveImageId)
  const setEditorActiveTaskId = useStore((s) => s.setEditorActiveTaskId)
  const addInputImage = useStore((s) => s.addInputImage)
  const setMaskEditorImageId = useStore((s) => s.setMaskEditorImageId)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const showToast = useStore((s) => s.showToast)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const [sliceFormat, setSliceFormat] = useState<APlusSliceFormat>('premium')
  const [showSliceDialog, setShowSliceDialog] = useState(false)
  const [sliceBusy, setSliceBusy] = useState(false)
  const [localBusy, setLocalBusy] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === editorActiveTaskId) ?? null,
    [editorActiveTaskId, tasks],
  )
  const outputImageIds = activeTask?.outputImages ?? []
  const currentImageId = editorActiveImageId ?? inputImages[0]?.id ?? styleReferenceImage?.id ?? outputImageIds[0] ?? null
  const currentInputImage = inputImages.find((image) => image.id === currentImageId)
    ?? (styleReferenceImage?.id === currentImageId ? styleReferenceImage : undefined)
  const currentSourceIsInput = Boolean(currentInputImage)
  const imageLimit = Math.max(1, adminAccess.referenceImageUploadLimit)
  const imageCount = inputImages.length + (styleReferenceImage ? 1 : 0)
  const canUpload = imageCount < imageLimit
  const upscalePlan = dimensions.width && dimensions.height
    ? getAPlusUpscalePlan(dimensions.width, dimensions.height, sliceFormat as APlusUpscaleFormat)
    : null

  useEffect(() => {
    if (!currentImageId) {
      setPreviewSrc('')
      setDimensions({ width: 0, height: 0 })
      return
    }

    let cancelled = false
    const nextSource = currentInputImage?.dataUrl
    void (nextSource ? Promise.resolve(nextSource) : ensureImageCached(currentImageId)).then(async (dataUrl) => {
      if (cancelled) return
      setPreviewSrc(dataUrl ?? '')
      if (!dataUrl) {
        setDimensions({ width: 0, height: 0 })
        return
      }
      try {
        const nextDimensions = await getImageDimensions(dataUrl)
        if (!cancelled) setDimensions(nextDimensions)
      } catch {
        if (!cancelled) setDimensions({ width: 0, height: 0 })
      }
    })
    return () => {
      cancelled = true
    }
  }, [currentImageId, currentInputImage?.dataUrl])

  useEffect(() => {
    if (!editorActiveImageId && inputImages[0]) {
      setEditorActiveImageId(inputImages[0].id)
    }
  }, [editorActiveImageId, inputImages, setEditorActiveImageId])

  useEffect(() => {
    if (!activeTask || activeTask.status !== 'done' || activeTask.outputImages.length === 0) return
    const firstOutputId = activeTask.outputImages[0]
    if (editorActiveImageId !== firstOutputId) setEditorActiveImageId(firstOutputId)
  }, [activeTask, editorActiveImageId, setEditorActiveImageId])

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return
    if (!canUpload) {
      showToast(`参考图数量已达上限（${imageLimit} 张），无法继续添加`, 'error')
      return
    }
    const remaining = imageLimit - imageCount
    let inserted = 0
    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        showToast('仅支持 JPG、PNG、WebP 等图片文件', 'error')
        continue
      }
      try {
        const image = await createInputImageFromFile(file)
        if (!image) continue
        addInputImage(image)
        if (!editorActiveImageId) setEditorActiveImageId(image.id)
        inserted += 1
      } catch (error) {
        showToast(error instanceof Error ? error.message : '上传图片失败', 'error')
      }
    }
    if (files.length > remaining) showToast(`最多还能上传 ${remaining} 张参考图`, 'info')
    if (inserted > 0) showToast(`已添加 ${inserted} 张图片`, 'success')
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void uploadFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void uploadFiles(Array.from(event.dataTransfer.files ?? []))
  }

  const handleOpenMask = () => {
    if (!currentImageId || !currentSourceIsInput) {
      showToast('请先选择一个输入图片作为遮罩主图', 'info')
      return
    }
    setMaskEditorImageId(currentImageId)
  }

  const handleLocalUpscale = async () => {
    if (!currentImageId || localBusy) return
    setLocalBusy(true)
    try {
      const task = await createAPlusUpscaleTaskFromImage(currentImageId, sliceFormat)
      setEditorActiveTaskId(task.id)
      setEditorActiveImageId(task.outputImages[0] ?? currentImageId)
      showToast(`已保存 ${sliceFormat === 'mobile' ? '手机' : '高级'} A+ 等比放大结果`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '图片放大失败', 'error')
    } finally {
      setLocalBusy(false)
    }
  }

  const handleConfirmSlice = async (sliceCount: number) => {
    if (!currentImageId || sliceBusy) return
    setSliceBusy(true)
    try {
      const task = await createAPlusSliceTaskFromImage(currentImageId, sliceCount, sliceFormat)
      setEditorActiveTaskId(task.id)
      setEditorActiveImageId(task.outputImages[0] ?? currentImageId)
      setShowSliceDialog(false)
      showToast(`已保存 ${task.outputImages.length} 张切片`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '图片切片失败', 'error')
    } finally {
      setSliceBusy(false)
    }
  }

  const handlePrepareConversion = async (target: APlusOutputConversionTarget) => {
    if (!currentImageId) return
    const prepared = await prepareAPlusConversionFromImage(currentImageId, target)
    if (prepared) {
      setEditorActiveImageId(currentImageId)
      showToast('已准备 A+ 编辑提示词，请确认后提交', 'success')
    }
  }

  const handlePreview = () => {
    if (!currentImageId) return
    setLightboxImageId(currentImageId, outputImageIds.length > 0 ? outputImageIds : [currentImageId])
  }

  const handleDownload = async () => {
    if (!currentImageId) return
    const result = await downloadImageIds([currentImageId], `editor-${currentImageId}`)
    showToast(result.successCount > 0 ? '下载成功' : '下载失败', result.successCount > 0 ? 'success' : 'error')
  }

  return (
    <main
      data-image-editor
      className="safe-area-x min-h-[calc(100vh-3.5rem)] bg-gray-50/70 py-3 dark:bg-gray-950/70 sm:py-4"
      onDragEnter={(event) => {
        event.preventDefault()
        if (canUpload) setIsDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false)
      }}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      <div className="mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-[1600px] gap-3 lg:grid-cols-[180px_minmax(0,1fr)_380px]">
        <aside className="order-2 flex min-h-0 flex-col rounded-2xl border border-gray-200/80 bg-white/75 p-3 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/60 lg:order-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">素材</h2>
              <p className="mt-0.5 text-[11px] text-gray-400">输入图与结果</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!canUpload}
              className="rounded-lg bg-blue-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40"
            >
              上传
            </button>
          </div>
          <div className="flex min-h-0 gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {inputImages.map((image, index) => (
              <EditorImageThumb
                key={image.id}
                imageId={image.id}
                dataUrl={image.dataUrl}
                label={`输入 ${index + 1}`}
                active={currentImageId === image.id}
                onClick={() => setEditorActiveImageId(image.id)}
              />
            ))}
            {styleReferenceImage && (
              <EditorImageThumb
                imageId={styleReferenceImage.id}
                dataUrl={styleReferenceImage.dataUrl}
                label="风格参考"
                active={currentImageId === styleReferenceImage.id}
                onClick={() => setEditorActiveImageId(styleReferenceImage.id)}
              />
            )}
            {outputImageIds.map((imageId, index) => (
              <EditorImageThumb
                key={imageId}
                imageId={imageId}
                label={`结果 ${index + 1}`}
                active={currentImageId === imageId}
                onClick={() => setEditorActiveImageId(imageId)}
              />
            ))}
            {!inputImages.length && !styleReferenceImage && !outputImageIds.length && (
              <p className="py-4 text-center text-xs text-gray-400 lg:px-2">上传图片开始编辑</p>
            )}
          </div>
        </aside>

        <section className="relative order-1 flex min-h-[42vh] min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200/80 bg-[#eef1f5] p-3 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/70 lg:order-2 lg:min-h-0 lg:p-6">
          {previewSrc ? (
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.92),_rgba(226,230,237,0.85))] p-3 dark:bg-[radial-gradient(circle_at_center,_rgba(55,65,81,0.8),_rgba(17,24,39,0.9))] sm:p-6">
              <img
                src={previewSrc}
                alt="当前编辑图片"
                draggable={false}
                data-image-id={currentImageId ?? undefined}
                data-output-image-ids={outputImageIds.join(',')}
                className="max-h-full max-w-full object-contain drop-shadow-xl"
              />
              {dimensions.width > 0 && (
                <span className="absolute bottom-5 left-5 rounded-lg bg-black/55 px-2 py-1 text-[11px] text-white">
                  {dimensions.width} × {dimensions.height}
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-full min-h-[34vh] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300/70 bg-blue-50/45 px-6 text-center transition hover:bg-blue-50 dark:border-blue-400/30 dark:bg-blue-500/5 dark:hover:bg-blue-500/10"
            >
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 text-2xl text-white shadow-lg shadow-blue-500/20">＋</span>
              <strong className="text-sm text-gray-700 dark:text-gray-200">上传本地图片</strong>
              <span className="mt-1 text-xs text-gray-400">支持拖拽 JPG、PNG、WebP 图片到这里</span>
            </button>
          )}
          {isDragging && (
            <div className="absolute inset-3 flex items-center justify-center rounded-xl bg-blue-500/15 backdrop-blur-sm">
              <span className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">松开以上传图片</span>
            </div>
          )}
        </section>

        <aside className="order-3 flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white/75 p-3 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/60 sm:p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">图片编辑</h2>
              <p className="mt-0.5 text-[11px] text-gray-400">提示词、遮罩与本地处理</p>
            </div>
            {activeTask && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${activeTask.status === 'running' ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200' : activeTask.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'}`}>{activeTask.status === 'running' ? '处理中' : activeTask.status === 'error' ? '失败' : '已完成'}</span>}
          </div>

          <div className="min-h-[360px] rounded-2xl border border-gray-200/70 bg-white/50 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <InputBar layout="editor" />
          </div>

          <section className="space-y-2 rounded-2xl border border-gray-200/70 bg-white/55 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-200">局部与本地处理</h3>
                <p className="mt-0.5 text-[10px] leading-relaxed text-gray-400">不调用 AI 的 Canvas 操作；A+ 目标会影响放大和切片规格。</p>
              </div>
              <div className="w-36 shrink-0">
                <Select
                  value={sliceFormat}
                  onChange={(value) => setSliceFormat(value as APlusSliceFormat)}
                  options={[
                    { label: 'Premium A+（桌面）', value: 'premium' },
                    { label: 'Mobile A+（手机）', value: 'mobile' },
                  ]}
                  className="rounded-xl border border-gray-200/60 bg-white/50 px-3 py-1.5 text-xs shadow-sm transition-all duration-200 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                />
              </div>
            </div>
            <ToolButton onClick={handleOpenMask} disabled={!currentImageId || !currentSourceIsInput} title="在当前输入图片上绘制局部重绘遮罩">
              打开遮罩编辑
            </ToolButton>
            <ToolButton onClick={() => { if (currentImageId) void openImageEditor(currentImageId) }} disabled={!currentImageId || currentSourceIsInput}>
              将当前结果作为输入继续编辑
            </ToolButton>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton onClick={handlePreview} disabled={!currentImageId}>
                预览当前图片
              </ToolButton>
              <ToolButton onClick={() => void handleDownload()} disabled={!currentImageId}>
                下载当前图片
              </ToolButton>
            </div>
            <ToolButton onClick={() => setShowSliceDialog(true)} disabled={!currentImageId || sliceBusy}>
              切割 A+ 母图
            </ToolButton>
            <ToolButton onClick={() => void handleLocalUpscale()} disabled={!currentImageId || localBusy}>
              {localBusy ? '正在处理图片…' : upscalePlan ? `等比放大至 ${upscalePlan.targetWidth} × ${upscalePlan.targetHeight}` : '等比放大图片'}
            </ToolButton>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <ToolButton onClick={() => void handlePrepareConversion('premium')} disabled={!currentImageId}>
                准备高级 A+
              </ToolButton>
              <ToolButton onClick={() => void handlePrepareConversion('mobile')} disabled={!currentImageId}>
                准备手机 A+
              </ToolButton>
            </div>
          </section>

          {activeTask?.error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{activeTask.error}</div>}
          <p className="px-1 text-[10px] leading-relaxed text-gray-400">AI 编辑结果和本地处理结果都会保存到首页任务历史。点击结果缩略图可继续编辑。</p>
        </aside>
      </div>

      <section className="mx-auto mt-6 max-w-[1600px] px-3 sm:px-4 lg:px-0" data-drag-select-surface>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">图片历史</h2>
            <p className="mt-1 text-xs text-gray-400">复用首页历史结果，也可以将一条任务的全部输出图片加入当前素材。</p>
          </div>
        </div>
        <TaskGrid showUseAsMaterialButton />
      </section>

      {showSliceDialog && previewSrc && (
        <ImageSliceDialog
          source={previewSrc}
          initialSliceCount={2}
          format={sliceFormat}
          busy={sliceBusy}
          onClose={() => { if (!sliceBusy) setShowSliceDialog(false) }}
          onConfirm={(count) => void handleConfirmSlice(count)}
        />
      )}
    </main>
  )
}
