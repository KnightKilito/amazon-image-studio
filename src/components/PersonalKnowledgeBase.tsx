import { useEffect, useRef, useState } from 'react'
import type { ApiProfile, PersonalKnowledgeDocument } from '../types'
import { clearPersonalKnowledgeDocuments, deletePersonalKnowledgeDocument, getAllPersonalKnowledgeDocuments, putPersonalKnowledgeDocument } from '../lib/db'
import { createPersonalKnowledgeDocument, KNOWLEDGE_FILE_ACCEPT, MAX_KNOWLEDGE_SUMMARY_LENGTH } from '../lib/personalKnowledge'
import { summarizePersonalKnowledge } from '../lib/personalKnowledgeApi'
import { validateApiProfile } from '../lib/apiProfiles'
import { useStore } from '../store'

const BUTTON = 'rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5'

export default function PersonalKnowledgeBase({ profile, onOpenSettings }: { profile: ApiProfile | null; onOpenSettings: () => void }) {
  const showToast = useStore((state) => state.showToast)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const [documents, setDocuments] = useState<PersonalKnowledgeDocument[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [summaryDraft, setSummaryDraft] = useState('')
  const [autoSummarize, setAutoSummarize] = useState(false)
  const [busy, setBusy] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const loadRevisionRef = useRef(0)
  const selected = documents.find((document) => document.id === selectedId)
  const profileError = !profile ? '请先选择 AI 策划配置' : validateApiProfile(profile) || (!['chat', 'responses'].includes(profile.apiMode) ? '策划配置需要使用 Chat 或 Responses 模式' : '')
  const load = async () => {
    const revision = ++loadRevisionRef.current
    setError('')
    try {
      const stored = await getAllPersonalKnowledgeDocuments()
      if (!mountedRef.current || revision !== loadRevisionRef.current) return
      setDocuments(stored.sort((a, b) => b.updatedAt - a.updatedAt))
      setSelectedId((current) => current && stored.some((document) => document.id === current) ? current : stored[0]?.id ?? null)
      setLoaded(true)
    } catch (err) { if (mountedRef.current && revision === loadRevisionRef.current) setError(`个人知识库加载失败：${err instanceof Error ? err.message : String(err)}`) }
  }
  useEffect(() => {
    mountedRef.current = true
    void load()
    return () => { mountedRef.current = false; loadRevisionRef.current++; controllerRef.current?.abort() }
  }, [])
  useEffect(() => { setSummaryDraft(selected?.summary ?? '') }, [selected?.id, selected?.summary])

  const save = async (document: PersonalKnowledgeDocument) => {
    const updated = { ...document, updatedAt: Date.now() }
    await putPersonalKnowledgeDocument(updated)
    if (mountedRef.current) setDocuments((current) => [updated, ...current.filter((item) => item.id !== updated.id)])
  }
  const summarize = async (document: PersonalKnowledgeDocument) => {
    if (!profile || profileError) throw new Error(profileError || '请先配置 AI 策划')
    const controller = new AbortController()
    controllerRef.current = controller
    const summary = await summarizePersonalKnowledge(document.text, profile, controller.signal)
    if (controller.signal.aborted || !mountedRef.current) return
    await save({ ...document, summary })
  }
  const upload = async (files: File[]) => {
    if (busy || !loaded) return
    setBusy('upload'); setError('')
    let count = 0
    try {
      for (const file of files) {
        if (documents.length + count >= 50) throw new Error('个人知识库最多保存 50 份文档，请先删除不需要的文档。')
        const document = await createPersonalKnowledgeDocument(file)
        if (!mountedRef.current) break
        await save(document)
        count++
        setSelectedId(document.id)
        if (autoSummarize) {
          try { await summarize(document) }
          catch (err) { setError(`${file.name} 已保存在本地，但概要未生成：${err instanceof Error ? err.message : String(err)}`) }
          if (controllerRef.current?.signal.aborted) break
        }
      }
      if (count) showToast(`已在本地保存 ${count} 份文档，是否用于策划需另行勾选`, 'success')
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { if (mountedRef.current) setBusy(''); controllerRef.current = null }
  }
  const generateSummary = async () => {
    if (!selected || busy) return
    setBusy('summary'); setError('')
    try { await summarize(selected); if (!controllerRef.current?.signal.aborted) showToast('概要已保存到本地，可修改后再选择是否用于 Listing', 'success') }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { if (mountedRef.current) setBusy(''); controllerRef.current = null }
  }
  const saveSummary = async (enabledForListing = selected?.enabledForListing ?? false) => {
    if (!selected || busy) return
    if (summaryDraft.length > MAX_KNOWLEDGE_SUMMARY_LENGTH) { setError('单份概要不能超过 12000 字符。'); return }
    setBusy('save'); setError('')
    try {
      await save({ ...selected, summary: summaryDraft, enabledForListing: enabledForListing && Boolean(summaryDraft.trim()) })
      showToast('概要与使用设置已保存，下次 Listing 策划时生效', 'success')
    } catch (err) { setError(`本地保存失败：${err instanceof Error ? err.message : String(err)}`) }
    finally { setBusy('') }
  }
  const remove = (all = false) => {
    if (busy || (!selected && !all)) return
    const id = selected?.id
    setConfirmDialog({ title: all ? '清空个人知识库？' : '删除本地文档？', message: '将删除本地原件、正文、概要和使用设置，不能从本站恢复；已有 Listing 历史不受影响。请先下载需要保留的原件。', confirmText: '确认删除', action: () => {
      setBusy('delete')
      void (all ? clearPersonalKnowledgeDocuments() : deletePersonalKnowledgeDocument(id!)).then(() => {
        setDocuments((current) => all ? [] : current.filter((document) => document.id !== id))
        setSelectedId(null)
        showToast('本地知识库内容已删除', 'success')
      }).catch((err) => setError(`删除失败：${err instanceof Error ? err.message : String(err)}`)).finally(() => setBusy(''))
    } })
  }
  const downloadOriginal = () => {
    if (!selected) return
    const url = URL.createObjectURL(selected.originalFile)
    const link = document.createElement('a')
    link.href = url; link.download = selected.filename; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <details className="mt-4 rounded-xl border border-blue-200 bg-blue-50/30 p-3 dark:border-blue-400/20 dark:bg-blue-400/5">
    <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-100">个人知识库 · {documents.length} 份 · 已启用 {documents.filter((document) => document.enabledForListing && document.summary.trim()).length} 份</summary>
    <p className="mt-3 text-xs leading-6 text-gray-500 dark:text-gray-400">原件、正文和概要仅保存在当前浏览器，不上传本站服务器、不随账号同步，清理网站数据会丢失。AI 总结会将该文档的完整提取正文发送给下方策划服务商；启用后，Listing 策划只带上保存的概要，不发送文档原文。</p>
    <p className="mt-1 text-xs text-gray-500">AI 总结使用：{profile ? `${profile.name} · ${profile.model}` : '未配置策划 AI'} <button type="button" onClick={onOpenSettings} className="ml-2 font-semibold text-blue-600">设置策划 AI</button></p>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className={BUTTON} disabled={Boolean(busy) || !loaded} onClick={() => uploadRef.current?.click()}>上传文档</button>
      <button type="button" className={BUTTON} disabled={Boolean(busy) || !documents.length} onClick={() => remove(true)}>清空个人知识库</button>
      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={autoSummarize} disabled={Boolean(busy)} onChange={(event) => setAutoSummarize(event.target.checked)} />上传后使用策划 AI 总结（会发送正文）</label>
      <input ref={uploadRef} type="file" multiple accept={KNOWLEDGE_FILE_ACCEPT} className="hidden" aria-label="上传个人知识库文档" onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = '' }} />
    </div>
    <p className="mt-2 text-[11px] text-gray-400">支持 TXT / Markdown / Word .docx，每份最多 10 MB；不支持 PDF、扫描图片和旧版 .doc。仅上传文档不会自动启用。</p>
    {error && <div role="alert" className="mt-3 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}{!loaded && <button type="button" onClick={() => void load()} className="ml-2 underline">重新加载</button>}</div>}
    {busy && <div role="status" className="mt-3 flex items-center gap-3 text-xs text-blue-600">{busy === 'upload' ? '正在本地解析、保存文档，按选择生成概要…' : busy === 'summary' ? '正在使用策划 AI 总结…' : '正在更新本地数据…'}{controllerRef.current && <button type="button" onClick={() => controllerRef.current?.abort()} className={BUTTON}>停止总结</button>}</div>}
    <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{documents.map((document) => <button type="button" key={document.id} disabled={Boolean(busy)} onClick={() => setSelectedId(document.id)} className={`${BUTTON} max-w-full truncate ${selectedId === document.id ? 'border-blue-400 bg-blue-100 dark:bg-blue-500/10' : ''}`}>{document.enabledForListing ? '已启用 · ' : ''}{document.filename}</button>)}</div>
    {selected ? <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500"><span className="break-all">{selected.filename} · {selected.text.length} 字符</span><div className="flex gap-2"><button type="button" className={BUTTON} onClick={downloadOriginal}>下载原件</button><button type="button" className={BUTTON} disabled={Boolean(busy)} onClick={() => remove()}>删除文档</button></div></div>
      <details><summary className="cursor-pointer text-xs text-gray-500">查看本地提取正文</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-xs leading-6 text-gray-600 dark:bg-gray-950 dark:text-gray-300">{selected.text}</pre></details>
      <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="personal-knowledge-summary" className="text-xs font-semibold text-gray-600 dark:text-gray-300">概要提示词（可手动编写或修改）</label><button type="button" disabled={Boolean(busy) || Boolean(profileError)} title={profileError || '将该文档正文发送给当前策划服务商，仅生成概要，不自动启用'} onClick={() => void generateSummary()} className={BUTTON}>{selected.summary ? '重新用 AI 总结' : '用 AI 生成概要'}</button></div>
      <textarea id="personal-knowledge-summary" rows={9} maxLength={MAX_KNOWLEDGE_SUMMARY_LENGTH} value={summaryDraft} disabled={Boolean(busy)} onChange={(event) => setSummaryDraft(event.target.value)} placeholder="可自行填写写作规则，无需使用 AI。保存后勾选下方开关，才会用于后续 Listing 策划。" className="w-full min-w-0 resize-y rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 text-gray-800 outline-none focus:border-blue-400 dark:border-white/10 dark:bg-gray-950 dark:text-gray-100" />
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={selected.enabledForListing} disabled={Boolean(busy) || !summaryDraft.trim()} onChange={(event) => void saveSummary(event.target.checked)} />在后续 Listing 文案策划中使用此概要</label><button type="button" className={BUTTON} disabled={Boolean(busy) || (summaryDraft === selected.summary)} onClick={() => void saveSummary()}>保存概要</button></div>
      {summaryDraft !== selected.summary && <p className="text-xs text-amber-600">概要尚未保存。策划只使用已保存版本；保存或勾选开关即可保存当前编辑。</p>}
    </div> : <p className="mt-4 text-xs text-gray-400">{loaded ? '上传文档或选择一份已有文档，编写自己的概要提示词。' : '正在读取本地知识库…'}</p>}
  </details>
}
