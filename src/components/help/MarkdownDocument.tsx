import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { copyTextToClipboard, getClipboardFailureMessage } from '../../lib/clipboard'
import type { DocumentationDocument } from '../../lib/documentation'
import { useStore } from '../../store'

function SectionHeading({ children }: { children?: React.ReactNode }) {
  const text = typeof children === 'string' ? children : ''
  const match = text.match(/^(\d{2})\s+(.+)$/)

  return (
    <h2 className="flex items-center gap-3 border-t border-gray-200 pt-8 text-lg font-bold text-gray-900 first:border-t-0 dark:border-white/[0.08] dark:text-gray-100">
      {match ? (
        <>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-950 text-xs font-bold text-white dark:bg-white dark:text-gray-950">{match[1]}</span>
          <span>{match[2]}</span>
        </>
      ) : children}
    </h2>
  )
}

export default function MarkdownDocument({ document }: { document: DocumentationDocument }) {
  const showToast = useStore((state) => state.showToast)

  const copyMarkdownValue = async (value: string) => {
    try {
      await copyTextToClipboard(value)
      showToast('内容已复制', 'success')
    } catch (error) {
      showToast(getClipboardFailureMessage('复制失败', error), 'error')
    }
  }

  return (
    <article>
      <header className="border-b border-gray-200 pb-7 dark:border-white/[0.08]">
        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">{document.eyebrow}</div>
        <h1 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl">{document.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300">{document.description}</p>
        {document.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {document.tags.map((tag) => (
              <span key={tag} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300">{tag}</span>
            ))}
          </div>
        )}
      </header>

      <div className="space-y-5 pb-10 pt-1 text-sm leading-7 text-gray-600 dark:text-gray-300">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <SectionHeading>{children}</SectionHeading>,
            h3: ({ children }) => <h3 className="pt-2 text-base font-semibold text-gray-900 dark:text-gray-100">{children}</h3>,
            p: ({ children }) => <p>{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
            ul: ({ children }) => <ul className="grid gap-2 sm:grid-cols-2">{children}</ul>,
            ol: ({ children }) => <ol className="space-y-3 [counter-reset:steps]">{children}</ol>,
            li: ({ children }) => <li className="rounded-lg border border-gray-200 bg-white px-4 py-3 marker:text-blue-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:marker:text-blue-400">{children}</li>,
            blockquote: ({ children }) => <blockquote className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-100">{children}</blockquote>,
            table: ({ children }) => <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]"><table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table></div>,
            thead: ({ children }) => <thead className="bg-gray-100/80 text-xs text-gray-500 dark:bg-white/[0.05] dark:text-gray-400">{children}</thead>,
            tbody: ({ children }) => <tbody className="divide-y divide-gray-200 bg-white dark:divide-white/[0.08] dark:bg-transparent">{children}</tbody>,
            th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
            td: ({ children }) => <td className="px-4 py-3 align-top leading-6 text-gray-600 dark:text-gray-300">{children}</td>,
            pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-6 text-gray-100">{children}</pre>,
            code: ({ children }) => <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800 dark:bg-white/[0.08] dark:text-gray-200">{children}</code>,
            a: ({ href, children }) => {
              if (href?.startsWith('#copy-')) {
                const value = decodeURIComponent(href.slice('#copy-'.length))
                return (
                  <button type="button" onClick={() => void copyMarkdownValue(value)} className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.07] dark:hover:text-white">
                    {children}
                  </button>
                )
              }
              return <a href={href} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-700 dark:hover:text-blue-300">{children}</a>
            },
          }}
        >
          {document.content}
        </ReactMarkdown>
      </div>
    </article>
  )
}
