import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type {
  AmazonMarketplace,
  BilingualText,
  InputImage,
  ListingCopyInput,
  ListingCopyPrompts,
  ListingCopyProfitInput,
  ListingCopyResult,
  ListingCopySession,
} from '../types'
import { getAmazonPlannerProfile, validateApiProfile } from '../lib/apiProfiles'
import { AMAZON_MARKETPLACE_OPTIONS, DEFAULT_AMAZON_MARKETPLACE, normalizeAmazonMarketplace } from '../lib/amazonMarketplace'
import {
  DEFAULT_LISTING_COPY_INPUT,
  DEFAULT_LISTING_COPY_PROFIT_INPUT,
  ITEM_HIGHLIGHT_MAX_CHARACTERS,
  ITEM_NAME_MAX_CHARACTERS,
  calculateListingCopyProfit,
  countVisibleCharacters,
  formatAllEnglishListingCopy,
  formatListingCopyBullets,
  listingDescriptionToHtml,
  normalizeListingCopyResult,
  validateListingCopyResult,
} from '../lib/listingCopy'
import {
  cloneDefaultListingCopyPrompts,
  DEFAULT_LISTING_COPY_PROMPTS,
  LISTING_COPY_KNOWLEDGE_SOURCES,
  normalizeListingCopyPrompts,
  type ListingCopyKnowledgeSource,
} from '../lib/listingCopyKnowledge'
import { generateListingCopy } from '../lib/listingCopyApi'
import { preparePlannerReferenceImagePayload } from '../lib/referenceImagePayload'
import {
  deleteListingCopySession,
  getAllListingCopySessions,
  getAllPersonalKnowledgeDocuments,
  putListingCopySession,
} from '../lib/db'
import { copyRichTextToClipboard, copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { applyGuestUnifiedApiUrl, createInputImageFromFile, deleteImageIfUnreferenced, ensureImageCached, useStore } from '../store'
import Select, { COMPACT_SELECT_CLASS } from './Select'
import PlannerRunDetailsModal, { type PlannerRunStatus } from './PlannerRunDetailsModal'
import { BookOpenIcon, CloseIcon, CopyIcon, EditIcon, EyeIcon, HistoryIcon, LinkIcon, PhotoIcon, RefreshIcon, SettingsIcon, TrashIcon } from './icons'
import type { PlannerAttemptInfo } from '../lib/listingPlannerApi'
import { replaceInputImagesWithReferenceImages } from '../lib/referenceImageSync'
import PersonalKnowledgeBase from './PersonalKnowledgeBase'
import { buildListingKnowledgePrompt } from '../lib/personalKnowledge'

const DRAFT_ID = 'listing-copy-current-draft'
const FIELD_CLASS = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500'
const CARD_CLASS = 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900'
const LABEL_CLASS = 'mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400'

function cloneInput(input: ListingCopyInput): ListingCopyInput {
  return { ...DEFAULT_LISTING_COPY_INPUT, ...input }
}

function cloneProfit(input: ListingCopyProfitInput): ListingCopyProfitInput {
  return { ...DEFAULT_LISTING_COPY_PROFIT_INPUT, ...input }
}

function createVersionId() {
  return `listing-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function titleForSession(input: ListingCopyInput, result: ListingCopyResult | null) {
  return result?.itemName.en.trim() || input.productDescription.trim().split(/\r?\n/)[0]?.slice(0, 60) || input.category.trim() || '未命名 Listing 文案'
}

function CopyButton({ value, label = '复制', onCopied, showLabel = false }: { value: string; label?: string; onCopied: () => void; showLabel?: boolean }) {
  const showToast = useStore((state) => state.showToast)
  const copy = async () => {
    if (!value.trim()) return
    try {
      await copyTextToClipboard(value)
      onCopied()
    } catch (error) {
      showToast(getClipboardFailureMessage('复制失败，请手动选择内容', error), 'error')
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={!value.trim()}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100 ${showLabel ? 'w-auto border border-gray-200 bg-white px-2.5 text-xs font-semibold dark:border-white/[0.08] dark:bg-gray-950' : 'w-8'}`}
    >
      <CopyIcon className="h-4 w-4" />
      {showLabel && <span>{label}</span>}
    </button>
  )
}

function FieldShell({ label, value, children, hint }: { label: string; value: string; children: ReactNode; hint?: string }) {
  const showToast = useStore((state) => state.showToast)
  return (
    <label className="block min-w-0">
      <span className={LABEL_CLASS}>{label}</span>
      <div className="relative">
        {children}
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <CopyButton value={value} label={`复制${label}`} onCopied={() => showToast(`${label}已复制`, 'success')} />
        </div>
      </div>
      {hint && <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">{hint}</span>}
    </label>
  )
}

function TextField(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  hint?: string
}) {
  return (
    <FieldShell label={props.label} value={props.value} hint={props.hint}>
      {props.rows ? (
        <textarea
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          rows={props.rows}
          className={`${FIELD_CLASS} resize-y`}
        />
      ) : (
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          className={FIELD_CLASS}
        />
      )}
    </FieldShell>
  )
}

function PromptEditor(props: {
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  onReset: () => void
  rows: number
  tone: 'emerald' | 'blue' | 'violet'
}) {
  const showToast = useStore((state) => state.showToast)
  const toneClass = props.tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50/45 dark:border-emerald-400/20 dark:bg-emerald-400/5'
    : props.tone === 'blue'
      ? 'border-blue-200 bg-blue-50/45 dark:border-blue-400/20 dark:bg-blue-400/5'
      : 'border-violet-200 bg-violet-50/45 dark:border-violet-400/20 dark:bg-violet-400/5'
  return (
    <section className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">{props.label}</h4>
          <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gray-400">{props.description}</p>
        </div>
        <button type="button" onClick={props.onReset} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-500 transition hover:bg-white hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-100"><RefreshIcon className="h-3 w-3" />恢复</button>
      </div>
      <div className="relative">
        <textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} rows={props.rows} className={`${FIELD_CLASS} resize-y pr-12 font-mono text-xs leading-6`} />
        <div className="absolute right-2 top-2"><CopyButton value={props.value} label={`复制${props.label}`} onCopied={() => showToast(`${props.label}已复制`, 'success')} /></div>
      </div>
    </section>
  )
}

function NumberField(props: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
  suffix?: string
  min?: number
  step?: number
  optional?: boolean
}) {
  const value = props.value == null ? '' : String(props.value)
  return (
    <FieldShell label={props.label} value={value} hint={props.optional ? '选填' : undefined}>
      <input
        type="number"
        value={value}
        min={props.min ?? 0}
        step={props.step ?? 0.01}
        onChange={(event) => props.onChange(event.target.value === '' ? null : event.target.valueAsNumber)}
        className={`${FIELD_CLASS} ${props.suffix ? 'pr-20' : ''}`}
      />
      {props.suffix && <span className="pointer-events-none absolute right-11 top-1/2 -translate-y-1/2 text-xs text-gray-400">{props.suffix}</span>}
    </FieldShell>
  )
}

function BilingualEditor(props: {
  label: string
  value: BilingualText
  onChange: (value: BilingualText) => void
  rows?: number
  englishLimit?: number
}) {
  const showToast = useStore((state) => state.showToast)
  const characterCount = countVisibleCharacters(props.value.en)
  const overLimit = props.englishLimit != null && characterCount > props.englishLimit
  const renderSide = (language: 'en' | 'zh', label: string) => (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
        {language === 'en' && props.englishLimit != null && (
          <span className={`text-[11px] font-medium ${overLimit ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {characterCount}/{props.englishLimit}
          </span>
        )}
      </div>
      <div className="relative">
        <textarea
          value={props.value[language]}
          rows={props.rows ?? 3}
          onChange={(event) => props.onChange({ ...props.value, [language]: event.target.value })}
          className={`${FIELD_CLASS} resize-y ${overLimit && language === 'en' ? '!border-red-300 focus:!border-red-400 focus:!ring-red-500/15' : ''}`}
        />
        <div className="absolute right-1 top-1">
          <CopyButton value={props.value[language]} label={`复制${props.label}${label}`} onCopied={() => showToast(`${props.label}${label}已复制`, 'success')} />
        </div>
      </div>
    </div>
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-gray-950/60">
      <h4 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{props.label}</h4>
      <div className="grid gap-3 lg:grid-cols-2">
        {renderSide('en', '英文')}
        {renderSide('zh', '中文对照')}
      </div>
    </section>
  )
}

function MoneyValue({ value }: { value: number | null | undefined }) {
  return <>{value == null ? '待补全' : `$${value.toFixed(2)}`}</>
}

function SafeHtmlPreview({ label, html, plainText }: { label: string; html: string; plainText: string }) {
  const showToast = useStore((state) => state.showToast)
  const copyPreview = async () => {
    if (!html || !plainText.trim()) return
    try {
      const mode = await copyRichTextToClipboard(html, plainText)
      showToast(mode === 'rich' ? `${label}富文本已复制` : `${label}纯文本已复制`, 'success')
    } catch (error) {
      showToast(getClipboardFailureMessage('复制预览失败，请复制下方纯文本或 HTML', error), 'error')
    }
  }
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/[0.08] dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between gap-2"><div className="text-xs font-bold text-gray-500 dark:text-gray-400">{label}</div><button type="button" onClick={() => void copyPreview()} disabled={!html || !plainText.trim()} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/[0.06]"><CopyIcon className="h-4 w-4" />复制富文本</button></div>
      {html ? (
        <article
          className="min-h-56 break-words text-sm leading-7 text-gray-700 dark:text-gray-300 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-8 [&_h2]:text-gray-900 dark:[&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 dark:[&_h3]:text-white [&_li]:mb-1 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : <div className="flex min-h-56 items-center justify-center text-sm text-gray-400">生成长描述后可在这里预览</div>}
    </div>
  )
}

export default function ListingCopyWorkspace() {
  const settings = useStore((state) => state.settings)
  const adminAccess = useStore((state) => state.adminAccess)
  const isAdminAuthenticated = useStore((state) => state.isAdminAuthenticated)
  const setShowSettings = useStore((state) => state.setShowSettings)
  const showToast = useStore((state) => state.showToast)
  const homeInputImages = useStore((state) => state.inputImages)
  const homeStyleReferenceImage = useStore((state) => state.styleReferenceImage)
  const setHomeInputImages = useStore((state) => state.setInputImages)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const dragCounterRef = useRef(0)
  const hydratedRef = useRef(false)
  const [marketplace, setMarketplace] = useState<AmazonMarketplace>(DEFAULT_AMAZON_MARKETPLACE)
  const [input, setInput] = useState<ListingCopyInput>(DEFAULT_LISTING_COPY_INPUT)
  const [profitInput, setProfitInput] = useState<ListingCopyProfitInput>(DEFAULT_LISTING_COPY_PROFIT_INPUT)
  const [prompts, setPrompts] = useState<ListingCopyPrompts>(cloneDefaultListingCopyPrompts)
  const [showSystemKnowledgeBase, setShowSystemKnowledgeBase] = useState(false)
  const [knowledgeBaseView, setKnowledgeBaseView] = useState<ListingCopyKnowledgeSource['id']>('title-prompt')
  const [result, setResult] = useState<ListingCopyResult | null>(null)
  const [referenceImages, setReferenceImages] = useState<InputImage[]>([])
  const [sessions, setSessions] = useState<ListingCopySession[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [validationIssues, setValidationIssues] = useState<string[]>([])
  const [isDraggingReferenceImages, setIsDraggingReferenceImages] = useState(false)
  const [showGenerationDetails, setShowGenerationDetails] = useState(false)
  const [showRefinement, setShowRefinement] = useState(false)
  const [refinementInstruction, setRefinementInstruction] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [generationRun, setGenerationRun] = useState<{
    startedAt: number | null
    finishedAt: number | null
    status: PlannerRunStatus
    attempt: PlannerAttemptInfo | null
    responseText: string
    error: string
  }>({ startedAt: null, finishedAt: null, status: 'preparing', attempt: null, responseText: '', error: '' })
  const profit = useMemo(() => calculateListingCopyProfit(profitInput), [profitInput])
  const versions = useMemo(() => sessions.filter((session) => session.kind === 'version').sort((a, b) => b.createdAt - a.createdAt), [sessions])
  const plannerProfile = useMemo(() => {
    const baseProfile = getAmazonPlannerProfile(settings)
    return baseProfile
      ? applyGuestUnifiedApiUrl(baseProfile, 'planner', adminAccess, isAdminAuthenticated)
      : null
  }, [adminAccess, isAdminAuthenticated, settings])
  const plannerProfileError = plannerProfile
    ? validateApiProfile(plannerProfile)
    : '尚未选择可用于 AI 策划的配置'

  const updateInput = <K extends keyof ListingCopyInput>(key: K, value: ListingCopyInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }))
  }
  const updateProfit = <K extends keyof ListingCopyProfitInput>(key: K, value: ListingCopyProfitInput[K]) => {
    setProfitInput((current) => ({ ...current, [key]: value }))
  }
  const hasProductCopy = Object.entries(input).some(([key, value]) => key !== 'preset' && typeof value === 'string' && value.trim())
  const clearProductCopy = () => {
    setInput((current) => ({ ...DEFAULT_LISTING_COPY_INPUT, preset: current.preset }))
    showToast('产品资料文案已清空', 'success')
  }
  const clearReferenceImages = () => {
    setReferenceImages([])
    setIsDraggingReferenceImages(false)
    dragCounterRef.current = 0
    if (fileInputRef.current) fileInputRef.current.value = ''
    showToast('已上传的参考图已清空', 'success')
  }

  const syncReferenceImagesToHome = () => {
    const uploadLimit = Math.max(1, Math.min(64, adminAccess.referenceImageUploadLimit))
    const styleReferenceCount = homeStyleReferenceImage ? 1 : 0
    const result = replaceInputImagesWithReferenceImages(
      referenceImages,
      Math.max(0, uploadLimit - styleReferenceCount),
    )
    if (!result.images.length) {
      showToast(`首页参考图容量不足（上限 ${uploadLimit} 张，当前风格参考图占用 ${styleReferenceCount} 张）`, 'error')
      return
    }

    const nextIds = new Set(result.images.map((image) => image.id))
    setHomeInputImages(result.images)
    for (const image of homeInputImages) {
      if (!nextIds.has(image.id)) void deleteImageIfUnreferenced(image.id)
    }

    const details = [
      `已用 ${result.images.length} 张 Listing 参考图替换首页参考图`,
      result.duplicateCount > 0 ? `${result.duplicateCount} 张已存在` : '',
      result.skippedCount > 0 ? `${result.skippedCount} 张超出首页上限` : '',
    ].filter(Boolean)
    showToast(details.join('，'), 'success')
  }

  useEffect(() => {
    let cancelled = false
    void getAllListingCopySessions().then(async (storedSessions) => {
      if (cancelled) return
      setSessions(storedSessions)
      const draft = storedSessions.find((session) => session.id === DRAFT_ID)
      if (draft) {
        setMarketplace(normalizeAmazonMarketplace(draft.marketplace))
        setInput(cloneInput(draft.input))
        setProfitInput(cloneProfit(draft.profitInput))
        setPrompts(normalizeListingCopyPrompts(draft.prompts, draft.prompt))
        setResult(draft.result ? normalizeListingCopyResult(draft.result) : null)
        const images = (await Promise.all((draft.referenceImageIds ?? []).map(async (id) => {
          const dataUrl = await ensureImageCached(id)
          return dataUrl ? { id, dataUrl } : null
        }))).filter((image): image is InputImage => image != null)
        if (!cancelled) setReferenceImages(images)
      }
      hydratedRef.current = true
    }).catch((error) => {
      hydratedRef.current = true
      showToast(`Listing 文案历史加载失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    })
    return () => {
      cancelled = true
      abortControllerRef.current?.abort()
    }
  }, [showToast])

  useEffect(() => {
    if (!hydratedRef.current) return
    const timer = window.setTimeout(() => {
      const now = Date.now()
      const previous = sessions.find((session) => session.id === DRAFT_ID)
      const draft: ListingCopySession = {
        id: DRAFT_ID,
        kind: 'draft',
        title: titleForSession(input, result),
        marketplace,
        input,
        prompts,
        result,
        profitInput,
        referenceImageIds: referenceImages.map((image) => image.id),
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }
      void putListingCopySession(draft).then(() => {
        setSessions((current) => [draft, ...current.filter((session) => session.id !== DRAFT_ID)])
      }).catch(() => {})
    }, 600)
    return () => window.clearTimeout(timer)
  }, [input, marketplace, profitInput, prompts, referenceImages, result])

  useEffect(() => {
    if (!showSystemKnowledgeBase) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSystemKnowledgeBase(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSystemKnowledgeBase])

  const handleFiles = async (files: FileList | File[]) => {
    const candidates = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!candidates.length) return
    const available = Math.max(0, Math.min(8, adminAccess.referenceImageUploadLimit) - referenceImages.length)
    if (!available) {
      showToast('参考图已达上限', 'error')
      return
    }
    setIsUploading(true)
    try {
      const created = (await Promise.all(candidates.slice(0, available).map(createInputImageFromFile))).filter((image): image is InputImage => image != null)
      setReferenceImages((current) => [...current, ...created.filter((image) => !current.some((item) => item.id === image.id))])
      showToast(`已上传 ${created.length} 张参考图`, 'success')
    } catch (error) {
      showToast(`参考图上传失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const stopGeneration = () => {
    abortControllerRef.current?.abort()
    setGenerationRun((current) => ({ ...current, status: 'stopped', finishedAt: Date.now() }))
    setIsGenerating(false)
    setIsRefining(false)
    setStatus('')
  }

  const restoreSession = async (session: ListingCopySession) => {
    setMarketplace(normalizeAmazonMarketplace(session.marketplace))
    setInput(cloneInput(session.input))
    setProfitInput(cloneProfit(session.profitInput))
    setPrompts(normalizeListingCopyPrompts(session.prompts, session.prompt))
    const restoredResult = session.result ? normalizeListingCopyResult(session.result) : null
    setResult(restoredResult)
    setValidationIssues(restoredResult ? validateListingCopyResult(restoredResult) : [])
    const images = (await Promise.all((session.referenceImageIds ?? []).map(async (id) => {
      const dataUrl = await ensureImageCached(id)
      return dataUrl ? { id, dataUrl } : null
    }))).filter((image): image is InputImage => image != null)
    setReferenceImages(images)
    setShowHistory(false)
    showToast('文案历史已恢复为当前草稿', 'success')
  }

  const runGeneration = async (sellerRefinement = '') => {
    const refinementRequest = sellerRefinement.trim()
    const resultBeforeRefinement = result
    if (refinementRequest && !resultBeforeRefinement) {
      showToast('请先生成一版 Listing 文案', 'error')
      return
    }
    if (!refinementRequest && !input.productDescription.trim() && !input.category.trim() && !referenceImages.length) {
      showToast('请至少填写产品介绍、品类或上传参考图', 'error')
      return
    }
    if (!plannerProfile) {
      showToast('请先在设置中选择 AI 策划配置', 'error')
      setShowSettings(true, 'api')
      return
    }
    if (plannerProfileError) {
      showToast(`AI 策划配置不完整：${plannerProfileError}`, 'error')
      setShowSettings(true, 'api')
      return
    }

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsGenerating(true)
    setIsRefining(Boolean(refinementRequest))
    setValidationIssues([])
    setStatus(refinementRequest ? '正在准备当前文案与参考图…' : '正在准备产品资料与参考图…')
    setGenerationRun({ startedAt: Date.now(), finishedAt: null, status: 'preparing', attempt: null, responseText: '', error: '' })
    try {
      const personalKnowledgePrompt = buildListingKnowledgePrompt(await getAllPersonalKnowledgeDocuments())
      if (controller.signal.aborted) return
      const payload = await preparePlannerReferenceImagePayload(referenceImages.map((image) => image.dataUrl), { signal: controller.signal })
      const generated = await generateListingCopy({
        input,
        prompts,
        marketplace,
        profile: plannerProfile,
        personalKnowledgePrompt,
        referenceImageDataUrls: payload.dataUrls,
        previousRaw: refinementRequest && resultBeforeRefinement ? JSON.stringify(resultBeforeRefinement) : undefined,
        refinementInstruction: refinementRequest || undefined,
        signal: controller.signal,
        onAttemptStart: (attempt) => {
          setStatus(attempt.label)
          setGenerationRun((current) => ({ ...current, attempt, status: 'waiting', responseText: '', error: '' }))
        },
        onStatusChange: (next) => {
          setStatus(next === 'streaming' ? '正在接收文案…' : next === 'parsing' ? '正在校验结果…' : '等待 AI 返回…')
          setGenerationRun((current) => ({ ...current, status: next }))
        },
        onTextDelta: (delta) => setGenerationRun((current) => ({ ...current, responseText: current.responseText + delta })),
      })
      if (controller.signal.aborted) return
      setResult(generated.result)
      if (refinementRequest) {
        setShowRefinement(false)
        setRefinementInstruction('')
      }
      setValidationIssues(generated.validationIssues)
      setGenerationRun((current) => ({ ...current, status: 'success', finishedAt: Date.now(), responseText: generated.rawResponseText || current.responseText }))
      const now = Date.now()
      const version: ListingCopySession = {
        id: createVersionId(),
        kind: 'version',
        title: titleForSession(input, generated.result),
        marketplace,
        input: cloneInput(input),
        prompts: { ...prompts },
        result: generated.result,
        profitInput: cloneProfit(profitInput),
        referenceImageIds: referenceImages.map((image) => image.id),
        createdAt: now,
        updatedAt: now,
      }
      await putListingCopySession(version)
      setSessions((current) => [version, ...current])
      const successMessage = refinementRequest
        ? generated.validationIssues.length ? '文案已优化，请检查标红规则' : '当前 Listing 文案已优化'
        : generated.validationIssues.length ? '文案已生成，请检查标红规则' : generated.repaired ? '文案已生成并自动修复' : 'Listing 文案已生成'
      showToast(successMessage, generated.validationIssues.length ? 'info' : 'success')
    } catch (error) {
      if (!controller.signal.aborted) {
        const detail = error instanceof Error ? error.message : String(error)
        setGenerationRun((current) => ({ ...current, status: 'error', finishedAt: Date.now(), error: detail }))
        showToast(`${refinementRequest ? '文案优化' : '文案生成'}失败：${detail}`, 'error')
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
      setIsGenerating(false)
      setIsRefining(false)
      setStatus('')
    }
  }

  const updateBilingual = (key: 'itemName' | 'itemHighlight' | 'longDescription' | 'backendSearchTerms', value: BilingualText) => {
    setResult((current) => current ? { ...current, [key]: value } : current)
  }

  const coreKeywordsText = result ? {
    en: result.coreKeywords.map((keyword) => keyword.en).filter(Boolean).join(', '),
    zh: result.coreKeywords.map((keyword) => keyword.zh).filter(Boolean).join('，'),
  } : { en: '', zh: '' }

  return (
    <main data-no-drag-select className="pb-16 pt-20">
      <div className="safe-area-x mx-auto max-w-7xl space-y-5 lg:!px-6">
        <section className={`${CARD_CLASS} overflow-hidden`}>
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50/80 via-white to-violet-50/70 px-4 py-5 dark:border-white/[0.08] dark:from-blue-500/10 dark:via-gray-900 dark:to-violet-500/10 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 inline-flex rounded-full border border-blue-200 bg-white/70 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">Listing Copy Studio</div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">AI Listing 文案</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">输入真实产品资料，生成美国站主标题、辅助标题、五点、长描述和关键词，并同步测算 FBM/FBA 利润。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 dark:border-white/[0.08] dark:bg-gray-950">
                  <span className="text-xs text-gray-400">目标站点</span>
                  <Select value={marketplace} onChange={(value) => setMarketplace(normalizeAmazonMarketplace(value))} options={AMAZON_MARKETPLACE_OPTIONS} ariaLabel="目标站点" className={`${COMPACT_SELECT_CLASS} min-w-24 !h-7 !rounded-lg !px-2 text-sm font-semibold`} />
                </label>
                <button type="button" onClick={() => setShowHistory((value) => !value)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${showHistory ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-white/[0.06]'}`}>
                  <HistoryIcon className="h-4 w-4" /> 历史版本 {versions.length > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] dark:bg-white/10">{versions.length}</span>}
                </button>
              </div>
            </div>
          </div>
          {showHistory && (
            <div className="border-b border-gray-200 bg-gray-50 p-4 dark:border-white/[0.08] dark:bg-gray-950/60">
              {versions.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{versions.map((session) => (
                <div key={session.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{session.title}</div><div className="mt-1 text-[11px] text-gray-400">{new Date(session.createdAt).toLocaleString('zh-CN')} · 美国站</div></div>
                    <button type="button" aria-label="删除历史版本" onClick={() => void deleteListingCopySession(session.id).then(() => setSessions((current) => current.filter((item) => item.id !== session.id)))} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-400/10"><TrashIcon className="h-4 w-4" /></button>
                  </div>
                  <button type="button" onClick={() => void restoreSession(session)} className="mt-3 w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900">恢复此版本</button>
                </div>
              ))}</div> : <div className="py-5 text-center text-sm text-gray-400">成功生成后会自动保存不可变历史版本。</div>}
            </div>
          )}
        </section>

        {plannerProfileError && (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <div className="text-sm font-bold text-amber-900 dark:text-amber-100">AI 策划配置待完善</div>
              <p className="mt-1 text-xs leading-5 text-amber-800/80 dark:text-amber-200/75">
                {plannerProfile
                  ? `当前配置「${plannerProfile.name}」${plannerProfileError}，完善后即可在本页生成 Listing 文案。`
                  : '尚未选择可用于 AI 策划的配置，请先完成 API 地址、API Key 和模型设置。'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(true, 'api')}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-amber-900 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200 sm:self-auto"
            >
              <SettingsIcon className="h-4 w-4" />
              去完善 AI 配置
            </button>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <section className={`${CARD_CLASS} p-4 sm:p-5`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h3 className="font-bold text-gray-900 dark:text-white">产品资料与成本</h3><p className="mt-1 text-xs text-gray-400">只填写能够确认的事实，未提供的信息不会让 AI 猜测。</p></div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-36">
                <Select value={input.preset} onChange={(value) => updateInput('preset', value === 'general' ? 'general' : 'footwear')} options={[{ value: 'footwear', label: '鞋靴预设' }, { value: 'general', label: '通用商品' }]} ariaLabel="商品预设" className={`${COMPACT_SELECT_CLASS} w-full`} />
                {hasProductCopy && (
                  <button type="button" onClick={clearProductCopy} className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-400/20 dark:bg-gray-950 dark:text-red-300 dark:hover:bg-red-400/10">
                    <TrashIcon className="h-3.5 w-3.5" />清空文案
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextField label="产品介绍" value={input.productDescription} onChange={(value) => updateInput('productDescription', value)} rows={8} placeholder="产品是什么、解决什么需求、最重要的真实特点…" /></div>
              <TextField label="品牌 / 型号" value={input.brand} onChange={(value) => updateInput('brand', value)} />
              <TextField label="核心品类" value={input.category} onChange={(value) => updateInput('category', value)} placeholder="例如 Women's Mule Sandals" />
              <TextField label="材质" value={input.material} onChange={(value) => updateInput('material', value)} />
              <TextField label="颜色与尺码" value={input.colorAndSize} onChange={(value) => updateInput('colorAndSize', value)} />
              <TextField label="目标人群" value={input.audience} onChange={(value) => updateInput('audience', value)} />
              <TextField label="使用场景" value={input.useCases} onChange={(value) => updateInput('useCases', value)} />
              <div className="sm:col-span-2"><TextField label="功能与卖点" value={input.features} onChange={(value) => updateInput('features', value)} rows={3} /></div>
              {input.preset === 'footwear' && <>
                <TextField label="鞋跟 / 鞋头" value={input.heel} onChange={(value) => updateInput('heel', value)} />
                <TextField label="鞋底 / 防滑" value={input.sole} onChange={(value) => updateInput('sole', value)} />
                <TextField label="穿戴方式" value={input.closure} onChange={(value) => updateInput('closure', value)} />
                <TextField label="舒适性" value={input.comfort} onChange={(value) => updateInput('comfort', value)} />
              </>}
              <TextField label="必须包含的词" value={input.requiredTerms} onChange={(value) => updateInput('requiredTerms', value)} />
              <TextField label="禁止使用的词" value={input.forbiddenTerms} onChange={(value) => updateInput('forbiddenTerms', value)} />
            </div>

            <div
              className={`mt-5 rounded-2xl border-2 border-dashed p-4 transition ${isDraggingReferenceImages ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-500/10 dark:border-blue-400 dark:bg-blue-400/10' : 'border-transparent border-t-gray-200 pt-5 dark:border-transparent dark:border-t-white/[0.08]'}`}
              onDragEnter={(event) => {
                event.preventDefault()
                dragCounterRef.current += 1
                if (event.dataTransfer.types.includes('Files')) setIsDraggingReferenceImages(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
              }}
              onDragLeave={(event) => {
                event.preventDefault()
                dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
                if (dragCounterRef.current === 0) setIsDraggingReferenceImages(false)
              }}
              onDrop={(event) => {
                event.preventDefault()
                dragCounterRef.current = 0
                setIsDraggingReferenceImages(false)
                if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files)
              }}
            >
              <div className="mb-3 space-y-3">
                <div><h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">产品参考图</h4><p className="mt-1 text-[11px] text-gray-400">用于确认外观事实，最多 8 张；不会直接决定文案风格。</p></div>
                <div className={`grid w-full gap-2 ${referenceImages.length > 0 ? 'sm:grid-cols-3' : ''}`}>
                  {referenceImages.length > 0 && (
                    <button type="button" onClick={clearReferenceImages} disabled={isUploading} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-400/20 dark:bg-gray-950 dark:text-red-300 dark:hover:bg-red-400/10">
                      <TrashIcon className="h-3.5 w-3.5" />清空图片
                    </button>
                  )}
                  {referenceImages.length > 0 && (
                    <button
                      type="button"
                      onClick={syncReferenceImagesToHome}
                      disabled={isUploading}
                      title="用当前 Listing 文案页参考图替换首页参考图"
                      className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/15"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />替换首页参考图
                    </button>
                  )}
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><PhotoIcon className="h-4 w-4" />{isUploading ? '上传中…' : '上传参考图'}</button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { void handleFiles(event.target.files ?? []); event.target.value = '' }} />
              {referenceImages.length ? <><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{referenceImages.map((image, index) => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/[0.08] dark:bg-gray-950"><img src={image.dataUrl} alt={`产品参考图 ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label={`删除参考图 ${index + 1}`} onClick={() => setReferenceImages((current) => current.filter((item) => item.id !== image.id))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"><CloseIcon className="h-3.5 w-3.5" /></button></div>)}</div><div className="mt-2 text-center text-[11px] text-gray-400">可继续把图片拖到此区域添加</div></> : <button type="button" onClick={() => fileInputRef.current?.click()} className={`flex w-full flex-col items-center justify-center rounded-xl border border-dashed py-8 text-sm transition ${isDraggingReferenceImages ? 'border-blue-400 bg-white/70 text-blue-600 dark:bg-gray-900/70' : 'border-gray-300 text-gray-400 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-600 dark:border-white/[0.12] dark:hover:bg-blue-400/5'}`}><PhotoIcon className="mb-2 h-6 w-6" /><span>{isDraggingReferenceImages ? '松开即可上传图片' : '点击或拖拽上传产品参考图'}</span><span className="mt-1 text-[11px] font-normal opacity-75">支持一次拖入多张图片，不使用风格参考图</span></button>}
            </div>

            <div className="mt-5 border-t border-gray-200 pt-5 dark:border-white/[0.08]">
              <h4 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-100">成本与物流</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <NumberField label="采购成本" value={profitInput.purchaseCostCny} onChange={(value) => updateProfit('purchaseCostCny', value)} suffix="CNY" />
                <NumberField label="国内运费" value={profitInput.domesticShippingCny} onChange={(value) => updateProfit('domesticShippingCny', value)} suffix="CNY" />
                <NumberField label="商品净重" value={profitInput.netWeightG} onChange={(value) => updateProfit('netWeightG', value)} suffix="g" />
                <NumberField label="包装增重" value={profitInput.packagingWeightG} onChange={(value) => updateProfit('packagingWeightG', value)} suffix="g" />
                <NumberField label="汇率" value={profitInput.exchangeRate} onChange={(value) => updateProfit('exchangeRate', value)} step={0.01} />
                <NumberField label="Amazon 佣金率" value={profitInput.referralRatePercent} onChange={(value) => updateProfit('referralRatePercent', value)} suffix="%" />
                <NumberField label="目标净利率" value={profitInput.targetMarginPercent} onChange={(value) => updateProfit('targetMarginPercent', value)} suffix="%" />
                <NumberField label="燕文公斤价" value={profitInput.yanwenRateCnyPerKg} onChange={(value) => updateProfit('yanwenRateCnyPerKg', value)} suffix="CNY/kg" />
                <NumberField label="燕文挂号费" value={profitInput.yanwenRegistrationFeeCny} onChange={(value) => updateProfit('yanwenRegistrationFeeCny', value)} suffix="CNY" />
                <NumberField label="竞品最低价" value={profitInput.competitorMinPriceUsd} onChange={(value) => updateProfit('competitorMinPriceUsd', value)} suffix="USD" optional />
                <NumberField label="竞品最高价" value={profitInput.competitorMaxPriceUsd} onChange={(value) => updateProfit('competitorMaxPriceUsd', value)} suffix="USD" optional />
                <NumberField label="FBA 头程/件" value={profitInput.fbaInboundCny} onChange={(value) => updateProfit('fbaInboundCny', value)} suffix="CNY" optional />
                <NumberField label="FBA 配送费" value={profitInput.fbaFulfillmentFeeUsd} onChange={(value) => updateProfit('fbaFulfillmentFeeUsd', value)} suffix="USD" optional />
              </div>
            </div>
          </section>

          <section className={`${CARD_CLASS} flex min-h-[720px] flex-col p-4 sm:p-5`}>
            <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-bold text-gray-900 dark:text-white">Listing 策划提示词</h3><p className="mt-1 text-xs text-gray-400">标题、五点描述和长描述可分别修改，生成时会连同产品资料一起提交给 AI。</p></div><button type="button" onClick={() => setPrompts(cloneDefaultListingCopyPrompts())} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"><RefreshIcon className="h-3.5 w-3.5" />全部恢复默认</button></div>
            <div className="space-y-3">
              <PromptEditor label="标题提示词" description="默认仅使用《标题Prompt.txt》原文；系统只额外禁止逗号和独立单词 and，不再追加其他标题说明。" value={prompts.title} onChange={(value) => setPrompts((current) => ({ ...current, title: value }))} onReset={() => setPrompts((current) => ({ ...current, title: DEFAULT_LISTING_COPY_PROMPTS.title }))} rows={9} tone="emerald" />
              <PromptEditor label="五点描述提示词" description="严格五条，用具体利益型小标题把真实参数转化为购买理由。" value={prompts.bullets} onChange={(value) => setPrompts((current) => ({ ...current, bullets: value }))} onReset={() => setPrompts((current) => ({ ...current, bullets: DEFAULT_LISTING_COPY_PROMPTS.bullets }))} rows={16} tone="blue" />
              <PromptEditor label="长描述提示词" description="独立大标题、卖点叙事、适用场景、规格说明和优雅收尾；AI 只返回无 Markdown/HTML 标签的纯文本。" value={prompts.longDescription} onChange={(value) => setPrompts((current) => ({ ...current, longDescription: value }))} onReset={() => setPrompts((current) => ({ ...current, longDescription: DEFAULT_LISTING_COPY_PROMPTS.longDescription }))} rows={18} tone="violet" />
            </div>
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-500 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-400"><span className="font-semibold text-gray-700 dark:text-gray-200">系统固定契约：</span>标题只额外禁用逗号和独立单词 and；五点与长描述必须是买家销售文案，缺失资料只能进入内部清单，不能出现在买家可见内容中。JSON 结构和禁止编造规则始终保留。</div>
            <button type="button" onClick={() => setShowSystemKnowledgeBase(true)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/15"><EyeIcon className="h-4 w-4" />查看内置知识库</button>
            <PersonalKnowledgeBase profile={plannerProfile} onOpenSettings={() => setShowSettings(true, 'api')} />
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void runGeneration()} disabled={isGenerating} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60">{isGenerating ? status || 'AI 生成中…' : '生成 Listing 文案'}</button>
              {generationRun.startedAt && (plannerProfile?.streamImages || !isGenerating) && <button type="button" onClick={() => setShowGenerationDetails(true)} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"><EyeIcon className="h-4 w-4" />{isGenerating && plannerProfile?.streamImages ? '查看流式数据' : '查看返回'}</button>}
              {isGenerating && <button type="button" onClick={stopGeneration} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-400/20 dark:hover:bg-red-400/10">停止</button>}
            </div>
          </section>
        </div>

        <section className={`${CARD_CLASS} p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="font-bold text-gray-900 dark:text-white">建议定价与利润预估</h3><p className="mt-1 text-xs text-gray-400">统一使用同一个测算售价比较 FBM 与 FBA；净利率 = 净利润 ÷ 售价。</p></div><div className="w-full lg:w-64"><NumberField label="利润测算售价" value={profitInput.calculationPriceUsd ?? profit.suggestedPriceUsd} onChange={(value) => updateProfit('calculationPriceUsd', value)} suffix="USD" /></div></div>
          {profit.error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{profit.error}</div>}
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/[0.08] dark:bg-gray-950"><div className="text-xs text-gray-400">计费重量 / 燕文费</div><div className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{profit.billingWeightKg == null ? '待补全' : `${profit.billingWeightKg.toFixed(3)} kg`}</div><div className="mt-1 text-sm text-gray-500">{profit.yanwenFeeCny == null ? '补充重量后计算' : `¥${profit.yanwenFeeCny.toFixed(2)}`}</div></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-400/20 dark:bg-blue-400/10"><div className="text-xs text-blue-600 dark:text-blue-300">建议售价</div><div className="mt-2 text-xl font-bold text-blue-800 dark:text-blue-100"><MoneyValue value={profit.suggestedPriceUsd} /></div><div className="mt-1 text-xs text-blue-600/80 dark:text-blue-300">取 FBM/FBA 建议价较高值</div></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10"><div className="text-xs text-emerald-600 dark:text-emerald-300">FBM 预估利润</div><div className="mt-2 text-xl font-bold text-emerald-800 dark:text-emerald-100"><MoneyValue value={profit.fbm.profitUsd} /></div><div className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-300">建议价 <MoneyValue value={profit.fbm.suggestedPriceUsd} /> · 利润率 {profit.fbm.marginPercent == null ? '待补全' : `${profit.fbm.marginPercent}%`}</div>{profit.fbm.warning && <div className="mt-2 text-[11px] leading-4 text-amber-600 dark:text-amber-300">{profit.fbm.warning}</div>}</div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-400/20 dark:bg-violet-400/10"><div className="text-xs text-violet-600 dark:text-violet-300">FBA 预估利润</div><div className="mt-2 text-xl font-bold text-violet-800 dark:text-violet-100"><MoneyValue value={profit.fba?.profitUsd} /></div><div className="mt-1 text-xs text-violet-600/80 dark:text-violet-300">{profit.fba ? <>建议价 <MoneyValue value={profit.fba.suggestedPriceUsd} /> · 利润率 {profit.fba.marginPercent == null ? '待补全' : `${profit.fba.marginPercent}%`}</> : '补充 FBA 头程和配送费后计算'}</div>{profit.fba?.warning && <div className="mt-2 text-[11px] leading-4 text-amber-600 dark:text-amber-300">{profit.fba.warning}</div>}</div>
          </div>
        </section>

        <section className={`${CARD_CLASS} p-4 sm:p-5`}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-gray-900 dark:text-white">中英文 Listing 文案</h3><p className="mt-1 text-xs text-gray-400">先查看 AI 的标题策划依据，再复制或编辑最终主标题、辅助标题和正文。</p></div>{result && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowRefinement((value) => !value)} disabled={isGenerating} className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200 dark:hover:bg-violet-400/15"><EditIcon className="h-4 w-4" />优化当前文案</button><CopyButton value={formatAllEnglishListingCopy(result)} label="复制全部英文" showLabel onCopied={() => showToast('全部英文文案已复制', 'success')} /></div>}</div>
          {!result ? <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center dark:border-white/[0.12]"><div className="text-sm font-medium text-gray-500 dark:text-gray-300">生成结果会显示在这里</div><div className="mt-1 text-xs text-gray-400">Item Name 与 Item Highlight 始终独立，不会拼接。</div></div> : <div className="space-y-3">
            {showRefinement && <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50/60 p-4 dark:border-violet-400/20 dark:from-violet-500/10 dark:via-gray-900 dark:to-blue-500/10"><div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-bold text-gray-900 dark:text-white">继续优化当前文案</h4><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">AI 会同时参考当前结果、原始产品资料和产品图，只修改你提出的部分，并把新结果保存为一个历史版本。</p></div><button type="button" aria-label="关闭优化当前文案" onClick={() => setShowRefinement(false)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"><CloseIcon className="h-4 w-4" /></button></div><textarea value={refinementInstruction} onChange={(event) => setRefinementInstruction(event.target.value)} rows={4} placeholder="例如：保留标题，把五点和长描述写得更华丽；结合凹凸橡胶鞋底突出防滑与强抓地；结合高防水台说明16厘米高跟的实际坡度与稳定感。" className={`${FIELD_CLASS} mt-3 resize-y pr-3`} /><div className="mt-3 flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => { setShowRefinement(false); setRefinementInstruction('') }} disabled={isGenerating} className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-white disabled:opacity-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消</button><button type="button" onClick={() => void runGeneration(refinementInstruction)} disabled={isGenerating || !refinementInstruction.trim()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"><EditIcon className="h-4 w-4" />{isRefining ? status || '正在优化…' : '提交优化要求'}</button></div></section>}
            {validationIssues.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-400/20 dark:bg-red-400/10"><div className="text-xs font-bold text-red-700 dark:text-red-200">需要人工检查</div><ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-red-600 dark:text-red-300">{validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
            {(result.titleAnalysis ?? '').trim() && <section className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-violet-50/70 dark:border-blue-400/20 dark:from-blue-500/10 dark:via-gray-900 dark:to-violet-500/10"><div className="flex items-center justify-between gap-3 border-b border-blue-100 px-4 py-3 dark:border-blue-400/15"><div><h4 className="text-sm font-bold text-gray-900 dark:text-white">AI 标题策划分析</h4><p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">商品身份、图片识别节点、关键词分层与标题取舍</p></div><CopyButton value={result.titleAnalysis ?? ''} label="复制策划分析" showLabel onCopied={() => showToast('标题策划分析已复制', 'success')} /></div><article className="break-words px-4 py-4 text-sm leading-7 text-gray-700 dark:text-gray-300 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 dark:[&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-bold [&_h3]:text-gray-900 dark:[&_h3]:text-white [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-bold [&_strong]:text-gray-900 dark:[&_strong]:text-white [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: listingDescriptionToHtml(result.titleAnalysis ?? '', { allowMarkdown: true }) }} /></section>}
            <BilingualEditor label="主标题 Item Name" value={result.itemName} englishLimit={ITEM_NAME_MAX_CHARACTERS} onChange={(value) => updateBilingual('itemName', value)} />
            <BilingualEditor label="辅助标题 Item Highlight" value={result.itemHighlight} englishLimit={ITEM_HIGHLIGHT_MAX_CHARACTERS} onChange={(value) => updateBilingual('itemHighlight', value)} />
            <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-gray-950/60 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">五点描述</h4><p className="mt-1 text-[11px] text-gray-400">可整组复制，也可继续逐条编辑和复制。</p></div><div className="flex flex-wrap gap-2"><CopyButton value={formatListingCopyBullets(result, 'en')} label="复制五点英文" showLabel onCopied={() => showToast('五点英文已复制', 'success')} /><CopyButton value={formatListingCopyBullets(result, 'zh')} label="复制五点中文" showLabel onCopied={() => showToast('五点中文已复制', 'success')} /></div></section>
            {result.bullets.map((bullet, index) => <BilingualEditor key={index} label={`五点描述 ${index + 1}`} value={bullet} rows={4} onChange={(value) => setResult((current) => current ? { ...current, bullets: current.bullets.map((item, itemIndex) => itemIndex === index ? value : item) as ListingCopyResult['bullets'] } : current)} />)}
            <BilingualEditor label="长描述（纯文本｜推荐提交）" value={result.longDescription} rows={15} onChange={(value) => updateBilingual('longDescription', value)} />
            <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-gray-900"><div className="mb-3"><h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">长描述富文本预览</h4><p className="mt-1 text-[11px] text-gray-400">复制富文本会同时写入 HTML 与纯文本；Amazon 官方已不支持描述 HTML，直接提交时优先复制上方纯文本。</p></div><div className="grid gap-3 lg:grid-cols-2"><SafeHtmlPreview label="英文预览" html={listingDescriptionToHtml(result.longDescription.en)} plainText={result.longDescription.en} /><SafeHtmlPreview label="中文预览" html={listingDescriptionToHtml(result.longDescription.zh)} plainText={result.longDescription.zh} /></div></section>
            <BilingualEditor label="核心关键词" value={coreKeywordsText} rows={3} onChange={(value) => setResult((current) => current ? { ...current, coreKeywords: value.en.split(/[,\n]/).map((en, index) => ({ en: en.trim(), zh: value.zh.split(/[，,\n]/)[index]?.trim() ?? '' })).filter((item) => item.en || item.zh) } : current)} />
            <BilingualEditor label="Backend Search Terms" value={result.backendSearchTerms} rows={3} onChange={(value) => updateBilingual('backendSearchTerms', value)} />
            <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-gray-950/60"><div className="mb-3"><h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">兼容 HTML 长描述</h4><p className="mt-1 text-[11px] text-gray-400">由纯文本在本地安全生成，仅用于仍接受富文本的外部工具；Amazon 商品描述不建议提交 HTML 标签。</p></div><div className="grid gap-3 lg:grid-cols-2">{([{ label: '英文 HTML', value: listingDescriptionToHtml(result.longDescription.en) }, { label: '中文 HTML', value: listingDescriptionToHtml(result.longDescription.zh) }] as const).map((item) => <FieldShell key={item.label} label={item.label} value={item.value}><textarea readOnly value={item.value} rows={13} className={`${FIELD_CLASS} min-h-72 resize-y bg-gray-50 font-mono text-xs leading-5 dark:bg-gray-950`} /></FieldShell>)}</div><div className="mt-4"><div className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">富文本效果预览</div><div className="grid gap-3 lg:grid-cols-2"><SafeHtmlPreview label="英文预览" html={listingDescriptionToHtml(result.longDescription.en)} plainText={result.longDescription.en} /><SafeHtmlPreview label="中文预览" html={listingDescriptionToHtml(result.longDescription.zh)} plainText={result.longDescription.zh} /></div></div></section>
            {(result.missingFacts.length > 0 || result.complianceWarnings.length > 0) && <div className="grid gap-3 lg:grid-cols-2"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/20 dark:bg-amber-400/10"><div className="text-xs font-bold text-amber-700 dark:text-amber-200">缺失信息</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">{result.missingFacts.length ? result.missingFacts.map((item) => <li key={item}>{item}</li>) : <li>无</li>}</ul></div><div className="rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-400/20 dark:bg-orange-400/10"><div className="text-xs font-bold text-orange-700 dark:text-orange-200">合规提醒</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-orange-700 dark:text-orange-300">{result.complianceWarnings.length ? result.complianceWarnings.map((item) => <li key={item}>{item}</li>) : <li>无</li>}</ul></div></div>}
          </div>}
        </section>
      </div>

      {showSystemKnowledgeBase && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSystemKnowledgeBase(false)
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="listing-knowledge-base-title" className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl dark:border-white/[0.1] dark:bg-gray-900">
            <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 dark:border-white/[0.08] sm:px-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"><BookOpenIcon className="h-5 w-5" /></div>
                <div><h3 id="listing-knowledge-base-title" className="font-bold text-gray-900 dark:text-white">内置知识库原文</h3><p className="mt-1 text-xs text-gray-400">仅展示 docs 中的公开标题 Prompt 和图片规范参考，不再包含私有笔记。个人上传文档请在下方个人知识库管理。</p></div>
              </div>
              <button type="button" aria-label="关闭系统内置知识库" onClick={() => setShowSystemKnowledgeBase(false)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"><CloseIcon className="h-5 w-5" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {LISTING_COPY_KNOWLEDGE_SOURCES.map((source) => (
                  <button key={source.id} type="button" onClick={() => setKnowledgeBaseView(source.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${knowledgeBaseView === source.id ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/[0.06]'}`}>{source.filename}</button>
                ))}
              </div>
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 p-4 font-sans text-sm leading-7 text-gray-700 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300">{LISTING_COPY_KNOWLEDGE_SOURCES.find((source) => source.id === knowledgeBaseView)?.content ?? ''}</pre>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-white/[0.08] sm:px-5">
              <CopyButton value={LISTING_COPY_KNOWLEDGE_SOURCES.find((source) => source.id === knowledgeBaseView)?.content ?? ''} label="复制当前内容" onCopied={() => showToast('当前知识库内容已复制', 'success')} />
              <button type="button" onClick={() => setShowSystemKnowledgeBase(false)} className="h-9 rounded-xl bg-gray-900 px-4 text-xs font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">关闭</button>
            </footer>
          </section>
        </div>
      )}
      {showGenerationDetails && generationRun.startedAt && plannerProfile && (
        <PlannerRunDetailsModal
          status={generationRun.status}
          startedAt={generationRun.startedAt}
          finishedAt={generationRun.finishedAt}
          profileName={plannerProfile.name}
          model={plannerProfile.model}
          apiMode={generationRun.attempt?.apiMode ?? plannerProfile.apiMode}
          attempt={generationRun.attempt}
          responseText={generationRun.responseText}
          error={generationRun.error}
          running={isGenerating}
          onClose={() => setShowGenerationDetails(false)}
          onStop={stopGeneration}
        />
      )}
    </main>
  )
}
