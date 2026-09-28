import { useEffect, useState, useMemo, useRef } from 'react'
import type { TaskRecord } from '../types'
import { useStore, getCachedImage, ensureImageCached, reuseConfig, openImageEditor, convertOutputToAPlusFormat, createPremiumAPlusSliceTask, createAPlusUpscaleTask, createAPlusBatchUpscaleTask, getSuggestedAPlusOutputConversionSliceCount, removeTask, updateTaskInStore, showCodexCliPrompt, getCodexCliPromptKey, retryTask } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { useTooltip } from '../hooks/useTooltip'
import { formatImageRatio } from '../lib/size'
import { ActualValueBadge, DetailParamValue } from '../lib/paramDisplay'
import { copyImageSourceToClipboard, copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { createMaskPreviewDataUrl } from '../lib/canvasImage'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import { downloadImageIds, downloadImageIdsAsZip } from '../lib/downloadImages'
import { getTaskDisplayPrompt, isAgentTaskPromptPending } from '../lib/taskPromptDisplay'
import { getTaskLoadingPhase } from '../lib/taskLoadingPhase'
import { getAspectLabel, getTaskHistoryCategory, getWorkflowLabel } from '../lib/taskHistory'
import { getAPlusUpscalePlan, type APlusUpscaleFormat } from '../lib/imageUpscaling'
import type { APlusSliceFormat } from '../lib/imageSlicing'
import { CloseIcon, CodeIcon, CopyIcon, DownloadIcon, EditIcon, LinkIcon, TrashIcon } from './icons'

import ViewportTooltip from './ViewportTooltip'
import ImageSliceDialog from './ImageSliceDialog'
import MobileAPlusConversionDialog from './MobileAPlusConversionDialog'

export default function DetailModal() {
  const tasks = useStore((s) => s.tasks)
  const detailTaskId = useStore((s) => s.detailTaskId)
  const setDetailTaskId = useStore((s) => s.setDetailTaskId)
  const setLightboxImageId = useStore((s) => s.setLightboxImageId)
  const setMaskEditorImageId = useStore((s) => s.setMaskEditorImageId)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const settings = useStore((s) => s.settings)
  const dismissedCodexCliPrompts = useStore((s) => s.dismissedCodexCliPrompts)
  const streamPreviewSrc = useStore((s) => detailTaskId ? s.streamPreviews[detailTaskId] || '' : '')
  const streamPreviewSlots = useStore((s) => detailTaskId ? s.streamPreviewSlots[detailTaskId] : undefined)

  const [imageIndex, setImageIndex] = useState(0)
  const [imageSrcs, setImageSrcs] = useState<Record<string, string>>({})
  const [outputPreviewSrcs, setOutputPreviewSrcs] = useState<Record<string, string>>({})
  const [imageRatios, setImageRatios] = useState<Record<string, string>>({})
  const [imageSizes, setImageSizes] = useState<Record<string, string>>({})
  const [maskPreviewSrc, setMaskPreviewSrc] = useState('')
  const [now, setNow] = useState(Date.now())
  const [showRawUrlsModal, setShowRawUrlsModal] = useState(false)
  const [showRawResponseModal, setShowRawResponseModal] = useState(false)
  const [showSliceDialog, setShowSliceDialog] = useState(false)
  const [sliceBusy, setSliceBusy] = useState(false)
  const [showMobileConversionDialog, setShowMobileConversionDialog] = useState(false)
  const [mobileConversionPanelCount, setMobileConversionPanelCount] = useState(1)
  const [mobileConversionBusy, setMobileConversionBusy] = useState(false)
  const [upscaleBusy, setUpscaleBusy] = useState(false)
  const [batchUpscaleBusy, setBatchUpscaleBusy] = useState(false)
  const [streamPreviewLoaded, setStreamPreviewLoaded] = useState(false)
  const [categoryProductInput, setCategoryProductInput] = useState('')
  const [categoryWorkflowInput, setCategoryWorkflowInput] = useState('gallery')
  const modalRef = useRef<HTMLDivElement>(null)
  const rawUrlsModalRef = useRef<HTMLDivElement>(null)
  const rawResponseModalRef = useRef<HTMLDivElement>(null)

  const rawUrlsBackdropPointerDownRef = useRef(false)
  const rawResponseBackdropPointerDownRef = useRef(false)

  const copyErrorTooltip = useTooltip()
  const copyRawUrlsTooltip = useTooltip()
  const viewRawResponseTooltip = useTooltip()
  const downloadPartialImagesTooltip = useTooltip()
  const retryTooltip = useTooltip()
  const downloadImageTooltip = useTooltip()
  const downloadAllTooltip = useTooltip()

  const clearTextSelection = () => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) selection.removeAllRanges()
  }

  const task = useMemo(
    () => tasks.find((t) => t.id === detailTaskId) ?? null,
    [tasks, detailTaskId],
  )
  const streamPreviewItems = useMemo(() => {
    const slotEntries = streamPreviewSlots
      ? Object.entries(streamPreviewSlots)
          .filter(([, src]) => Boolean(src))
          .sort(([a], [b]) => Number(a) - Number(b))
      : []
    const count = Math.max(
      task?.status === 'running' ? task.params.n : 0,
      slotEntries.length ? Math.max(...slotEntries.map(([key]) => Number(key) + 1)) : 0,
      streamPreviewSrc ? 1 : 0,
    )
    const byIndex = new Map(slotEntries.map(([key, src]) => [Number(key), src]))

    return Array.from({ length: count }, (_, index) => ({
      key: String(index),
      src: byIndex.get(index) ?? (index === 0 ? streamPreviewSrc : ''),
    }))
  }, [task?.params.n, task?.status, streamPreviewSlots, streamPreviewSrc])
  const activeStreamPreviewSrc = streamPreviewItems[imageIndex]?.src || ''
  const historyCategory = useMemo(() => task ? getTaskHistoryCategory(task) : null, [task])

  useEffect(() => {
    setStreamPreviewLoaded(false)
  }, [activeStreamPreviewSrc, detailTaskId, imageIndex])

  useEffect(() => {
    if (!task || !historyCategory) return
    setCategoryProductInput(historyCategory.productTitle)
    setCategoryWorkflowInput(task.category?.workflow ?? historyCategory.workflow)
  }, [historyCategory, task])

  useEffect(() => {
    const count = task?.status === 'running'
      ? streamPreviewItems.length
      : task?.outputImages?.length ?? 0
    if (count > 0 && imageIndex >= count) setImageIndex(count - 1)
  }, [imageIndex, streamPreviewItems.length, task?.outputImages?.length, task?.status])

  useCloseOnEscape(Boolean(task) && !showSliceDialog && !showMobileConversionDialog, () => setDetailTaskId(null))
  usePreventBackgroundScroll(Boolean(task), [modalRef, rawUrlsModalRef, rawResponseModalRef])

  // Reset index when task changes
  useEffect(() => {
    setImageIndex(0)
    setShowSliceDialog(false)
    setSliceBusy(false)
    setShowMobileConversionDialog(false)
    setMobileConversionPanelCount(1)
    setMobileConversionBusy(false)
    setUpscaleBusy(false)
    setBatchUpscaleBusy(false)
  }, [detailTaskId])

  useEffect(() => {
    if (task?.status !== 'running' && !(task?.status === 'error' && (task.falRecoverable || task.customRecoverable))) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    setNow(Date.now())
    return () => window.clearInterval(id)
  }, [task?.customRecoverable, task?.falRecoverable, task?.status])

  // 加载所有相关图片
  useEffect(() => {
    if (!task) {
      setImageSrcs({})
      setOutputPreviewSrcs({})
      setImageRatios({})
      setImageSizes({})
      return
    }

    let cancelled = false
    const ids = [...new Set([
      ...(task.inputImageIds || []),
      ...(task.maskImageId ? [task.maskImageId] : []),
    ])]
    const initial: Record<string, string> = {}
    for (const id of ids) {
      const cached = getCachedImage(id)
      if (cached) initial[id] = cached
    }
    setImageSrcs(initial)
    for (const id of ids) {
      if (initial[id]) continue
      ensureImageCached(id).then((url) => {
        if (!cancelled && url) setImageSrcs((prev) => ({ ...prev, [id]: url }))
      })
    }

    return () => {
      cancelled = true
    }
  }, [task])

  const currentOutputImageId = task?.outputImages?.[imageIndex] || ''
  const currentOutputPreviewSrc = currentOutputImageId ? outputPreviewSrcs[currentOutputImageId] || '' : ''
  const maskTargetId = task?.maskTargetImageId || null
  const maskTargetSrc = maskTargetId ? imageSrcs[maskTargetId] || '' : ''
  const maskSrc = task?.maskImageId ? imageSrcs[task.maskImageId] || '' : ''
  const allInputImageIds = task?.inputImageIds ?? []
  const styleReferenceImageId = task?.category?.styleReferenceImageId?.trim() || ''

  useEffect(() => {
    const outputImageIds = task?.outputImages ?? []
    if (outputImageIds.length === 0) {
      setOutputPreviewSrcs({})
      return
    }

    let cancelled = false
    const setOutputImage = (imageId: string, dataUrl: string) => {
      if (!cancelled) setOutputPreviewSrcs((prev) => ({ ...prev, [imageId]: dataUrl }))
    }

    for (const imageId of outputImageIds) {
      const cached = getCachedImage(imageId)
      if (cached) {
        setOutputImage(imageId, cached)
      } else {
        ensureImageCached(imageId)
          .then((dataUrl) => {
            if (dataUrl) setOutputImage(imageId, dataUrl)
          })
          .catch(() => {})
      }
    }

    return () => {
      cancelled = true
    }
  }, [task?.outputImages])

  useEffect(() => {
    let cancelled = false
    setMaskPreviewSrc('')
    if (!maskTargetSrc || !maskSrc) return

    createMaskPreviewDataUrl(maskTargetSrc, maskSrc)
      .then((url) => {
        if (!cancelled) setMaskPreviewSrc(url)
      })
      .catch(() => {
        if (!cancelled) setMaskPreviewSrc('')
      })

    return () => {
      cancelled = true
    }
  }, [maskTargetSrc, maskSrc])

  if (!task) return null

  const isAgentTask = task.sourceMode === 'agent' || Boolean(task.agentConversationId || task.agentRoundId)
  const showPendingPrompt = isAgentTaskPromptPending(task)
  const displayPrompt = getTaskDisplayPrompt(task)
  const isAgentEditTool = task.status === 'done' && String(task.agentToolAction ?? '').toLowerCase() === 'edit'
  const showReferenceSection = allInputImageIds.length > 0 || isAgentEditTool

  const outputLen = task.outputImages?.length || 0
  const currentImageRatio = (currentOutputImageId ? imageRatios[currentOutputImageId] : '') || ''
  const currentImageSize = (currentOutputImageId ? imageSizes[currentOutputImageId] : '') || ''
  const currentActualParams = currentOutputImageId ? task.actualParamsByImage?.[currentOutputImageId] : undefined
  const currentRevisedPrompt = currentOutputImageId ? task.revisedPromptByImage?.[currentOutputImageId]?.trim() : ''
  const showRevisedPrompt = Boolean(currentRevisedPrompt && currentRevisedPrompt !== task.prompt.trim())
  const codexCliPromptKey = getCodexCliPromptKey(settings)
  const hasHandledPromptWarning = settings.codexCli || dismissedCodexCliPrompts.includes(codexCliPromptKey)
  const taskProvider = task.apiProvider
  const isOpenAiTask = (taskProvider ?? 'openai') === 'openai'
  const showPromptWarning = Boolean(isOpenAiTask && task.apiMode === 'responses' && currentOutputImageId && (!currentRevisedPrompt || showRevisedPrompt) && !hasHandledPromptWarning)
  const taskProviderName = taskProvider === 'fal' ? 'fal.ai' : taskProvider ? 'OpenAI' : '未知'
  const taskProfileName = task.apiProfileName || '未知'
  const taskModel = task.apiModel || '未知'
  const showSourceInfo = Boolean(task.apiProvider || task.apiProfileName || task.apiModel)
  const isFalReconnecting = task.status === 'error' && task.falRecoverable
  const isCustomReconnecting = task.status === 'error' && task.customRecoverable
  const rawImageUrls = task.rawImageUrls ?? []
  const isDownloadingImage = getTaskLoadingPhase(task) === 'downloading'
  const streamPreviewLen = streamPreviewItems.length
  const currentStreamPreviewSrc = activeStreamPreviewSrc
  const streamPartialImageIds = task.streamPartialImageIds ?? []
  const currentHistoryCategory = historyCategory ?? getTaskHistoryCategory(task)
  const aPlusUpscaleFormat: APlusUpscaleFormat | null = currentHistoryCategory.workflow === 'amazon-aplus'
    && (currentHistoryCategory.aPlusType === 'premium' || currentHistoryCategory.aPlusType === 'mobile')
    ? currentHistoryCategory.aPlusType
    : null
  const currentImageDimensionMatch = currentImageSize.match(/^(\d+)\s*[xX×]\s*(\d+)$/)
  const currentUpscalePlan = aPlusUpscaleFormat && currentImageDimensionMatch
    ? getAPlusUpscalePlan(Number(currentImageDimensionMatch[1]), Number(currentImageDimensionMatch[2]), aPlusUpscaleFormat)
    : null
  const categoryChanged =
    categoryProductInput.trim() !== currentHistoryCategory.productTitle ||
    categoryWorkflowInput !== (task.category?.workflow ?? currentHistoryCategory.workflow)

  const formatTime = (ts: number | null) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString('zh-CN')
  }

  const formatDuration = () => {
    if (task.status === 'running' || isFalReconnecting || isCustomReconnecting) {
      const seconds = Math.max(0, Math.floor((now - task.createdAt) / 1000))
      const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
      const ss = String(seconds % 60).padStart(2, '0')
      return `${mm}:${ss}`
    }
    if (task.elapsed == null) return null
    const seconds = Math.floor(task.elapsed / 1000)
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
    const ss = String(seconds % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  const handleReuse = () => {
    reuseConfig(task)
    setDetailTaskId(null)
  }

  const handleEdit = async () => {
    const imageId = currentOutputImageId || task.outputImages?.[0]
    if (!imageId) return
    const opened = await openImageEditor(imageId)
    if (opened) setDetailTaskId(null)
  }

  const handleConvertToPremiumAPlus = async () => {
    const converted = await convertOutputToAPlusFormat(task, currentOutputImageId || undefined, 'premium')
    if (converted) setDetailTaskId(null)
  }

  const handleOpenMobileConversion = () => {
    setMobileConversionPanelCount(getSuggestedAPlusOutputConversionSliceCount(task))
    setShowMobileConversionDialog(true)
  }

  const handleConfirmMobileConversion = async (panelCount: number) => {
    if (mobileConversionBusy) return
    setMobileConversionBusy(true)
    try {
      const converted = await convertOutputToAPlusFormat(task, currentOutputImageId || undefined, 'mobile', panelCount)
      if (converted) {
        setShowMobileConversionDialog(false)
        setDetailTaskId(null)
      }
    } finally {
      setMobileConversionBusy(false)
    }
  }

  const handleUpscaleCurrentOutput = async () => {
    if (!currentOutputImageId || !aPlusUpscaleFormat || upscaleBusy || batchUpscaleBusy) return
    setUpscaleBusy(true)
    try {
      const upscaledTask = await createAPlusUpscaleTask(task, currentOutputImageId, aPlusUpscaleFormat)
      const outputSize = upscaledTask.actualParams?.size ?? upscaledTask.params.size
      showToast(`已等比放大并保存为 ${outputSize}`, 'success')
      setDetailTaskId(upscaledTask.id)
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : '图片放大失败', 'error')
    } finally {
      setUpscaleBusy(false)
    }
  }

  const handleBatchUpscaleOutputs = async () => {
    if (!aPlusUpscaleFormat || outputLen < 2 || upscaleBusy || batchUpscaleBusy) return
    setBatchUpscaleBusy(true)
    try {
      const upscaledTask = await createAPlusBatchUpscaleTask(task, task.outputImages, aPlusUpscaleFormat)
      showToast(`已批量等比放大并保存 ${upscaledTask.outputImages.length} 张图片`, 'success')
      setDetailTaskId(upscaledTask.id)
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : '批量放大失败', 'error')
    } finally {
      setBatchUpscaleBusy(false)
    }
  }

  const handleMaskEditCurrentOutput = () => {
    const imgId = task.outputImages?.[imageIndex]
    if (!imgId) return
    setMaskEditorImageId(imgId)
    setDetailTaskId(null)
  }

  const handleDelete = () => {
    setDetailTaskId(null)
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条记录吗？关联的图片资源也会被清理（如果没有其他任务引用）。',
      action: () => removeTask(task),
    })
  }

  const handleToggleFavorite = () => {
    updateTaskInStore(task.id, { isFavorite: !task.isFavorite })
  }

  const handleSaveCategory = () => {
    updateTaskInStore(task.id, {
      category: {
        ...task.category,
        productTitle: categoryProductInput.trim(),
        workflow: categoryWorkflowInput as NonNullable<TaskRecord['category']>['workflow'],
      },
    })
    showToast('分类已保存', 'success')
  }

  const handleCopyError = async () => {
    const errorText = task.error || '生成失败'
    try {
      await copyTextToClipboard(errorText)
      showToast('完整报错已复制', 'success')
    } catch (err) {
      showToast(getClipboardFailureMessage('复制报错失败', err), 'error')
    }
  }

  const handleCopyRawImageUrl = async (url: string, index?: number) => {
    try {
      await copyTextToClipboard(url)
      showToast(index == null ? '图片 URL 已复制' : `图片 ${index + 1} URL 已复制`, 'success')
    } catch (err) {
      showToast(getClipboardFailureMessage('复制图片 URL 失败', err), 'error')
    }
  }

  const handleCopyAllRawImageUrls = async () => {
    if (!rawImageUrls.length) return
    try {
      await copyTextToClipboard(rawImageUrls.join('\n'))
      showToast(`已复制 ${rawImageUrls.length} 条图片 URL`, 'success')
    } catch (err) {
      showToast(getClipboardFailureMessage('复制全部图片 URL 失败', err), 'error')
    }
  }

  const handleCopyPrompt = async () => {
    if (!displayPrompt) return
    try {
      await copyTextToClipboard(displayPrompt)
      showToast('提示词已复制', 'success')
    } catch (err) {
      showToast(getClipboardFailureMessage('复制提示词失败', err), 'error')
    }
  }

  const handleShowPromptWarning = () => {
    showCodexCliPrompt(
      true,
      currentRevisedPrompt ? '接口返回的提示词已被改写' : '接口没有返回官方 API 会返回的部分信息',
    )
  }

  const handleCopyInputImage = async () => {
    const imgId = allInputImageIds[0]
    const src = imgId ? imageSrcs[imgId] : ''
    if (!src) return
    try {
      await copyImageSourceToClipboard(src)
      showToast('参考图已复制', 'success')
    } catch (err) {
      console.error(err)
      showToast(getClipboardFailureMessage('复制参考图失败', err), 'error')
    }
  }

  const handleDownloadCurrentOutput = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentOutputImageId || !task) return

    try {
      const result = await downloadImageIds([currentOutputImageId], `task-${task.id}`)
      if (result.successCount === 0) {
        showToast('下载失败', 'error')
      } else {
        showToast('下载成功', 'success')
      }
    } catch (err) {
      console.error(err)
      showToast('下载失败', 'error')
    }
  }

  const handleDownloadAllOutputs = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!task?.outputImages?.length) return

    try {
      const result = await downloadImageIds(task.outputImages, `task-${task.id}`)
      if (result.successCount === 0) {
        showToast('下载失败', 'error')
      } else if (result.failCount > 0) {
        showToast(`部分下载失败：成功 ${result.successCount}，失败 ${result.failCount}`, 'error')
      } else {
        showToast(result.successCount > 1 ? `下载成功：${result.successCount} 张图片` : '下载成功', 'success')
      }
    } catch (err) {
      console.error(err)
      showToast('下载失败', 'error')
    }
  }

  const handleDownloadSliceZip = async () => {
    if (!task?.derivation || task.outputImages.length === 0) return
    try {
      const result = await downloadImageIdsAsZip(
        task.outputImages,
        `${task.derivation.type.startsWith('mobile-') ? 'mobile' : 'premium'}-aplus-slices-${task.derivation.sliceCount}-${task.id}`,
      )
      if (result.successCount === 0) {
        showToast('打包下载失败', 'error')
      } else if (result.failCount > 0) {
        showToast(`部分图片打包失败：成功 ${result.successCount}，失败 ${result.failCount}`, 'error')
      } else {
        showToast(`已打包下载 ${result.successCount} 张切片`, 'success')
      }
    } catch (err) {
      console.error(err)
      showToast('打包下载失败', 'error')
    }
  }

  const handleConfirmSlice = async (sliceCount: number, sliceFormat: APlusSliceFormat) => {
    if (!task || !currentOutputImageId || sliceBusy) return
    setSliceBusy(true)
    try {
      const derivedTask = await createPremiumAPlusSliceTask(task, currentOutputImageId, sliceCount, sliceFormat)
      showToast(`已切割并保存 ${derivedTask.outputImages.length} 张${sliceFormat === 'mobile' ? '手机' : '高级'} A+ 图片`, 'success')
      setShowSliceDialog(false)
      setDetailTaskId(derivedTask.id)
    } catch (err) {
      console.error(err)
      showToast(err instanceof Error ? err.message : '切割失败', 'error')
    } finally {
      setSliceBusy(false)
    }
  }

  const handleDownloadPartialImages = async () => {
    if (!task || !streamPartialImageIds.length) return

    try {
      const result = await downloadImageIds(streamPartialImageIds, `task-${task.id}-partial`)
      if (result.successCount === 0) {
        showToast('下载失败', 'error')
      } else if (result.failCount > 0) {
        showToast(`部分下载失败：成功 ${result.successCount}，失败 ${result.failCount}`, 'error')
      } else {
        showToast(`下载成功：${result.successCount} 张中间步骤图`, 'success')
      }
    } catch (err) {
      console.error(err)
      showToast('下载失败', 'error')
    }
  }

  const handleRetry = () => {
    retryTask(task)
    setDetailTaskId(null)
  }

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => setDetailTaskId(null)}
    >
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-md animate-overlay-in" />
      <div
        ref={modalRef}
        className="relative bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-white/50 dark:border-white/[0.08] rounded-3xl shadow-[0_8px_40px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgb(0,0,0,0.4)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row z-10 ring-1 ring-black/5 dark:ring-white/10 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 items-center justify-end px-4 md:hidden">
          <button
            onClick={() => setDetailTaskId(null)}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-gray-400"
            aria-label="关闭"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 左侧：图片 */}
        <div className="md:w-1/2 w-full h-64 md:h-auto bg-gray-100 dark:bg-black/20 relative flex items-center justify-center flex-shrink-0 min-h-[16rem]">
          {task.status === 'done' && outputLen > 0 && (
            <div className="absolute right-3 top-[15px] z-20 flex items-center gap-1.5">
              <div className="relative group flex">
                <button
                  type="button"
                  {...downloadImageTooltip.handlers}
                  onClick={(e) => {
                    downloadImageTooltip.handlers.onClick()
                    handleDownloadCurrentOutput(e)
                  }}
                    className="flex items-center justify-center px-1.5 py-0.5 bg-black/50 text-white rounded backdrop-blur-sm hover:bg-black/70 transition focus:outline-none focus:ring-1 focus:ring-white/50"
                  aria-label="下载图片"
                >
                  <DownloadIcon className="h-4 w-4" />
                </button>
                <ViewportTooltip visible={downloadImageTooltip.visible} className="whitespace-nowrap">
                  下载图片
                </ViewportTooltip>
              </div>
              {outputLen > 1 && (
                <div className="relative group flex">
                  <button
                    type="button"
                    {...downloadAllTooltip.handlers}
                    onClick={(e) => {
                      downloadAllTooltip.handlers.onClick()
                      handleDownloadAllOutputs(e)
                    }}
                    className="flex items-center justify-center pl-1.5 pr-2 py-0.5 gap-0.5 bg-black/50 text-white rounded backdrop-blur-sm hover:bg-black/70 transition focus:outline-none focus:ring-1 focus:ring-white/50"
                    aria-label="下载全部"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    <span className="text-[9px] font-bold leading-none mt-[1px]">ALL</span>
                  </button>
                  <ViewportTooltip visible={downloadAllTooltip.visible} className="whitespace-nowrap">
                    下载全部
                  </ViewportTooltip>
                </div>
              )}
            </div>
          )}
          {task.status === 'done' && outputLen > 0 && currentOutputPreviewSrc && (
            <>
              <img
                src={currentOutputPreviewSrc}
                data-image-id={currentOutputImageId}
                className="saveable-image max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] object-contain cursor-pointer"
                onLoad={(e) => {
                  const image = e.currentTarget
                  if (currentOutputImageId && image.naturalWidth > 0 && image.naturalHeight > 0) {
                    setImageRatios((prev) => ({
                      ...prev,
                      [currentOutputImageId]: formatImageRatio(image.naturalWidth, image.naturalHeight),
                    }))
                    setImageSizes((prev) => ({
                      ...prev,
                      [currentOutputImageId]: `${image.naturalWidth}×${image.naturalHeight}`,
                    }))
                  }
                }}
                onClick={() =>
                  setLightboxImageId(task.outputImages[imageIndex], task.outputImages)
                }
                alt=""
              />
              <div data-selectable-text className="absolute left-4 top-[15px] flex items-center gap-1.5">
                {currentImageRatio && currentImageSize ? (
                  <>
                    <span className="bg-black/50 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm font-mono">
                      {currentImageRatio}
                    </span>
                    <span className="bg-black/50 text-white/90 text-xs px-2 py-0.5 rounded backdrop-blur-sm font-medium">
                      {currentImageSize}
                    </span>
                  </>
                ) : (
                  formatDuration() && (
                    <span className="flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm font-mono">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatDuration()}
                    </span>
                  )
                )}
              </div>
              {outputLen > 1 && (
                <>
                  <button
                    onClick={() =>
                      setImageIndex(
                        (imageIndex - 1 + outputLen) % outputLen,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setImageIndex((imageIndex + 1) % outputLen)
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                    {imageIndex + 1} / {outputLen}
                  </span>
                </>
              )}
            </>
          )}
          {(task.status === 'running' || isFalReconnecting) && (
            <>
              <div className="absolute left-4 top-4 flex items-center gap-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded backdrop-blur-sm font-mono">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration()}
              </div>
              {task.status === 'running' && streamPreviewLen > 0 && (
                <>
                  {currentStreamPreviewSrc ? (
                    <img
                      src={currentStreamPreviewSrc}
                      className={`max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] object-contain ${streamPreviewLoaded ? '' : 'hidden'}`}
                      alt=""
                      onLoad={() => setStreamPreviewLoaded(true)}
                      onError={() => setStreamPreviewLoaded(false)}
                    />
                  ) : null}
                  {(!currentStreamPreviewSrc || !streamPreviewLoaded) && (
                    <div className="flex flex-col items-center gap-2">
                      <svg className={`h-10 w-10 animate-spin ${isDownloadingImage ? 'text-emerald-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className={`text-sm font-medium ${isDownloadingImage ? 'text-emerald-300' : 'text-white/75'}`}>
                        {isDownloadingImage ? '下载中...' : '生成中...'}
                      </span>
                    </div>
                  )}
                  {streamPreviewLoaded && (
                    <span className={`absolute top-4 right-4 flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm ${isDownloadingImage ? 'bg-emerald-600' : 'bg-blue-500'}`}>
                      {isDownloadingImage ? '下载中 · 流式预览' : '流式预览'}
                    </span>
                  )}
                  {streamPreviewLen > 1 && (
                    <>
                      <button
                        onClick={() => setImageIndex((imageIndex - 1 + streamPreviewLen) % streamPreviewLen)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setImageIndex((imageIndex + 1) % streamPreviewLen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                        {imageIndex + 1} / {streamPreviewLen}
                      </span>
                    </>
                  )}
                </>
              )}
              {task.status === 'running' && streamPreviewLen === 0 && (
                <div className="flex flex-col items-center gap-2">
                  <svg className={`h-10 w-10 animate-spin ${isDownloadingImage ? 'text-emerald-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className={`text-sm font-medium ${isDownloadingImage ? 'text-emerald-300' : 'text-white/75'}`}>
                    {isDownloadingImage ? '下载中...' : '生成中...'}
                  </span>
                </div>
              )}
            </>
          )}
          {task.status === 'error' && isFalReconnecting && (
            <div className="w-full max-w-md px-4 text-center">
              <svg className="w-10 h-10 text-yellow-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-sm font-medium text-yellow-500">重连中</p>
            </div>
          )}
          {task.status === 'error' && !isFalReconnecting && (
            <div className="w-full max-w-md px-4 text-center">
              <svg className="w-10 h-10 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p
                className="overflow-hidden whitespace-pre-line text-sm leading-6 text-red-500 break-words"
                style={{
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 10,
                }}
              >
                {task.error || '生成失败'}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="relative group">
                  <button
                    type="button"
                    {...copyErrorTooltip.handlers}
                    onClick={(e) => {
                      copyErrorTooltip.handlers.onClick()
                      handleCopyError()
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-red-200/80 bg-white/80 px-3 py-1.5 text-red-500 transition hover:bg-red-50 dark:border-red-400/20 dark:bg-white/[0.04] dark:hover:bg-red-500/10"
                    aria-label="复制完整报错"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </button>
                  <ViewportTooltip visible={copyErrorTooltip.visible} className="whitespace-nowrap">
                    复制完整报错
                  </ViewportTooltip>
                </div>
                {task.rawResponsePayload && (
                  <div className="relative group">
                    <button
                      type="button"
                      {...viewRawResponseTooltip.handlers}
                      onClick={(e) => {
                        dismissAllTooltips()
                        setShowRawResponseModal(true)
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-purple-200/80 bg-purple-50 px-3 py-1.5 text-purple-600 transition hover:bg-purple-100 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-400 dark:hover:bg-purple-500/20"
                      aria-label="查看原始响应"
                    >
                      <CodeIcon className="h-4 w-4" />
                    </button>
                    <ViewportTooltip visible={viewRawResponseTooltip.visible} className="whitespace-nowrap">
                      查看原始响应
                    </ViewportTooltip>
                  </div>
                )}
                {task.rawImageUrls && task.rawImageUrls.length > 0 && (
                  <div className="relative group">
                    <button
                      type="button"
                      {...copyRawUrlsTooltip.handlers}
                      onClick={async (e) => {
                        if (task.rawImageUrls!.length === 1) {
                          copyRawUrlsTooltip.handlers.onClick()
                          await handleCopyRawImageUrl(task.rawImageUrls![0])
                        } else {
                          dismissAllTooltips()
                          setShowRawUrlsModal(true)
                        }
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-green-200/80 bg-green-50 px-3 py-1.5 text-green-600 transition hover:bg-green-100 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
                      aria-label="复制图片链接"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </button>
                    <ViewportTooltip visible={copyRawUrlsTooltip.visible} className="whitespace-nowrap">
                      复制图片链接
                    </ViewportTooltip>
                  </div>
                )}
                {streamPartialImageIds.length > 0 && (
                  <div className="relative group">
                    <button
                      type="button"
                      {...downloadPartialImagesTooltip.handlers}
                      onClick={(e) => {
                        downloadPartialImagesTooltip.handlers.onClick()
                        void handleDownloadPartialImages()
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-amber-600 transition hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                      aria-label="下载中间步骤图"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>
                    <ViewportTooltip visible={downloadPartialImagesTooltip.visible} className="whitespace-nowrap">
                      下载中间步骤图
                    </ViewportTooltip>
                  </div>
                )}
                <div className="relative group">
                  <button
                    type="button"
                    {...retryTooltip.handlers}
                    onClick={(e) => {
                      retryTooltip.handlers.onClick()
                      handleRetry()
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-blue-200/80 bg-white/80 px-3 py-1.5 text-blue-500 transition hover:bg-blue-50 dark:border-blue-400/20 dark:bg-white/[0.04] dark:hover:bg-blue-500/10"
                    aria-label="重试任务"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <ViewportTooltip visible={retryTooltip.visible} className="whitespace-nowrap">
                    重试任务
                  </ViewportTooltip>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：信息 */}
        <div className="md:w-1/2 w-full p-5 overflow-y-auto overscroll-contain flex flex-col">
          <button
            onClick={() => setDetailTaskId(null)}
            className="absolute top-3 right-3 hidden p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] transition text-gray-400 z-10 md:block"
            aria-label="关闭"
          >
            <CloseIcon className="w-5 h-5" />
          </button>

          <div data-selectable-text className="contents">
            {rawImageUrls.length > 0 && (
              <section className="order-2 mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">图片下载 URL</h3>
                      <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">后台已返回</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/75 dark:text-emerald-200/75">
                      {task.status === 'running'
                        ? '图片服务已返回地址，浏览器正在下载到本机；网速较慢时可先复制链接打开。'
                        : '这是图片服务返回的原始地址，可复制到其他网络环境打开或下载。'}
                    </p>
                  </div>
                  {rawImageUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleCopyAllRawImageUrls()}
                      className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-400/20 dark:bg-gray-900 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                      复制全部
                    </button>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {rawImageUrls.map((url, index) => (
                    <div key={`${url}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-emerald-200/80 bg-white/90 p-2 dark:border-emerald-400/15 dark:bg-gray-950/70">
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">{index + 1}</span>
                      <input
                        readOnly
                        value={url}
                        onFocus={(event) => event.currentTarget.select()}
                        aria-label={`图片 ${index + 1} 下载 URL`}
                        className="h-8 min-w-0 w-full rounded-md border border-gray-200 bg-gray-50 px-2 font-mono text-[11px] text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCopyRawImageUrl(url, index)}
                        aria-label={`复制图片 ${index + 1} 下载 URL`}
                        title="复制 URL"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-400/15"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="order-4">
            <div className="flex items-center gap-1.5 mb-2">
              <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                输入内容
              </h3>
              {displayPrompt && !showPendingPrompt && (
                <button
                  onClick={handleCopyPrompt}
                  className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/[0.06] transition"
                  title="复制提示词"
                >
                  <CopyIcon className="h-4 w-4" />
                </button>
              )}
              {showPromptWarning && (
                <span className="relative inline-flex">
                  <button
                    type="button"
                    className="p-1 rounded text-amber-500 hover:bg-amber-50 dark:text-yellow-300 dark:hover:bg-yellow-500/10 transition"
                    onClick={handleShowPromptWarning}
                    aria-label="提示词已被改写"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
            {showPendingPrompt ? (
              <div className="mb-4 leading-relaxed">
                <p className="text-sm text-gray-700 dark:text-gray-300">正在生成……</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">输入内容将在响应完成时接收</p>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">
                {displayPrompt || '(无提示词)'}
              </p>
            )}
            {showRevisedPrompt && currentRevisedPrompt && (
              <div className="mb-4">
                <ActualValueBadge
                  value={currentRevisedPrompt}
                  className="max-w-full rounded px-2 py-1 text-left text-xs leading-relaxed whitespace-pre-wrap"
                />
              </div>
            )}
            </section>

            {/* 参考图 */}
            {showReferenceSection && (
              <div className="order-3 mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    参考图
                  </h3>
                  {allInputImageIds.length > 0 && (
                    <button
                      onClick={handleCopyInputImage}
                      className="p-1 rounded text-gray-400 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-white/[0.06] transition"
                      title="复制参考图"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {allInputImageIds.length > 0 ? (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {allInputImageIds.map((imgId) => {
                        const isMaskTarget = imgId === maskTargetId
                        const isStyleReference = imgId === styleReferenceImageId
                        const displaySrc = (isMaskTarget && maskPreviewSrc) ? maskPreviewSrc : (imageSrcs[imgId] || '')
                        return (
                          <div key={imgId} className="relative group inline-block">
                            <div
                              className={`relative w-16 h-16 rounded-lg overflow-hidden border cursor-pointer hover:opacity-80 transition ${
                                isMaskTarget ? 'border-blue-500 border-2 shadow-sm' : 'border-gray-200 dark:border-white/[0.08]'
                              }`}
                              onClick={() => setLightboxImageId(imgId, allInputImageIds)}
                            >
                              {displaySrc && (
                                <img
                                  src={displaySrc}
                                  data-image-id={imgId}
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              )}
                              {isMaskTarget && (
                                <span className="absolute left-1 top-1 rounded bg-blue-500/90 px-1.5 py-0.5 text-[8px] leading-none text-white font-bold tracking-wider backdrop-blur-sm z-10 pointer-events-none">
                                  MASK
                                </span>
                              )}
                              {isStyleReference && !isMaskTarget && (
                                <span className="absolute left-1 top-1 rounded bg-violet-500/90 px-1.5 py-0.5 text-[8px] leading-none text-white font-bold tracking-wider backdrop-blur-sm z-10 pointer-events-none">
                                  STYLE
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {isAgentEditTool && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        由模型自主选择，可能包含其他图片
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    由模型自主选择
                  </div>
                )}
              </div>
            )}

            {/* 分类 */}
            <section className="order-5">
            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              分类
            </h3>
            <div className="mb-4 rounded-lg bg-gray-50 px-3 py-3 text-xs dark:bg-white/[0.03]">
              <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                <label className="min-w-0">
                  <span className="mb-1 block text-gray-400 dark:text-gray-500">商品</span>
                  <input
                    value={categoryProductInput}
                    onChange={(event) => setCategoryProductInput(event.target.value)}
                    placeholder="未识别商品"
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-gray-400 dark:text-gray-500">来源</span>
                  <select
                    value={categoryWorkflowInput}
                    onChange={(event) => setCategoryWorkflowInput(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
                  >
                    <option value="amazon-listing">Listing 图</option>
                    <option value="amazon-aplus">A+ 图</option>
                    <option value="gallery">普通生图</option>
                    <option value="agent">Agent</option>
                    <option value="unknown">未知来源</option>
                  </select>
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-gray-500 dark:text-gray-400">
                <span>{getWorkflowLabel(currentHistoryCategory.workflow)}</span>
                <span>·</span>
                <span>{getAspectLabel(currentHistoryCategory.aspect)}</span>
                {currentHistoryCategory.amazonSlot && (
                  <>
                    <span>·</span>
                    <span>{currentHistoryCategory.amazonSlot}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={!categoryChanged}
                className="mt-3 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-white/[0.08] dark:disabled:text-gray-500"
              >
                保存分类
              </button>
            </div>
            </section>

            {/* 参数 */}
            <section className="order-2">
            <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              参数配置
            </h3>
            {showSourceInfo && (
              <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-white/[0.03]">
                <span className="text-gray-400 dark:text-gray-500">来源</span>
                <br />
                <span className="font-medium text-gray-700 dark:text-gray-200">{taskProviderName}</span>
                <span className="text-gray-400 dark:text-gray-500"> · {taskProfileName} · {taskModel}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-gray-400 dark:text-gray-500">尺寸</span>
                <br />
                <DetailParamValue task={task} paramKey="size" className="font-medium" actualParams={currentActualParams} />
              </div>
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-gray-400 dark:text-gray-500">质量</span>
                <br />
                <DetailParamValue task={task} paramKey="quality" className="font-medium" actualParams={currentActualParams} />
              </div>
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-gray-400 dark:text-gray-500">格式</span>
                <br />
                <DetailParamValue task={task} paramKey="output_format" className="font-medium" actualParams={currentActualParams} />
              </div>
              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-gray-400 dark:text-gray-500">审核</span>
                <br />
                <DetailParamValue task={task} paramKey="moderation" className="font-medium" actualParams={currentActualParams} />
              </div>
              {!isAgentTask && (
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-gray-400 dark:text-gray-500">数量</span>
                  <br />
                  <DetailParamValue task={task} paramKey="n" className="font-medium" />
                </div>
              )}
              {task.params.output_compression != null && (
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2">
                  <span className="text-gray-400 dark:text-gray-500">压缩率</span>
                  <br />
                  <DetailParamValue task={task} paramKey="output_compression" className="font-medium" actualParams={currentActualParams} />
                </div>
              )}
            </div>
            </section>

            {/* 时间 */}
            <div className="order-6 text-xs text-gray-400 dark:text-gray-500 mb-4">
              <span>创建于 {formatTime(task.createdAt)}</span>
              {formatDuration() && <span> · 耗时 {formatDuration()}</span>}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="order-1 mb-4 space-y-2 border-b border-gray-100 pb-4 md:pr-8 dark:border-white/[0.08]">
            {task.derivation ? (
              <button
                type="button"
                onClick={handleDownloadSliceZip}
                disabled={task.outputImages.length === 0}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
              >
                <DownloadIcon className="h-4 w-4" />
                打包下载 {task.derivation.sliceCount} 张切片
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSliceDialog(true)}
                disabled={!currentOutputImageId || !currentOutputPreviewSrc}
                className="flex w-full items-center justify-center rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
              >
                切割 A+ 母图
              </button>
            )}
            {aPlusUpscaleFormat && (
              <div className={`grid gap-2 ${outputLen > 1 ? 'sm:grid-cols-2' : ''}`}>
                <button
                  type="button"
                  onClick={() => void handleUpscaleCurrentOutput()}
                  disabled={!currentOutputImageId || !currentOutputPreviewSrc || !currentUpscalePlan || upscaleBusy || batchUpscaleBusy}
                  title="使用浏览器 Canvas 等比放大当前图片并保存为新任务，不调用 AI 接口"
                  className="flex w-full items-center justify-center rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
                >
                  {upscaleBusy
                    ? '正在放大当前图片...'
                    : currentUpscalePlan
                      ? `当前图放大到 ${currentUpscalePlan.targetWidth}x${currentUpscalePlan.targetHeight}`
                      : '放大当前图片'}
                </button>
                {outputLen > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleBatchUpscaleOutputs()}
                    disabled={upscaleBusy || batchUpscaleBusy}
                    title="逐张等比放大当前任务的全部图片，并保存到同一条新任务"
                    className="flex w-full items-center justify-center rounded-xl bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-500/10 dark:text-teal-300 dark:hover:bg-teal-500/20"
                  >
                    {batchUpscaleBusy ? `正在批量放大 ${outputLen} 张...` : `批量等比放大 ${outputLen} 张`}
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => void handleConvertToPremiumAPlus()}
                disabled={!outputLen}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-600 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
              >
                转为高级A+
              </button>
              <button
                onClick={handleOpenMobileConversion}
                disabled={!outputLen}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
              >
                转为手机A+
              </button>
            </div>
            <div className="grid grid-cols-4 sm:flex gap-2">
              <button
                onClick={handleReuse}
                className="col-span-2 sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition text-sm font-medium whitespace-nowrap"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                复用配置
              </button>
              <button
                onClick={handleEdit}
                disabled={!outputLen}
                className="col-span-2 sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition text-sm font-medium whitespace-nowrap"
              >
                <EditIcon className="w-4 h-4 flex-shrink-0" />
                编辑输出
              </button>
              <button
                onClick={handleDelete}
                className="col-span-3 sm:flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition text-sm font-medium whitespace-nowrap"
              >
                <TrashIcon className="w-4 h-4 flex-shrink-0" />
                删除记录
              </button>
              <button
                onClick={handleToggleFavorite}
                className={`col-span-1 sm:flex-none sm:w-11 w-full flex items-center justify-center rounded-xl transition ${
                  task.isFavorite
                    ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20'
                    : 'bg-gray-50 text-gray-400 hover:bg-yellow-50 hover:text-yellow-500 dark:bg-white/[0.04] dark:hover:bg-yellow-500/10'
                }`}
                title={task.isFavorite ? '取消收藏' : '收藏记录'}
              >
                <svg className="w-5 h-5" fill={task.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showSliceDialog && currentOutputPreviewSrc && (
        <ImageSliceDialog
          source={currentOutputPreviewSrc}
          initialSliceCount={task.category?.aPlusPlanContext?.sliceCount ?? 2}
          format={task.category?.aPlusType === 'mobile' ? 'mobile' : 'premium'}
          allowFormatSelection
          busy={sliceBusy}
          onClose={() => {
            if (!sliceBusy) setShowSliceDialog(false)
          }}
          onConfirm={handleConfirmSlice}
        />
      )}

      {showMobileConversionDialog && (
        <MobileAPlusConversionDialog
          initialPanelCount={mobileConversionPanelCount}
          busy={mobileConversionBusy}
          onClose={() => {
            if (!mobileConversionBusy) setShowMobileConversionDialog(false)
          }}
          onConfirm={(panelCount) => void handleConfirmMobileConversion(panelCount)}
        />
      )}

      {showRawUrlsModal && rawImageUrls.length > 0 && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm sm:p-6"
          onPointerDown={(e) => {
            rawUrlsBackdropPointerDownRef.current = e.target === e.currentTarget
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (rawUrlsBackdropPointerDownRef.current && e.target === e.currentTarget) setShowRawUrlsModal(false)
            rawUrlsBackdropPointerDownRef.current = false
          }}
        >
          <div ref={rawUrlsModalRef} className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#1c1c1e]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.08] shrink-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">原始图片链接 ({rawImageUrls.length})</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyAllRawImageUrls()}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-xs font-medium"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                  全部复制
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawUrlsModal(false)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-white/[0.08] dark:hover:text-gray-300 transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 bg-gray-50/50 dark:bg-black/20 overscroll-contain">
              <div className="space-y-2.5">
                {rawImageUrls.map((url, i) => (
                  <div key={i} className="group flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="text-xs font-medium text-gray-400 dark:text-gray-500">
                        图片 {i + 1}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 truncate select-text" title={url}>
                        {url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyRawImageUrl(url, i)}
                      className="flex-shrink-0 p-2 sm:px-3 sm:py-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-xs font-medium border border-transparent dark:border-white/[0.04]"
                      title="复制链接"
                    >
                      <CopyIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span className="hidden sm:inline">复制</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showRawResponseModal && task?.rawResponsePayload && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm sm:p-6"
          onPointerDown={(e) => {
            rawResponseBackdropPointerDownRef.current = e.target === e.currentTarget
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (rawResponseBackdropPointerDownRef.current && e.target === e.currentTarget) setShowRawResponseModal(false)
            rawResponseBackdropPointerDownRef.current = false
          }}
        >
          <div
            ref={rawResponseModalRef}
            className="flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#1c1c1e]"
            onPointerDown={(e) => {
              if (!(e.target as Element).closest('[data-selectable-text]')) clearTextSelection()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/[0.08] shrink-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">原始响应数据</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await copyTextToClipboard(task.rawResponsePayload!)
                      showToast('复制成功', 'success')
                    } catch (err) {
                      showToast(getClipboardFailureMessage('复制失败', err), 'error')
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-xs font-medium"
                >
                  <CopyIcon className="w-3.5 h-3.5" />
                  全部复制
                </button>
                <button
                  type="button"
                  onClick={() => setShowRawResponseModal(false)}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-white/[0.08] dark:hover:text-gray-300 transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-gray-50/50 dark:bg-black/20 overscroll-contain">
              <pre data-selectable-text className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 font-mono whitespace-pre-wrap break-all select-text">
                {task.rawResponsePayload.replace(/"(b64_json|base64|data)":\s*"[^"]+"/g, '"$1": "<base64_data>"')}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
