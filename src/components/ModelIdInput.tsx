import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDownIcon } from './icons'

interface Props {
  label: string
  value: string
  options: string[]
  placeholder: string
  onChange: (value: string) => void
  onCommit: (value: string) => void
}

export default function ModelIdInput({ label, value, options, placeholder, onChange, onCommit }: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [placement, setPlacement] = useState<'above' | 'below'>('below')
  const [menuHeight, setMenuHeight] = useState(224)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  useEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    let below = window.innerHeight - rect.bottom - 8
    let above = rect.top - 8
    let parent = rootRef.current.parentElement
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent)
      if (/(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowY}`)) {
        const parentRect = parent.getBoundingClientRect()
        below = Math.min(below, parentRect.bottom - rect.bottom - 8)
        above = Math.min(above, rect.top - parentRect.top - 8)
      }
      parent = parent.parentElement
    }
    const aboveIsBetter = below < 120 && above > below
    setPlacement(aboveIsBetter ? 'above' : 'below')
    setMenuHeight(Math.max(64, Math.min(224, aboveIsBetter ? above : below)))
  }, [open])

  const selectOption = (modelId: string) => {
    onCommit(modelId)
    setOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div className="block">
      <label htmlFor={listId} className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</label>
      <div ref={rootRef} className="relative">
        <input
          ref={inputRef}
          id={listId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && options.length > 0}
          aria-controls={options.length > 0 ? `${listId}-options` : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
          value={value}
          onChange={(event) => { onChange(event.target.value); setActiveIndex(-1) }}
          onBlur={(event) => onCommit(event.target.value)}
          onFocus={() => { if (options.length > 0) setOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); return }
            if (!options.length) return
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((current) => event.key === 'ArrowDown'
                ? (current + 1) % options.length
                : (current <= 0 ? options.length - 1 : current - 1))
            } else if (event.key === 'Enter' && open && activeIndex >= 0) {
              event.preventDefault()
              selectOption(options[activeIndex])
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          className={`w-full rounded-xl bg-white/70 px-3 py-2.5 font-mono text-sm text-gray-700 outline-none transition focus:ring-2 focus:ring-blue-200 dark:bg-gray-950/30 dark:text-gray-200 dark:focus:ring-blue-500/20 ${options.length ? 'pr-10' : ''}`}
        />
        {options.length > 0 && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => { setOpen((current) => !current); inputRef.current?.focus() }}
            aria-label={`选择${label}`}
            aria-expanded={open}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
          >
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        {open && options.length > 0 && (
          <div
            id={`${listId}-options`}
            role="listbox"
            aria-label={`${label}可选项`}
            style={{ maxHeight: menuHeight }}
            className={`absolute left-0 right-0 z-50 overflow-y-auto rounded-xl border border-gray-200/60 bg-white/95 py-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-gray-900/95 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] dark:ring-white/10 custom-scrollbar ${placement === 'above' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
          >
            {options.map((modelId, index) => (
              <button
                key={modelId}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={modelId === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(modelId)}
                className={`flex w-full items-center px-3 py-2 text-left font-mono text-xs transition-colors ${index === activeIndex || modelId === value ? 'bg-blue-50 font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.06]'}`}
              >
                <span className="min-w-0 truncate">{modelId}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
