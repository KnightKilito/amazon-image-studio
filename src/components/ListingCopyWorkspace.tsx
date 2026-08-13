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
  listingDescriptionToHtml,
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
  putListingCopySession,
} from '../lib/db'
import { copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { applyGuestUnifiedApiUrl, createInputImageFromFile, ensureImageCached, useStore } from '../store'
import Select, { COMPACT_SELECT_CLASS } from './Select'
import { BookOpenIcon, CloseIcon, CopyIcon, EyeIcon, HistoryIcon, PhotoIcon, RefreshIcon, SettingsIcon, TrashIcon } from './icons'

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

function CopyButton({ value, label = '复制', onCopied }: { value: string; label?: string; onCopied: () => void }) {
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
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
    >
      <CopyIcon className="h-4 w-4" />
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

export default function ListingCopyWorkspace() {
  const settings = useStore((state) => state.settings)
  const adminAccess = useStore((state) => state.adminAccess)
  const isAdminAuthenticated = useStore((state) => state.isAdminAuthenticated)
  const setShowSettings = useStore((state) => state.setShowSettings)
  const showToast = useStore((state) => state.showToast)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
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
        setResult(draft.result)
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

  const restoreSession = async (session: ListingCopySession) => {
    setMarketplace(normalizeAmazonMarketplace(session.marketplace))
    setInput(cloneInput(session.input))
    setProfitInput(cloneProfit(session.profitInput))
    setPrompts(normalizeListingCopyPrompts(session.prompts, session.prompt))
    setResult(session.result)
    setValidationIssues(session.result ? validateListingCopyResult(session.result) : [])
    const images = (await Promise.all((session.referenceImageIds ?? []).map(async (id) => {
      const dataUrl = await ensureImageCached(id)
      return dataUrl ? { id, dataUrl } : null
    }))).filter((image): image is InputImage => image != null)
    setReferenceImages(images)
    setShowHistory(false)
    showToast('文案历史已恢复为当前草稿', 'success')
  }

  const runGeneration = async () => {
    if (!input.productDescription.trim() && !input.category.trim() && !referenceImages.length) {
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
    setValidationIssues([])
    setStatus('正在准备产品资料与参考图…')
    try {
      const payload = await preparePlannerReferenceImagePayload(referenceImages.map((image) => image.dataUrl), { signal: controller.signal })
      const generated = await generateListingCopy({
        input,
        prompts,
        marketplace,
        profile: plannerProfile,
        referenceImageDataUrls: payload.dataUrls,
        signal: controller.signal,
        onAttemptStart: (attempt) => setStatus(attempt.label),
        onStatusChange: (next) => setStatus(next === 'streaming' ? '正在接收文案…' : next === 'parsing' ? '正在校验结果…' : '等待 AI 返回…'),
      })
      if (controller.signal.aborted) return
      setResult(generated.result)
      setValidationIssues(generated.validationIssues)
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
      showToast(generated.validationIssues.length ? '文案已生成，请检查标红规则' : generated.repaired ? '文案已生成并自动修复' : 'Listing 文案已生成', generated.validationIssues.length ? 'info' : 'success')
    } catch (error) {
      if (!controller.signal.aborted) showToast(`文案生成失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
      setIsGenerating(false)
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
            <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-gray-900 dark:text-white">产品资料与成本</h3><p className="mt-1 text-xs text-gray-400">只填写能够确认的事实，未提供的信息不会让 AI 猜测。</p></div><Select value={input.preset} onChange={(value) => updateInput('preset', value === 'general' ? 'general' : 'footwear')} options={[{ value: 'footwear', label: '鞋靴预设' }, { value: 'general', label: '通用商品' }]} ariaLabel="商品预设" className={`${COMPACT_SELECT_CLASS} w-28`} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextField label="产品介绍" value={input.productDescription} onChange={(value) => updateInput('productDescription', value)} rows={4} placeholder="产品是什么、解决什么需求、最重要的真实特点…" /></div>
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

            <div className="mt-5 border-t border-gray-200 pt-5 dark:border-white/[0.08]">
              <div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">产品参考图</h4><p className="mt-1 text-[11px] text-gray-400">用于确认外观事实，最多 8 张；不会直接决定文案风格。</p></div><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><PhotoIcon className="h-4 w-4" />{isUploading ? '上传中…' : '上传参考图'}</button></div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => { void handleFiles(event.target.files ?? []); event.target.value = '' }} />
              {referenceImages.length ? <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{referenceImages.map((image, index) => <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-white/[0.08] dark:bg-gray-950"><img src={image.dataUrl} alt={`产品参考图 ${index + 1}`} className="h-full w-full object-cover" /><button type="button" aria-label={`删除参考图 ${index + 1}`} onClick={() => setReferenceImages((current) => current.filter((item) => item.id !== image.id))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"><CloseIcon className="h-3.5 w-3.5" /></button></div>)}</div> : <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full items-center justify-center rounded-xl border border-dashed border-gray-300 py-8 text-sm text-gray-400 transition hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-600 dark:border-white/[0.12] dark:hover:bg-blue-400/5"><PhotoIcon className="mr-2 h-5 w-5" />添加产品参考图</button>}
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
              <PromptEditor label="标题提示词" description="默认直接使用《标题Prompt.txt》，同时策划 Item Name（≤75）与 Item Highlight（≤125）。" value={prompts.title} onChange={(value) => setPrompts((current) => ({ ...current, title: value }))} onReset={() => setPrompts((current) => ({ ...current, title: DEFAULT_LISTING_COPY_PROMPTS.title }))} rows={9} tone="emerald" />
              <PromptEditor label="五点描述提示词" description="根据两份笔记整理：设计/穿戴、关键结构、功能、搭配场景、注意事项，严格五条。" value={prompts.bullets} onChange={(value) => setPrompts((current) => ({ ...current, bullets: value }))} onReset={() => setPrompts((current) => ({ ...current, bullets: DEFAULT_LISTING_COPY_PROMPTS.bullets }))} rows={13} tone="blue" />
              <PromptEditor label="长描述提示词" description="根据两份笔记整理：使用稳定结构展开产品价值，并将事实型注意事项放在结尾。" value={prompts.longDescription} onChange={(value) => setPrompts((current) => ({ ...current, longDescription: value }))} onReset={() => setPrompts((current) => ({ ...current, longDescription: DEFAULT_LISTING_COPY_PROMPTS.longDescription }))} rows={11} tone="violet" />
            </div>
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs leading-5 text-gray-500 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-400"><span className="font-semibold text-gray-700 dark:text-gray-200">系统固定契约：</span>独立标题字段、75/125 字符限制、精确五点、中英结构、缺失事实、合规提醒、JSON-only 和禁止编造。该部分不会显示在编辑框内，也不能被删除。</div>
            <button type="button" onClick={() => setShowSystemKnowledgeBase(true)} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200 dark:hover:bg-blue-400/15"><EyeIcon className="h-4 w-4" />查看内置知识库</button>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => void runGeneration()} disabled={isGenerating} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-sm font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60">{isGenerating ? status || 'AI 生成中…' : '生成 Listing 文案'}</button>
              {isGenerating && <button type="button" onClick={() => abortControllerRef.current?.abort()} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-400/20 dark:hover:bg-red-400/10">停止</button>}
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-gray-900 dark:text-white">中英文 Listing 文案</h3><p className="mt-1 text-xs text-gray-400">两侧均可独立编辑和复制，不会自动互相覆盖。</p></div>{result && <CopyButton value={formatAllEnglishListingCopy(result)} label="复制全部英文" onCopied={() => showToast('全部英文文案已复制', 'success')} />}</div>
          {!result ? <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center dark:border-white/[0.12]"><div className="text-sm font-medium text-gray-500 dark:text-gray-300">生成结果会显示在这里</div><div className="mt-1 text-xs text-gray-400">Item Name 与 Item Highlight 始终独立，不会拼接。</div></div> : <div className="space-y-3">
            {validationIssues.length > 0 && <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-400/20 dark:bg-red-400/10"><div className="text-xs font-bold text-red-700 dark:text-red-200">需要人工检查</div><ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-red-600 dark:text-red-300">{validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
            <BilingualEditor label="主标题 Item Name" value={result.itemName} englishLimit={ITEM_NAME_MAX_CHARACTERS} onChange={(value) => updateBilingual('itemName', value)} />
            <BilingualEditor label="辅助标题 Item Highlight" value={result.itemHighlight} englishLimit={ITEM_HIGHLIGHT_MAX_CHARACTERS} onChange={(value) => updateBilingual('itemHighlight', value)} />
            {result.bullets.map((bullet, index) => <BilingualEditor key={index} label={`五点描述 ${index + 1}`} value={bullet} rows={4} onChange={(value) => setResult((current) => current ? { ...current, bullets: current.bullets.map((item, itemIndex) => itemIndex === index ? value : item) as ListingCopyResult['bullets'] } : current)} />)}
            <BilingualEditor label="长描述（纯文本）" value={result.longDescription} rows={8} onChange={(value) => updateBilingual('longDescription', value)} />
            <BilingualEditor label="核心关键词" value={coreKeywordsText} rows={3} onChange={(value) => setResult((current) => current ? { ...current, coreKeywords: value.en.split(/[,\n]/).map((en, index) => ({ en: en.trim(), zh: value.zh.split(/[，,\n]/)[index]?.trim() ?? '' })).filter((item) => item.en || item.zh) } : current)} />
            <BilingualEditor label="Backend Search Terms" value={result.backendSearchTerms} rows={3} onChange={(value) => updateBilingual('backendSearchTerms', value)} />
            <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-white/[0.08] dark:bg-gray-950/60"><h4 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">安全 HTML 长描述</h4><div className="grid gap-3 lg:grid-cols-2">{([{ label: '英文 HTML', value: listingDescriptionToHtml(result.longDescription.en) }, { label: '中文 HTML', value: listingDescriptionToHtml(result.longDescription.zh) }] as const).map((item) => <FieldShell key={item.label} label={item.label} value={item.value}><textarea readOnly value={item.value} rows={6} className={`${FIELD_CLASS} resize-y bg-gray-50 font-mono text-xs dark:bg-gray-950`} /></FieldShell>)}</div></section>
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
                <div><h3 id="listing-knowledge-base-title" className="font-bold text-gray-900 dark:text-white">内置知识库原文</h3><p className="mt-1 text-xs text-gray-400">查看标题 Prompt 和两份笔记的完整内容；右侧三个默认提示词以这些文件为依据。</p></div>
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
    </main>
  )
}
