import type { ImageEditorAnnotation } from '../types'
import { loadImage } from './canvasImage'

export const IMAGE_EDITOR_ANNOTATION_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#eab308'] as const
export const IMAGE_EDITOR_LINE_WIDTHS = [
  { label: '细', value: 0.0035 },
  { label: '中', value: 0.0065 },
  { label: '粗', value: 0.012 },
] as const
export const IMAGE_EDITOR_ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const

export interface ImageEditPromptOptions {
  instruction: string
  hasVisualGuide: boolean
  referenceCount: number
  hasStyleReference?: boolean
}

export interface ImageEditorAnnotationHistory {
  current: ImageEditorAnnotation[]
  undoStack: ImageEditorAnnotation[][]
  redoStack: ImageEditorAnnotation[][]
}

export function commitImageEditorAnnotationHistory(
  history: ImageEditorAnnotationHistory,
  next: ImageEditorAnnotation[],
): ImageEditorAnnotationHistory {
  return {
    current: next,
    undoStack: [...history.undoStack.slice(-49), history.current],
    redoStack: [],
  }
}

export function undoImageEditorAnnotationHistory(history: ImageEditorAnnotationHistory): ImageEditorAnnotationHistory {
  const previous = history.undoStack[history.undoStack.length - 1]
  if (!previous) return history
  return {
    current: previous,
    undoStack: history.undoStack.slice(0, -1),
    redoStack: [...history.redoStack, history.current],
  }
}

export function redoImageEditorAnnotationHistory(history: ImageEditorAnnotationHistory): ImageEditorAnnotationHistory {
  const next = history.redoStack[history.redoStack.length - 1]
  if (!next) return history
  return {
    current: next,
    undoStack: [...history.undoStack, history.current],
    redoStack: history.redoStack.slice(0, -1),
  }
}

export function buildImageEditPrompt({
  instruction,
  hasVisualGuide,
  referenceCount,
  hasStyleReference = false,
}: ImageEditPromptOptions) {
  let nextImageIndex = hasVisualGuide ? 3 : 2
  const roles = ['图1是必须编辑的原图，也是构图、画幅和未修改内容的唯一基准。']

  if (hasVisualGuide) {
    roles.push('图2是“视觉定位图”，彩色线条仅用于指出编辑位置和范围，不是原图内容，也不是原生遮罩。')
  }
  for (let index = 0; index < Math.max(0, referenceCount); index += 1) {
    roles.push(`图${nextImageIndex}是参考图${index + 1}，仅在编辑要求涉及主体替换、多图融合或材质参考时使用。`)
    nextImageIndex += 1
  }
  if (hasStyleReference) {
    roles.push(`图${nextImageIndex}是风格参考图，仅用于参考视觉风格、色彩、光照、材质和排版语言。`)
  }

  return [
    '请执行一次精确的图片编辑任务。',
    ...roles,
    '',
    `用户原始编辑要求：${instruction.trim()}`,
    '',
    hasVisualGuide
      ? '请根据视觉定位图理解位置，但最终结果中不得出现任何红、蓝、绿、黄标注线、箭头、边框或涂鸦。'
      : null,
    '只修改用户明确指定的区域和内容；未指定区域、主体身份、透视、光照、文字与版式应尽量保持不变。',
    '保持图1的原始宽高比，只输出完成后的干净图片，不要输出对比图、拼图、说明文字或额外版本。',
  ].filter((line): line is string => line != null).join('\n')
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  lineWidth: number,
  shortEdge: number,
) {
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  const angle = Math.atan2(endY - startY, endX - startX)
  const headLength = Math.max(lineWidth * 5, shortEdge * 0.018)
  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(endX, endY)
  ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

export function drawImageEditorAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: ImageEditorAnnotation[],
  width: number,
  height: number,
) {
  const shortEdge = Math.min(width, height)
  for (const annotation of annotations) {
    if (annotation.points.length < 2) continue
    const points = annotation.points.map((point) => ({ x: point.x * width, y: point.y * height }))
    const start = points[0]
    const end = points[points.length - 1]
    ctx.save()
    ctx.strokeStyle = annotation.color
    ctx.fillStyle = annotation.color
    ctx.lineWidth = Math.max(1, annotation.width * shortEdge)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (annotation.kind === 'brush') {
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
      ctx.stroke()
    } else if (annotation.kind === 'rectangle') {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
    } else if (annotation.kind === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(
        (start.x + end.x) / 2,
        (start.y + end.y) / 2,
        Math.abs(end.x - start.x) / 2,
        Math.abs(end.y - start.y) / 2,
        0,
        0,
        Math.PI * 2,
      )
      ctx.stroke()
    } else {
      drawArrow(ctx, start.x, start.y, end.x, end.y, ctx.lineWidth, shortEdge)
    }
    ctx.restore()
  }
}

export async function createImageEditorVisualGuideDataUrl(
  sourceDataUrl: string,
  annotations: ImageEditorAnnotation[],
) {
  if (annotations.length === 0) return null
  const source = await loadImage(sourceDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = source.naturalWidth
  canvas.height = source.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas')
  ctx.drawImage(source, 0, 0)
  drawImageEditorAnnotations(ctx, annotations, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

export function translateImageEditorAnnotation(
  annotation: ImageEditorAnnotation,
  delta: { x: number; y: number },
): ImageEditorAnnotation {
  if (annotation.points.length === 0) return annotation
  const xs = annotation.points.map((point) => point.x)
  const ys = annotation.points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const offsetX = Math.min(1 - maxX, Math.max(-minX, delta.x))
  const offsetY = Math.min(1 - maxY, Math.max(-minY, delta.y))

  return {
    ...annotation,
    points: annotation.points.map((point) => ({
      x: point.x + offsetX,
      y: point.y + offsetY,
    })),
  }
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

export function findImageEditorAnnotationAtPoint(
  annotations: ImageEditorAnnotation[],
  point: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
) {
  const shortEdge = Math.max(1, Math.min(imageWidth, imageHeight))
  const scaleX = imageWidth / shortEdge
  const scaleY = imageHeight / shortEdge
  const px = point.x * scaleX
  const py = point.y * scaleY

  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index]
    if (annotation.points.length < 2) continue
    const points = annotation.points.map((item) => ({ x: item.x * scaleX, y: item.y * scaleY }))
    const threshold = Math.max(0.012, annotation.width * 2.5)
    const start = points[0]
    const end = points[points.length - 1]

    if (annotation.kind === 'brush' || annotation.kind === 'arrow') {
      for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        const previous = points[pointIndex - 1]
        const current = points[pointIndex]
        if (distanceToSegment(px, py, previous.x, previous.y, current.x, current.y) <= threshold) return annotation.id
      }
      continue
    }

    const left = Math.min(start.x, end.x)
    const right = Math.max(start.x, end.x)
    const top = Math.min(start.y, end.y)
    const bottom = Math.max(start.y, end.y)
    if (annotation.kind === 'rectangle') {
      const edgeDistance = Math.min(
        distanceToSegment(px, py, left, top, right, top),
        distanceToSegment(px, py, right, top, right, bottom),
        distanceToSegment(px, py, right, bottom, left, bottom),
        distanceToSegment(px, py, left, bottom, left, top),
      )
      if (edgeDistance <= threshold) return annotation.id
      continue
    }

    const radiusX = Math.max((right - left) / 2, 0.0001)
    const radiusY = Math.max((bottom - top) / 2, 0.0001)
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2
    const normalizedRadius = Math.hypot((px - centerX) / radiusX, (py - centerY) / radiusY)
    if (Math.abs(normalizedRadius - 1) <= threshold / Math.max(radiusX, radiusY)) return annotation.id
  }
  return null
}
