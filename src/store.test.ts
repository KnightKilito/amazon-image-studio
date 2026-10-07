import { beforeEach, describe, expect, it, vi } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { DEFAULT_PARAMS } from './types'
import { createDefaultFalProfile, createDefaultOpenAIProfile, DEFAULT_RESPONSES_MODEL, DEFAULT_SETTINGS, normalizeSettings } from './lib/apiProfiles'
import type { AgentConversation, AmazonPlannerSession, ExportData, ListingCopySession, StoredImage, StoredImageThumbnail, TaskRecord, TextNote } from './types'
import { getSelectedImageMentionLabel } from './lib/promptImageMentions'
import { readTextNotes, TEXT_NOTES_STORAGE_KEY } from './lib/textNotes'
vi.mock('./lib/db', () => {
  const tasks = new Map<string, TaskRecord>()
  const amazonPlannerSessions = new Map<string, AmazonPlannerSession>()
  const listingCopySessions = new Map<string, ListingCopySession>()
  const images = new Map<string, StoredImage>()
  const thumbnails = new Map<string, StoredImageThumbnail>()
  let imageSeq = 0

  return {
    CURRENT_THUMBNAIL_VERSION: 2,
    getAllTasks: async () => [...tasks.values()],
    putTask: async (task: TaskRecord) => {
      tasks.set(task.id, task)
      return task.id
    },
    deleteTask: async (id: string) => {
      tasks.delete(id)
    },
    clearTasks: async () => {
      tasks.clear()
    },
    getAllAmazonPlannerSessions: async () => [...amazonPlannerSessions.values()],
    putAmazonPlannerSession: async (session: AmazonPlannerSession) => {
      amazonPlannerSessions.set(session.id, session)
      return session.id
    },
    deleteAmazonPlannerSession: async (id: string) => {
      amazonPlannerSessions.delete(id)
    },
    clearAmazonPlannerSessions: async () => {
      amazonPlannerSessions.clear()
    },
    getAllListingCopySessions: async () => [...listingCopySessions.values()],
    putListingCopySession: async (session: ListingCopySession) => {
      listingCopySessions.set(session.id, session)
      return session.id
    },
    deleteListingCopySession: async (id: string) => {
      listingCopySessions.delete(id)
    },
    clearListingCopySessions: async () => {
      listingCopySessions.clear()
    },
    getImage: async (id: string) => images.get(id),
    getImageThumbnail: async (id: string) => thumbnails.get(id),
    getStoredFreshImageThumbnail: async (id: string) => thumbnails.get(id),
    getAllImageIds: async () => [...images.keys()],
    getAllImages: async () => [...images.values()],
    putImage: async (image: StoredImage) => {
      images.set(image.id, image)
      return image.id
    },
    putImageThumbnail: async (thumbnail: StoredImageThumbnail) => {
      thumbnails.set(thumbnail.id, thumbnail)
      return thumbnail.id
    },
    deleteImage: async (id: string) => {
      images.delete(id)
      thumbnails.delete(id)
    },
    clearImages: async () => {
      images.clear()
      thumbnails.clear()
    },
    storeImage: async (dataUrl: string, source: StoredImage['source'] = 'upload') => {
      const id = `stored-image-${++imageSeq}`
      images.set(id, { id, dataUrl, source, createdAt: Date.now() })
      return id
    },
  }
})
vi.mock('./lib/api', () => ({
  callImageApi: vi.fn(async () => ({
    images: [],
    actualParams: {},
    actualParamsList: [],
    revisedPrompts: [],
  })),
}))
vi.mock('./lib/canvasImage', async () => {
  const actual = await vi.importActual<typeof import('./lib/canvasImage')>('./lib/canvasImage')
  return {
    ...actual,
    validateMaskMatchesImage: vi.fn(async () => 'partial'),
  }
})
vi.mock('./lib/imageEditorAnnotations', async () => {
  const actual = await vi.importActual<typeof import('./lib/imageEditorAnnotations')>('./lib/imageEditorAnnotations')
  return {
    ...actual,
    createImageEditorVisualGuideDataUrl: vi.fn(async () => 'data:image/png;base64,visual-guide'),
  }
})
vi.mock('./lib/imageUpscaling', () => ({
  upscaleImageDataUrlForAPlus: vi.fn(async (dataUrl: string, _format: string, targetSize?: { width: number; height: number }) => ({
    dataUrl: `${dataUrl}-upscaled`,
    sourceWidth: 300,
    sourceHeight: 225,
    targetWidth: targetSize?.width ?? 600,
    targetHeight: targetSize?.height ?? 450,
    scale: 2,
    scaleX: targetSize ? targetSize.width / 300 : 2,
    scaleY: targetSize ? targetSize.height / 225 : 2,
    proportional: targetSize ? targetSize.width / 300 === targetSize.height / 225 : true,
    needsUpscale: true,
  })),
}))
vi.mock('./lib/imageResizing', () => ({
  resizeImageDataUrl: vi.fn(async (dataUrl: string, options: { width: number; height: number; mode: string; outputFormat: string; quality: number }) => ({
    dataUrl: `data:image/${options.outputFormat};base64,resized-${dataUrl.slice(-1)}`,
    sourceWidth: 1024,
    sourceHeight: 768,
    targetWidth: options.mode === 'contain' ? options.width : options.width,
    targetHeight: options.mode === 'contain' ? Math.round(options.width * 0.75) : options.height,
    scaleX: options.width / 1024,
    scaleY: options.height / 768,
    proportional: options.mode === 'contain',
    byteSize: 1234,
    outputFormat: options.outputFormat,
    quality: options.outputFormat === 'png' ? null : options.quality,
  })),
}))
vi.mock('./lib/imageSlicing', () => ({
  sliceImageDataUrlVertically: vi.fn(async (_dataUrl: string, sliceCount: number, format: 'premium' | 'mobile') => ({
    width: 120,
    height: 240,
    validation: null,
    slices: Array.from({ length: sliceCount }, (_, index) => ({
      dataUrl: `data:image/png;base64,${format}-slice-${index + 1}`,
      width: 120,
      height: 120,
    })),
  })),
}))
vi.mock('./lib/agentApi', () => ({
  callAgentConversationTitleApi: vi.fn(async () => '标题'),
  callAgentResponsesApi: vi.fn(() => new Promise(() => {})),
  callBatchImageSingle: vi.fn(async (opts: { batchItemId: string; prompt: string }) => ({
    batchItemId: opts.batchItemId,
    image: { dataUrl: 'data:image/png;base64,batch-output', revisedPrompt: opts.prompt },
    error: null,
  })),
  parseBatchImageCallArguments: vi.fn((args: string) => {
    try {
      const parsed = JSON.parse(args) as { images?: Array<{ id?: string; prompt?: string; reference_ids?: string[] }> }
      return parsed.images?.map((item, index) => ({
        id: item.id || `image_${index + 1}`,
        prompt: item.prompt || '',
        reference_ids: item.reference_ids || [],
      })) ?? null
    } catch {
      return null
    }
  }),
}))
import { clearAmazonPlannerSessions, clearImages, clearListingCopySessions, clearTasks, getAllAmazonPlannerSessions, getAllImages, getAllListingCopySessions, getImage, putAmazonPlannerSession, putImage, putListingCopySession } from './lib/db'
import { callImageApi } from './lib/api'
import { captureAPlusRequestSettings, prepareAPlusConversionFromImage, stopImageTask, submitExplicitImageTask, deleteImageIfUnreferenced, waitForImageTask, updateTaskInStore } from './store'
import { addAPlusBatchSources, enqueueAPlusBatchRows, stopAllAPlusBatchRows, stopAPlusBatchRow } from './lib/aPlusConversionBatch'
import { buildAPlusConversionSpec } from './lib/aPlusConversion'
import { createImageEditorVisualGuideDataUrl } from './lib/imageEditorAnnotations'
import { upscaleImageDataUrlForAPlus } from './lib/imageUpscaling'
import { resizeImageDataUrl } from './lib/imageResizing'
import { getTaskDisplayPrompt } from './lib/taskPromptDisplay'
import { callAgentResponsesApi, callBatchImageSingle } from './lib/agentApi'
import { addTaskOutputsToInputImages, cleanStaleAgentInputDrafts, clearData, clearImageEditorInputs, convertOutputToAPlusFormat, createAPlusBatchUpscaleTask, createAPlusSliceTaskFromImage, createAPlusUpscaleTaskFromImage, createBatchImageResizeTask, editOutputs, exportData, generatePlannerStyleReferenceImage, getErrorToastMessage, getPersistedState, getTaskApiProfile, importData, initStore, markInterruptedOpenAIRunningTasks, mergePersistedState, mergeRestoredInputImage, mergeRestoredInputImages, openImageEditor, regenerateAgentAssistantMessage, removeTask, retryTask, reuseConfig, submitAgentMessage, submitImageEditorTask, submitTask, useStore } from './store'

const imageA = { id: 'image-a', dataUrl: 'data:image/png;base64,a' }
const imageB = { id: 'image-b', dataUrl: 'data:image/png;base64,b' }

describe('input image startup hydration', () => {
  it('hydrates previews without overwriting a concurrent reorder, removal, or addition', () => {
    const persisted = [
      { id: 'image-a', dataUrl: '' },
      { id: 'image-b', dataUrl: '' },
      { id: 'image-c', dataUrl: '' },
    ]
    const restored = [
      { id: 'image-a', dataUrl: 'data:image/png;base64,a' },
      { id: 'image-b', dataUrl: 'data:image/png;base64,b' },
      { id: 'image-c', dataUrl: 'data:image/png;base64,c' },
    ]
    const latest = [
      { id: 'image-c', dataUrl: '' },
      { id: 'image-a', dataUrl: '' },
      { id: 'image-new', dataUrl: 'data:image/png;base64,new' },
    ]

    expect(mergeRestoredInputImages(persisted, restored, latest)).toEqual([
      { id: 'image-c', dataUrl: 'data:image/png;base64,c' },
      { id: 'image-a', dataUrl: 'data:image/png;base64,a' },
      { id: 'image-new', dataUrl: 'data:image/png;base64,new' },
    ])
  })

  it('hydrates a single preview only while the latest state still references the same placeholder', () => {
    const persisted = { id: 'style-old', dataUrl: '' }
    const restored = { id: 'style-old', dataUrl: 'data:image/png;base64,old' }

    expect(mergeRestoredInputImage(persisted, restored, { id: 'style-old', dataUrl: '' })).toEqual(restored)
    expect(mergeRestoredInputImage(persisted, restored, null)).toBeNull()
    expect(mergeRestoredInputImage(persisted, restored, { id: 'style-new', dataUrl: '' })).toEqual({
      id: 'style-new',
      dataUrl: '',
    })
    expect(mergeRestoredInputImage(persisted, restored, { id: 'style-new', dataUrl: 'data:image/png;base64,new' })).toEqual({
      id: 'style-new',
      dataUrl: 'data:image/png;base64,new',
    })
  })
})

describe('history pagination state', () => {
  it('resets to the first page when history filters change', () => {
    const state = useStore.getState()
    const setters = [
      () => state.setSearchQuery('lamp'),
      () => state.setFilterStatus('done'),
      () => state.setFilterFavorite(true),
      () => state.setFilterProductTitle('Desk Lamp'),
      () => state.setFilterWorkflow('amazon-listing'),
      () => state.setFilterAspect('landscape'),
    ]

    for (const applyFilter of setters) {
      useStore.setState({ historyPage: 4 })
      applyFilter()
      expect(useStore.getState().historyPage).toBe(1)
    }

    useStore.setState({
      searchQuery: '',
      filterStatus: 'all',
      filterFavorite: false,
      filterProductTitle: '',
      filterWorkflow: 'all',
      filterAspect: 'all',
      historyPage: 1,
    })
  })

  it('normalizes invalid page values', () => {
    useStore.getState().setHistoryPage(-3)
    expect(useStore.getState().historyPage).toBe(1)
    useStore.getState().setHistoryPage(2.9)
    expect(useStore.getState().historyPage).toBe(2)
    useStore.setState({ historyPage: 1 })
  })

  it('persists an allowed page size, resets the page when changed, and rejects unsupported sizes', () => {
    useStore.setState({ historyPage: 4, historyPageSize: 12 })
    useStore.getState().setHistoryPageSize(24)
    expect(useStore.getState()).toMatchObject({ historyPage: 1, historyPageSize: 24 })
    expect(getPersistedState(useStore.getState()).historyPageSize).toBe(24)

    const restored = mergePersistedState({ historyPageSize: 48 }, useStore.getState())
    expect(restored.historyPageSize).toBe(48)
    const invalid = mergePersistedState({ historyPageSize: 17 }, useStore.getState())
    expect(invalid.historyPageSize).toBe(12)

    useStore.getState().setHistoryPageSize(17)
    expect(useStore.getState().historyPageSize).toBe(12)
    useStore.setState({ historyPage: 1, historyPageSize: 12 })
  })

  it('persists and restores the current Amazon Listing target size', () => {
    useStore.getState().setAmazonPlannerListingTargetSize('1600x2000')
    expect(useStore.getState().amazonPlannerListingTargetSize).toBe('1600x2000')
    expect(getPersistedState(useStore.getState()).amazonPlannerListingTargetSize).toBe('1600x2000')

    const restored = mergePersistedState({ amazonPlannerListingTargetSize: '1536x2048' }, useStore.getState())
    expect(restored.amazonPlannerListingTargetSize).toBe('1536x2048')

    const legacy = mergePersistedState({}, useStore.getState())
    expect(legacy.amazonPlannerListingTargetSize).toBe('2048x2048')

    const invalid = mergePersistedState({ amazonPlannerListingTargetSize: 'not-a-size' }, useStore.getState())
    expect(invalid.amazonPlannerListingTargetSize).toBe('2048x2048')

    useStore.setState({ amazonPlannerListingTargetSize: '2048x2048' })
  })
})

describe('error toast messages', () => {
  it('drops long error detail after the failure title', () => {
    expect(getErrorToastMessage('Agent 请求失败：接口拒绝了很长的提示词内容')).toBe('Agent 请求失败')
  })

  it('uses a generic message for long raw errors without a title', () => {
    expect(getErrorToastMessage(`invalid request ${'x'.repeat(90)}`)).toBe('操作失败，请查看详情')
  })
})

function agentConversation(overrides: Partial<AgentConversation> = {}): AgentConversation {
  return {
    id: 'conversation-a',
    title: '新对话',
    activeRoundId: null,
    createdAt: 1,
    updatedAt: 1,
    rounds: [],
    messages: [],
    ...overrides,
  }
}

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: 'prompt',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    maskTargetImageId: null,
    maskImageId: null,
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...overrides,
  }
}

function amazonPlannerSession(overrides: Partial<AmazonPlannerSession> = {}): AmazonPlannerSession {
  return {
    id: 'planner-session-a',
    title: 'Tumbler Listing',
    mode: 'listing',
    aPlusType: 'standard-large',
    resolution: '2k',
    listingText: 'Title: Tumbler',
    referenceImageIds: [],
    draft: {
      kind: 'main',
      productTitle: 'Tumbler',
      category: 'Kitchen',
      brand: '',
      color: '',
      material: '',
      audience: '',
      sellingPoints: '',
      packageIncludes: '',
      scene: '',
      forbidden: '',
    },
    seriesStyleGuides: {
      listing: 'Warm studio style.',
      aplus: '',
    },
    styleCandidates: [
      {
        label: '信息图',
        description: '字体、色板和标注样式',
        prompt: 'Create a style board.',
        negativePrompt: 'Chinese characters',
      },
    ],
    styleImages: [],
    selectedStyleIndex: null,
    imagePlans: [
      {
        slot: 'MAIN',
        label: '主图',
        kind: 'main',
        planMarkdown: '主图策划',
        prompt: 'Create main image.',
        negativePrompt: 'text',
      },
    ],
    aPlusPlans: [],
    selectedPlanIndex: 0,
    selectedAPlusPlanIndex: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

function listingCopySession(overrides: Partial<ListingCopySession> = {}): ListingCopySession {
  return {
    id: 'listing-copy-version-a',
    kind: 'version',
    title: 'Women Mule Sandals',
    marketplace: 'us',
    input: {
      preset: 'footwear',
      productDescription: 'Women mule sandals',
      brand: '',
      category: 'Mule Sandals',
      material: 'Synthetic upper',
      features: 'Slip-on',
      colorAndSize: 'Black, 35-42',
      audience: 'Women',
      useCases: 'Office and casual wear',
      requiredTerms: '',
      forbiddenTerms: '',
      heel: 'Block heel',
      sole: 'Rubber outsole',
      closure: 'Slip-on',
      comfort: 'Cushioned footbed',
    },
    prompt: 'Create compliant listing copy.',
    result: null,
    profitInput: {
      purchaseCostCny: 30,
      domesticShippingCny: 5,
      netWeightG: 500,
      packagingWeightG: 50,
      exchangeRate: 7,
      referralRatePercent: 15,
      targetMarginPercent: 30,
      yanwenRateCnyPerKg: 100,
      yanwenRegistrationFeeCny: 16,
      competitorMinPriceUsd: null,
      competitorMaxPriceUsd: null,
      fbaInboundCny: null,
      fbaFulfillmentFeeUsd: null,
      calculationPriceUsd: null,
    },
    referenceImageIds: [],
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

function importFile(data: ExportData): File {
  const zipped = zipSync({ 'manifest.json': strToU8(JSON.stringify(data)) })
  const buffer = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
  return { arrayBuffer: async () => buffer } as File
}

function createTextNotesStorage(notes: TextNote[] = []) {
  const values = new Map<string, string>()
  if (notes.length > 0) values.set(TEXT_NOTES_STORAGE_KEY, JSON.stringify(notes))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

describe('history pagination task updates', () => {
  it('returns to the first page for new tasks without resetting for existing task updates', () => {
    const existing = task({ id: 'existing-task' })
    useStore.setState({ tasks: [existing], historyPage: 3 })

    useStore.getState().setTasks([{ ...existing, status: 'running' }])
    expect(useStore.getState().historyPage).toBe(3)

    useStore.getState().setTasks([task({ id: 'new-task' }), existing])
    expect(useStore.getState().historyPage).toBe(1)
    useStore.setState({ tasks: [], historyPage: 1 })
  })
})

async function waitForCondition(predicate: () => boolean, attempts = 25) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  expect(predicate()).toBe(true)
}

describe('mask draft lifecycle in store actions', () => {
  beforeEach(() => {
    vi.mocked(callImageApi).mockReset()
    vi.mocked(callImageApi).mockResolvedValue({
      images: [],
      actualParams: {},
      actualParamsList: [],
      revisedPrompts: [],
    })
    vi.mocked(createImageEditorVisualGuideDataUrl).mockReset()
    vi.mocked(createImageEditorVisualGuideDataUrl).mockResolvedValue('data:image/png;base64,visual-guide')
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      prompt: 'prompt',
      inputImages: [],
      styleReferenceImage: null,
      editorCanvasDraft: { sourceImageId: null, annotations: [], updatedAt: 0 },
      editorActiveImageId: null,
      editorActiveTaskId: null,
      maskDraft: null,
      maskEditorImageId: null,
      params: { ...DEFAULT_PARAMS },
      pendingTaskCategory: null,
      singleAPlusConversion: null,
      aPlusBatchDraft: null,
      tasks: [],
      detailTaskId: null,
      lightboxImageId: null,
      lightboxImageList: [],
      showSettings: false,
      toast: null,
      confirmDialog: null,
      adminAccess: { ...useStore.getState().adminAccess, referenceImageUploadLimit: 16 },
      showToast: vi.fn(),
      setConfirmDialog: vi.fn(),
    })
  })

  it('fills the style reference slot when it is empty', () => {
    const generatedStyleImage = { id: 'generated-style', dataUrl: 'data:image/png;base64,generated-style' }

    const inserted = useStore.getState().setStyleReferenceImageIfEmpty(generatedStyleImage)

    expect(inserted).toBe(true)
    expect(useStore.getState().styleReferenceImage).toEqual(generatedStyleImage)
  })

  it('prepares an editor conversion without removing materials and sends only the selected source', async () => {
    await Promise.all([putImage(imageA), putImage(imageB)])
    useStore.setState({ inputImages: [imageA, imageB], styleReferenceImage: imageA, appPage: 'editor' })
    expect(await prepareAPlusConversionFromImage(imageB.id, 'mobile', 3)).toBe(true)
    expect(useStore.getState().inputImages).toEqual([imageA, imageB])
    expect(useStore.getState().styleReferenceImage).toEqual(imageA)
    expect(await submitImageEditorTask()).toBe(true)
    await waitForCondition(() => vi.mocked(callImageApi).mock.calls.length > 0)
    expect(vi.mocked(callImageApi).mock.calls[0][0]).toMatchObject({ inputImageDataUrls: [imageB.dataUrl], params: { size: '1200x2700', n: 1 } })
    await waitForCondition(() => useStore.getState().tasks[0]?.status === 'done')
  })

  it('keeps batch-only upload references alive during orphan cleanup', async () => {
    await putImage(imageA)
    addAPlusBatchSources([{ id: imageA.id, label: 'batch-only' }], 'mobile')
    await deleteImageIfUnreferenced(imageA.id)
    expect(await getImage(imageA.id)).toBeTruthy()
    expect(getPersistedState(useStore.getState()).aPlusBatchDraft?.rows[0].sourceImageId).toBe(imageA.id)
    const sourceTask = task({ outputImages: [imageA.id] })
    useStore.getState().setTasks([sourceTask])
    await removeTask(sourceTask)
    expect(await getImage(imageA.id)).toBeTruthy()
  })

  it('does not finish a batch slot while a disconnected task is recoverable', async () => {
    const reconnecting = task({ id: 'batch-recovery', status: 'running' })
    useStore.getState().setTasks([reconnecting])
    let settled = false
    const completion = waitForImageTask(reconnecting.id).then((result) => { settled = true; return result })
    updateTaskInStore(reconnecting.id, { status: 'error', falRecoverable: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(settled).toBe(false)
    stopImageTask(reconnecting.id)
    expect((await completion)?.error).toBe('已停止生成。')
  })

  it('stops downloading and ignores late callbacks and results without changing editor inputs', async () => {
    await putImage(imageA)
    let resolveApi!: (result: Awaited<ReturnType<typeof callImageApi>>) => void
    vi.mocked(callImageApi).mockImplementation(() => new Promise((resolve) => { resolveApi = resolve }))
    useStore.setState({ prompt: '保留草稿', params: { ...DEFAULT_PARAMS }, inputImages: [imageB], editorActiveTaskId: 'old-task' })
    const spec = buildAPlusConversionSpec('mobile', 2, '转换')
    const handle = await submitExplicitImageTask({ ...spec, inputImages: [imageA], maskDraft: null, styleReferenceImage: null }, captureAPlusRequestSettings())
    await waitForCondition(() => !!resolveApi)
    const opts = vi.mocked(callImageApi).mock.calls[0][0]
    opts.onRawImageUrls?.(['https://images.example/result.png'])
    opts.onPartialImage?.({ image: 'data:image/png;base64,racing-partial', partialImageIndex: 0 })
    stopImageTask(handle.taskId)
    expect(opts.signal?.aborted).toBe(true)
    expect((await handle.completion)?.error).toBe('已停止生成。')
    opts.onPartialImage?.({ image: 'data:image/png;base64,late-partial', partialImageIndex: 0 })
    resolveApi({ images: ['data:image/png;base64,late-final'] })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const storedTask = useStore.getState().tasks.find((task) => task.id === handle.taskId)!
    expect(storedTask).toMatchObject({ status: 'error', outputImages: [], rawImageUrls: ['https://images.example/result.png'] })
    expect(useStore.getState()).toMatchObject({ prompt: '保留草稿', inputImages: [imageB], editorActiveTaskId: 'old-task', params: DEFAULT_PARAMS })
    expect((await getAllImages()).some((image) => image.dataUrl.includes('late-final') || image.dataUrl.includes('late-partial') || image.dataUrl.includes('racing-partial'))).toBe(false)
  })

  it('limits all batch submits to nine slots, cancels queued work and freezes queued API settings', async () => {
    const resolvers: Array<(result: Awaited<ReturnType<typeof callImageApi>>) => void> = []
    vi.mocked(callImageApi).mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve) }))
    const images = Array.from({ length: 11 }, (_, index) => ({ id: `queue-source-${index}`, dataUrl: `data:image/png;base64,queue-${index}` }))
    await Promise.all(images.map(putImage))
    addAPlusBatchSources(images.map((image) => ({ id: image.id, label: image.id })), 'mobile')
    const rows = useStore.getState().aPlusBatchDraft!.rows
    enqueueAPlusBatchRows(rows.map((row) => row.id))
    await waitForCondition(() => resolvers.length === 9)
    expect(useStore.getState().aPlusBatchDraft!.rows.filter((row) => row.status === 'queued')).toHaveLength(2)
    stopAPlusBatchRow(rows[10].id)
    const originalModel = vi.mocked(callImageApi).mock.calls[0][0].settings.model
    useStore.getState().setSettings({ model: 'changed-model' })
    resolvers[0]({ images: ['data:image/png;base64,queue-success'] })
    await waitForCondition(() => resolvers.length === 10)
    expect(vi.mocked(callImageApi).mock.calls[9][0].settings.model).toBe(originalModel)
    expect(vi.mocked(callImageApi).mock.calls.every(([opts]) => opts.params.n === 1 && opts.inputImageDataUrls.length === 1)).toBe(true)
    stopAllAPlusBatchRows()
    for (const resolve of resolvers) resolve({ images: [] })
    await waitForCondition(() => !useStore.getState().aPlusBatchDraft!.rows.some((row) => row.status === 'running' || row.status === 'queued'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(vi.mocked(callImageApi)).toHaveBeenCalledTimes(10)
  })

  it('treats a non-renderable persisted style placeholder as an empty slot', () => {
    const generatedStyleImage = { id: 'generated-style', dataUrl: 'data:image/png;base64,generated-style' }
    useStore.getState().setStyleReferenceImage({ id: 'missing-persisted-style', dataUrl: '' })

    const inserted = useStore.getState().setStyleReferenceImageIfEmpty(generatedStyleImage)

    expect(inserted).toBe(true)
    expect(useStore.getState().styleReferenceImage).toEqual(generatedStyleImage)
  })

  it('preserves an existing style reference when an AI style image finishes later', () => {
    const existingStyleImage = { id: 'manual-style', dataUrl: 'data:image/png;base64,manual-style' }
    const generatedStyleImage = { id: 'generated-style', dataUrl: 'data:image/png;base64,generated-style' }
    useStore.getState().setStyleReferenceImage(existingStyleImage)

    const inserted = useStore.getState().setStyleReferenceImageIfEmpty(generatedStyleImage)

    expect(inserted).toBe(false)
    expect(useStore.getState().styleReferenceImage).toEqual(existingStyleImage)
  })

  it('replaces an existing style reference after an explicit current-style fill', () => {
    const existingStyleImage = { id: 'manual-style', dataUrl: 'data:image/png;base64,manual-style' }
    const currentStyleImage = { id: 'current-style', dataUrl: 'data:image/png;base64,current-style' }
    useStore.getState().setStyleReferenceImage(existingStyleImage)

    useStore.getState().setStyleReferenceImage(currentStyleImage)

    expect(useStore.getState().styleReferenceImage).toEqual(currentStyleImage)
  })

  it('replaces the current draft with one output image when quick editing output', async () => {
    await putImage(imageB)
    const maskDraft = {
      targetImageId: imageA.id,
      maskDataUrl: 'data:image/png;base64,mask',
      updatedAt: 1,
    }
    useStore.setState({
      prompt: 'old prompt',
      inputImages: [imageA],
      maskDraft,
      maskEditorImageId: imageA.id,
      params: { ...DEFAULT_PARAMS, quality: 'low', output_format: 'jpeg', output_compression: 70 },
    })

    await editOutputs(task({ outputImages: [imageB.id] }))

    const state = useStore.getState()
    expect(state.prompt).toBe('')
    expect(state.inputImages).toEqual([imageB])
    expect(state.maskDraft).toBeNull()
    expect(state.maskEditorImageId).toBeNull()
    expect(state.params.quality).toBe('high')
    expect(state.params.output_format).toBe('png')
    expect(state.params.output_compression).toBeNull()
  })

  it('opens a source image in the editor and resets transient edit state', async () => {
    await putImage(imageB)
    useStore.setState({
      appPage: 'home',
      editorActiveImageId: null,
      editorActiveTaskId: 'old-task',
      editorCanvasDraft: {
        sourceImageId: imageA.id,
        annotations: [{ id: 'old-mark', kind: 'rectangle', color: '#ef4444', width: 0.0065, points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }] }],
        updatedAt: 1,
      },
      prompt: 'old prompt',
      inputImages: [imageA],
      styleReferenceImage: imageA,
      maskDraft: {
        targetImageId: imageA.id,
        maskDataUrl: 'data:image/png;base64,mask',
        updatedAt: 1,
      },
      maskEditorImageId: imageA.id,
    })

    expect(await openImageEditor(imageB.id)).toBe(true)

    const state = useStore.getState()
    expect(state.appPage).toBe('editor')
    expect(state.editorActiveImageId).toBe(imageB.id)
    expect(state.editorActiveTaskId).toBeNull()
    expect(state.editorCanvasDraft.sourceImageId).toBe(imageB.id)
    expect(state.editorCanvasDraft.annotations).toEqual([])
    expect(state.prompt).toBe('')
    expect(state.inputImages).toEqual([imageB])
    expect(state.styleReferenceImage).toBeNull()
    expect(state.maskDraft).toBeNull()
    expect(state.maskEditorImageId).toBeNull()
    expect(state.pendingTaskCategory).toBeNull()
  })

  it('fully clears the editor main image state while preserving prompt and style reference', () => {
    useStore.setState({
      prompt: 'keep this instruction',
      inputImages: [imageA],
      styleReferenceImage: imageB,
      editorActiveImageId: imageA.id,
      editorActiveTaskId: 'active-result-task',
      editorCanvasDraft: {
        sourceImageId: imageA.id,
        annotations: [{ id: 'old-mark', kind: 'rectangle', color: '#ef4444', width: 0.0065, points: [{ x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }] }],
        updatedAt: 1,
      },
    })

    clearImageEditorInputs()

    const state = useStore.getState()
    expect(state.inputImages).toEqual([])
    expect(state.editorActiveImageId).toBeNull()
    expect(state.editorActiveTaskId).toBeNull()
    expect(state.editorCanvasDraft).toMatchObject({ sourceImageId: null, annotations: [] })
    expect(state.prompt).toBe('keep this instruction')
    expect(state.styleReferenceImage).toEqual(imageB)
  })

  it('submits annotated editor inputs in source, guide, reference, and style order', async () => {
    const styleImage = { id: 'editor-style', dataUrl: 'data:image/png;base64,editor-style' }
    await Promise.all([putImage(imageA), putImage(imageB), putImage(styleImage)])
    useStore.setState({
      appPage: 'editor',
      prompt: '把箭头指向的产品改成蓝色',
      inputImages: [imageA, imageB],
      styleReferenceImage: styleImage,
      editorCanvasDraft: {
        sourceImageId: imageA.id,
        annotations: [{ id: 'arrow-1', kind: 'arrow', color: '#ef4444', width: 0.0065, points: [{ x: 0.1, y: 0.1 }, { x: 0.7, y: 0.7 }] }],
        updatedAt: 1,
      },
    })

    expect(await submitImageEditorTask()).toBe(true)

    const submittedTask = useStore.getState().tasks[0]
    expect(submittedTask.category?.workflow).toBe('image-edit')
    expect(submittedTask.inputImageIds[0]).toBe(imageA.id)
    expect(submittedTask.inputImageIds[2]).toBe(imageB.id)
    expect(submittedTask.inputImageIds[3]).toBe(styleImage.id)
    expect(submittedTask.imageEditContext).toEqual({
      sourceImageId: imageA.id,
      visualGuideImageId: submittedTask.inputImageIds[1],
      referenceImageIds: [imageB.id],
      userInstruction: '把箭头指向的产品改成蓝色',
    })
    expect(submittedTask.prompt).toContain('图2是“视觉定位图”')
    expect(submittedTask.prompt).toContain('图3是参考图1')
    expect(submittedTask.prompt).toContain('图4是风格参考图')
    expect(getTaskDisplayPrompt(submittedTask)).toBe('把箭头指向的产品改成蓝色')
    expect(useStore.getState().editorActiveTaskId).toBe(submittedTask.id)

    await waitForCondition(() => vi.mocked(callImageApi).mock.calls.length >= 1)
    expect(vi.mocked(callImageApi).mock.calls[0]?.[0].inputImageDataUrls).toEqual([
      imageA.dataUrl,
      'data:image/png;base64,visual-guide',
      imageB.dataUrl,
      styleImage.dataUrl,
    ])
  })

  it('submits editor input without creating a guide when annotations are empty', async () => {
    await Promise.all([putImage(imageA), putImage(imageB)])
    useStore.setState({
      prompt: '只替换产品颜色',
      inputImages: [imageA, imageB],
      editorCanvasDraft: { sourceImageId: imageA.id, annotations: [], updatedAt: 1 },
    })

    expect(await submitImageEditorTask()).toBe(true)

    const submittedTask = useStore.getState().tasks[0]
    expect(createImageEditorVisualGuideDataUrl).not.toHaveBeenCalled()
    expect(submittedTask.inputImageIds).toEqual([imageA.id, imageB.id])
    expect(submittedTask.imageEditContext?.visualGuideImageId).toBeNull()
    expect(submittedTask.prompt).not.toContain('视觉定位图')
  })

  it('keeps the masked editor source first when annotations are also present', async () => {
    await Promise.all([putImage(imageA), putImage(imageB)])
    useStore.setState({
      prompt: '只重绘遮罩和方框共同指定的区域',
      inputImages: [imageB, imageA],
      editorCanvasDraft: {
        sourceImageId: imageA.id,
        annotations: [{ id: 'rect-1', kind: 'rectangle', color: '#2563eb', width: 0.0065, points: [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.6 }] }],
        updatedAt: 1,
      },
      maskDraft: {
        targetImageId: imageA.id,
        maskDataUrl: 'data:image/png;base64,editor-mask',
        updatedAt: 1,
      },
    })

    expect(await submitImageEditorTask()).toBe(true)

    const submittedTask = useStore.getState().tasks[0]
    expect(submittedTask.inputImageIds[0]).toBe(imageA.id)
    expect(submittedTask.inputImageIds[1]).toBe(submittedTask.imageEditContext?.visualGuideImageId)
    expect(submittedTask.inputImageIds[2]).toBe(imageB.id)
    expect(submittedTask.maskTargetImageId).toBe(imageA.id)
    expect(submittedTask.maskImageId).toBeTruthy()
  })

  it('counts a visual guide against the editor input limit before generating it', async () => {
    await Promise.all([putImage(imageA), putImage(imageB)])
    useStore.setState({
      prompt: '编辑图片',
      inputImages: [imageA, imageB],
      editorCanvasDraft: {
        sourceImageId: imageA.id,
        annotations: [{ id: 'rect-limit', kind: 'rectangle', color: '#ef4444', width: 0.0065, points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }] }],
        updatedAt: 1,
      },
      adminAccess: { ...useStore.getState().adminAccess, referenceImageUploadLimit: 2 },
    })

    expect(await submitImageEditorTask()).toBe(false)
    expect(createImageEditorVisualGuideDataUrl).not.toHaveBeenCalled()
    expect(useStore.getState().showToast).toHaveBeenCalledWith(expect.stringContaining('标注导引图额外占用一张输入图'), 'error')
  })

  it('deletes a transient guide when profile validation blocks task creation', async () => {
    await clearImages()
    await putImage(imageA)
    const invalidProfile = createDefaultOpenAIProfile({ id: 'invalid-editor-profile', apiKey: '', apiMode: 'images' })
    useStore.setState({
      settings: normalizeSettings({ ...DEFAULT_SETTINGS, profiles: [invalidProfile], activeProfileId: invalidProfile.id }),
      prompt: '编辑图片',
      inputImages: [imageA],
      editorCanvasDraft: {
        sourceImageId: imageA.id,
        annotations: [{ id: 'rect-cleanup', kind: 'rectangle', color: '#ef4444', width: 0.0065, points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }] }],
        updatedAt: 1,
      },
    })

    expect(await submitImageEditorTask()).toBe(false)
    expect(useStore.getState().tasks).toHaveLength(0)
    expect((await getAllImages()).some((image) => image.dataUrl === 'data:image/png;base64,visual-guide')).toBe(false)
  })

  it('preserves image-edit metadata and input references when retrying', async () => {
    const failedTask = task({
      prompt: '内部编辑提示词',
      status: 'error',
      inputImageIds: ['retry-source', 'retry-guide', 'retry-reference'],
      category: { workflow: 'image-edit' },
      imageEditContext: {
        sourceImageId: 'retry-source',
        visualGuideImageId: 'retry-guide',
        referenceImageIds: ['retry-reference'],
        userInstruction: '用户编辑要求',
      },
    })

    await retryTask(failedTask)

    const retriedTask = useStore.getState().tasks[0]
    expect(retriedTask.inputImageIds).toEqual(failedTask.inputImageIds)
    expect(retriedTask.category?.workflow).toBe('image-edit')
    expect(retriedTask.imageEditContext).toEqual(failedTask.imageEditContext)
    expect(retriedTask.imageEditContext).not.toBe(failedTask.imageEditContext)
  })

  it('keeps or drops the canvas draft on restart according to the existing persistence setting', () => {
    const draft = {
      sourceImageId: imageA.id,
      annotations: [{ id: 'persisted-mark', kind: 'ellipse' as const, color: '#16a34a', width: 0.0065, points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }] }],
      updatedAt: 12,
    }
    useStore.setState({
      editorCanvasDraft: draft,
      settings: { ...useStore.getState().settings, persistInputOnRestart: true },
    })
    expect(getPersistedState(useStore.getState()).editorCanvasDraft).toEqual(draft)

    useStore.setState({ settings: { ...useStore.getState().settings, persistInputOnRestart: false } })
    expect(getPersistedState(useStore.getState()).editorCanvasDraft).toEqual({ sourceImageId: null, annotations: [], updatedAt: 0 })
  })

  it('deletes a visual guide through the existing task reference cleanup', async () => {
    const source = { id: 'cleanup-source', dataUrl: 'data:image/png;base64,cleanup-source' }
    const guide = { id: 'cleanup-guide', dataUrl: 'data:image/png;base64,cleanup-guide' }
    await Promise.all([putImage(source), putImage(guide)])
    const editTask = task({
      id: 'cleanup-image-edit-task',
      inputImageIds: [source.id, guide.id],
      category: { workflow: 'image-edit' },
      imageEditContext: {
        sourceImageId: source.id,
        visualGuideImageId: guide.id,
        referenceImageIds: [],
        userInstruction: '清理测试',
      },
    })
    useStore.setState({ tasks: [editTask], inputImages: [], editorCanvasDraft: { sourceImageId: null, annotations: [], updatedAt: 0 } })

    await removeTask(editTask)

    expect(await getImage(guide.id)).toBeUndefined()
  })

  it('creates a derived A+ upscale task from an uploaded editor image', async () => {
    await putImage(imageB)
    useStore.setState({ tasks: [], appPage: 'editor' })

    const derivedTask = await createAPlusUpscaleTaskFromImage(imageB.id, 'mobile')

    expect(derivedTask.inputImageIds).toEqual([imageB.id])
    expect(derivedTask.outputImages).toHaveLength(1)
    expect(derivedTask.params).toMatchObject({
      size: '600x450',
      output_format: 'png',
      quality: 'high',
      output_compression: null,
    })
    expect(derivedTask.category).toMatchObject({
      workflow: 'amazon-aplus',
      aPlusType: 'mobile',
    })
    expect(useStore.getState().tasks[0]?.id).toBe(derivedTask.id)
  })

  it('creates an exact custom-size upscale task from the editor image', async () => {
    await putImage(imageB)
    vi.mocked(upscaleImageDataUrlForAPlus).mockClear()
    useStore.setState({ tasks: [], appPage: 'editor' })

    const derivedTask = await createAPlusUpscaleTaskFromImage(imageB.id, 'premium', {
      width: 1800,
      height: 1350,
    })

    expect(upscaleImageDataUrlForAPlus).toHaveBeenCalledWith(imageB.dataUrl, 'premium', {
      width: 1800,
      height: 1350,
    })
    expect(derivedTask.params).toMatchObject({
      size: '1800x1350',
      output_format: 'png',
      quality: 'high',
    })
    expect(derivedTask.category).toMatchObject({
      workflow: 'amazon-aplus',
      amazonSlot: '图片编辑 · 自定义尺寸放大',
    })
  })

  it('batch-resizes editor materials into one derived history task', async () => {
    await putImage(imageA)
    await putImage(imageB)
    vi.mocked(resizeImageDataUrl).mockClear()
    useStore.setState({ tasks: [], appPage: 'editor' })

    const derivedTask = await createBatchImageResizeTask([imageA.id, imageB.id, imageA.id], {
      width: 800,
      height: 800,
      mode: 'contain',
      outputFormat: 'webp',
      quality: 82,
    })

    expect(resizeImageDataUrl).toHaveBeenCalledTimes(2)
    expect(derivedTask.inputImageIds).toEqual([imageA.id, imageB.id])
    expect(derivedTask.outputImages).toHaveLength(2)
    expect(derivedTask.params).toMatchObject({
      n: 2,
      size: '800x600',
      output_format: 'webp',
      output_compression: 18,
    })
    expect(Object.values(derivedTask.actualParamsByImage ?? {})).toHaveLength(2)
    expect(derivedTask.category).toEqual({
      workflow: 'gallery',
      amazonSlot: '图片编辑 · 批量调整尺寸（2 张）',
    })
    expect(useStore.getState().tasks[0]?.id).toBe(derivedTask.id)
  })

  it('keeps the source image reference on a derived A+ slice task', async () => {
    await putImage(imageB)
    useStore.setState({ tasks: [], appPage: 'editor' })

    const derivedTask = await createAPlusSliceTaskFromImage(imageB.id, 2, 'premium')

    expect(derivedTask.inputImageIds).toEqual([imageB.id])
    expect(derivedTask.derivation).toMatchObject({
      type: 'premium-aplus-vertical-slices',
      sourceImageId: imageB.id,
      sliceCount: 2,
    })
    expect(useStore.getState().tasks[0]?.id).toBe(derivedTask.id)
  })

  it('adds every output image from a history task as editor material', async () => {
    await putImage(imageA)
    await putImage(imageB)
    const previousAdminAccess = useStore.getState().adminAccess
    useStore.setState({
      inputImages: [],
      styleReferenceImage: null,
      adminAccess: { ...useStore.getState().adminAccess, referenceImageUploadLimit: 2 },
    })

    const result = await addTaskOutputsToInputImages(task({ outputImages: [imageA.id, imageB.id] }))

    expect(result.addedImageIds).toEqual([imageA.id, imageB.id])
    expect(result.skippedCount).toBe(0)
    expect(useStore.getState().inputImages.map((image) => image.id)).toEqual([imageA.id, imageB.id])
    useStore.setState({ adminAccess: previousAdminAccess })
  })

  it('clears an invalid mask draft when submit cannot find the mask target image', async () => {
    useStore.setState({
      inputImages: [imageA],
      maskDraft: {
        targetImageId: 'missing-image',
        maskDataUrl: 'data:image/png;base64,mask',
        updatedAt: 1,
      },
    })

    await submitTask()

    expect(useStore.getState().maskDraft).toBeNull()
  })

  it('shows a submitted toast after creating a gallery task', async () => {
    const submitted = await submitTask()

    const state = useStore.getState()
    expect(submitted).toBe(true)
    expect(state.tasks).toHaveLength(1)
    expect(state.showToast).toHaveBeenCalledWith('任务已提交', 'success')
  })

  it.each([
    { apiMode: 'chat' as const, model: 'deepseek-v4-flash', label: 'Chat Completions' },
    { apiMode: 'responses' as const, model: DEFAULT_RESPONSES_MODEL, label: 'Responses API' },
  ])('blocks gallery submit with a switch-config dialog when the active profile is $label', async ({ apiMode, model, label }) => {
    const plannerProfile = createDefaultOpenAIProfile({
      id: `planner-profile-${apiMode}`,
      name: 'AI策划',
      apiKey: 'planner-key',
      apiMode,
      model,
    })
    useStore.setState({
      settings: normalizeSettings({
        profiles: [plannerProfile],
        activeProfileId: plannerProfile.id,
      }),
    })

    const submitted = await submitTask()

    const state = useStore.getState()
    expect(submitted).toBe(false)
    expect(state.tasks).toHaveLength(0)
    expect(state.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '当前配置不能生图',
      confirmText: '去切换配置',
      cancelText: '取消',
      message: expect.stringContaining(label),
    }))
    expect(state.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('普通生图只支持 Images API'),
    }))
  })

  it('allows gallery submit when the active Chat Completions profile is an OpenRouter image model', async () => {
    const openRouterProfile = createDefaultOpenAIProfile({
      id: 'openrouter-image',
      name: 'OpenRouter 生图',
      apiKey: 'openrouter-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiMode: 'chat',
      model: 'google/gemini-2.5-flash-image',
    })
    useStore.setState({
      settings: normalizeSettings({
        profiles: [openRouterProfile],
        activeProfileId: openRouterProfile.id,
      }),
    })

    const submitted = await submitTask()

    const state = useStore.getState()
    expect(submitted).toBe(true)
    expect(state.tasks).toHaveLength(1)
    expect(state.setConfirmDialog).not.toHaveBeenCalledWith(expect.objectContaining({
      title: '当前配置不能生图',
    }))
  })

  it('blocks retry with a switch-config dialog when the active profile is Responses API', async () => {
    const responseProfile = createDefaultOpenAIProfile({
      id: 'responses-profile',
      name: 'AI策划',
      apiKey: 'planner-key',
      apiMode: 'responses',
      model: DEFAULT_RESPONSES_MODEL,
    })
    useStore.setState({
      settings: normalizeSettings({
        profiles: [responseProfile],
        activeProfileId: responseProfile.id,
      }),
    })

    await retryTask(task())

    const state = useStore.getState()
    expect(state.tasks).toHaveLength(0)
    expect(state.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '当前配置不能生图',
      message: expect.stringContaining('Responses API'),
    }))
  })

  it('returns false when submit is blocked before creating a task', async () => {
    useStore.setState({ prompt: '' })

    const submitted = await submitTask()

    const state = useStore.getState()
    expect(submitted).toBe(false)
    expect(state.tasks).toHaveLength(0)
    expect(state.showToast).toHaveBeenCalledWith('请输入提示词', 'error')
  })

  it('stores pending Amazon Listing category when the submitted prompt still matches', async () => {
    useStore.setState({
      prompt: 'listing prompt',
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'listing prompt',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'MAIN',
        },
      },
    })

    await submitTask()

    const state = useStore.getState()
    expect(state.tasks[0]?.category).toMatchObject({
      productTitle: 'Large Folding Umbrella',
      workflow: 'amazon-listing',
      amazonSlot: 'MAIN',
    })
    expect(state.pendingTaskCategory).toBeNull()
  })

  it('stores pending Amazon A+ category when the submitted prompt still matches', async () => {
    useStore.setState({
      prompt: 'aplus prompt',
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'aplus prompt',
        category: {
          productTitle: 'LED Desk Lamp',
          workflow: 'amazon-aplus',
          amazonSlot: 'A+S01',
          aPlusType: 'standard',
        },
      },
    })

    await submitTask()

    expect(useStore.getState().tasks[0]?.category).toMatchObject({
      productTitle: 'LED Desk Lamp',
      workflow: 'amazon-aplus',
      amazonSlot: 'A+S01',
      aPlusType: 'standard',
    })
  })

  it('submits and records a manually uploaded style reference without planner metadata', async () => {
    const styleImage = { id: 'style-reference-image', dataUrl: 'data:image/png;base64,style' }
    await putImage(imageA)
    await putImage(styleImage)
    useStore.setState({
      prompt: 'listing prompt',
      inputImages: [imageA],
      styleReferenceImage: styleImage,
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'listing prompt',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'PT01',
        },
      },
    })

    await submitTask()

    const task = useStore.getState().tasks[0]
    expect(task?.inputImageIds).toEqual([imageA.id, styleImage.id])
    expect(task?.category).toMatchObject({
      workflow: 'amazon-listing',
      amazonSlot: 'PT01',
      styleReferenceImageId: styleImage.id,
    })
    await waitForCondition(() => vi.mocked(callImageApi).mock.calls.length >= 1)
    expect(vi.mocked(callImageApi).mock.calls[0]?.[0].inputImageDataUrls).toEqual([
      imageA.dataUrl,
      styleImage.dataUrl,
    ])
  })

  it('generates and stores an AI planner style reference with the active image profile', async () => {
    const imageProfile = createDefaultOpenAIProfile({
      id: 'style-image-profile',
      apiKey: 'style-image-key',
      apiMode: 'images',
      model: 'gpt-image-2',
    })
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        profiles: [imageProfile],
        activeProfileId: imageProfile.id,
      }),
    })
    vi.mocked(callImageApi).mockResolvedValueOnce({
      images: ['data:image/png;base64,ai-style-board'],
      actualParams: {},
      actualParamsList: [],
      revisedPrompts: [],
    })

    const image = await generatePlannerStyleReferenceImage({
      prompt: 'Create a 2x2 coastal campaign direction board.',
      negativePrompt: 'logos, readable text',
      referenceImageDataUrls: [imageA.dataUrl],
    })

    expect(image.dataUrl).toBe('data:image/png;base64,ai-style-board')
    expect(vi.mocked(callImageApi)).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('Negative prompt:\nlogos, readable text'),
      inputImageDataUrls: [imageA.dataUrl],
      params: expect.objectContaining({
        size: '1536x1024',
        quality: 'high',
        output_format: 'png',
        n: 1,
      }),
    }))
  })

  it('does not append a hidden style reference image for an Amazon MAIN prompt', async () => {
    const styleImage = { id: 'style-reference-image', dataUrl: 'data:image/png;base64,style' }
    await putImage(imageA)
    await putImage(styleImage)
    useStore.setState({
      prompt: 'listing prompt',
      inputImages: [imageA],
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'listing prompt',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'MAIN',
          styleReferenceImageId: styleImage.id,
        },
      },
    })

    await submitTask()

    const task = useStore.getState().tasks[0]
    expect(task?.inputImageIds).toEqual([imageA.id])
    expect(task?.category).toMatchObject({
      workflow: 'amazon-listing',
      amazonSlot: 'MAIN',
    })
    expect(task?.category).not.toHaveProperty('styleReferenceImageId')
  })

  it('blocks submit when visible references plus the explicit style reference exceed the API image limit', async () => {
    const styleImage = { id: 'style-reference-image', dataUrl: 'data:image/png;base64,style' }
    await putImage(styleImage)
    const inputImages = Array.from({ length: 16 }, (_, index) => ({
      id: `product-reference-${index + 1}`,
      dataUrl: `data:image/png;base64,product-${index + 1}`,
    }))
    useStore.setState({
      prompt: 'listing prompt',
      inputImages,
      styleReferenceImage: styleImage,
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'listing prompt',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'PT01',
          styleReferenceImageId: styleImage.id,
        },
      },
    })

    await submitTask()

    expect(useStore.getState().tasks).toHaveLength(0)
    expect(useStore.getState().showToast).toHaveBeenCalledWith(expect.stringContaining('实际参考图数量不能超过 16 张'), 'error')
  })

  it('asks before retrying generation with the provider reference image limit and preserves the explicit style reference', async () => {
    const styleImage = { id: 'style-reference-image', dataUrl: 'data:image/png;base64,style' }
    const productImages = Array.from({ length: 8 }, (_, index) => ({
      id: `product-reference-${index + 1}`,
      dataUrl: `data:image/png;base64,product-${index + 1}`,
    }))
    for (const image of [...productImages, styleImage]) {
      await putImage(image)
    }
    vi.mocked(callImageApi)
      .mockRejectedValueOnce(new Error('reference image count exceeds limit: count=9, limit=3 (request id: test-request)'))
      .mockResolvedValueOnce({
        images: ['data:image/png;base64,output'],
        actualParams: {},
        actualParamsList: [],
        revisedPrompts: [],
      })
    useStore.setState({
      prompt: 'listing prompt',
      inputImages: productImages,
      styleReferenceImage: styleImage,
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'listing prompt',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'PT01',
          styleReferenceImageId: styleImage.id,
        },
      },
    })

    const submitted = await submitTask()

    expect(submitted).toBe(true)
    await waitForCondition(() => vi.mocked(callImageApi).mock.calls.length >= 1)
    expect(vi.mocked(callImageApi)).toHaveBeenCalledTimes(1)
    const firstCall = vi.mocked(callImageApi).mock.calls[0]?.[0]
    expect(firstCall?.inputImageDataUrls).toHaveLength(9)
    expect(useStore.getState().tasks[0]?.status).toBe('error')
    expect(useStore.getState().setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '参考图数量受限',
      message: expect.stringContaining('最多支持 3 张参考图'),
      confirmText: '只传 3 张继续',
      cancelText: '取消，不继续',
    }))

    const confirmDialogCalls = vi.mocked(useStore.getState().setConfirmDialog).mock.calls
    const dialog = confirmDialogCalls[confirmDialogCalls.length - 1]?.[0]
    dialog?.action?.()
    await waitForCondition(() => vi.mocked(callImageApi).mock.calls.length >= 2)
    const retryCall = vi.mocked(callImageApi).mock.calls[1]?.[0]
    expect(retryCall?.inputImageDataUrls).toEqual([
      productImages[0]!.dataUrl,
      productImages[1]!.dataUrl,
      styleImage.dataUrl,
    ])
  })

  it('does not apply stale pending category after the prompt changes', async () => {
    useStore.setState({
      prompt: 'changed prompt',
      pendingTaskCategory: {
        mode: 'prompt-match',
        prompt: 'original prompt',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'MAIN',
        },
      },
    })

    await submitTask()

    expect(useStore.getState().tasks[0]?.category).toEqual({ workflow: 'gallery' })
  })

  it('preserves reused Listing category on the next submit even after editing the prompt', async () => {
    await reuseConfig(task({
      prompt: 'original listing prompt',
      category: {
        productTitle: 'Large Folding Umbrella',
        workflow: 'amazon-listing',
        amazonSlot: 'PT02',
      },
    }))

    useStore.getState().setPrompt('revised listing prompt')
    await submitTask()

    const state = useStore.getState()
    expect(state.tasks[0]?.category).toMatchObject({
      productTitle: 'Large Folding Umbrella',
      workflow: 'amazon-listing',
      amazonSlot: 'PT02',
    })
    expect(state.pendingTaskCategory).toBeNull()
  })

  it('preserves edit-output Listing category on the next submit even after entering a new prompt', async () => {
    const outputImage = { id: 'listing-output-image', dataUrl: 'data:image/png;base64,listing-output' }
    await clearImages()
    await putImage(outputImage)

    await editOutputs(task({
      outputImages: [outputImage.id],
      category: {
        productTitle: 'Large Folding Umbrella',
        workflow: 'amazon-listing',
        amazonSlot: 'MAIN',
      },
    }))

    useStore.getState().setPrompt('edit this listing image')
    await submitTask()

    expect(useStore.getState().tasks[0]?.category).toMatchObject({
      productTitle: 'Large Folding Umbrella',
      workflow: 'amazon-listing',
      amazonSlot: 'MAIN',
    })
  })

  it('prepares the selected output image as a Premium A+ conversion reference', async () => {
    const firstOutput = { id: 'premium-output-a', dataUrl: 'data:image/png;base64,premium-a' }
    const selectedOutput = { id: 'premium-output-b', dataUrl: 'data:image/png;base64,premium-b' }
    await clearImages()
    await putImage(firstOutput)
    await putImage(selectedOutput)
    useStore.setState({
      prompt: 'old prompt',
      inputImages: [imageA],
      styleReferenceImage: imageA,
      params: { ...DEFAULT_PARAMS, quality: 'low', output_format: 'jpeg', output_compression: 70 },
    })

    await convertOutputToAPlusFormat(task({
      outputImages: [firstOutput.id, selectedOutput.id],
      category: {
        productTitle: 'Premium Tumbler',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+P02',
        aPlusType: 'standard-large',
        styleReferenceImageId: imageA.id,
      },
    }), selectedOutput.id, 'premium')

    const state = useStore.getState()
    expect(state.inputImages).toEqual([{ id: selectedOutput.id, dataUrl: selectedOutput.dataUrl }])
    expect(state.styleReferenceImage).toBeNull()
    expect(state.prompt).toContain('2928x1200')
    expect(state.prompt).not.toContain('1200x900')
    expect(state.params.size).toBe('2928x1200')
    expect(state.params.quality).toBe('high')
    expect(state.params.output_format).toBe('png')
    expect(state.params.output_compression).toBeNull()
    expect(state.pendingTaskCategory).toMatchObject({
      mode: 'next-submit',
      category: {
        productTitle: 'Premium Tumbler',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+P02',
        aPlusType: 'premium',
      },
    })
    expect(state.pendingTaskCategory?.category).not.toHaveProperty('styleReferenceImageId')
  })

  it('prepares the selected output image as a Mobile A+ conversion reference', async () => {
    const outputImage = { id: 'mobile-output-image', dataUrl: 'data:image/png;base64,mobile-output' }
    await clearImages()
    await putImage(outputImage)

    await convertOutputToAPlusFormat(task({
      outputImages: [outputImage.id],
      category: {
        productTitle: 'Mobile Tumbler',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+M01',
        aPlusType: 'premium',
      },
    }), outputImage.id, 'mobile')

    const state = useStore.getState()
    expect(state.inputImages).toEqual([{ id: outputImage.id, dataUrl: outputImage.dataUrl }])
    expect(state.prompt).toContain('1200x900')
    expect(state.params.size).toBe('1200x900')
    expect(state.params.quality).toBe('high')
    expect(state.params.output_format).toBe('png')
    expect(state.params.output_compression).toBeNull()
    expect(state.pendingTaskCategory).toMatchObject({
      category: {
        productTitle: 'Mobile Tumbler',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+M01',
        aPlusType: 'mobile',
      },
    })
  })

  it('uses the explicit Mobile A+ panel count for legacy tasks without mother-image metadata', async () => {
    const outputImage = { id: 'legacy-mobile-mother-output', dataUrl: 'data:image/png;base64,legacy-mobile-mother' }
    await clearImages()
    await putImage(outputImage)

    await convertOutputToAPlusFormat(task({
      outputImages: [outputImage.id],
      params: { ...DEFAULT_PARAMS, size: '2928x2400' },
      category: {
        productTitle: 'Legacy Continuous Shoes',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+P01',
        aPlusType: 'premium',
      },
    }), outputImage.id, 'mobile', 2)

    const state = useStore.getState()
    expect(state.prompt).toContain('1200x1800')
    expect(state.prompt).toContain('2 片连续母图')
    expect(state.params.size).toBe('1200x1800')
    expect(state.pendingTaskCategory).toMatchObject({
      category: {
        aPlusType: 'mobile',
        aPlusPlanContext: {
          layoutMode: 'composed',
          groupKind: 'continuous-canvas',
          sliceCount: 2,
          slotCost: 2,
          plannedGenerationSize: '1200x1800',
        },
      },
    })
  })

  it('lets an explicit single-panel choice override stale mother-image metadata', async () => {
    const outputImage = { id: 'single-mobile-output', dataUrl: 'data:image/png;base64,single-mobile' }
    await clearImages()
    await putImage(outputImage)

    await convertOutputToAPlusFormat(task({
      outputImages: [outputImage.id],
      category: {
        workflow: 'amazon-aplus',
        aPlusType: 'premium',
        aPlusPlanContext: {
          layoutMode: 'composed',
          groupId: 'old-three-panel-group',
          groupKind: 'continuous-canvas',
          itemIndex: 0,
          sliceCount: 3,
          slotCost: 3,
          plannedGenerationSize: '2928x3600',
        },
      },
    }), outputImage.id, 'mobile', 1)

    const state = useStore.getState()
    expect(state.params.size).toBe('1200x900')
    expect(state.pendingTaskCategory?.category).not.toHaveProperty('aPlusPlanContext')
  })

  it('preserves continuous mother-image panel count when converting to Mobile A+', async () => {
    const outputImage = { id: 'mobile-mother-output', dataUrl: 'data:image/png;base64,mobile-mother' }
    await clearImages()
    await putImage(outputImage)

    await convertOutputToAPlusFormat(task({
      outputImages: [outputImage.id],
      params: { ...DEFAULT_PARAMS, size: '2928x3600' },
      category: {
        productTitle: 'Continuous Mobile Shoes',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+F01-M',
        aPlusType: 'premium',
        aPlusPlanContext: {
          layoutMode: 'composed',
          groupId: 'continuous-mobile-test',
          groupKind: 'continuous-canvas',
          itemIndex: 0,
          sliceCount: 3,
          slotCost: 3,
          plannedGenerationSize: '2928x3600',
        },
      },
    }), outputImage.id, 'mobile')

    const state = useStore.getState()
    expect(state.prompt).toContain('1200x2700')
    expect(state.prompt).toContain('3 片连续母图')
    expect(state.prompt).toContain('不得拆成 3 张独立图片')
    expect(state.params.size).toBe('1200x2700')
    expect(state.pendingTaskCategory).toMatchObject({
      category: {
        aPlusType: 'mobile',
        aPlusPlanContext: {
          groupKind: 'continuous-canvas',
          sliceCount: 3,
          plannedGenerationSize: '1200x2700',
        },
      },
    })
  })

  it('batch-upscales all outputs into one PNG/high task', async () => {
    const sourceImages = [
      { id: 'batch-upscale-a', dataUrl: 'data:image/png;base64,batch-a' },
      { id: 'batch-upscale-b', dataUrl: 'data:image/png;base64,batch-b' },
      { id: 'batch-upscale-c', dataUrl: 'data:image/png;base64,batch-c' },
    ]
    await clearImages()
    for (const image of sourceImages) await putImage(image)

    const sourceTask = task({
      outputImages: sourceImages.map(({ id }) => id),
      params: { ...DEFAULT_PARAMS, n: 3 },
      category: {
        workflow: 'amazon-aplus',
        aPlusType: 'mobile',
        amazonSlot: 'A+M01',
      },
    })
    useStore.setState({ tasks: [sourceTask] })

    const upscaledTask = await createAPlusBatchUpscaleTask(
      sourceTask,
      sourceImages.map(({ id }) => id),
      'mobile',
    )

    expect(upscaledTask.outputImages).toHaveLength(3)
    expect(upscaledTask.inputImageIds).toEqual(sourceImages.map(({ id }) => id))
    expect(upscaledTask.params).toMatchObject({
      n: 3,
      size: '600x450',
      output_format: 'png',
      quality: 'high',
      output_compression: null,
    })
    expect(Object.values(upscaledTask.actualParamsByImage ?? {})).toHaveLength(3)
    expect(Object.values(upscaledTask.actualParamsByImage ?? {})).toEqual(expect.arrayContaining([
      expect.objectContaining({ size: '600x450', output_format: 'png', quality: 'high' }),
    ]))
    expect(upscaledTask.category).toMatchObject({
      workflow: 'amazon-aplus',
      aPlusType: 'mobile',
      amazonSlot: 'A+M01 · 批量等比放大',
    })
    expect(useStore.getState().tasks[0]?.id).toBe(upscaledTask.id)
  })

  it('preserves reused A+ category and type on the next submit', async () => {
    await reuseConfig(task({
      prompt: 'original aplus prompt',
      category: {
        productTitle: 'LED Desk Lamp',
        workflow: 'amazon-aplus',
        amazonSlot: 'A+S01',
        aPlusType: 'standard',
      },
    }))

    useStore.getState().setPrompt('revised aplus prompt')
    await submitTask()

    expect(useStore.getState().tasks[0]?.category).toMatchObject({
      productTitle: 'LED Desk Lamp',
      workflow: 'amazon-aplus',
      amazonSlot: 'A+S01',
      aPlusType: 'standard',
    })
  })

  it('replacing a stale Amazon pending category with a normal reused task submits as gallery', async () => {
    useStore.setState({
      pendingTaskCategory: {
        mode: 'next-submit',
        category: {
          productTitle: 'Large Folding Umbrella',
          workflow: 'amazon-listing',
          amazonSlot: 'MAIN',
        },
      },
    })

    await reuseConfig(task({
      prompt: 'regular prompt',
      category: { workflow: 'gallery' },
    }))

    useStore.getState().setPrompt('changed regular prompt')
    await submitTask()

    expect(useStore.getState().tasks[0]?.category).toEqual({ workflow: 'gallery' })
  })

  it('preserves selected image mentions when replacing a mask target with an equivalent image id', () => {
    const replacement = { id: 'image-a-replacement', dataUrl: imageA.dataUrl }
    const prompt = `参考 ${getSelectedImageMentionLabel(0)} 生成`
    useStore.setState({
      prompt,
      inputImages: [imageA, imageB],
    })

    useStore.getState().setInputImages([replacement, imageB], {
      equivalentImageIds: { [imageA.id]: replacement.id },
    })

    const state = useStore.getState()
    expect(state.inputImages.map((img) => img.id)).toEqual([replacement.id, imageB.id])
    expect(state.prompt).toBe(prompt)
  })
})

describe('interrupted OpenAI running tasks', () => {
  it('requires manual continuation for every provider in a restored A+ batch', () => {
    const tasks = ['openai', 'fal', 'custom'].map((provider) => task({
      id: `restore-${provider}`, apiProvider: provider, status: 'running',
      falRecoverable: provider === 'fal', customRecoverable: provider === 'custom',
      aPlusConversion: { sourceImageId: 'source', target: 'mobile', panelCount: 2, batchId: 'batch' },
    }))
    const result = markInterruptedOpenAIRunningTasks(tasks)
    expect(result.tasks.every((task) => task.status === 'error' && !task.falRecoverable && !task.customRecoverable)).toBe(true)
    expect(result.interruptedTasks).toHaveLength(3)
  })
  it('marks legacy and OpenAI running tasks as interrupted', () => {
    const now = 10_000
    const legacyRunning = task({ id: 'legacy-running', status: 'running', createdAt: 1_000, finishedAt: null, elapsed: null })
    const openAIRunning = task({ id: 'openai-running', apiProvider: 'openai', status: 'running', createdAt: 2_000, finishedAt: null, elapsed: null })
    const falRunning = task({ id: 'fal-running', apiProvider: 'fal', status: 'running', createdAt: 3_000, finishedAt: null, elapsed: null })
    const customAsyncRunning = task({ id: 'custom-running', apiProvider: 'custom-provider', customTaskId: 'task-1', status: 'running', createdAt: 4_000, finishedAt: null, elapsed: null })
    const doneTask = task({ id: 'done-task', apiProvider: 'openai', status: 'done' })

    const result = markInterruptedOpenAIRunningTasks([legacyRunning, openAIRunning, falRunning, customAsyncRunning, doneTask], now)

    expect(result.interruptedTasks.map((item) => item.id)).toEqual(['legacy-running', 'openai-running'])
    expect(result.tasks.find((item) => item.id === 'legacy-running')).toMatchObject({
      status: 'error',
      error: expect.stringContaining('请求中断'),
      finishedAt: now,
      elapsed: 9_000,
    })
    expect(result.tasks.find((item) => item.id === 'openai-running')).toMatchObject({
      status: 'error',
      error: expect.stringContaining('请求中断'),
      finishedAt: now,
      elapsed: 8_000,
    })
    expect(result.tasks.find((item) => item.id === 'fal-running')).toEqual(falRunning)
    expect(result.tasks.find((item) => item.id === 'custom-running')).toEqual(customAsyncRunning)
    expect(result.tasks.find((item) => item.id === 'done-task')).toEqual(doneTask)
  })
})

describe('input persistence setting', () => {
  beforeEach(() => {
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      appMode: 'gallery',
      prompt: 'prompt',
      inputImages: [imageA],
      galleryInputDraft: null,
      dismissedCodexCliPrompts: [],
    })
  })

  it('persists input when restart input restore is enabled', () => {
    const persisted = getPersistedState(useStore.getState())

    expect(persisted.prompt).toBe('prompt')
    expect(persisted.inputImages).toEqual([{ id: imageA.id, dataUrl: '' }])
  })

  it('omits input when restart input restore is disabled', () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS, persistInputOnRestart: false } })

    const persisted = getPersistedState(useStore.getState())

    expect(persisted).not.toHaveProperty('prompt')
    expect(persisted).not.toHaveProperty('inputImages')
  })

  it('writes empty input when persisted input is cleared', () => {
    useStore.setState({ prompt: '', inputImages: [] })

    const persisted = getPersistedState(useStore.getState())

    expect(persisted.prompt).toBe('')
    expect(persisted.inputImages).toEqual([])
  })
})

describe('admin model options compatibility', () => {
  it('restores legacy model options as image models and keeps planner options separate', () => {
    const current = useStore.getState()
    const legacy = mergePersistedState({ adminAccess: { modelIds: ['gpt-image-2', 'gpt-image-2'] } }, current)
    expect(legacy.adminAccess.modelIds).toEqual(['gpt-image-2'])
    expect(legacy.adminAccess.plannerModelIds).toEqual([])

    const separated = mergePersistedState({ adminAccess: {
      modelIds: [' gpt-image-2 '],
      plannerModelIds: ['gpt-5.5', ' gpt-5.5 ', 'deepseek-chat'],
    } }, current)
    expect(separated.adminAccess.modelIds).toEqual(['gpt-image-2'])
    expect(separated.adminAccess.plannerModelIds).toEqual(['gpt-5.5', 'deepseek-chat'])
  })
})

describe('app page prompt drafts', () => {
  beforeEach(() => {
    useStore.setState({
      appMode: 'gallery',
      appPage: 'home',
      prompt: '',
      pagePromptDrafts: { home: '', editor: '' },
      inputImages: [],
      styleReferenceImage: null,
      galleryInputDraft: null,
      settings: { ...DEFAULT_SETTINGS },
    })
  })

  it('keeps independent home and editor prompts across page switches', () => {
    useStore.getState().setPrompt('首页未提交草稿')
    useStore.getState().setAppPage('editor')

    expect(useStore.getState()).toMatchObject({
      appPage: 'editor',
      prompt: '',
      pagePromptDrafts: { home: '首页未提交草稿', editor: '' },
    })

    useStore.getState().setPrompt('编辑页未提交草稿')
    useStore.getState().setAppPage('listing-copy')
    useStore.getState().setAppPage('home')
    expect(useStore.getState().prompt).toBe('首页未提交草稿')

    useStore.getState().setAppPage('editor')
    expect(useStore.getState().prompt).toBe('编辑页未提交草稿')
  })

  it('keeps dismissed editor results across tabs and resets them for a new active task', () => {
    useStore.setState({
      editorActiveTaskId: 'task-a',
      editorHiddenResultImageIds: ['result-a'],
    })
    useStore.getState().setAppPage('editor')
    useStore.getState().setAppPage('home')
    useStore.getState().setAppPage('editor')
    expect(useStore.getState().editorHiddenResultImageIds).toEqual(['result-a'])

    useStore.getState().setEditorActiveTaskId('task-b')
    expect(useStore.getState().editorHiddenResultImageIds).toEqual([])
  })

  it('preserves the home draft when opening an image in the editor', async () => {
    await putImage(imageA)
    useStore.getState().setPrompt('首页待继续的提示词')

    expect(await openImageEditor(imageA.id)).toBe(true)

    expect(useStore.getState()).toMatchObject({
      appPage: 'editor',
      prompt: '',
      pagePromptDrafts: { home: '首页待继续的提示词', editor: '' },
      editorActiveImageId: imageA.id,
    })
    useStore.getState().setAppPage('home')
    expect(useStore.getState().prompt).toBe('首页待继续的提示词')
  })

  it('persists both prompt drafts only when restart input restore is enabled', () => {
    useStore.setState({ pagePromptDrafts: { home: '首页草稿', editor: '编辑草稿' } })
    expect(getPersistedState(useStore.getState()).pagePromptDrafts).toEqual({ home: '首页草稿', editor: '编辑草稿' })

    useStore.setState({ settings: { ...DEFAULT_SETTINGS, persistInputOnRestart: false } })
    expect(getPersistedState(useStore.getState()).pagePromptDrafts).toEqual({ home: '', editor: '' })
  })
})

describe('agent conversation creation', () => {
  beforeEach(() => {
    useStore.setState({
      agentConversations: [],
      activeAgentConversationId: null,
      agentSidebarCollapsed: false,
      agentEditingRoundId: null,
    })
  })

  it('refreshes the latest empty conversation instead of creating another one', () => {
    const olderEmpty = agentConversation({ id: 'older-empty', createdAt: 1_000, updatedAt: 1_000 })
    const latestEmpty = agentConversation({ id: 'latest-empty', createdAt: 2_000, updatedAt: 2_000 })
    const now = vi.spyOn(Date, 'now').mockReturnValue(3_000)
    useStore.setState({
      agentConversations: [olderEmpty, latestEmpty],
      activeAgentConversationId: olderEmpty.id,
      agentSidebarCollapsed: false,
      agentEditingRoundId: 'editing-round',
    })

    const id = useStore.getState().createAgentConversation()

    const state = useStore.getState()
    expect(id).toBe(latestEmpty.id)
    expect(state.activeAgentConversationId).toBe(latestEmpty.id)
    expect(state.agentConversations).toHaveLength(2)
    expect(state.agentConversations.find((item) => item.id === latestEmpty.id)).toMatchObject({
      createdAt: 3_000,
      updatedAt: 3_000,
    })
    expect(state.agentConversations.find((item) => item.id === olderEmpty.id)).toEqual(olderEmpty)
    expect(state.agentSidebarCollapsed).toBe(true)
    expect(state.agentEditingRoundId).toBeNull()
    now.mockRestore()
  })

  it('creates a new conversation when the latest conversation has messages', () => {
    const olderEmpty = agentConversation({ id: 'older-empty', createdAt: 1_000, updatedAt: 1_000 })
    const latestUsed = agentConversation({
      id: 'latest-used',
      activeRoundId: 'round-a',
      createdAt: 2_000,
      updatedAt: 2_000,
      rounds: [{
        id: 'round-a',
        index: 1,
        parentRoundId: null,
        userMessageId: 'message-a',
        prompt: 'prompt',
        inputImageIds: [],
        outputTaskIds: [],
        status: 'done',
        error: null,
        createdAt: 2_000,
        finishedAt: 2_000,
      }],
      messages: [{ id: 'message-a', role: 'user', content: 'prompt', roundId: 'round-a', createdAt: 2_000 }],
    })
    const now = vi.spyOn(Date, 'now').mockReturnValue(3_000)
    useStore.setState({ agentConversations: [olderEmpty, latestUsed], activeAgentConversationId: latestUsed.id })

    const id = useStore.getState().createAgentConversation()

    const state = useStore.getState()
    expect(id).not.toBe(olderEmpty.id)
    expect(id).not.toBe(latestUsed.id)
    expect(state.agentConversations).toHaveLength(3)
    expect(state.agentConversations[state.agentConversations.length - 1]).toMatchObject({ id, createdAt: 3_000, updatedAt: 3_000, messages: [], rounds: [] })
    expect(state.activeAgentConversationId).toBe(id)
    now.mockRestore()
  })
})

describe('data import', () => {
  beforeEach(async () => {
    await clearAmazonPlannerSessions()
    await clearListingCopySessions()
    useStore.setState({
      tasks: [],
      agentConversations: [],
      activeAgentConversationId: null,
      showToast: vi.fn(),
    })
  })

  it('skips empty agent conversations when importing task data', async () => {
    const usedConversation = agentConversation({
      id: 'used-conversation',
      activeRoundId: 'round-a',
      rounds: [{
        id: 'round-a',
        index: 1,
        parentRoundId: null,
        userMessageId: 'message-a',
        prompt: 'prompt',
        inputImageIds: [],
        outputTaskIds: [],
        status: 'done',
        error: null,
        createdAt: 1,
        finishedAt: 2,
      }],
      messages: [{ id: 'message-a', role: 'user', content: 'prompt', roundId: 'round-a', createdAt: 1 }],
    })

    const imported = await importData(importFile({
      version: 3,
      exportedAt: new Date(0).toISOString(),
      tasks: [],
      agentConversations: [
        agentConversation({ id: 'empty-conversation' }),
        usedConversation,
      ],
      imageFiles: {},
    }), { importConfig: false, importTasks: true })

    const state = useStore.getState()
    expect(imported).toBe(true)
    expect(state.agentConversations.map((conversation) => conversation.id)).toEqual(['used-conversation'])
    expect(state.activeAgentConversationId).toBe('used-conversation')
  })

  it('merges imported agent conversations without replacing local conversations', async () => {
    const localConversation = agentConversation({
      id: 'local-conversation',
      title: '本地对话',
      createdAt: 1,
      updatedAt: 1,
    })
    const importedConversation = agentConversation({
      id: 'imported-conversation',
      activeRoundId: 'round-a',
      rounds: [{
        id: 'round-a',
        index: 1,
        parentRoundId: null,
        userMessageId: 'message-a',
        prompt: 'imported prompt',
        inputImageIds: [],
        outputTaskIds: [],
        status: 'done',
        error: null,
        createdAt: 2,
        finishedAt: 3,
      }],
      messages: [{ id: 'message-a', role: 'user', content: 'imported prompt', roundId: 'round-a', createdAt: 2 }],
    })
    useStore.setState({
      agentConversations: [localConversation],
      activeAgentConversationId: localConversation.id,
    })

    const imported = await importData(importFile({
      version: 3,
      exportedAt: new Date(0).toISOString(),
      tasks: [],
      agentConversations: [importedConversation],
      imageFiles: {},
    }), { importConfig: false, importTasks: true })

    const state = useStore.getState()
    expect(imported).toBe(true)
    expect(state.agentConversations.map((conversation) => conversation.id)).toEqual(['local-conversation', 'imported-conversation'])
    expect(state.activeAgentConversationId).toBe('local-conversation')
  })

  it('imports Amazon planner session history with task data', async () => {
    const session = amazonPlannerSession({
      id: 'imported-planner-session',
      referenceImageIds: ['image-a'],
      selectedStylePresetId: 'clean-tech',
      selectedStyleReferenceImageId: 'preset-style-image',
      styleImages: [{ candidateIndex: 0, imageId: 'style-image-a' }],
      selectedStyleIndex: 0,
    })

    const imported = await importData(importFile({
      version: 4,
      exportedAt: new Date(0).toISOString(),
      tasks: [],
      amazonPlannerSessions: [session],
      imageFiles: {},
    }), { importConfig: false, importTasks: true })

    expect(imported).toBe(true)
    expect(await getAllAmazonPlannerSessions()).toEqual([{ ...session, marketplace: 'us' }])
    expect(useStore.getState().showToast).toHaveBeenCalledWith('已导入 0 条记录和 1 条策划历史', 'success')
  })

  it('imports Listing copy history and restores the US marketplace default', async () => {
    const session = listingCopySession({ marketplace: undefined as never })
    const imported = await importData(importFile({
      version: 4,
      exportedAt: new Date(0).toISOString(),
      tasks: [],
      listingCopySessions: [session],
      imageFiles: {},
    }), { importConfig: false, importTasks: true })

    expect(imported).toBe(true)
    expect(await getAllListingCopySessions()).toEqual([{ ...session, marketplace: 'us' }])
    expect(useStore.getState().showToast).toHaveBeenCalledWith('已导入 0 条记录和 1 条策划历史', 'success')
  })

  it('imports custom style references with config data', async () => {
    useStore.setState({ settings: { ...DEFAULT_SETTINGS } })

    const imported = await importData(importFile({
      version: 4,
      exportedAt: new Date(0).toISOString(),
      settings: normalizeSettings({
        customStyleReferences: [
          {
            id: 'custom-style-a',
            basePresetId: 'clean-tech',
            title: 'Custom clean style',
            editState: {
              title: 'Custom clean style',
              palette: ['#FFFFFF', '#E5E7EB', '#111827', '#2563EB', '#16A34A', '#F97316'],
              typography: 'Clean sans',
              lighting: 'Soft light',
              material: 'Satin panels',
              density: 'rich',
            },
            imageId: 'custom-style-image',
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      }),
    }), { importConfig: true, importTasks: false })

    expect(imported).toBe(true)
    expect(useStore.getState().settings.customStyleReferences).toHaveLength(1)
    expect(useStore.getState().settings.customStyleReferences[0]).toMatchObject({
      id: 'custom-style-a',
      imageId: 'custom-style-image',
    })
  })

  it('merges imported text notes and keeps the newer local version', async () => {
    const localNote: TextNote = { id: 'same-note', title: 'Local newer', content: 'local', createdAt: 1, updatedAt: 5 }
    const importedNote: TextNote = { id: 'imported-note', title: 'Imported', content: 'imported', createdAt: 2, updatedAt: 4 }
    const storage = createTextNotesStorage([localNote])
    const dispatchEvent = vi.fn()
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent })

    const imported = await importData(importFile({
      version: 5,
      exportedAt: new Date(0).toISOString(),
      textNotes: [
        { ...localNote, title: 'Imported older', updatedAt: 3 },
        importedNote,
      ],
    }), { importConfig: false, importTasks: false })

    expect(imported).toBe(true)
    expect(readTextNotes(storage)).toEqual([localNote, importedNote])
    expect(dispatchEvent).toHaveBeenCalled()
    expect(useStore.getState().showToast).toHaveBeenCalledWith('数据已成功导入，2 条文字笔记', 'success')
    vi.unstubAllGlobals()
  })
})

describe('data export and clearing', () => {
  beforeEach(async () => {
    await clearAmazonPlannerSessions()
    await clearListingCopySessions()
    await clearImages()
    useStore.setState({
      tasks: [],
      agentConversations: [],
      activeAgentConversationId: null,
      settings: { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      showToast: vi.fn(),
    })
  })

  it('exports Amazon planner session history in the backup manifest', async () => {
    const session = amazonPlannerSession({
      id: 'exported-planner-session',
      referenceImageIds: ['image-a'],
      selectedStylePresetId: 'clean-tech',
      selectedStyleReferenceImageId: 'preset-style-image',
      styleImages: [{ candidateIndex: 0, imageId: 'style-image-a' }],
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    await putAmazonPlannerSession(session)
    await putImage({ id: 'image-a', dataUrl: 'data:image/png;base64,YQ==', createdAt: 1_700_000_000_000, source: 'upload' })
    await putImage({ id: 'preset-style-image', dataUrl: 'data:image/png;base64,Yw==', createdAt: 1_700_000_000_000, source: 'preset' })
    await putImage({ id: 'style-image-a', dataUrl: 'data:image/png;base64,Yg==', createdAt: 1_700_000_000_000, source: 'generated' })

    const clickedDownloads: Array<{ download?: string; href?: string }> = []
    const anchor = {
      href: '',
      download: '',
      click: vi.fn(() => {
        clickedDownloads.push({ download: anchor.download, href: anchor.href })
      }),
    }
    const exportedTextNote: TextNote = { id: 'note-a', title: '常用提示词', content: 'prompt body', createdAt: 1, updatedAt: 2 }
    vi.stubGlobal('window', { localStorage: createTextNotesStorage([exportedTextNote]) })
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
    })
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await exportData({ exportConfig: false, exportTasks: true })

    expect(useStore.getState().showToast).not.toHaveBeenCalledWith(expect.stringContaining('导出失败'), 'error')
    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob
    const buffer = await blob.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buffer))
    const manifest = JSON.parse(strFromU8(unzipped['manifest.json'])) as ExportData
    expect(manifest.version).toBe(5)
    expect(manifest.amazonPlannerSessions).toEqual([session])
    expect(manifest.textNotes).toEqual([exportedTextNote])
    expect(manifest.imageFiles).toHaveProperty('image-a')
    expect(manifest.imageFiles).toHaveProperty('preset-style-image')
    expect(manifest.imageFiles).toHaveProperty('style-image-a')
    expect(manifest.imageFiles?.['preset-style-image']?.source).toBe('preset')
    expect(clickedDownloads[0]?.download).toContain('amazon-image-studio-backup')

    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
    vi.unstubAllGlobals()
  })

  it('exports Listing copy history and its reference images', async () => {
    const timestamp = 1_700_000_000_000
    const session = listingCopySession({ referenceImageIds: ['copy-reference-image'], createdAt: timestamp, updatedAt: timestamp })
    await putListingCopySession(session)
    await putImage({ id: 'copy-reference-image', dataUrl: 'data:image/png;base64,YQ==', createdAt: timestamp, source: 'upload' })
    const anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) })
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => 'blob:backup')
    const revokeObjectUrl = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })

    await exportData({ exportConfig: false, exportTasks: true })

    expect(useStore.getState().showToast).not.toHaveBeenCalledWith(expect.stringContaining('导出失败'), 'error')
    expect(createObjectUrl).toHaveBeenCalled()
    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob
    const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const manifest = JSON.parse(strFromU8(unzipped['manifest.json'])) as ExportData
    expect(manifest.listingCopySessions).toEqual([session])
    expect(manifest.imageFiles).toHaveProperty('copy-reference-image')
    vi.unstubAllGlobals()
  })

  it('exports custom style library config and referenced custom style images', async () => {
    const customStyle = {
      id: 'custom-style-a',
      basePresetId: 'clean-tech',
      title: 'Custom clean style',
      editState: {
        title: 'Custom clean style',
        palette: ['#FFFFFF', '#E5E7EB', '#111827', '#2563EB', '#16A34A', '#F97316'],
        typography: 'Clean sans',
        lighting: 'Soft light',
        material: 'Satin panels',
        density: 'rich' as const,
      },
      imageId: 'custom-style-image',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_100,
    }
    const session = amazonPlannerSession({
      id: 'custom-style-session',
      selectedStylePresetId: 'clean-tech',
      selectedStyleReferenceImageId: customStyle.imageId,
      selectedCustomStyleReferenceId: customStyle.id,
      selectedCustomStyleReferenceSnapshot: customStyle,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        customStyleReferences: [customStyle],
      }),
    })
    await putAmazonPlannerSession(session)
    await putImage({ id: customStyle.imageId, dataUrl: 'data:image/png;base64,Yw==', createdAt: 1_700_000_000_000, source: 'style-custom' })

    const anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
    })
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await exportData({ exportConfig: true, exportTasks: true })

    const blob = createObjectUrl.mock.calls[0]?.[0] as Blob
    const buffer = await blob.arrayBuffer()
    const unzipped = unzipSync(new Uint8Array(buffer))
    const manifest = JSON.parse(strFromU8(unzipped['manifest.json'])) as ExportData
    expect(manifest.settings?.customStyleReferences).toEqual([customStyle])
    expect(manifest.amazonPlannerSessions?.[0]).toMatchObject({
      selectedCustomStyleReferenceId: customStyle.id,
      selectedStyleReferenceImageId: customStyle.imageId,
    })
    expect(manifest.imageFiles?.[customStyle.imageId]?.source).toBe('style-custom')

    createObjectUrl.mockRestore()
    revokeObjectUrl.mockRestore()
    vi.unstubAllGlobals()
  })

  it('clears Amazon planner sessions when clearing task data', async () => {
    await putAmazonPlannerSession(amazonPlannerSession())
    await putListingCopySession(listingCopySession())

    await clearData({ clearConfig: false, clearTasks: true })

    expect(await getAllAmazonPlannerSessions()).toEqual([])
    expect(await getAllListingCopySessions()).toEqual([])
  })
})

describe('planner history image retention', () => {
  beforeEach(async () => {
    await clearTasks()
    await clearAmazonPlannerSessions()
    await clearImages()
    useStore.setState({
      tasks: [],
      inputImages: [],
      styleReferenceImage: null,
      galleryInputDraft: null,
      agentInputDrafts: {},
      agentConversations: [],
      activeAgentConversationId: null,
      settings: normalizeSettings({ ...DEFAULT_SETTINGS, customStyleReferences: [] }),
    })
  })

  it('keeps images referenced only by Amazon planner history during startup cleanup', async () => {
    const referenceImage = { id: 'planner-reference-only', dataUrl: 'data:image/png;base64,reference', createdAt: 1, source: 'upload' as const }
    const styleImage = { id: 'planner-style-only', dataUrl: 'data:image/png;base64,style', createdAt: 1, source: 'preset' as const }
    const aiStyleImage = { id: 'planner-ai-style-only', dataUrl: 'data:image/png;base64,ai-style', createdAt: 1, source: 'generated' as const }
    const legacyStyleImage = { id: 'planner-legacy-style-only', dataUrl: 'data:image/png;base64,legacy', createdAt: 1, source: 'generated' as const }
    const orphanImage = { id: 'truly-unreferenced', dataUrl: 'data:image/png;base64,orphan', createdAt: 1, source: 'upload' as const }
    for (const image of [referenceImage, styleImage, aiStyleImage, legacyStyleImage, orphanImage]) await putImage(image)
    await putAmazonPlannerSession(amazonPlannerSession({
      referenceImageIds: [referenceImage.id],
      selectedStyleReferenceImageId: styleImage.id,
      aiStyleReferenceImageId: aiStyleImage.id,
      styleImages: [{ candidateIndex: 0, imageId: legacyStyleImage.id }],
    }))
    vi.stubGlobal('window', {
      requestIdleCallback: vi.fn(),
      setTimeout,
    })

    try {
      await initStore()

      expect(await getImage(referenceImage.id)).toBeDefined()
      expect(await getImage(styleImage.id)).toBeDefined()
      expect(await getImage(aiStyleImage.id)).toBeDefined()
      expect(await getImage(legacyStyleImage.id)).toBeDefined()
      expect(await getImage(orphanImage.id)).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('agent draft lifecycle', () => {
  const responsesProfile = createDefaultOpenAIProfile({ id: 'openai-responses', apiKey: 'openai-key', apiMode: 'responses' })
  const draftState = {
    prompt: `参考 ${getSelectedImageMentionLabel(0)} 生成`,
    inputImages: [imageA],
    styleReferenceImage: null,
    maskDraft: {
      targetImageId: imageA.id,
      maskDataUrl: 'data:image/png;base64,mask',
      updatedAt: 1,
    },
    maskEditorImageId: imageA.id,
    agentEditingRoundId: 'round-a',
  }

  beforeEach(() => {
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        profiles: [responsesProfile],
        activeProfileId: responsesProfile.id,
      }),
      appMode: 'agent',
      agentConversations: [
        agentConversation({ id: 'conversation-a' }),
        agentConversation({ id: 'conversation-b' }),
      ],
      activeAgentConversationId: 'conversation-a',
      galleryInputDraft: null,
      agentInputDrafts: {},
      agentSidebarCollapsed: false,
      agentAssetPanelCollapsed: false,
      ...draftState,
    })
  })

  it('clears visible input but keeps the agent draft when returning to gallery mode', () => {
    useStore.getState().setAppMode('gallery')

    const state = useStore.getState()
    expect(state.appMode).toBe('gallery')
    expect(state.prompt).toBe('')
    expect(state.inputImages).toEqual([])
    expect(state.maskDraft).toBeNull()
    expect(state.maskEditorImageId).toBeNull()
    expect(state.agentEditingRoundId).toBeNull()
    expect(state.agentInputDrafts['conversation-a']).toMatchObject({
      prompt: draftState.prompt,
      inputImages: draftState.inputImages,
      maskDraft: draftState.maskDraft,
      maskEditorImageId: imageA.id,
    })
  })

  it('does not enter agent mode when requested from gallery mode', () => {
    useStore.getState().setAppMode('gallery')
    useStore.getState().setAppMode('agent')

    const state = useStore.getState()
    expect(state.appMode).toBe('gallery')
    expect(state.prompt).toBe('')
    expect(state.inputImages).toEqual([])
    expect(state.maskDraft).toBeNull()
    expect(state.maskEditorImageId).toBeNull()
    expect(state.agentEditingRoundId).toBeNull()
    expect(state.agentInputDrafts['conversation-a']).toMatchObject({
      prompt: draftState.prompt,
      inputImages: draftState.inputImages,
      maskDraft: draftState.maskDraft,
      maskEditorImageId: imageA.id,
    })
  })

  it('normalizes persisted agent mode back to gallery while retaining agent drafts', () => {
    const merged = mergePersistedState({
      appMode: 'agent',
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        persistInputOnRestart: true,
      }),
      galleryInputDraft: {
        prompt: 'gallery draft',
        inputImages: [imageB],
        styleReferenceImage: null,
        maskDraft: null,
        maskEditorImageId: null,
      },
      agentConversations: [agentConversation({ id: 'conversation-a' })],
      activeAgentConversationId: 'conversation-a',
      agentInputDrafts: {
        'conversation-a': {
          prompt: 'agent draft',
          inputImages: [imageA],
          styleReferenceImage: null,
          maskDraft: null,
          maskEditorImageId: null,
          updatedAt: Date.now(),
        },
      },
    }, useStore.getState())

    expect(merged.appMode).toBe('gallery')
    expect(merged.prompt).toBe('gallery draft')
    expect(merged.inputImages).toEqual([imageB])
    expect(merged.agentInputDrafts['conversation-a']?.prompt).toBe('agent draft')
  })

  it('keeps the gallery draft when agent mode is requested', () => {
    const galleryPrompt = `画廊 ${getSelectedImageMentionLabel(0)} 草稿`
    useStore.setState({
      appMode: 'gallery',
      prompt: galleryPrompt,
      inputImages: [imageB],
      maskDraft: null,
      maskEditorImageId: null,
      galleryInputDraft: null,
      agentInputDrafts: {
        'conversation-a': {
          prompt: draftState.prompt,
          inputImages: draftState.inputImages,
          styleReferenceImage: null,
          maskDraft: draftState.maskDraft,
          maskEditorImageId: imageA.id,
        },
      },
    })

    useStore.getState().setAppMode('agent')

    let state = useStore.getState()
    expect(state.appMode).toBe('gallery')
    expect(state.galleryInputDraft).toMatchObject({ prompt: galleryPrompt, inputImages: [imageB] })
    expect(state.prompt).toBe(galleryPrompt)
    expect(state.inputImages).toEqual([imageB])

    useStore.getState().setAppMode('gallery')

    state = useStore.getState()
    expect(state.appMode).toBe('gallery')
    expect(state.prompt).toBe(galleryPrompt)
    expect(state.inputImages).toEqual([imageB])
  })

  it('persists the gallery draft while agent mode is active', () => {
    const galleryPrompt = 'gallery draft'
    useStore.setState({
      appMode: 'agent',
      galleryInputDraft: {
        prompt: galleryPrompt,
        inputImages: [imageB],
        styleReferenceImage: null,
        maskDraft: null,
        maskEditorImageId: null,
      },
    })

    const persisted = getPersistedState(useStore.getState())

    expect(persisted.prompt).toBe(galleryPrompt)
    expect(persisted.inputImages).toEqual([{ id: imageB.id, dataUrl: '' }])
  })

  it('clears stale mentions in the visible input when switching conversations', () => {
    useStore.getState().setActiveAgentConversationId('conversation-b')

    const state = useStore.getState()
    expect(state.activeAgentConversationId).toBe('conversation-b')
    expect(state.prompt).toBe('')
    expect(state.inputImages).toEqual([])
    expect(state.maskDraft).toBeNull()
    expect(state.maskEditorImageId).toBeNull()
    expect(state.agentEditingRoundId).toBeNull()
    expect(state.agentInputDrafts['conversation-a']?.prompt).toBe(draftState.prompt)
  })

  it('restores the previous conversation draft when switching back', () => {
    useStore.getState().setActiveAgentConversationId('conversation-b')
    useStore.getState().setActiveAgentConversationId('conversation-a')

    const state = useStore.getState()
    expect(state.activeAgentConversationId).toBe('conversation-a')
    expect(state.prompt).toBe(draftState.prompt)
    expect(state.inputImages).toEqual(draftState.inputImages)
    expect(state.maskDraft).toEqual(draftState.maskDraft)
    expect(state.maskEditorImageId).toBe(imageA.id)
    expect(state.agentEditingRoundId).toBeNull()
  })

  it('keeps the current draft when selecting the already active conversation', () => {
    useStore.getState().setActiveAgentConversationId('conversation-a')

    const state = useStore.getState()
    expect(state.prompt).toBe(draftState.prompt)
    expect(state.inputImages).toEqual(draftState.inputImages)
    expect(state.maskDraft).toEqual(draftState.maskDraft)
    expect(state.maskEditorImageId).toBe(imageA.id)
  })

  it('persists agent drafts separately from the gallery input draft', () => {
    const persisted = getPersistedState(useStore.getState())

    expect(persisted).not.toHaveProperty('prompt')
    expect(persisted.agentInputDrafts['conversation-a']).toMatchObject({
      prompt: draftState.prompt,
      inputImages: [{ id: imageA.id, dataUrl: '' }],
      maskDraft: draftState.maskDraft,
      maskEditorImageId: imageA.id,
    })
    expect(persisted.agentInputDrafts['conversation-a']?.updatedAt).toEqual(expect.any(Number))
  })

  it('removes stale agent drafts except the last active conversation', () => {
    const now = 10 * 24 * 60 * 60 * 1000
    const staleUpdatedAt = now - 3 * 24 * 60 * 60 * 1000 - 1
    const recentUpdatedAt = now - 3 * 24 * 60 * 60 * 1000
    const activeDraft = { prompt: 'active', inputImages: [], styleReferenceImage: null, maskDraft: null, maskEditorImageId: null, updatedAt: staleUpdatedAt }
    const staleDraft = { prompt: 'stale', inputImages: [], styleReferenceImage: null, maskDraft: null, maskEditorImageId: null, updatedAt: staleUpdatedAt }
    const recentDraft = { prompt: 'recent', inputImages: [], styleReferenceImage: null, maskDraft: null, maskEditorImageId: null, updatedAt: recentUpdatedAt }

    const cleaned = cleanStaleAgentInputDrafts({
      'conversation-a': activeDraft,
      'conversation-b': staleDraft,
      'conversation-c': recentDraft,
    }, 'conversation-a', now)

    expect(cleaned).toEqual({
      'conversation-a': activeDraft,
      'conversation-c': recentDraft,
    })
  })

})

describe('agent context for removed outputs', () => {
  beforeEach(() => {
    const profile = createDefaultOpenAIProfile({
      id: 'responses-profile',
      apiKey: 'test-key',
      apiMode: 'responses',
      model: DEFAULT_RESPONSES_MODEL,
    })
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        apiMode: 'responses',
        model: DEFAULT_RESPONSES_MODEL,
        profiles: [profile],
        activeProfileId: profile.id,
      }),
      prompt: '继续',
      inputImages: [],
      maskDraft: null,
      params: { ...DEFAULT_PARAMS },
      appMode: 'agent',
      tasks: [task({
        id: 'task-live',
        outputImages: ['image-live'],
        sourceMode: 'agent',
        agentRoundId: 'round-a',
        agentToolCallId: 'live-call',
      })],
      agentConversations: [agentConversation({
        id: 'conversation-a',
        activeRoundId: 'round-a',
        rounds: [{
          id: 'round-a',
          index: 1,
          parentRoundId: null,
          userMessageId: 'user-a',
          assistantMessageId: 'assistant-a',
          prompt: '画两张图',
          inputImageIds: [],
          outputTaskIds: ['task-deleted', 'task-live'],
          responseOutput: [
            { type: 'message', content: [{ type: 'output_text', text: '已生成两张图。' }] },
            { type: 'image_generation_call', id: 'deleted-call', result: 'deleted-base64' },
            { type: 'image_generation_call', id: 'live-call', result: 'live-base64' },
          ],
          status: 'done',
          error: null,
          createdAt: 1,
          finishedAt: 2,
        }],
        messages: [
          { id: 'user-a', role: 'user', content: '画两张图', roundId: 'round-a', createdAt: 1 },
          { id: 'assistant-a', role: 'assistant', content: '已生成两张图。', roundId: 'round-a', outputTaskIds: ['task-deleted', 'task-live'], createdAt: 2 },
        ],
      })],
      activeAgentConversationId: 'conversation-a',
      agentEditingRoundId: null,
      showToast: vi.fn(),
    })
    vi.mocked(callAgentResponsesApi).mockClear()
    vi.mocked(callAgentResponsesApi).mockResolvedValue({
      text: 'ok',
      images: [],
      outputItems: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }],
      responseId: 'response-b',
    })
  })

  it('does not send removed image_generation results back to the model', async () => {
    await submitAgentMessage()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const input = vi.mocked(callAgentResponsesApi).mock.calls[0][0].input
    const serializedInput = JSON.stringify(input)
    expect(serializedInput).not.toContain('deleted-base64')
    expect(serializedInput).toContain('live-base64')
    expect(serializedInput).not.toContain('Generated image removed')
    expect(serializedInput).toContain('removed_ref')
    expect(serializedInput).toContain('round-1-image-1')
    expect(serializedInput).toContain('round-1-image-2')
  })

  it('scrubs stored agent response payloads when deleting an output task', async () => {
    const rawResponsePayload = JSON.stringify({
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '已生成两张图。' }] },
        { type: 'image_generation_call', id: 'deleted-call', result: 'deleted-base64' },
        { type: 'image_generation_call', id: 'live-call', result: 'live-base64' },
      ],
    }, null, 2)
    const deletedTask = task({
      id: 'task-deleted',
      outputImages: ['image-deleted'],
      rawResponsePayload,
      sourceMode: 'agent',
      agentRoundId: 'round-a',
      agentToolCallId: 'deleted-call',
    })
    const liveTask = task({
      id: 'task-live',
      outputImages: ['image-live'],
      rawResponsePayload,
      sourceMode: 'agent',
      agentRoundId: 'round-a',
      agentToolCallId: 'live-call',
    })
    useStore.setState((state) => ({
      tasks: [deletedTask, liveTask],
      agentConversations: state.agentConversations.map((conversation) => ({
        ...conversation,
        rounds: conversation.rounds.map((round) => round.id === 'round-a'
          ? { ...round, outputTaskIds: ['task-deleted', 'task-live'], responseOutput: JSON.parse(rawResponsePayload).output }
          : round,
        ),
      })),
    }))

    await removeTask(deletedTask)

    const state = useStore.getState()
    const serializedConversations = JSON.stringify(state.agentConversations)
    const remainingTaskPayload = state.tasks.find((item) => item.id === 'task-live')?.rawResponsePayload ?? ''
    expect(serializedConversations).not.toContain('deleted-base64')
    expect(remainingTaskPayload).not.toContain('deleted-base64')
    expect(serializedConversations).toContain('live-base64')
    expect(remainingTaskPayload).toContain('live-base64')
  })

  it('does not corrupt batch task payloads when deleting one of the batch tasks', async () => {
    const batchDeletedPayload = JSON.stringify({
      output: [{ type: 'image_generation_call', id: 'batch-deleted-call', result: 'batch-deleted-base64' }],
    }, null, 2)
    const batchLivePayload = JSON.stringify({
      output: [{ type: 'image_generation_call', id: 'batch-live-call', result: 'batch-live-base64' }],
    }, null, 2)
    const batchDeletedTask = task({
      id: 'batch-task-deleted',
      outputImages: ['batch-img-deleted'],
      rawResponsePayload: batchDeletedPayload,
      sourceMode: 'agent',
      agentRoundId: 'round-a',
      agentToolCallId: 'batch-deleted-call',
      agentBatchCallId: 'batch-fc-1',
    })
    const batchLiveTask = task({
      id: 'batch-task-live',
      outputImages: ['batch-img-live'],
      rawResponsePayload: batchLivePayload,
      sourceMode: 'agent',
      agentRoundId: 'round-a',
      agentToolCallId: 'batch-live-call',
      agentBatchCallId: 'batch-fc-1',
    })
    useStore.setState((state) => ({
      tasks: [batchDeletedTask, batchLiveTask],
      agentConversations: state.agentConversations.map((conversation) => ({
        ...conversation,
        rounds: conversation.rounds.map((round) => round.id === 'round-a'
          ? {
              ...round,
              outputTaskIds: ['batch-task-deleted', 'batch-task-live'],
              responseOutput: [
                { type: 'function_call', name: 'generate_image_batch', call_id: 'batch-fc-1', arguments: '{}' },
                { type: 'function_call_output', call_id: 'batch-fc-1', output: '{"images":[{"id":"1","status":"done"},{"id":"2","status":"done"}]}' },
              ],
            }
          : round,
        ),
      })),
    }))

    await removeTask(batchDeletedTask)

    const state = useStore.getState()
    const liveTaskPayload = state.tasks.find((item) => item.id === 'batch-task-live')?.rawResponsePayload ?? ''
    expect(liveTaskPayload).toContain('batch-live-base64')
    expect(liveTaskPayload).not.toContain('batch-deleted-base64')
    const serializedConversations = JSON.stringify(state.agentConversations)
    expect(serializedConversations).toContain('function_call_output')
    expect(serializedConversations).not.toContain('batch-deleted-base64')
  })
})

describe('agent batch reference resolution', () => {
  const responsesProfile = createDefaultOpenAIProfile({
    id: 'responses-profile',
    apiKey: 'test-key',
    apiMode: 'responses',
    model: DEFAULT_RESPONSES_MODEL,
  })

  beforeEach(async () => {
    await clearImages()
    await putImage(imageA)
    await putImage(imageB)
    vi.mocked(callAgentResponsesApi).mockClear()
    vi.mocked(callBatchImageSingle).mockClear()
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        apiKey: 'test-key',
        apiMode: 'responses',
        model: DEFAULT_RESPONSES_MODEL,
        profiles: [responsesProfile],
        activeProfileId: responsesProfile.id,
      }),
      prompt: '继续生成',
      inputImages: [],
      maskDraft: null,
      params: { ...DEFAULT_PARAMS },
      appMode: 'agent',
      tasks: [
        task({ id: 'task-branch-a', outputImages: [imageA.id], sourceMode: 'agent', agentRoundId: 'round-2-a' }),
        task({ id: 'task-branch-b', outputImages: [imageB.id], sourceMode: 'agent', agentRoundId: 'round-2-b' }),
      ],
      agentConversations: [agentConversation({
        id: 'conversation-a',
        activeRoundId: 'round-2-b',
        rounds: [
          {
            id: 'round-1',
            index: 1,
            parentRoundId: null,
            userMessageId: 'user-1',
            assistantMessageId: 'assistant-1',
            prompt: '画基础图',
            inputImageIds: [],
            outputTaskIds: [],
            status: 'done',
            error: null,
            createdAt: 1,
            finishedAt: 2,
          },
          {
            id: 'round-2-a',
            index: 2,
            parentRoundId: 'round-1',
            userMessageId: 'user-2-a',
            assistantMessageId: 'assistant-2-a',
            prompt: '分支 A',
            inputImageIds: [],
            outputTaskIds: ['task-branch-a'],
            status: 'done',
            error: null,
            createdAt: 3,
            finishedAt: 4,
          },
          {
            id: 'round-2-b',
            index: 2,
            parentRoundId: 'round-1',
            userMessageId: 'user-2-b',
            assistantMessageId: 'assistant-2-b',
            prompt: '分支 B',
            inputImageIds: [],
            outputTaskIds: ['task-branch-b'],
            status: 'done',
            error: null,
            createdAt: 5,
            finishedAt: 6,
          },
        ],
        messages: [
          { id: 'user-1', role: 'user', content: '画基础图', roundId: 'round-1', createdAt: 1 },
          { id: 'assistant-1', role: 'assistant', content: '完成', roundId: 'round-1', createdAt: 2 },
          { id: 'user-2-a', role: 'user', content: '分支 A', roundId: 'round-2-a', createdAt: 3 },
          { id: 'assistant-2-a', role: 'assistant', content: '完成', roundId: 'round-2-a', outputTaskIds: ['task-branch-a'], createdAt: 4 },
          { id: 'user-2-b', role: 'user', content: '分支 B', roundId: 'round-2-b', createdAt: 5 },
          { id: 'assistant-2-b', role: 'assistant', content: '完成', roundId: 'round-2-b', outputTaskIds: ['task-branch-b'], createdAt: 6 },
        ],
      })],
      activeAgentConversationId: 'conversation-a',
      agentEditingRoundId: null,
      showToast: vi.fn(),
    })
  })

  it('resolves batch references from the active branch path only', async () => {
    vi.mocked(callAgentResponsesApi)
      .mockResolvedValueOnce({
        text: '',
        images: [],
        outputItems: [{
          type: 'function_call',
          name: 'generate_image_batch',
          call_id: 'batch-call',
          arguments: JSON.stringify({
            images: [{
              id: 'next-image',
              prompt: '参考 <ref id="round-2-image-1" /> 生成',
              reference_ids: ['round-2-image-1'],
            }],
          }),
        }],
        responseId: 'response-1',
      })
      .mockResolvedValueOnce({
        text: '完成',
        images: [],
        outputItems: [{ type: 'message', content: [{ type: 'output_text', text: '完成' }] }],
        responseId: 'response-2',
      })

    await submitAgentMessage()

    for (let i = 0; i < 5 && vi.mocked(callBatchImageSingle).mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(callBatchImageSingle).toHaveBeenCalled()
    const batchArgs = vi.mocked(callBatchImageSingle).mock.calls[0][0]
    expect(batchArgs.referenceImageDataUrls).toEqual([imageB.dataUrl])
    expect(batchArgs.referenceImageDataUrls).not.toContain(imageA.dataUrl)
    expect(batchArgs.referenceIds).toEqual(['round-2-image-1'])
  })
})

describe('agent assistant regeneration', () => {
  const responsesProfile = createDefaultOpenAIProfile({ id: 'openai-responses', apiKey: 'openai-key', apiMode: 'responses' })

  beforeEach(() => {
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        profiles: [responsesProfile],
        activeProfileId: responsesProfile.id,
        alwaysShowRetryButton: false,
      }),
      params: { ...DEFAULT_PARAMS, n: 4 },
      agentEditingRoundId: 'round-a',
      agentConversations: [
        agentConversation({
          id: 'conversation-a',
          activeRoundId: 'round-a',
          rounds: [{
            id: 'round-a',
            index: 1,
            parentRoundId: null,
            userMessageId: 'user-a',
            assistantMessageId: 'assistant-a',
            prompt: '画一只猫',
            inputImageIds: [imageA.id],
            outputTaskIds: [],
            status: 'done',
            error: null,
            createdAt: 1,
            finishedAt: 2,
          }],
          messages: [
            { id: 'user-a', role: 'user', content: '画一只猫', roundId: 'round-a', inputImageIds: [imageA.id], createdAt: 1 },
            { id: 'assistant-a', role: 'assistant', content: '已完成。', roundId: 'round-a', createdAt: 2 },
          ],
        }),
      ],
      toast: null,
      showToast: vi.fn(),
      setConfirmDialog: vi.fn(),
    })
  })

  it('creates a sibling round from the assistant message regardless of retry setting', async () => {
    await regenerateAgentAssistantMessage('conversation-a', 'round-a')

    const conversation = useStore.getState().agentConversations[0]
    const newRound = conversation.rounds.find((round) => round.id !== 'round-a')
    expect(newRound).toMatchObject({
      index: 1,
      parentRoundId: null,
      prompt: '画一只猫',
      inputImageIds: [imageA.id],
      status: 'running',
      outputTaskIds: [],
    })
    expect(conversation.activeRoundId).toBe(newRound?.id)
    expect(conversation.messages).toContainEqual(expect.objectContaining({
      role: 'user',
      content: '画一只猫',
      roundId: newRound?.id,
      inputImageIds: [imageA.id],
    }))
    expect(useStore.getState().agentEditingRoundId).toBeNull()
  })

  it('overwrites the same round when regenerating an error assistant message', async () => {
    useStore.setState({
      agentConversations: [
        agentConversation({
          id: 'conversation-a',
          activeRoundId: 'round-a',
          rounds: [{
            id: 'round-a',
            index: 1,
            parentRoundId: null,
            userMessageId: 'user-a',
            assistantMessageId: 'assistant-a',
            prompt: '画一只猫',
            inputImageIds: [imageA.id],
            outputTaskIds: ['task-a'],
            status: 'error',
            error: '失败',
            createdAt: 1,
            finishedAt: 2,
          }],
          messages: [
            { id: 'user-a', role: 'user', content: '画一只猫', roundId: 'round-a', inputImageIds: [imageA.id], createdAt: 1 },
            { id: 'assistant-a', role: 'assistant', content: '请求失败：失败', roundId: 'round-a', outputTaskIds: ['task-a'], createdAt: 2 },
          ],
        }),
      ],
    })

    await regenerateAgentAssistantMessage('conversation-a', 'round-a')

    const conversation = useStore.getState().agentConversations[0]
    expect(conversation.rounds).toHaveLength(1)
    expect(conversation.activeRoundId).toBe('round-a')
    expect(conversation.rounds[0]).toMatchObject({
      id: 'round-a',
      status: 'running',
      error: null,
      outputTaskIds: [],
      finishedAt: null,
    })
    expect(conversation.messages.find((message) => message.id === 'assistant-a')).toMatchObject({
      content: '',
      outputTaskIds: [],
    })
  })
})

describe('reused task API profile', () => {
  const openaiProfile = createDefaultOpenAIProfile({ id: 'openai-profile', apiKey: 'openai-key' })
  const falProfile = createDefaultFalProfile({ id: 'fal-profile', name: 'fal 配置', apiKey: 'fal-key' })

  beforeEach(() => {
    useStore.setState({
      settings: normalizeSettings({
        ...DEFAULT_SETTINGS,
        profiles: [openaiProfile, falProfile],
        activeProfileId: openaiProfile.id,
        reuseTaskApiProfileTemporarily: true,
      }),
      prompt: '',
      inputImages: [],
      maskDraft: null,
      params: { ...DEFAULT_PARAMS },
      tasks: [],
      showSettings: false,
      toast: null,
      reusedTaskApiProfileId: null,
      reusedTaskApiProfileName: null,
      reusedTaskApiProfileMissing: false,
      pendingTaskCategory: null,
      showToast: vi.fn(),
      setConfirmDialog: vi.fn(),
    })
  })

  it('resolves a task API profile by stored profile id', () => {
    const resolved = getTaskApiProfile(useStore.getState().settings, task({ apiProvider: 'fal', apiProfileId: falProfile.id }))

    expect(resolved?.id).toBe(falProfile.id)
  })

  it('does not resolve a task API profile by stored name or model', () => {
    const resolved = getTaskApiProfile(useStore.getState().settings, task({
      apiProvider: 'fal',
      apiProfileName: falProfile.name,
      apiModel: falProfile.model,
    }))

    expect(resolved).toBeNull()
  })

  it('reuses the task API profile temporarily without switching the active profile', async () => {
    await reuseConfig(task({
      apiProvider: 'fal',
      apiProfileId: falProfile.id,
      params: { ...DEFAULT_PARAMS, n: 8, size: 'auto', quality: 'auto' },
    }))

    const state = useStore.getState()
    expect(state.settings.activeProfileId).toBe(openaiProfile.id)
    expect(state.reusedTaskApiProfileId).toBe(falProfile.id)
    expect(state.params).toMatchObject({ n: 4, size: '1360x1024', quality: 'high' })
    expect(state.showToast).toHaveBeenCalledWith('已临时复用该任务的 API 配置「fal 配置」', 'success')
  })

  it('keeps selected image mentions when reusing a task with different current input images', async () => {
    await clearImages()
    await putImage(imageA)
    await putImage(imageB)
    const taskPrompt = `参考 ${getSelectedImageMentionLabel(1)} 生成`

    useStore.setState({
      prompt: `当前 ${getSelectedImageMentionLabel(1)}`,
      inputImages: [
        { id: 'current-x', dataUrl: 'data:image/png;base64,x' },
        { id: 'current-y', dataUrl: 'data:image/png;base64,y' },
      ],
    })

    await reuseConfig(task({
      apiProvider: 'openai',
      apiProfileId: openaiProfile.id,
      prompt: taskPrompt,
      inputImageIds: [imageA.id, imageB.id],
    }))

    const state = useStore.getState()
    expect(state.inputImages.map((img) => img.id)).toEqual([imageA.id, imageB.id])
    expect(state.prompt).toBe(taskPrompt)
  })

  it('clears temporary reuse when switching current settings to the reused API profile', async () => {
    await reuseConfig(task({ apiProvider: 'fal', apiProfileId: falProfile.id }))

    useStore.getState().setSettings({ activeProfileId: falProfile.id })

    const state = useStore.getState()
    expect(state.settings.activeProfileId).toBe(falProfile.id)
    expect(state.reusedTaskApiProfileId).toBeNull()
    expect(state.reusedTaskApiProfileMissing).toBe(false)
  })

  it('normalizes reused params to the current API profile when temporary reuse is disabled', async () => {
    useStore.setState({
      settings: normalizeSettings({
        ...useStore.getState().settings,
        reuseTaskApiProfileTemporarily: false,
      }),
    })

    await reuseConfig(task({
      apiProvider: 'fal',
      apiProfileId: falProfile.id,
      params: { ...DEFAULT_PARAMS, n: 8, size: 'auto', quality: 'auto' },
    }))

    const state = useStore.getState()
    expect(state.settings.activeProfileId).toBe(openaiProfile.id)
    expect(state.reusedTaskApiProfileId).toBeNull()
    expect(state.params).toMatchObject({ n: 8, size: 'auto', quality: 'auto' })
  })

  it('asks whether to submit with current API profile when the reused API profile is missing', async () => {
    await reuseConfig(task({ apiProvider: 'fal', apiProfileId: 'missing-profile' }))

    const state = useStore.getState()
    expect(state.tasks).toEqual([])
    expect(state.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: '找不到 API 配置',
      message: '找不到复用任务所使用的 API 配置「未知配置」，要使用当前的 API 配置「默认」提交任务吗？',
      confirmText: '使用当前配置提交',
      cancelText: '放弃提交',
    }))
    expect(state.showSettings).toBe(false)
  })
})
