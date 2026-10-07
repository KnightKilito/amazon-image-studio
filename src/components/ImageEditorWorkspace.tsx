import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  createAPlusSliceTaskFromImage,
  createAPlusUpscaleTaskFromImage,
  createBatchImageResizeTask,
  createInputImageFromFile,
  deleteImageIfUnreferenced,
  ensureImageCached,
  getSuggestedAPlusOutputConversionSliceCount,
  openImageEditor,
  prepareAPlusConversionFromImage,
  useStore,
} from '../store'
import { getImageDimensions } from '../lib/canvasImage'
import { getPendingImageEditorResultAutoPreview } from '../lib/imageEditorSelection'
import { getAPlusUpscalePlan, getCustomUpscalePlan, MAX_CUSTOM_UPSCALE_EDGE, type APlusUpscaleFormat, type ImageUpscaleTargetSize } from '../lib/imageUpscaling'
import { downloadImageIds } from '../lib/downloadImages'
import type { ImageResizeOptions } from '../lib/imageResizing'
import type { APlusOutputConversionTarget } from '../store'
import type { APlusSliceFormat } from '../lib/imageSlicing'
import InputBar from './InputBar'
import ImageAnnotationCanvas from './ImageAnnotationCanvas'
import ImageSliceDialog from './ImageSliceDialog'
import BatchImageResizeDialog, { type BatchResizeCandidate } from './BatchImageResizeDialog'
import Select from './Select'
import TaskGrid from './TaskGrid'
import TaskSelectionToolbar from './TaskSelectionToolbar'
import APlusConversionDialog from './MobileAPlusConversionDialog'
import BatchAPlusConversionDialog from './BatchAPlusConversionDialog'
import { addAPlusBatchSources } from '../lib/aPlusConversionBatch'

type UpscaleMode = 'proportional' | 'custom'

function EditorImageThumb({ imageId, dataUrl, label, active, onClick, onRemove }: {
  imageId: string
  dataUrl?: string
  label: string
  active: boolean
  onClick: () => void
  onRemove?: () => void
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
    <div className="group relative h-16 w-16 shrink-0">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={`relative h-full w-full overflow-hidden rounded-xl border bg-gray-100 transition dark:bg-white/[0.04] ${active
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 hover:border-blue-300 dark:border-white/[0.08] dark:hover:border-blue-400/60'
          }`}
      >
        {src ? <img src={src} alt="" className="h-full w-full object-cover" draggable={false} /> : <span className="text-[10px] text-gray-400">读取中</span>}
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">{label}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          title={`移除${label}`}
          aria-label={`移除${label}`}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
          className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white opacity-100 shadow transition hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        >
          ×
        </button>
      )}
    </div>
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
  const hiddenResultImageIds = useStore((s) => s.editorHiddenResultImageIds)
  const editorCanvasDraft = useStore((s) => s.editorCanvasDraft)
  const singleConversion = useStore((s) => s.singleAPlusConversion)
  const setEditorActiveImageId = useStore((s) => s.setEditorActiveImageId)
  const setEditorActiveTaskId = useStore((s) => s.setEditorActiveTaskId)
  const setHiddenResultImageIds = useStore((s) => s.setEditorHiddenResultImageIds)
  const setEditorCanvasDraft = useStore((s) => s.setEditorCanvasDraft)
  const resetEditorCanvasDraft = useStore((s) => s.resetEditorCanvasDraft)
  const addInputImage = useStore((s) => s.addInputImage)
  const removeInputImage = useStore((s) => s.removeInputImage)
  const clearInputImages = useStore((s) => s.clearInputImages)
  const setInputImages = useStore((s) => s.setInputImages)
  const clearStyleReferenceImage = useStore((s) => s.clearStyleReferenceImage)
  const maskDraft = useStore((s) => s.maskDraft)
  const clearMaskDraft = useStore((s) => s.clearMaskDraft)
  const setMaskEditorImageId = useStore((s) => s.setMaskEditorImageId)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const clearSelection = useStore((s) => s.clearSelection)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const historySelectionSurfaceRef = useRef<HTMLElement>(null)
  const lastAutoPreviewedResultSignatureRef = useRef<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const [sliceFormat, setSliceFormat] = useState<APlusSliceFormat>('premium')
  const [showSliceDialog, setShowSliceDialog] = useState(false)
  const [showBatchResizeDialog, setShowBatchResizeDialog] = useState(false)
  const [sliceBusy, setSliceBusy] = useState(false)
  const [batchResizeBusy, setBatchResizeBusy] = useState(false)
  const [localBusy, setLocalBusy] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [upscaleMode, setUpscaleMode] = useState<UpscaleMode>('proportional')
  const [customUpscaleWidth, setCustomUpscaleWidth] = useState('')
  const [customUpscaleHeight, setCustomUpscaleHeight] = useState('')
  const [historyMultiSelectMode, setHistoryMultiSelectMode] = useState(false)
  const [conversionDialog, setConversionDialog] = useState<{ sourceImageId: string; target: APlusOutputConversionTarget; count: number } | null>(null)
  const [conversionBusy, setConversionBusy] = useState(false)
  const [showBatchConversion, setShowBatchConversion] = useState(false)

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === editorActiveTaskId) ?? null,
    [editorActiveTaskId, tasks],
  )
  const taskOutputImageIds = useMemo(() => activeTask?.outputImages ?? [], [activeTask])
  const outputImageIds = useMemo(
    () => taskOutputImageIds.filter((imageId) => !hiddenResultImageIds.includes(imageId)),
    [hiddenResultImageIds, taskOutputImageIds],
  )
  const batchResizeCandidates = useMemo(() => {
    const candidates = new Map<string, BatchResizeCandidate>()
    inputImages.forEach((image, index) => candidates.set(image.id, {
      id: image.id,
      dataUrl: image.dataUrl,
      label: image.id === editorCanvasDraft.sourceImageId ? '当前主图' : `参考素材 ${index + 1}`,
    }))
    if (styleReferenceImage) candidates.set(styleReferenceImage.id, {
      id: styleReferenceImage.id,
      dataUrl: styleReferenceImage.dataUrl,
      label: '风格参考',
    })
    outputImageIds.forEach((imageId, index) => candidates.set(imageId, {
      id: imageId,
      label: `结果 ${index + 1}`,
    }))
    return [...candidates.values()]
  }, [editorCanvasDraft.sourceImageId, inputImages, outputImageIds, styleReferenceImage])
  const currentImageId = editorActiveImageId ?? inputImages[0]?.id ?? outputImageIds[0] ?? null
  const currentInputImage = inputImages.find((image) => image.id === currentImageId)
  const currentPreviewImage = currentInputImage
    ?? (styleReferenceImage?.id === currentImageId ? styleReferenceImage : undefined)
  const mainSourceImageId = editorCanvasDraft.sourceImageId
  const currentSourceIsInput = Boolean(currentInputImage && currentImageId === mainSourceImageId)
  const currentOutputImageId = currentImageId && outputImageIds.includes(currentImageId) ? currentImageId : null
  const imageLimit = Math.max(1, adminAccess.referenceImageUploadLimit)
  const imageCount = inputImages.length + (styleReferenceImage ? 1 : 0)
  const canUpload = imageCount < imageLimit
  const proportionalUpscalePlan = dimensions.width && dimensions.height
    ? getAPlusUpscalePlan(dimensions.width, dimensions.height, sliceFormat as APlusUpscaleFormat)
    : null
  const customUpscale = useMemo(() => {
    if (!dimensions.width || !dimensions.height) return { plan: null, error: '' }
    try {
      return {
        plan: getCustomUpscalePlan(dimensions.width, dimensions.height, {
          width: Number(customUpscaleWidth),
          height: Number(customUpscaleHeight),
        }),
        error: '',
      }
    } catch (error) {
      return { plan: null, error: error instanceof Error ? error.message : '自定义尺寸无效。' }
    }
  }, [customUpscaleHeight, customUpscaleWidth, dimensions.height, dimensions.width])
  const selectedUpscalePlan = upscaleMode === 'custom' ? customUpscale.plan : proportionalUpscalePlan

  useEffect(() => {
    if (!currentImageId) {
      setPreviewSrc('')
      setDimensions({ width: 0, height: 0 })
      return
    }

    let cancelled = false
    const nextSource = currentPreviewImage?.dataUrl
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
  }, [currentImageId, currentPreviewImage?.dataUrl])

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) {
      setCustomUpscaleWidth('')
      setCustomUpscaleHeight('')
      return
    }
    const plan = getAPlusUpscalePlan(dimensions.width, dimensions.height, sliceFormat as APlusUpscaleFormat)
    setCustomUpscaleWidth(String(plan.targetWidth))
    setCustomUpscaleHeight(String(plan.targetHeight))
  }, [currentImageId, dimensions.height, dimensions.width, sliceFormat])

  useEffect(() => {
    if (!editorActiveImageId && inputImages[0]) {
      setEditorActiveImageId(inputImages[0].id)
    }
  }, [editorActiveImageId, inputImages, setEditorActiveImageId])

  useEffect(() => {
    if (!mainSourceImageId) {
      if (inputImages[0]) setEditorCanvasDraft({ sourceImageId: inputImages[0].id, annotations: [] })
      return
    }
    if (inputImages.some((image) => image.id === mainSourceImageId)) return

    const nextSourceImageId = inputImages[0]?.id ?? null
    resetEditorCanvasDraft(nextSourceImageId)
    if (editorActiveImageId === mainSourceImageId) setEditorActiveImageId(nextSourceImageId)
  }, [editorActiveImageId, inputImages, mainSourceImageId, resetEditorCanvasDraft, setEditorActiveImageId, setEditorCanvasDraft])

  useEffect(() => {
    const pendingPreview = getPendingImageEditorResultAutoPreview(
      activeTask,
      lastAutoPreviewedResultSignatureRef.current,
    )
    if (!pendingPreview) return
    lastAutoPreviewedResultSignatureRef.current = pendingPreview.signature
    setEditorActiveImageId(pendingPreview.imageId)
  }, [activeTask, setEditorActiveImageId])

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
        if (!useStore.getState().editorCanvasDraft.sourceImageId) {
          useStore.getState().setEditorCanvasDraft({ sourceImageId: image.id, annotations: [] })
        }
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

  const applyMainSource = (imageId: string) => {
    useStore.getState().setSingleAPlusConversion(null)
    const nextSource = inputImages.find((image) => image.id === imageId)
    if (!nextSource) return
    const reordered = [nextSource, ...inputImages.filter((image) => image.id !== imageId)]
    setInputImages(reordered)
    if (maskDraft && maskDraft.targetImageId !== imageId) clearMaskDraft()
    setEditorCanvasDraft({ sourceImageId: imageId, annotations: [] })
    setEditorActiveImageId(imageId)
  }

  const handlePromoteInput = (imageId: string) => {
    if (imageId === mainSourceImageId) return
    if (editorCanvasDraft.annotations.length === 0) {
      applyMainSource(imageId)
      return
    }
    setConfirmDialog({
      title: '切换当前编辑主图？',
      message: '切换主图会清空当前画布标注；不匹配新主图的遮罩也会一并清除。',
      confirmText: '切换主图',
      cancelText: '取消',
      tone: 'warning',
      action: () => applyMainSource(imageId),
    })
  }

  const handlePromoteResult = (imageId: string) => {
    const applyResultSource = () => {
      void openImageEditor(imageId)
    }
    if (editorCanvasDraft.annotations.length === 0) {
      applyResultSource()
      return
    }
    setConfirmDialog({
      title: '将结果图设为当前主图？',
      message: '继续编辑结果图会清空当前画布标注、遮罩、风格参考和残留提示词。',
      confirmText: '设为当前主图',
      cancelText: '取消',
      tone: 'warning',
      action: applyResultSource,
    })
  }

  const handleLocalUpscale = async () => {
    if (!currentImageId || localBusy) return
    let targetSize: ImageUpscaleTargetSize | undefined
    if (upscaleMode === 'custom') {
      if (!customUpscale.plan) {
        showToast(customUpscale.error || '请填写有效的自定义尺寸', 'error')
        return
      }
      targetSize = {
        width: customUpscale.plan.targetWidth,
        height: customUpscale.plan.targetHeight,
      }
    }
    setLocalBusy(true)
    try {
      const task = await createAPlusUpscaleTaskFromImage(currentImageId, sliceFormat, targetSize)
      setEditorActiveTaskId(task.id)
      setEditorActiveImageId(task.outputImages[0] ?? currentImageId)
      showToast(targetSize
        ? `已保存 ${targetSize.width} × ${targetSize.height} 自定义尺寸放大结果`
        : `已保存 ${sliceFormat === 'mobile' ? '手机' : '高级'} A+ 等比放大结果`, 'success')
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

  const getMaterialFallbackImageId = (removedImageId?: string) => {
    return inputImages.find((image) => image.id !== removedImageId)?.id
      ?? (styleReferenceImage?.id !== removedImageId ? styleReferenceImage?.id : null)
      ?? outputImageIds[0]
      ?? null
  }

  const removeMaterialImage = (imageId: string, inputIndex?: number) => {
    const applyRemoval = () => {
      if (useStore.getState().singleAPlusConversion?.sourceImageId === imageId) useStore.getState().setSingleAPlusConversion(null)
      const removingMainSource = imageId === mainSourceImageId
      const nextSourceImageId = removingMainSource
        ? inputImages.find((image) => image.id !== imageId)?.id ?? null
        : mainSourceImageId
      if (inputIndex == null) clearStyleReferenceImage()
      else removeInputImage(inputIndex)
      if (removingMainSource) resetEditorCanvasDraft(nextSourceImageId)
      if (editorActiveImageId === imageId || removingMainSource) {
        setEditorActiveImageId(nextSourceImageId ?? getMaterialFallbackImageId(imageId))
      }
      void deleteImageIfUnreferenced(imageId)
    }

    if (imageId === mainSourceImageId && editorCanvasDraft.annotations.length > 0) {
      setConfirmDialog({
        title: '移除当前主图？',
        message: '移除当前主图会同时清空这张图的画布标注和不匹配的遮罩。',
        confirmText: '移除主图',
        cancelText: '取消',
        tone: 'warning',
        action: applyRemoval,
      })
      return
    }
    applyRemoval()
  }

  const clearMaterials = () => {
    if (!inputImages.length && !styleReferenceImage) return
    const removedImageIds = [...inputImages.map((image) => image.id), ...(styleReferenceImage ? [styleReferenceImage.id] : [])]
    const applyClear = () => {
      clearInputImages()
      clearStyleReferenceImage()
      resetEditorCanvasDraft(null)
      setEditorActiveImageId(outputImageIds[0] ?? null)
      removedImageIds.forEach((imageId) => { void deleteImageIfUnreferenced(imageId) })
    }
    if (editorCanvasDraft.annotations.length > 0) {
      setConfirmDialog({
        title: '清空全部素材？',
        message: '清空素材会同时清除当前主图、画布标注、遮罩和风格参考；历史结果不会被删除。',
        confirmText: '清空素材',
        cancelText: '取消',
        tone: 'warning',
        action: applyClear,
      })
      return
    }
    applyClear()
  }

  const dismissResultImage = (imageId: string) => {
    setHiddenResultImageIds((current) => current.includes(imageId) ? current : [...current, imageId])
    if (editorActiveImageId === imageId) {
      const nextResult = outputImageIds.find((candidateId) => candidateId !== imageId)
      setEditorActiveImageId(nextResult ?? mainSourceImageId ?? inputImages[0]?.id ?? styleReferenceImage?.id ?? null)
    }
  }

  const clearResults = () => {
    if (!taskOutputImageIds.length) return
    setEditorActiveTaskId(null)
    setHiddenResultImageIds([])
    if (editorActiveImageId && taskOutputImageIds.includes(editorActiveImageId)) {
      setEditorActiveImageId(mainSourceImageId ?? inputImages[0]?.id ?? styleReferenceImage?.id ?? null)
    }
    showToast('已清空当前结果列表，历史任务仍然保留', 'success')
  }

  const handleBatchResize = async (imageIds: string[], options: ImageResizeOptions) => {
    if (batchResizeBusy) return
    setBatchResizeBusy(true)
    try {
      const task = await createBatchImageResizeTask(imageIds, options)
      setEditorActiveTaskId(task.id)
      setEditorActiveImageId(task.outputImages[0] ?? null)
      setShowBatchResizeDialog(false)
      showToast(`已调整并保存 ${task.outputImages.length} 张图片`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '批量调整图片尺寸失败', 'error')
    } finally {
      setBatchResizeBusy(false)
    }
  }

  const handlePrepareConversion = (target: APlusOutputConversionTarget) => {
    if (!currentImageId) return
    const sourceTask = tasks.find((task) => task.outputImages.includes(currentImageId))
    setConversionDialog({ sourceImageId: currentImageId, target, count: sourceTask ? getSuggestedAPlusOutputConversionSliceCount(sourceTask) : 1 })
  }

  const confirmConversion = async (count: number) => {
    if (!conversionDialog || conversionBusy) return
    setConversionBusy(true)
    try {
      const prepared = await prepareAPlusConversionFromImage(conversionDialog.sourceImageId, conversionDialog.target, count)
      if (prepared) { setConversionDialog(null); showToast('已准备单图 A+ 转换，其他素材已保留，请确认提示词后提交。', 'success') }
    } catch (error) { showToast(error instanceof Error ? error.message : '准备转换失败', 'error') }
    finally { setConversionBusy(false) }
  }

  const openBatchConversion = () => {
    if (!useStore.getState().aPlusBatchDraft) {
      addAPlusBatchSources(inputImages.map((image, index) => ({ id: image.id, label: image.id === mainSourceImageId ? '当前主图' : `参考素材 ${index + 1}` })), sliceFormat)
    }
    setShowBatchConversion(true)
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
      ref={historySelectionSurfaceRef}
      data-image-editor
      data-drag-select-surface
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
      <div data-no-drag-select className="mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-[1600px] gap-3 lg:grid-cols-[180px_minmax(0,1fr)_380px]">
        <aside className="order-2 flex min-h-0 flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white/75 p-3 shadow-sm dark:border-white/[0.08] dark:bg-gray-900/60 lg:order-1">
          <section className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">素材</h2>
                <p className="mt-0.5 text-[10px] text-gray-400">主图、参考图与风格图</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={clearMaterials} disabled={!inputImages.length && !styleReferenceImage} className="rounded-lg px-2 py-1 text-[10px] font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10">清空</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!canUpload} className="rounded-lg bg-blue-500 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40">上传</button>
              </div>
            </div>
            <div className="flex min-h-[4rem] gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
              {inputImages.map((image, index) => (
                <EditorImageThumb
                  key={image.id}
                  imageId={image.id}
                  dataUrl={image.dataUrl}
                  label={image.id === mainSourceImageId ? '当前主图' : `参考素材 ${index + 1}`}
                  active={currentImageId === image.id}
                  onClick={() => setEditorActiveImageId(image.id)}
                  onRemove={() => removeMaterialImage(image.id, index)}
                />
              ))}
              {styleReferenceImage && (
                <EditorImageThumb
                  imageId={styleReferenceImage.id}
                  dataUrl={styleReferenceImage.dataUrl}
                  label="风格参考"
                  active={currentImageId === styleReferenceImage.id}
                  onClick={() => setEditorActiveImageId(styleReferenceImage.id)}
                  onRemove={() => removeMaterialImage(styleReferenceImage.id)}
                />
              )}
              {!inputImages.length && !styleReferenceImage && <p className="py-4 text-center text-[11px] text-gray-400 lg:px-2">暂无素材</p>}
            </div>
          </section>

          <div className="border-t border-gray-200/80 dark:border-white/[0.08]" />

          <section className="min-h-0 lg:flex lg:flex-1 lg:flex-col">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">结果</h2>
                <p className="mt-0.5 text-[10px] text-gray-400">当前任务输出 · 历史仍保留</p>
              </div>
              <button type="button" onClick={clearResults} disabled={!outputImageIds.length} className="rounded-lg px-2 py-1 text-[10px] font-medium text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-red-500/10">清空</button>
            </div>
            <div className="flex min-h-[4rem] gap-2 overflow-x-auto pb-1 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
              {outputImageIds.map((imageId, index) => (
                <EditorImageThumb
                  key={imageId}
                  imageId={imageId}
                  label={`结果 ${index + 1}`}
                  active={currentImageId === imageId}
                  onClick={() => setEditorActiveImageId(imageId)}
                  onRemove={() => dismissResultImage(imageId)}
                />
              ))}
              {!outputImageIds.length && <p className="py-4 text-center text-[11px] text-gray-400 lg:px-2">暂无结果</p>}
            </div>
          </section>
        </aside>

        <section className="relative order-1 flex min-h-[42vh] min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200/80 bg-[#eef1f5] shadow-sm dark:border-white/[0.08] dark:bg-gray-900/70 lg:order-2 lg:min-h-0">
          {previewSrc ? (
            <div className="flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.92),_rgba(226,230,237,0.85))] dark:bg-[radial-gradient(circle_at_center,_rgba(55,65,81,0.8),_rgba(17,24,39,0.9))]">
              <ImageAnnotationCanvas
                imageId={currentImageId!}
                annotationSourceImageId={mainSourceImageId}
                src={previewSrc}
                annotations={currentImageId === mainSourceImageId ? editorCanvasDraft.annotations : []}
                editable={!singleConversion && currentImageId === mainSourceImageId && Boolean(currentInputImage)}
                outputImageIds={outputImageIds}
                onAnnotationsChange={(annotations) => setEditorCanvasDraft({ annotations })}
                onDimensionsChange={setDimensions}
              />
              {dimensions.width > 0 && (
                <span className="absolute bottom-5 left-5 rounded-lg bg-black/55 px-2 py-1 text-[11px] text-white">
                  {dimensions.width} × {dimensions.height}
                </span>
              )}
              {currentImageId !== mainSourceImageId && (
                <div className="absolute left-5 top-5 flex items-center gap-2 rounded-xl bg-black/60 p-1 pl-2 text-[11px] text-white shadow-lg backdrop-blur-sm">
                  <span>素材预览 · 画布工具仅用于当前主图</span>
                  {(currentInputImage || currentOutputImageId) && (
                    <button
                      type="button"
                      onClick={() => currentInputImage
                        ? handlePromoteInput(currentInputImage.id)
                        : currentOutputImageId && handlePromoteResult(currentOutputImageId)}
                      className="rounded-lg bg-white/15 px-2 py-1 font-semibold transition hover:bg-white/25"
                    >
                      设为当前主图
                    </button>
                  )}
                </div>
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
            <ToolButton onClick={handleOpenMask} disabled={Boolean(singleConversion) || !currentImageId || !currentSourceIsInput} title="在当前输入图片上绘制局部重绘遮罩">
              打开遮罩编辑
            </ToolButton>
            <ToolButton onClick={() => { if (currentOutputImageId) handlePromoteResult(currentOutputImageId) }} disabled={!currentOutputImageId}>
              将当前结果设为主图继续编辑
            </ToolButton>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton onClick={handlePreview} disabled={!currentImageId}>
                预览当前图片
              </ToolButton>
              <ToolButton onClick={() => void handleDownload()} disabled={!currentImageId}>
                下载当前图片
              </ToolButton>
            </div>
            <ToolButton onClick={() => setShowBatchResizeDialog(true)} disabled={batchResizeCandidates.length === 0 || batchResizeBusy} title="多选当前素材和结果图，统一调整尺寸、格式与质量">
              批量调整图片尺寸
            </ToolButton>
            <ToolButton onClick={() => setShowSliceDialog(true)} disabled={!currentImageId || sliceBusy}>
              切割 A+ 母图
            </ToolButton>
            <div className="space-y-2 rounded-xl border border-gray-200/70 bg-white/60 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.025]">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium text-gray-500 dark:text-gray-400">放大方式</span>
                <Select
                  value={upscaleMode}
                  onChange={(value) => setUpscaleMode(value as UpscaleMode)}
                  options={[
                    { label: '等比放大（默认）', value: 'proportional' },
                    { label: '自定义尺寸', value: 'custom' },
                  ]}
                  className="w-full rounded-xl border border-gray-200/60 bg-white/70 px-3 py-1.5 text-xs shadow-sm transition-all duration-200 hover:bg-white dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                />
              </label>
              {upscaleMode === 'custom' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] text-gray-500 dark:text-gray-400">宽度（px）</span>
                      <input
                        type="number"
                        min={dimensions.width || 1}
                        max={MAX_CUSTOM_UPSCALE_EDGE}
                        step={1}
                        value={customUpscaleWidth}
                        onChange={(event) => setCustomUpscaleWidth(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                    <span className="pb-2 text-xs text-gray-400">×</span>
                    <label className="min-w-0">
                      <span className="mb-1 block text-[10px] text-gray-500 dark:text-gray-400">高度（px）</span>
                      <input
                        type="number"
                        min={dimensions.height || 1}
                        max={MAX_CUSTOM_UPSCALE_EDGE}
                        step={1}
                        value={customUpscaleHeight}
                        onChange={(event) => setCustomUpscaleHeight(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100"
                      />
                    </label>
                  </div>
                  <p className={`text-[10px] leading-relaxed ${customUpscale.error ? 'text-red-500 dark:text-red-300' : 'text-gray-400'}`}>
                    {customUpscale.error || '严格输出所填宽高；与原图比例不同时画面会被拉伸。'}
                  </p>
                </div>
              )}
            </div>
            <ToolButton onClick={() => void handleLocalUpscale()} disabled={!currentImageId || localBusy || !selectedUpscalePlan}>
              {localBusy
                ? '正在处理图片…'
                : selectedUpscalePlan
                  ? `${upscaleMode === 'custom' ? '自定义尺寸放大' : '等比放大'}至 ${selectedUpscalePlan.targetWidth} × ${selectedUpscalePlan.targetHeight}`
                  : '放大图片'}
            </ToolButton>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <ToolButton onClick={() => void handlePrepareConversion('premium')} disabled={!currentImageId}>
                转为高级 A+
              </ToolButton>
              <ToolButton onClick={() => void handlePrepareConversion('mobile')} disabled={!currentImageId}>
                转为手机 A+
              </ToolButton>
            </div>
            <ToolButton onClick={openBatchConversion} tone="primary">批量转为 A+</ToolButton>
          </section>

          {activeTask?.error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{activeTask.error}</div>}
          <p className="px-1 text-[10px] leading-relaxed text-gray-400">AI 编辑结果和本地处理结果都会保存到首页任务历史。点击结果缩略图可继续编辑。</p>
        </aside>
      </div>

      <section className="mx-auto mt-6 max-w-[1600px] px-3 sm:px-4 lg:px-0">
        <div className="mb-3 flex flex-col items-stretch justify-between gap-3 px-1 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">图片历史</h2>
            <p className="mt-1 text-xs text-gray-400">复用首页历史结果，也可以将一条任务的全部输出图片加入当前素材。</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              aria-pressed={historyMultiSelectMode}
              onClick={() => {
                if (historyMultiSelectMode) clearSelection()
                setHistoryMultiSelectMode((current) => !current)
              }}
              className={`h-9 rounded-xl border px-3 text-xs font-semibold transition ${historyMultiSelectMode
                ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                : 'border-gray-200 bg-white/80 text-gray-600 hover:border-blue-300 hover:text-blue-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300'}`}
            >
              {historyMultiSelectMode ? '退出多选' : '多选'}
            </button>
            <TaskSelectionToolbar variant="inline" />
          </div>
        </div>
        <TaskGrid
          showUseAsMaterialButton
          multiSelectMode={historyMultiSelectMode}
          disableTaskDrag
          selectionSurfaceRef={historySelectionSurfaceRef}
        />
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
      {conversionDialog && (
        <APlusConversionDialog target={conversionDialog.target} initialPanelCount={conversionDialog.count} busy={conversionBusy}
          onClose={() => { if (!conversionBusy) setConversionDialog(null) }} onConfirm={(count) => void confirmConversion(count)} />
      )}
      {showBatchConversion && <BatchAPlusConversionDialog onClose={() => setShowBatchConversion(false)} />}
      {showBatchResizeDialog && (
        <BatchImageResizeDialog
          candidates={batchResizeCandidates}
          initialWidth={dimensions.width}
          initialHeight={dimensions.height}
          busy={batchResizeBusy}
          onClose={() => { if (!batchResizeBusy) setShowBatchResizeDialog(false) }}
          onConfirm={(imageIds, options) => void handleBatchResize(imageIds, options)}
        />
      )}
    </main>
  )
}
