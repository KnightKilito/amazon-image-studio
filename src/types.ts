// ===== 设置 =====

export type ApiMode = 'images' | 'responses' | 'chat'
export type PlannerConnectionMode = 'separate' | 'reuse-image'
export type AppMode = 'gallery' | 'agent'
export type AppPage = 'home' | 'listing-copy' | 'editor'
export type AmazonMarketplace = 'us'
export type TaskWorkflow = 'amazon-listing' | 'amazon-aplus' | 'gallery' | 'image-edit' | 'agent' | 'unknown'
export type TaskAspect = 'square' | 'landscape' | 'portrait'
export type HistoryWorkflowFilter = 'all' | TaskWorkflow
export type HistoryAspectFilter = 'all' | TaskAspect
export type ReferenceImageEditAction = 'ask' | 'replace-reference' | 'add-mask'
export type BuiltInApiProvider = 'openai' | 'fal'
export type ApiProvider = BuiltInApiProvider | string
export type CustomProviderTemplate = 'http-image'
export type MotherImageSupport = 'auto' | 'supported' | 'unsupported'
export const DEFAULT_STREAM_PARTIAL_IMAGES = 1
export const DEFAULT_AGENT_MAX_TOOL_ROUNDS = 15
export const DEFAULT_REFERENCE_IMAGE_UPLOAD_LIMIT = 16

export interface AdminAccessSettings {
  allowGuestEditApiUrl: boolean
  allowGuestViewApiUrl: boolean
  allowGuestCreateApiProfile: boolean
  allowGuestEditApiProvider: boolean
  allowGuestCreateCustomProvider: boolean
  unifiedGuestPlannerApiUrlEnabled: boolean
  unifiedGuestPlannerApiUrl: string
  unifiedGuestImageApiUrlEnabled: boolean
  unifiedGuestImageApiUrl: string
  referenceImageUploadLimit: number
  modelIds: string[]
}

export type CustomProviderRequestMethod = 'GET' | 'POST'
export type CustomProviderContentType = 'json' | 'multipart'
export type CustomProviderFileSource = 'inputImages' | 'mask'

export interface CustomProviderFileMapping {
  field: string
  source: CustomProviderFileSource
  array?: boolean
}

export interface CustomProviderResultMapping {
  imageUrlPaths?: string[]
  b64JsonPaths?: string[]
}

export interface CustomProviderSubmitMapping {
  path: string
  method?: CustomProviderRequestMethod
  contentType?: CustomProviderContentType
  query?: Record<string, string>
  body?: Record<string, unknown>
  files?: CustomProviderFileMapping[]
  taskIdPath?: string
  result?: CustomProviderResultMapping
}

export interface CustomProviderPollMapping {
  path: string
  method?: CustomProviderRequestMethod
  query?: Record<string, string>
  intervalSeconds?: number
  statusPath: string
  successValues: string[]
  failureValues: string[]
  errorPath?: string
  result: CustomProviderResultMapping
}

export interface CustomProviderDefinition {
  id: string
  name: string
  template?: CustomProviderTemplate
  submit: CustomProviderSubmitMapping
  editSubmit?: CustomProviderSubmitMapping
  poll?: CustomProviderPollMapping
}

export interface ApiProfile {
  id: string
  name: string
  provider: ApiProvider
  baseUrl: string
  apiKey: string
  model: string
  timeout: number
  apiMode: ApiMode
  codexCli: boolean
  apiProxy: boolean
  responseFormatB64Json?: boolean
  streamImages?: boolean
  streamPartialImages?: number
  motherImageSupport?: MotherImageSupport
  maxMotherSlices?: number
  providerDrafts?: Partial<Record<ApiProvider, Partial<Pick<ApiProfile, 'baseUrl' | 'model' | 'apiMode' | 'codexCli' | 'apiProxy' | 'responseFormatB64Json' | 'streamImages' | 'streamPartialImages' | 'motherImageSupport' | 'maxMotherSlices'>>>>
}

export interface AppSettings {
  /** 旧版单配置字段：保留用于导入/查询参数兼容，实际请求以 active profile 为准 */
  baseUrl: string
  apiKey: string
  model: string
  timeout: number
  apiMode: ApiMode
  codexCli: boolean
  apiProxy: boolean
  streamImages?: boolean
  streamPartialImages?: number
  customProviders: CustomProviderDefinition[]
  providerOrder?: string[]
  clearInputAfterSubmit: boolean
  persistInputOnRestart: boolean
  reuseTaskApiProfileTemporarily: boolean
  alwaysShowRetryButton: boolean
  embedSyntheticPerformerMetadata: boolean
  enterSubmit: boolean
  referenceImageEditAction: ReferenceImageEditAction
  agentScrollToBottomAfterSubmit: boolean
  agentMaxToolRounds: number
  agentWebSearch: boolean
  profiles: ApiProfile[]
  activeProfileId: string
  amazonPlannerProfileId: string
  plannerConnectionMode: PlannerConnectionMode
  customStyleReferences: CustomStyleReference[]
}

// ===== 任务参数 =====

export interface TaskParams {
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  output_format: 'png' | 'jpeg' | 'webp'
  output_compression: number | null
  moderation: 'auto' | 'low'
  n: number
}

export const DEFAULT_OUTPUT_COMPRESSION = 70

export const DEFAULT_PARAMS: TaskParams = {
  size: 'auto',
  quality: 'auto',
  output_format: 'jpeg',
  output_compression: DEFAULT_OUTPUT_COMPRESSION,
  moderation: 'auto',
  n: 1,
}

export const AMAZON_GENERATION_DEFAULTS = {
  quality: 'high',
  output_format: 'png',
  output_compression: null,
} as const satisfies Pick<TaskParams, 'quality' | 'output_format' | 'output_compression'>

// ===== 输入图片（UI 层面） =====

export interface InputImage {
  /** IndexedDB image store 的 id（SHA-256 hash） */
  id: string
  /** data URL，用于预览 */
  dataUrl: string
}

export interface MaskDraft {
  targetImageId: string
  maskDataUrl: string
  updatedAt: number
}

export type ImageEditorAnnotationKind = 'brush' | 'rectangle' | 'ellipse' | 'arrow'

export interface ImageEditorAnnotationPoint {
  /** Coordinate normalized against the source image width/height. */
  x: number
  y: number
}

export interface ImageEditorAnnotation {
  id: string
  kind: ImageEditorAnnotationKind
  color: string
  /** Stroke width normalized against the source image short edge. */
  width: number
  points: ImageEditorAnnotationPoint[]
}

export interface ImageEditorCanvasDraft {
  sourceImageId: string | null
  annotations: ImageEditorAnnotation[]
  updatedAt: number
}

export interface TaskImageEditContext {
  sourceImageId: string
  visualGuideImageId?: string | null
  referenceImageIds: string[]
  userInstruction: string
}

// ===== 任务记录 =====

export type TaskStatus = 'running' | 'done' | 'error'

export interface TaskRecord {
  id: string
  prompt: string
  params: TaskParams
  /** 生成时使用的 Provider 类型 */
  apiProvider?: ApiProvider
  /** 生成时使用的 API 配置 ID */
  apiProfileId?: string
  /** 生成时使用的 Provider 名称 */
  apiProfileName?: string
  /** 生成时使用的 API 模式 */
  apiMode?: ApiMode
  /** 生成时使用的模型 ID */
  apiModel?: string
  /** fal.ai 队列请求 ID，用于连接断开后的结果恢复 */
  falRequestId?: string
  /** fal.ai 队列 endpoint，用于连接断开后的状态和结果查询 */
  falEndpoint?: string
  /** fal.ai 任务连接断开后是否等待自动恢复 */
  falRecoverable?: boolean
  /** 自定义异步服务商任务 ID，用于重启后继续查询结果 */
  customTaskId?: string
  /** 自定义异步任务是否等待自动恢复 */
  customRecoverable?: boolean
  /** API 返回的实际生效参数，用于标记与请求值不一致的情况 */
  actualParams?: Partial<TaskParams>
  /** 输出图片对应的实际生效参数，key 为 outputImages 中的图片 id */
  actualParamsByImage?: Record<string, Partial<TaskParams>>
  /** 输出图片对应的 API 改写提示词，key 为 outputImages 中的图片 id */
  revisedPromptByImage?: Record<string, string>
  /** 输入图片的 image store id 列表 */
  inputImageIds: string[]
  maskTargetImageId?: string | null
  maskImageId?: string | null
  /** 输出图片的 image store id 列表 */
  outputImages: string[]
  /** 流式生成的中间步骤图片 id 列表，仅失败时保留供排查/下载 */
  streamPartialImageIds?: string[]
  /** API 返回的原始图片 HTTP URL（非 base64 时记录） */
  rawImageUrls?: string[]
  /** 发生解析错误时的原始响应 JSON */
  rawResponsePayload?: string
  status: TaskStatus
  error: string | null
  createdAt: number
  finishedAt: number | null
  /** 总耗时毫秒 */
  elapsed: number | null
  /** 是否收藏 */
  isFavorite?: boolean
  /** 来源模式：画廊 / Agent */
  sourceMode?: AppMode
  /** Agent 对话 ID */
  agentConversationId?: string
  /** Agent 轮次 ID */
  agentRoundId?: string
  /** Agent 消息 ID */
  agentMessageId?: string
  /** Agent 图像工具调用 ID */
  agentToolCallId?: string
  /** Agent 批量图像工具调用 ID */
  agentBatchCallId?: string
  /** Agent 图像工具实际动作 */
  agentToolAction?: 'generate' | 'edit' | 'auto' | string
  /** 图片编辑任务中的输入角色与原始用户要求。 */
  imageEditContext?: TaskImageEditContext
  derivation?: {
    type: 'premium-aplus-vertical-slices' | 'premium-aplus-horizontal-slices' | 'mobile-aplus-vertical-slices'
    sourceTaskId: string
    sourceImageId: string
    sliceCount: number
    sourceWidth: number
    sourceHeight: number
  }
  /** 历史筛选分类元数据；旧任务可为空并由前端推断 */
  category?: {
    productTitle?: string
    workflow?: TaskWorkflow
    amazonSlot?: string
    aPlusType?: 'standard' | 'standard-large' | 'premium' | 'mobile' | 'brand-story'
    styleReferenceImageId?: string
    aPlusPlanContext?: APlusPlanContext
  }
}

export type APlusComposableContentType = 'premium' | 'mobile'
export type APlusLayoutMode = 'independent' | 'composed'
export type APlusGroupKind = 'independent-image' | 'continuous-canvas' | 'lifestyle-carousel'
export type APlusGroupPurpose =
  | 'auto'
  | 'hero'
  | 'lifestyle'
  | 'technical-detail'
  | 'comfort-structure'
  | 'material-detail'
  | 'color-lineup'
  | 'size-fit'
  | 'comparison'
  | 'custom'

export interface APlusLayoutGroup {
  id: string
  kind: APlusGroupKind
  purpose: APlusGroupPurpose
  label: string
  objective: string
  customInstruction: string
  sliceCount?: number
  slideCount?: number
}

export interface APlusLayoutState {
  mode: APlusLayoutMode
  groups: APlusLayoutGroup[]
}

export type APlusLayoutStates = Record<APlusComposableContentType, APlusLayoutState>

export interface APlusPlanContext {
  plannerSessionId?: string
  layoutMode: APlusLayoutMode
  groupId: string
  groupKind: APlusGroupKind | 'brand-story'
  groupPurpose?: APlusGroupPurpose
  itemIndex: number
  sliceCount?: number
  slotCost: number
  plannedGenerationSize: string
  /** 新版自由编排记录所属版式；旧高级 A+ 任务可能缺少。 */
  aPlusType?: APlusComposableContentType
  /** 单片生图画布，用于切换 2K/4K 后重新计算完整画布。 */
  generationSliceWidth?: number
  generationSliceHeight?: number
}

/** @deprecated 兼容旧调用方和已持久化的 Premium 字段。 */
export type PremiumAPlusLayoutMode = APlusLayoutMode
/** @deprecated 兼容旧调用方和已持久化的 Premium 字段。 */
export type PremiumAPlusGroupKind = APlusGroupKind
/** @deprecated 兼容旧调用方和已持久化的 Premium 字段。 */
export type PremiumAPlusGroupPurpose = APlusGroupPurpose
/** @deprecated 兼容旧调用方和已持久化的 Premium 字段。 */
export type PremiumAPlusLayoutGroup = APlusLayoutGroup
/** @deprecated 兼容旧调用方和已持久化的 Premium 字段。 */
export type PremiumAPlusPlanContext = APlusPlanContext

export interface AmazonVisualSystem {
  styleName: string
  colorPalette: string
  lighting: string
  background: string
  typography: string
  composition: string
  overlayStyle: string
}

export type AmazonVisualStyleMode = 'builtin' | 'ai'

export interface AmazonAiVisualStyle {
  name: string
  summary: string
  artDirection: string
  sceneStrategy: string
  palette: string[]
  lighting: string
  typography: string
  materials: string
  composition: string
  referencePrompt: string
  referenceNegativePrompt: string
}

export interface AmazonPlannerSessionDraft {
  productTitle: string
  category: string
  brand: string
  color: string
  material: string
  audience: string
  sellingPoints: string
  packageIncludes: string
  scene: string
  forbidden: string
  kind?: string
}

export interface AmazonPlannerSessionStyleCandidate {
  label: string
  description: string
  prompt: string
  negativePrompt: string
}

export interface AmazonPlannerSessionImagePlan {
  slot: string
  label: string
  kind?: string
  planMarkdown: string
  prompt: string
  negativePrompt: string
}

export interface AmazonPlannerSessionAPlusPlan {
  slot: string
  label: string
  moduleType: string
  uploadSize: string
  generationSize: string
  summary?: string
  planMarkdown: string
  textTitle: string
  textBody: string
  prompt: string
  negativePrompt: string
  planContext?: APlusPlanContext
}

export interface AmazonPlannerSessionAPlusModuleSpec {
  contentType: 'standard' | 'standard-large' | 'premium' | 'mobile' | 'brand-story' | 'optional'
  slot: string
  label: string
  displayLabel: string
  moduleType: string
  uploadWidth: number
  uploadHeight: number
  objective: string
  planContext?: APlusPlanContext
  exactGenerationWidth?: number
  exactGenerationHeight?: number
}

export interface AmazonPlannerSessionStyleImage {
  candidateIndex: number
  imageId: string
}

export type AmazonStyleDensityMode = 'rich' | 'minimal'

export interface StyleReferenceEditState {
  title: string
  palette: string[]
  typography: string
  lighting: string
  material: string
  density: AmazonStyleDensityMode
}

export interface CustomStyleReference {
  id: string
  basePresetId?: string | null
  title: string
  editState: StyleReferenceEditState
  imageId: string
  createdAt: number
  updatedAt: number
}

export interface AmazonPlannerSession {
  id: string
  title: string
  mode: 'listing' | 'aplus'
  aPlusType: 'standard' | 'standard-large' | 'premium' | 'mobile' | 'brand-story'
  resolution: '2k' | '4k'
  listingTargetSize?: string
  listingImageCount?: number
  marketplace?: AmazonMarketplace
  aPlusModuleSpecs?: Partial<Record<'standard' | 'standard-large' | 'premium' | 'mobile' | 'brand-story', AmazonPlannerSessionAPlusModuleSpec[]>>
  aPlusLayoutStates?: Partial<APlusLayoutStates>
  /** @deprecated 旧版 Premium 自由编排字段，读取时迁入 aPlusLayoutStates.premium。 */
  premiumLayoutMode?: PremiumAPlusLayoutMode
  /** @deprecated 旧版 Premium 自由编排字段，读取时迁入 aPlusLayoutStates.premium。 */
  premiumLayoutGroups?: PremiumAPlusLayoutGroup[]
  premiumBrandStoryEnabled?: boolean
  premiumBrandStoryCardCount?: number
  standaloneBrandStoryCardCount?: number
  listingText: string
  referenceImageIds: string[]
  draft: AmazonPlannerSessionDraft
  seriesStyleGuides: {
    listing: string
    aplus: string
  }
  visualStyleMode?: AmazonVisualStyleMode
  aiVisualStyle?: AmazonAiVisualStyle | null
  aiStyleReferenceImageId?: string | null
  styleCandidates: AmazonPlannerSessionStyleCandidate[]
  styleImages: AmazonPlannerSessionStyleImage[]
  selectedStyleIndex: number | null
  selectedStylePresetId?: string | null
  selectedStyleReferenceImageId?: string | null
  selectedCustomStyleReferenceId?: string | null
  selectedCustomStyleReferenceSnapshot?: CustomStyleReference | null
  styleDensityMode?: AmazonStyleDensityMode
  imagePlans: AmazonPlannerSessionImagePlan[]
  aPlusPlans: AmazonPlannerSessionAPlusPlan[]
  selectedPlanIndex: number | null
  selectedAPlusPlanIndex: number | null
  createdAt: number
  updatedAt: number
}

// ===== Listing 文案 =====

export type ListingCopyPreset = 'footwear' | 'general'

export interface BilingualText {
  en: string
  zh: string
}

export interface ListingCopyInput {
  preset: ListingCopyPreset
  productDescription: string
  brand: string
  category: string
  material: string
  features: string
  colorAndSize: string
  audience: string
  useCases: string
  requiredTerms: string
  forbiddenTerms: string
  heel: string
  sole: string
  closure: string
  comfort: string
}

export type ListingCopyBullets = [BilingualText, BilingualText, BilingualText, BilingualText, BilingualText]

export interface ListingCopyPrompts {
  title: string
  bullets: string
  longDescription: string
}

export interface ListingCopyResult {
  /** 面向卖家的标题策划说明；旧历史版本可能不存在。 */
  titleAnalysis?: string
  itemName: BilingualText
  itemHighlight: BilingualText
  bullets: ListingCopyBullets
  longDescription: BilingualText
  coreKeywords: BilingualText[]
  backendSearchTerms: BilingualText
  missingFacts: string[]
  complianceWarnings: string[]
}

export interface ListingCopyProfitInput {
  purchaseCostCny: number | null
  domesticShippingCny: number | null
  netWeightG: number | null
  packagingWeightG: number | null
  exchangeRate: number | null
  referralRatePercent: number | null
  targetMarginPercent: number | null
  yanwenRateCnyPerKg: number | null
  yanwenRegistrationFeeCny: number | null
  competitorMinPriceUsd: number | null
  competitorMaxPriceUsd: number | null
  fbaInboundCny: number | null
  fbaFulfillmentFeeUsd: number | null
  calculationPriceUsd: number | null
}

export interface ListingCopyFulfillmentProfit {
  fixedCostUsd: number
  targetPriceUsd: number | null
  suggestedPriceUsd: number | null
  profitUsd: number | null
  marginPercent: number | null
  warning: string
}

export interface ListingCopyProfitResult {
  billingWeightKg: number | null
  yanwenFeeCny: number | null
  calculationPriceUsd: number | null
  suggestedPriceUsd: number | null
  fbm: ListingCopyFulfillmentProfit
  fba: ListingCopyFulfillmentProfit | null
  error: string
}

export interface ListingCopySession {
  id: string
  kind: 'draft' | 'version'
  title: string
  marketplace: AmazonMarketplace
  input: ListingCopyInput
  prompts?: ListingCopyPrompts
  /** 仅用于兼容旧版单提示词草稿和导入数据。 */
  prompt?: string
  /** 仅用于兼容旧版知识库开关。 */
  useSystemKnowledgeBase?: boolean
  result: ListingCopyResult | null
  profitInput: ListingCopyProfitInput
  referenceImageIds: string[]
  createdAt: number
  updatedAt: number
}

// ===== Agent 模式 =====

export type AgentMessageRole = 'user' | 'assistant'
export type AgentRoundStatus = 'running' | 'done' | 'error'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  roundId: string
  inputImageIds?: string[]
  maskTargetImageId?: string | null
  maskImageId?: string | null
  outputTaskIds?: string[]
  createdAt: number
}

export interface AgentRound {
  id: string
  index: number
  parentRoundId?: string | null
  userMessageId: string
  assistantMessageId?: string
  prompt: string
  inputImageIds: string[]
  maskTargetImageId?: string | null
  maskImageId?: string | null
  outputTaskIds: string[]
  responseId?: string
  responseOutput?: ResponsesOutputItem[]
  status: AgentRoundStatus
  error: string | null
  createdAt: number
  finishedAt: number | null
}

export interface AgentConversation {
  id: string
  title: string
  activeRoundId?: string | null
  createdAt: number
  updatedAt: number
  rounds: AgentRound[]
  messages: AgentMessage[]
}

// ===== IndexedDB 存储的图片 =====

export interface StoredImage {
  id: string
  dataUrl: string
  /** 图片首次存储时间（ms） */
  createdAt?: number
  /** 图片来源：用户上传 / API 生成 / 遮罩 / 风格参考 */
  source?: 'upload' | 'generated' | 'derived' | 'mask' | 'preset' | 'style-custom'
  /** 原图宽度 */
  width?: number
  /** 原图高度 */
  height?: number
}

export interface StoredImageThumbnail {
  id: string
  /** 列表缩略图，用于避免卡片页解码完整 4K 原图 */
  thumbnailDataUrl: string
  /** 原图宽度 */
  width?: number
  /** 原图高度 */
  height?: number
  /** 缩略图生成参数版本 */
  thumbnailVersion?: number
}

// ===== API 请求体 =====

export interface ImageGenerationRequest {
  model: string
  prompt: string
  size: string
  quality: string
  output_format: string
  moderation: string
  output_compression?: number
  n?: number
}

// ===== API 响应 =====

export interface ImageResponseItem {
  b64_json?: string
  url?: string
  revised_prompt?: string
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
}

export interface ImageApiResponse {
  data: ImageResponseItem[]
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
  n?: number
}

export interface ResponsesOutputItem {
  id?: string
  type?: string
  status?: string
  action?: string | Record<string, unknown>
  /** function_call: unique call id for sending back function_call_output */
  call_id?: string
  /** function_call: function name */
  name?: string
  /** function_call: JSON-encoded arguments string */
  arguments?: string
  /** function_call_output: JSON/text output string */
  output?: string
  annotations?: Array<{
    type?: string
    start_index?: number
    end_index?: number
    url?: string
    title?: string
  }>
  content?: Array<{
    type?: string
    text?: string
    annotations?: Array<{
      type?: string
      start_index?: number
      end_index?: number
      url?: string
      title?: string
    }>
  }>
  result?: string | {
    b64_json?: string
    image?: string
    data?: string
  }
  size?: string
  quality?: string
  output_format?: string
  output_compression?: number
  moderation?: string
  revised_prompt?: string
}

export interface ResponsesApiResponse {
  id?: string
  output?: ResponsesOutputItem[]
  tools?: Array<{
    type?: string
    size?: string
    quality?: string
    output_format?: string
    output_compression?: number
    moderation?: string
    n?: number
  }>
}

export interface FalImageFile {
  url?: string
  content_type?: string
  file_name?: string
  width?: number
  height?: number
  b64_json?: string
  base64?: string
  data?: string
}

export interface FalApiResponse {
  images?: FalImageFile[]
  image?: FalImageFile | string
  url?: string
  seed?: number
}

export interface TextNote {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

// ===== 导出数据 =====

/** ZIP manifest.json 格式 */
export interface ExportData {
  version: number
  exportedAt: string
  settings?: AppSettings
  tasks?: TaskRecord[]
  agentConversations?: AgentConversation[]
  amazonPlannerSessions?: AmazonPlannerSession[]
  listingCopySessions?: ListingCopySession[]
  textNotes?: TextNote[]
  /** imageId → 图片信息 */
  imageFiles?: Record<string, {
    path: string
    createdAt?: number
    source?: 'upload' | 'generated' | 'derived' | 'mask' | 'preset' | 'style-custom'
    width?: number
    height?: number
  }>
  /** imageId → 缩略图信息 */
  thumbnailFiles?: Record<string, {
    path: string
    width?: number
    height?: number
    thumbnailVersion?: number
  }>
}
