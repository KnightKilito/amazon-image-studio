import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { usePreventBackgroundScroll } from '../hooks/usePreventBackgroundScroll'
import { documentationDocuments } from '../lib/documentation'
import MarkdownDocument from './help/MarkdownDocument'
import { BookOpenIcon, ChevronRightIcon, CloseIcon, HistoryIcon, PhotoIcon } from './icons'

interface HelpModalProps {
  onClose: () => void
}

function LayersIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </svg>
  )
}

function DocumentIcon({ icon }: { icon: string }) {
  if (icon === 'photo') return <PhotoIcon className="h-4 w-4" />
  if (icon === 'layers') return <LayersIcon className="h-4 w-4" />
  if (icon === 'history') return <HistoryIcon className="h-4 w-4" />
  return <BookOpenIcon className="h-4 w-4" />
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const [activeDocumentId, setActiveDocumentId] = useState(documentationDocuments[0].id)
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  useCloseOnEscape(true, onClose)
  usePreventBackgroundScroll(true, modalRef)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [activeDocumentId])

  const activeDocument = documentationDocuments.find((document) => document.id === activeDocumentId) ?? documentationDocuments[0]

  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-950">
      <div ref={modalRef} className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/95">
          <div className="safe-area-x mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white dark:bg-white dark:text-gray-950">
                <BookOpenIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">亚马逊AI工作台 · 使用文档</div>
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">Markdown 自动生成导航与正文</div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white" aria-label="关闭使用文档">
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-gray-200 bg-white dark:border-white/[0.08] dark:bg-gray-950 md:w-64 md:border-b-0 md:border-r">
            <div className="hidden px-5 pb-3 pt-7 text-[11px] font-semibold uppercase text-gray-400 dark:text-gray-500 md:block">文档导航</div>
            <nav className="flex gap-2 overflow-x-auto p-3 md:block md:space-y-1 md:overflow-visible md:px-3 md:py-0">
              {documentationDocuments.map((document) => {
                const active = activeDocumentId === document.id
                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => setActiveDocumentId(document.id)}
                    className={`flex min-w-[150px] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition md:w-full md:min-w-0 ${active ? 'bg-gray-950 text-white shadow-sm dark:bg-white dark:text-gray-950' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white'}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-white/15 dark:bg-gray-950/10' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'}`}>
                      <DocumentIcon icon={document.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{document.navTitle}</span>
                      <span className={`mt-0.5 hidden truncate text-[11px] md:block ${active ? 'text-white/65 dark:text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>{document.description}</span>
                    </span>
                    <ChevronRightIcon className={`hidden h-3.5 w-3.5 shrink-0 md:block ${active ? 'opacity-80' : 'opacity-30'}`} />
                  </button>
                )
              })}
            </nav>
            <div className="mx-5 mt-7 hidden border-t border-gray-200 pt-5 text-xs leading-6 text-gray-400 dark:border-white/[0.08] dark:text-gray-500 md:block">
              文档来自 <code>src/docs/*.md</code>，新增文件后会自动出现在导航中。
            </div>
          </aside>

          <main ref={contentRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 custom-scrollbar sm:px-7 md:px-10 md:py-9">
            <div className="mx-auto max-w-4xl">
              <MarkdownDocument document={activeDocument} />
            </div>
          </main>
        </div>
      </div>
    </div>,
    document.body,
  )
}
