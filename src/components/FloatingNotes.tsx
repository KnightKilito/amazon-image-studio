import { useEffect, useMemo, useRef, useState } from 'react'
import type { TextNote } from '../types'
import { copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import {
  readTextNotes,
  removeTextNote,
  saveTextNotes,
  searchTextNotes,
  TEXT_NOTES_CHANGED_EVENT,
  upsertTextNote,
} from '../lib/textNotes'
import { useStore } from '../store'
import { BookOpenIcon, CloseIcon, CopyIcon, EditIcon, PlusIcon, TrashIcon } from './icons'

type NoteEditor = {
  id: string | null
  title: string
  content: string
}

function createNoteId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? `note-${crypto.randomUUID()}`
    : `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function FloatingNotes() {
  const showToast = useStore((state) => state.showToast)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [notes, setNotes] = useState<TextNote[]>(readTextNotes)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<NoteEditor | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const filteredNotes = useMemo(() => searchTextNotes(notes, query), [notes, query])

  useEffect(() => {
    const reload = () => setNotes(readTextNotes())
    window.addEventListener(TEXT_NOTES_CHANGED_EVENT, reload)
    return () => window.removeEventListener(TEXT_NOTES_CHANGED_EVENT, reload)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (launcherRef.current?.contains(target) || panelRef.current?.contains(target)) return
      if (!editor) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (editor) setEditor(null)
      else setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, isOpen])

  const persistNotes = (nextNotes: TextNote[]) => {
    const saved = saveTextNotes(nextNotes)
    setNotes(saved)
  }

  const openNewNote = () => {
    setEditor({ id: null, title: '', content: '' })
    setIsOpen(true)
  }

  const openEditNote = (note: TextNote) => {
    setEditor({ id: note.id, title: note.title, content: note.content })
  }

  const saveEditor = () => {
    if (!editor) return
    const title = editor.title.trim()
    const content = editor.content.trim()
    if (!title || !content) {
      showToast('请填写笔记标题和正文', 'error')
      return
    }
    const existing = editor.id ? notes.find((note) => note.id === editor.id) : null
    const now = Date.now()
    persistNotes(upsertTextNote(notes, {
      id: existing?.id ?? createNoteId(),
      title,
      content,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }))
    setEditor(null)
    showToast(existing ? '文字笔记已更新' : '文字笔记已保存', 'success')
  }

  const copyNote = async (note: TextNote) => {
    try {
      await copyTextToClipboard(note.content)
      showToast(`已复制「${note.title}」`, 'success')
    } catch (error) {
      showToast(getClipboardFailureMessage('笔记复制失败', error), 'error')
    }
  }

  const confirmDeleteNote = (note: TextNote) => {
    setConfirmDialog({
      title: '删除文字笔记',
      message: `确定要删除「${note.title}」吗？此操作不可恢复。`,
      confirmText: '删除',
      tone: 'danger',
      action: () => {
        persistNotes(removeTextNote(notes, note.id))
        if (expandedNoteId === note.id) setExpandedNoteId(null)
        showToast('文字笔记已删除', 'success')
      },
    })
  }

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        data-floating-notes-launcher
        onClick={() => setIsOpen((open) => !open)}
        className="fixed left-2 top-1/2 z-[65] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)] ring-4 ring-white/80 transition hover:scale-105 hover:shadow-[0_12px_36px_rgba(37,99,235,0.45)] dark:ring-gray-950/80 sm:left-3"
        title="常用文字笔记"
        aria-label="常用文字笔记"
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon className="h-5 w-5" /> : <BookOpenIcon className="h-5 w-5" />}
        {notes.length > 0 && !isOpen && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950 ring-2 ring-white dark:ring-gray-950">
            {notes.length > 99 ? '99+' : notes.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          data-floating-notes-panel
          className="fixed left-16 top-1/2 z-[65] flex max-h-[min(72vh,640px)] w-[min(360px,calc(100vw-5rem))] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.22)] ring-1 ring-black/5 backdrop-blur-xl dark:border-white/[0.1] dark:bg-gray-900/95 dark:ring-white/10 sm:left-20"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-white/[0.08]">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 dark:text-white">常用文字笔记</div>
              <div className="mt-0.5 text-[11px] text-gray-400">常用提示词保存在当前浏览器</div>
            </div>
            <button type="button" onClick={openNewNote} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white transition hover:bg-blue-500">
              <PlusIcon className="h-3.5 w-3.5" />新增
            </button>
          </div>

          {editor ? (
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{editor.id ? '编辑笔记' : '新建笔记'}</div>
              <input
                value={editor.title}
                onChange={(event) => setEditor((current) => current ? { ...current, title: event.target.value } : current)}
                maxLength={120}
                placeholder="笔记标题，例如：Listing 五点提示词"
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
              />
              <textarea
                value={editor.content}
                onChange={(event) => setEditor((current) => current ? { ...current, content: event.target.value } : current)}
                maxLength={20_000}
                placeholder="粘贴常用提示词或文字内容…"
                className="mt-3 min-h-48 flex-1 resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setEditor(null)} className="h-9 rounded-lg px-3 text-xs font-medium text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]">取消</button>
                <button type="button" onClick={saveEditor} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white transition hover:bg-blue-500">保存笔记</button>
              </div>
            </div>
          ) : (
            <>
              {notes.length > 0 && (
                <div className="border-b border-gray-200 p-3 dark:border-white/[0.08]">
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题或正文" className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-xs text-gray-700 outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200" />
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar">
                {filteredNotes.length > 0 ? filteredNotes.map((note) => {
                  const expanded = expandedNoteId === note.id
                  return (
                    <article key={note.id} className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-blue-400/20 dark:hover:bg-blue-400/5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100" title={note.title}>{note.title}</h4>
                          <div className="mt-0.5 text-[10px] text-gray-400">{new Date(note.updatedAt).toLocaleString('zh-CN')}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <button type="button" onClick={() => void copyNote(note)} className="rounded-lg p-1.5 text-blue-600 transition hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-400/10" title="复制正文" aria-label={`复制 ${note.title}`}><CopyIcon className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => openEditNote(note)} className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-white/[0.08]" title="编辑笔记" aria-label={`编辑 ${note.title}`}><EditIcon className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => confirmDeleteNote(note)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-400/10" title="删除笔记" aria-label={`删除 ${note.title}`}><TrashIcon className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <p className={`mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600 dark:text-gray-300 ${expanded ? '' : 'line-clamp-3'}`}>{note.content}</p>
                      {note.content.length > 120 && (
                        <button type="button" onClick={() => setExpandedNoteId(expanded ? null : note.id)} className="mt-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300">{expanded ? '收起' : '展开全文'}</button>
                      )}
                    </article>
                  )
                }) : (
                  <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-400/10 dark:text-blue-300"><BookOpenIcon className="h-6 w-6" /></div>
                    <div className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{notes.length ? '没有匹配的笔记' : '还没有文字笔记'}</div>
                    <div className="mt-1 text-xs leading-relaxed text-gray-400">{notes.length ? '换个关键词试试' : '把常用提示词保存到这里，随时复制使用。'}</div>
                    {!notes.length && <button type="button" onClick={openNewNote} className="mt-4 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">创建第一条笔记</button>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
