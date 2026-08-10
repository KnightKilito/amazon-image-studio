import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { ImageEditorAnnotation, ImageEditorAnnotationKind } from '../types'
import {
  commitImageEditorAnnotationHistory,
  findImageEditorAnnotationAtPoint,
  IMAGE_EDITOR_ANNOTATION_COLORS,
  IMAGE_EDITOR_LINE_WIDTHS,
  IMAGE_EDITOR_ZOOM_LEVELS,
  redoImageEditorAnnotationHistory,
  translateImageEditorAnnotation,
  undoImageEditorAnnotationHistory,
} from '../lib/imageEditorAnnotations'
import {
  ArrowIcon,
  BrushIcon,
  EllipseIcon,
  EraserIcon,
  HandIcon,
  MoveIcon,
  RectangleIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from './icons'

type EditorTool = ImageEditorAnnotationKind | 'eraser' | 'pan' | 'select'

interface AnnotationMoveState {
  original: ImageEditorAnnotation
  preview: ImageEditorAnnotation
  start: { x: number; y: number }
  moved: boolean
}

interface ImageAnnotationCanvasProps {
  imageId: string
  annotationSourceImageId: string | null
  src: string
  annotations: ImageEditorAnnotation[]
  editable: boolean
  outputImageIds?: string[]
  onAnnotationsChange: (annotations: ImageEditorAnnotation[]) => void
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void
}

function makeAnnotationId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))
}

function CanvasToolButton({
  active,
  label,
  children,
  disabled,
  onClick,
}: {
  active?: boolean
  label: string
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-35 ${active
        ? 'border-blue-400 bg-blue-50 text-blue-600 shadow-sm dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-300'
        : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-white dark:text-gray-300 dark:hover:border-white/[0.08] dark:hover:bg-white/[0.05]'
        }`}
    >
      {children}
    </button>
  )
}

function AnnotationMark({ annotation, width, height }: { annotation: ImageEditorAnnotation; width: number; height: number }) {
  if (annotation.points.length < 2) return null
  const points = annotation.points.map((point) => ({ x: point.x * width, y: point.y * height }))
  const start = points[0]
  const end = points[points.length - 1]
  const strokeWidth = Math.max(1, annotation.width * Math.min(width, height))
  const common = {
    fill: 'none',
    stroke: annotation.color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (annotation.kind === 'brush') {
    return <path {...common} d={points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} />
  }
  if (annotation.kind === 'rectangle') {
    return <rect {...common} x={Math.min(start.x, end.x)} y={Math.min(start.y, end.y)} width={Math.abs(end.x - start.x)} height={Math.abs(end.y - start.y)} />
  }
  if (annotation.kind === 'ellipse') {
    return <ellipse {...common} cx={(start.x + end.x) / 2} cy={(start.y + end.y) / 2} rx={Math.abs(end.x - start.x) / 2} ry={Math.abs(end.y - start.y) / 2} />
  }

  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const head = Math.max(strokeWidth * 5, Math.min(width, height) * 0.018)
  const left = { x: end.x - head * Math.cos(angle - Math.PI / 6), y: end.y - head * Math.sin(angle - Math.PI / 6) }
  const right = { x: end.x - head * Math.cos(angle + Math.PI / 6), y: end.y - head * Math.sin(angle + Math.PI / 6) }
  return (
    <g {...common}>
      <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
      <path d={`M ${left.x} ${left.y} L ${end.x} ${end.y} L ${right.x} ${right.y}`} />
    </g>
  )
}

function AnnotationSelectionOutline({ annotation, width, height }: { annotation: ImageEditorAnnotation; width: number; height: number }) {
  if (annotation.points.length === 0) return null
  const xs = annotation.points.map((point) => point.x * width)
  const ys = annotation.points.map((point) => point.y * height)
  const padding = Math.max(6, Math.min(width, height) * 0.012)
  const left = Math.max(0, Math.min(...xs) - padding)
  const top = Math.max(0, Math.min(...ys) - padding)
  const right = Math.min(width, Math.max(...xs) + padding)
  const bottom = Math.min(height, Math.max(...ys) + padding)
  return (
    <rect
      x={left}
      y={top}
      width={Math.max(1, right - left)}
      height={Math.max(1, bottom - top)}
      rx={Math.max(2, padding / 2)}
      fill="none"
      stroke="#2563eb"
      strokeWidth={Math.max(1.5, Math.min(width, height) * 0.0025)}
      strokeDasharray={`${padding} ${Math.max(4, padding * 0.65)}`}
      pointerEvents="none"
    />
  )
}

export default function ImageAnnotationCanvas({
  imageId,
  annotationSourceImageId,
  src,
  annotations,
  editable,
  outputImageIds = [],
  onAnnotationsChange,
  onDimensionsChange,
}: ImageAnnotationCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const panStateRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)
  const annotationMoveRef = useRef<AnnotationMoveState | null>(null)
  const [tool, setTool] = useState<EditorTool>('brush')
  const [color, setColor] = useState<string>(IMAGE_EDITOR_ANNOTATION_COLORS[0])
  const [lineWidth, setLineWidth] = useState<number>(IMAGE_EDITOR_LINE_WIDTHS[1].value)
  const [zoom, setZoom] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 })
  const [canPan, setCanPan] = useState(false)
  const [currentAnnotation, setCurrentAnnotation] = useState<ImageEditorAnnotation | null>(null)
  const [movingAnnotation, setMovingAnnotation] = useState<ImageEditorAnnotation | null>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<ImageEditorAnnotation[][]>([])
  const [redoStack, setRedoStack] = useState<ImageEditorAnnotation[][]>([])

  useEffect(() => {
    setCurrentAnnotation(null)
    annotationMoveRef.current = null
    setMovingAnnotation(null)
    setSelectedAnnotationId(null)
    setUndoStack([])
    setRedoStack([])
    setZoom(1)
  }, [annotationSourceImageId])

  useEffect(() => {
    if (editable) return
    panStateRef.current = null
    annotationMoveRef.current = null
    setCurrentAnnotation(null)
    setMovingAnnotation(null)
    setSelectedAnnotationId(null)
  }, [editable])

  const effectiveZoom = editable ? zoom : 1

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !src) {
      setCanPan(false)
      return
    }
    const updateCanPan = () => {
      setCanPan(viewport.scrollWidth > viewport.clientWidth + 1 || viewport.scrollHeight > viewport.clientHeight + 1)
    }
    const frame = window.requestAnimationFrame(updateCanPan)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateCanPan)
    observer?.observe(viewport)
    if (viewport.firstElementChild instanceof HTMLElement) observer?.observe(viewport.firstElementChild)
    window.addEventListener('resize', updateCanPan)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', updateCanPan)
    }
  }, [dimensions.height, dimensions.width, effectiveZoom, src])

  useEffect(() => {
    if (tool === 'pan' && !canPan) setTool('brush')
  }, [canPan, tool])

  const commitAnnotations = useCallback((next: ImageEditorAnnotation[]) => {
    const history = commitImageEditorAnnotationHistory({ current: annotations, undoStack, redoStack }, next)
    setUndoStack(history.undoStack)
    setRedoStack(history.redoStack)
    onAnnotationsChange(history.current)
  }, [annotations, onAnnotationsChange, redoStack, undoStack])

  const undo = useCallback(() => {
    const history = undoImageEditorAnnotationHistory({ current: annotations, undoStack, redoStack })
    if (history.current === annotations) return
    annotationMoveRef.current = null
    setMovingAnnotation(null)
    setSelectedAnnotationId(null)
    setUndoStack(history.undoStack)
    setRedoStack(history.redoStack)
    onAnnotationsChange(history.current)
  }, [annotations, onAnnotationsChange, redoStack, undoStack])

  const redo = useCallback(() => {
    const history = redoImageEditorAnnotationHistory({ current: annotations, undoStack, redoStack })
    if (history.current === annotations) return
    annotationMoveRef.current = null
    setMovingAnnotation(null)
    setSelectedAnnotationId(null)
    setRedoStack(history.redoStack)
    setUndoStack(history.undoStack)
    onAnnotationsChange(history.current)
  }, [annotations, onAnnotationsChange, redoStack, undoStack])

  useEffect(() => {
    if (!editable) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTextEditingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((key === 'y' && !event.shiftKey) || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editable, redo, undo])

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !editable) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (tool === 'pan') {
      const viewport = viewportRef.current
      if (viewport) panStateRef.current = { x: event.clientX, y: event.clientY, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop }
      return
    }
    const point = pointFromEvent(event)
    if (tool === 'select') {
      const hitId = findImageEditorAnnotationAtPoint(annotations, point, dimensions.width, dimensions.height)
      const annotation = hitId ? annotations.find((item) => item.id === hitId) ?? null : null
      setSelectedAnnotationId(hitId)
      annotationMoveRef.current = annotation ? { original: annotation, preview: annotation, start: point, moved: false } : null
      setMovingAnnotation(annotation)
      return
    }
    if (tool === 'eraser') {
      const hitId = findImageEditorAnnotationAtPoint(annotations, point, dimensions.width, dimensions.height)
      if (hitId) commitAnnotations(annotations.filter((annotation) => annotation.id !== hitId))
      return
    }
    setCurrentAnnotation({ id: makeAnnotationId(), kind: tool, color, width: lineWidth, points: [point, point] })
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panStateRef.current) {
      const viewport = viewportRef.current
      if (!viewport) return
      viewport.scrollLeft = panStateRef.current.scrollLeft - (event.clientX - panStateRef.current.x)
      viewport.scrollTop = panStateRef.current.scrollTop - (event.clientY - panStateRef.current.y)
      return
    }
    const annotationMove = annotationMoveRef.current
    if (annotationMove) {
      const point = pointFromEvent(event)
      const delta = { x: point.x - annotationMove.start.x, y: point.y - annotationMove.start.y }
      const preview = translateImageEditorAnnotation(annotationMove.original, delta)
      annotationMove.preview = preview
      annotationMove.moved ||= Math.hypot(delta.x, delta.y) >= 0.001
      setMovingAnnotation(preview)
      return
    }
    if (!currentAnnotation) return
    const point = pointFromEvent(event)
    setCurrentAnnotation((annotation) => {
      if (!annotation) return null
      if (annotation.kind === 'brush') {
        const previous = annotation.points[annotation.points.length - 1]
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.002) return annotation
        return { ...annotation, points: [...annotation.points, point] }
      }
      return { ...annotation, points: [annotation.points[0], point] }
    })
  }

  const finishPointerAction = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    panStateRef.current = null
    const annotationMove = annotationMoveRef.current
    annotationMoveRef.current = null
    if (annotationMove) {
      setMovingAnnotation(null)
      if (annotationMove.moved) {
        commitAnnotations(annotations.map((annotation) => annotation.id === annotationMove.original.id ? annotationMove.preview : annotation))
      }
      return
    }
    if (!currentAnnotation) return
    const start = currentAnnotation.points[0]
    const end = currentAnnotation.points[currentAnnotation.points.length - 1]
    if (Math.hypot(end.x - start.x, end.y - start.y) >= 0.003) commitAnnotations([...annotations, currentAnnotation])
    setCurrentAnnotation(null)
  }

  const adjustZoom = useCallback((direction: -1 | 1) => {
    setZoom((currentZoom) => {
      const index = IMAGE_EDITOR_ZOOM_LEVELS.reduce(
        (best, level, levelIndex) => Math.abs(level - currentZoom) < Math.abs(IMAGE_EDITOR_ZOOM_LEVELS[best] - currentZoom) ? levelIndex : best,
        0,
      )
      return IMAGE_EDITOR_ZOOM_LEVELS[Math.min(IMAGE_EDITOR_ZOOM_LEVELS.length - 1, Math.max(0, index + direction))]
    })
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !src || !editable) return
    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return
      event.preventDefault()
      adjustZoom(event.deltaY < 0 ? 1 : -1)
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [adjustZoom, editable, src])

  return (
    <div data-no-drag-select className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl">
      {editable && (
        <div className="shrink-0 border-b border-gray-200/70 bg-white/75 dark:border-white/[0.08] dark:bg-gray-900/75">
          <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
            <CanvasToolButton active={tool === 'select'} label="选择并移动标注" onClick={() => setTool('select')}><MoveIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton active={tool === 'brush'} label="自由涂鸦" onClick={() => setTool('brush')}><BrushIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton active={tool === 'rectangle'} label="矩形标注" onClick={() => setTool('rectangle')}><RectangleIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton active={tool === 'ellipse'} label="椭圆标注" onClick={() => setTool('ellipse')}><EllipseIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton active={tool === 'arrow'} label="箭头标注" onClick={() => setTool('arrow')}><ArrowIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton active={tool === 'eraser'} label="点击擦除标注" onClick={() => setTool('eraser')}><EraserIcon className="h-4 w-4" /></CanvasToolButton>
            <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-white/[0.08]" />
            <CanvasToolButton label="撤销（Ctrl/Cmd + Z）" disabled={undoStack.length === 0} onClick={undo}><UndoIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton label="重做（Ctrl + Y / Cmd + Shift + Z）" disabled={redoStack.length === 0} onClick={redo}><RedoIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton label="清空全部标注" disabled={annotations.length === 0} onClick={() => { setSelectedAnnotationId(null); commitAnnotations([]) }}><TrashIcon className="h-4 w-4" /></CanvasToolButton>
            <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-white/[0.08]" />
            <CanvasToolButton active={tool === 'pan'} label={canPan ? '拖动画布' : '放大后可拖动画布'} disabled={!canPan} onClick={() => setTool('pan')}><HandIcon className="h-4 w-4" /></CanvasToolButton>
            <CanvasToolButton label="缩小" disabled={zoom <= IMAGE_EDITOR_ZOOM_LEVELS[0]} onClick={() => adjustZoom(-1)}><ZoomOutIcon className="h-4 w-4" /></CanvasToolButton>
            <button type="button" onClick={() => setZoom(1)} className="h-9 min-w-12 shrink-0 rounded-xl px-1 text-xs font-semibold tabular-nums text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-white/[0.05]" title="恢复 100%">{Math.round(zoom * 100)}%</button>
            <CanvasToolButton label="放大" disabled={zoom >= IMAGE_EDITOR_ZOOM_LEVELS[IMAGE_EDITOR_ZOOM_LEVELS.length - 1]} onClick={() => adjustZoom(1)}><ZoomInIcon className="h-4 w-4" /></CanvasToolButton>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto border-t border-gray-200/60 px-3 py-2 dark:border-white/[0.06]">
            <span className="shrink-0 text-[11px] font-medium text-gray-500 dark:text-gray-400">标注色</span>
            <div className="flex shrink-0 gap-2">
              {IMAGE_EDITOR_ANNOTATION_COLORS.map((item) => (
                <button key={item} type="button" onClick={() => setColor(item)} className={`h-6 w-6 rounded-full border-2 transition ${color === item ? 'border-white ring-2 ring-blue-400/60 dark:border-gray-800' : 'border-white/80 ring-1 ring-gray-300 dark:border-gray-800 dark:ring-gray-600'}`} style={{ backgroundColor: item }} aria-label={`选择标注色 ${item}`} />
              ))}
            </div>
            <div className="flex shrink-0 rounded-xl bg-gray-100 p-0.5 dark:bg-white/[0.06]">
              {IMAGE_EDITOR_LINE_WIDTHS.map((item) => (
                <button key={item.label} type="button" onClick={() => setLineWidth(item.value)} className={`rounded-[10px] px-2.5 py-1 text-[11px] font-semibold transition ${lineWidth === item.value ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{item.label}</button>
              ))}
            </div>
            <span className="ml-auto hidden shrink-0 text-[10px] text-gray-400 sm:inline">Ctrl/Cmd + 滚轮缩放</span>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        className={`min-h-0 flex-1 overflow-auto p-3 sm:p-5 ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : editable ? tool === 'select' ? 'cursor-move' : tool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair' : 'cursor-default'}`}
      >
        <div className={`min-h-full min-w-full ${effectiveZoom <= 1 ? 'flex items-center justify-center' : 'w-max'}`}>
          <div className="relative inline-block max-w-full overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/[0.06] dark:bg-gray-950 dark:ring-white/[0.08]" style={{ zoom: effectiveZoom }}>
            <img
              src={src}
              alt={editable ? '当前编辑主图' : '当前预览图片'}
              draggable={false}
              data-image-id={imageId}
              data-output-image-ids={outputImageIds.join(',')}
              className="block max-h-[64vh] max-w-full object-contain"
              onLoad={(event) => {
                const next = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }
                setDimensions(next)
                onDimensionsChange?.(next)
              }}
            />
            {editable && dimensions.width > 0 && dimensions.height > 0 && (
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
                preserveAspectRatio="none"
                style={{ touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerAction}
                onPointerCancel={finishPointerAction}
              >
                {annotations.map((annotation) => {
                  const renderedAnnotation = movingAnnotation?.id === annotation.id ? movingAnnotation : annotation
                  return (
                    <g key={annotation.id}>
                      <AnnotationMark annotation={renderedAnnotation} width={dimensions.width} height={dimensions.height} />
                      {tool === 'select' && selectedAnnotationId === annotation.id && (
                        <AnnotationSelectionOutline annotation={renderedAnnotation} width={dimensions.width} height={dimensions.height} />
                      )}
                    </g>
                  )
                })}
                {currentAnnotation && <AnnotationMark annotation={currentAnnotation} width={dimensions.width} height={dimensions.height} />}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
