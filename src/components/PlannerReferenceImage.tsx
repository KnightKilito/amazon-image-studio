import { useEffect, useState } from 'react'
import type { InputImage } from '../types'
import { useStore } from '../store'
import { createMaskPreviewDataUrl } from '../lib/canvasImage'
import { EditIcon } from './icons'

interface Props {
  image: InputImage
  index: number
  imageIds: string[]
  onRemove: () => void
}

export default function PlannerReferenceImage({ image, index, imageIds, onRemove }: Props) {
  const maskDraft = useStore((state) => state.maskDraft)
  const setLightboxImageId = useStore((state) => state.setLightboxImageId)
  const setMaskEditorImageId = useStore((state) => state.setMaskEditorImageId)
  const isMaskTarget = maskDraft?.targetImageId === image.id
  const otherMaskExists = Boolean(maskDraft && !isMaskTarget)
  const maskDataUrl = isMaskTarget ? maskDraft.maskDataUrl : ''
  const [preview, setPreview] = useState<{ source: string; mask: string; url: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!maskDataUrl || !image.dataUrl) { setPreview(null); return }
    createMaskPreviewDataUrl(image.dataUrl, maskDataUrl)
      .then((url) => { if (!cancelled) setPreview({ source: image.dataUrl, mask: maskDataUrl, url }) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [image.dataUrl, maskDataUrl])
  const displaySrc = isMaskTarget && preview?.source === image.dataUrl && preview.mask === maskDataUrl ? preview.url : image.dataUrl
  const maskLabel = isMaskTarget ? '编辑遮罩' : '添加遮罩'
  const actionClass = 'absolute z-20 flex h-6 w-6 items-center justify-center rounded-full text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'

  return <div className={`group relative aspect-square overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900 ${isMaskTarget ? 'border-2 border-blue-500' : 'border border-gray-200 dark:border-white/[0.08]'}`}>
    <button type="button" onClick={() => setLightboxImageId(image.id, imageIds)} aria-label={`预览参考图 ${index + 1}`} title={`预览参考图 ${index + 1}`} className="h-full w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
      <img src={displaySrc} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover transition hover:opacity-90" />
    </button>
    {isMaskTarget && <span className="pointer-events-none absolute left-1 top-1 rounded bg-blue-500/90 px-1 py-0.5 text-[8px] font-bold text-white">MASK</span>}
    <span className="pointer-events-none absolute bottom-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1.5 text-[10px] font-semibold text-white">{index + 1}</span>
    <button type="button" onClick={onRemove} className={`${actionClass} right-1 top-1 bg-black/55 hover:bg-red-500`} aria-label={`删除参考图 ${index + 1}`} title={`删除参考图 ${index + 1}`}>
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
    <button type="button" disabled={otherMaskExists} onClick={() => setMaskEditorImageId(image.id)} aria-label={`${maskLabel}参考图 ${index + 1}`} title={otherMaskExists ? '只能有一张遮罩图，请先在现有遮罩编辑器中移除遮罩' : maskLabel} className={`${actionClass} bottom-1 right-1 bg-black/60 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-30`}>
      <EditIcon className="h-3.5 w-3.5" />
    </button>
  </div>
}
