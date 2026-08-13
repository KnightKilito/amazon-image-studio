import type { ApiMode, ApiProfile, ListingCopyInput, ListingCopyPrompts, ListingCopyResult } from '../types'
import { AMAZON_MARKETPLACE_CONTEXT } from './amazonMarketplace'
import { DEFAULT_CHAT_MODEL, DEFAULT_RESPONSES_MODEL, isOfficialDeepSeekPlannerProfile } from './apiProfiles'
import { buildApiUrl, readClientDevProxyConfig, shouldUseApiProxy } from './devProxy'
import { getApiErrorMessage } from './imageApiShared'
import { readPlannerResponseText, type PlannerAttemptInfo, type PlannerRequestStatus } from './listingPlannerApi'
import { validateListingCopyResult } from './listingCopy'
import type { AmazonMarketplace } from '../types'

const BILINGUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    en: { type: 'string' },
    zh: { type: 'string' },
  },
  required: ['en', 'zh'],
} as const

const LISTING_COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    itemName: BILINGUAL_SCHEMA,
    itemHighlight: BILINGUAL_SCHEMA,
    bullets: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: BILINGUAL_SCHEMA,
    },
    longDescription: BILINGUAL_SCHEMA,
    coreKeywords: {
      type: 'array',
      minItems: 3,
      maxItems: 12,
      items: BILINGUAL_SCHEMA,
    },
    backendSearchTerms: BILINGUAL_SCHEMA,
    missingFacts: { type: 'array', items: { type: 'string' } },
    complianceWarnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['itemName', 'itemHighlight', 'bullets', 'longDescription', 'coreKeywords', 'backendSearchTerms', 'missingFacts', 'complianceWarnings'],
} as const

function formatInput(input: ListingCopyInput) {
  const rows: Array<[string, string]> = [
    ['Preset', input.preset === 'footwear' ? 'Footwear' : 'General product'],
    ['Product introduction', input.productDescription],
    ['Brand', input.brand],
    ['Category', input.category],
    ['Material', input.material],
    ['Features', input.features],
    ['Colors and sizes', input.colorAndSize],
    ['Target customer', input.audience],
    ['Use cases', input.useCases],
    ['Required terms', input.requiredTerms],
    ['Forbidden terms', input.forbiddenTerms],
    ['Heel', input.heel],
    ['Sole', input.sole],
    ['Closure', input.closure],
    ['Comfort', input.comfort],
  ]
  return rows.filter(([, value]) => value.trim()).map(([label, value]) => `- ${label}: ${value.trim()}`).join('\n')
}

function buildSystemPrompt(options: { prompts: ListingCopyPrompts; marketplace: AmazonMarketplace; textOnly: boolean; repairIssues?: string[] }) {
  const context = AMAZON_MARKETPLACE_CONTEXT[options.marketplace]
  return [
    `Title instructions:\n${options.prompts.title.trim()}`,
    `Five-bullet instructions:\n${options.prompts.bullets.trim()}`,
    `Long-description instructions:\n${options.prompts.longDescription.trim()}`,
    `Target marketplace: ${context.label}, ${context.domain}. Primary copy language: ${context.primaryLanguage}. Currency context: ${context.currency}.`,
    options.textOnly
      ? 'No reference images are available in this attempt. Use only supplied product facts and never infer appearance, construction, materials, accessories, claims, certifications, sizing, or package contents.'
      : 'Reference images may be used only to confirm visible product facts. Do not invent facts that are not explicitly supplied or clearly visible.',
    options.repairIssues?.length
      ? `Repair every validation issue below while preserving all supported facts:\n- ${options.repairIssues.join('\n- ')}`
      : '',
    'Item Name and Item Highlight are separate fields. Never concatenate them. Item Name English must contain at most 75 visible characters including spaces and punctuation. Item Highlight English must contain at most 125.',
    'Return exactly five bilingual bullet objects. Return longDescription as plain text only; do not return HTML.',
    'Return coreKeywords as bilingual terms. backendSearchTerms.en must be a natural space-separated Seller Central search term string without competitor brands, ASINs, irrelevant words, or mechanical repetition.',
    'Return missingFacts and complianceWarnings as Simplified Chinese string arrays. If none, return empty arrays.',
    'Return only one valid JSON object matching the required schema. Do not use Markdown fences, comments, or text outside JSON.',
  ].filter(Boolean).join('\n\n')
}

function buildUserText(input: ListingCopyInput, previousRaw?: string) {
  return previousRaw
    ? `Use these authoritative product facts while repairing the previous JSON response:\n\n${formatInput(input) || '(No product facts supplied)'}\n\nPrevious JSON response:\n${previousRaw}\n\nReturn the complete corrected object.`
    : `Create the Amazon listing copy from these authoritative product facts:\n\n${formatInput(input) || '(No product facts supplied)'}`
}

function buildChatContent(text: string, images: string[]) {
  if (!images.length) return text
  return [
    { type: 'text', text },
    ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
  ]
}

function buildResponsesInput(text: string, images: string[]) {
  return [{
    role: 'user',
    content: [
      { type: 'input_text', text },
      ...images.map((url) => ({ type: 'input_image', image_url: url })),
    ],
  }]
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  return JSON.parse(fenced ?? trimmed)
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function readBilingual(value: unknown) {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return { en: readString(record.en), zh: readString(record.zh) }
}

export function normalizeListingCopyPayload(payload: unknown): ListingCopyResult {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const bullets = Array.isArray(record.bullets) ? record.bullets.map(readBilingual) : []
  const paddedBullets = Array.from({ length: 5 }, (_, index) => bullets[index] ?? { en: '', zh: '' })
  const coreKeywords = Array.isArray(record.coreKeywords) ? record.coreKeywords.map(readBilingual).filter((item) => item.en || item.zh) : []
  return {
    itemName: readBilingual(record.itemName),
    itemHighlight: readBilingual(record.itemHighlight),
    bullets: paddedBullets as ListingCopyResult['bullets'],
    longDescription: readBilingual(record.longDescription),
    coreKeywords,
    backendSearchTerms: readBilingual(record.backendSearchTerms),
    missingFacts: Array.isArray(record.missingFacts) ? record.missingFacts.map(readString).filter(Boolean) : [],
    complianceWarnings: Array.isArray(record.complianceWarnings) ? record.complianceWarnings.map(readString).filter(Boolean) : [],
  }
}

async function performRequest(options: {
  input: ListingCopyInput
  prompts: ListingCopyPrompts
  marketplace: AmazonMarketplace
  profile: ApiProfile
  referenceImageDataUrls: string[]
  previousRaw?: string
  repairIssues?: string[]
  signal?: AbortSignal
  onAttemptStart?: (attempt: PlannerAttemptInfo) => void
  onStatusChange?: (status: PlannerRequestStatus) => void
  onTextDelta?: (delta: string) => void
}) {
  const profile = options.profile
  const apiMode: ApiMode = profile.apiMode === 'chat' ? 'chat' : 'responses'
  const chat = apiMode === 'chat'
  const textOnly = isOfficialDeepSeekPlannerProfile(profile) || Boolean(options.previousRaw) || options.referenceImageDataUrls.length === 0
  const images = textOnly ? [] : options.referenceImageDataUrls
  const model = profile.model.trim() || (chat ? DEFAULT_CHAT_MODEL : DEFAULT_RESPONSES_MODEL)
  const proxyConfig = readClientDevProxyConfig()
  const useProxy = shouldUseApiProxy(profile.apiProxy, proxyConfig, profile.baseUrl)
  const systemPrompt = buildSystemPrompt({
    prompts: options.prompts,
    marketplace: options.marketplace,
    textOnly,
    repairIssues: options.repairIssues,
  })
  const userText = buildUserText(options.input, options.previousRaw)
  options.onAttemptStart?.({ label: options.previousRaw ? '自动修复文案' : images.length ? '带参考图生成文案' : '生成文案', apiMode, streaming: Boolean(profile.streamImages) })
  options.onStatusChange?.('waiting')
  const response = await fetch(
    chat
      ? buildApiUrl(profile.baseUrl, 'chat/completions', proxyConfig, useProxy, { prefixV1: false })
      : buildApiUrl(profile.baseUrl, 'responses', proxyConfig, useProxy),
    {
      method: 'POST',
      signal: options.signal,
      headers: { Authorization: `Bearer ${profile.apiKey}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(chat ? {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildChatContent(userText, images) },
        ],
        response_format: { type: 'json_object' },
        stream: Boolean(profile.streamImages),
      } : {
        model,
        instructions: systemPrompt,
        input: buildResponsesInput(userText, images),
        text: { format: { type: 'json_schema', name: 'amazon_listing_copy', strict: true, schema: LISTING_COPY_SCHEMA } },
        stream: Boolean(profile.streamImages),
      }),
    },
  )
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await getApiErrorMessage(response)}`)
  const raw = await readPlannerResponseText(response, (delta) => {
    options.onStatusChange?.('streaming')
    options.onTextDelta?.(delta)
  })
  options.onStatusChange?.('parsing')
  return raw
}

export async function generateListingCopy(options: Parameters<typeof performRequest>[0]) {
  let firstRaw = ''
  let firstIssues: string[] = []
  try {
    try {
      firstRaw = await performRequest(options)
    } catch (error) {
      if (options.signal?.aborted || !options.referenceImageDataUrls.length) throw error
      options.onAttemptStart?.({ label: '参考图请求失败，纯文本重试', apiMode: options.profile.apiMode === 'chat' ? 'chat' : 'responses', streaming: Boolean(options.profile.streamImages) })
      firstRaw = await performRequest({ ...options, referenceImageDataUrls: [] })
    }
    const firstResult = normalizeListingCopyPayload(parseJsonObject(firstRaw))
    firstIssues = validateListingCopyResult(firstResult)
    if (!firstIssues.length) return { result: firstResult, validationIssues: [], rawResponseText: firstRaw, repaired: false }
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (!firstRaw) throw error
    firstIssues = [`JSON 解析失败：${error instanceof Error ? error.message : String(error)}`]
  }

  const repairedRaw = await performRequest({ ...options, referenceImageDataUrls: [], previousRaw: firstRaw || '{}', repairIssues: firstIssues })
  const repairedResult = normalizeListingCopyPayload(parseJsonObject(repairedRaw))
  return {
    result: repairedResult,
    validationIssues: validateListingCopyResult(repairedResult),
    rawResponseText: repairedRaw,
    repaired: true,
  }
}
