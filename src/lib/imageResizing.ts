import { canvasToBlob, loadImage } from './canvasImage'

export type ImageResizeMode = 'contain' | 'stretch'
export type ImageResizeOutputFormat = 'png' | 'jpeg' | 'webp'

export interface ImageResizeOptions {
  width: number
  height: number
  mode: ImageResizeMode
  outputFormat: ImageResizeOutputFormat
  /** Canvas encoder quality from 1 to 100. PNG ignores this value. */
  quality: number
}

export interface ImageResizePlan {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
  scaleX: number
  scaleY: number
  proportional: boolean
}

export const MAX_IMAGE_RESIZE_EDGE = 16384
export const MAX_IMAGE_RESIZE_PIXELS = 64_000_000

export function getLockedResizeCompanionDimension(
  changedDimension: 'width' | 'height',
  value: number,
  aspectRatio: number,
) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return 0
  return Math.max(1, Math.round(changedDimension === 'width' ? value / aspectRatio : value * aspectRatio))
}

function assertPositiveInteger(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label}必须是大于 0 的整数。`)
  }
}

export function getImageResizePlan(
  sourceWidth: number,
  sourceHeight: number,
  options: Pick<ImageResizeOptions, 'width' | 'height' | 'mode'>,
): ImageResizePlan {
  assertPositiveInteger(sourceWidth, '原图宽度')
  assertPositiveInteger(sourceHeight, '原图高度')
  assertPositiveInteger(options.width, '目标宽度')
  assertPositiveInteger(options.height, '目标高度')

  const scale = options.mode === 'contain'
    ? Math.min(options.width / sourceWidth, options.height / sourceHeight)
    : null
  const targetWidth = scale == null ? options.width : Math.max(1, Math.round(sourceWidth * scale))
  const targetHeight = scale == null ? options.height : Math.max(1, Math.round(sourceHeight * scale))

  if (targetWidth > MAX_IMAGE_RESIZE_EDGE || targetHeight > MAX_IMAGE_RESIZE_EDGE) {
    throw new Error(`调整后的图片单边不能超过 ${MAX_IMAGE_RESIZE_EDGE} 像素。`)
  }
  if (targetWidth * targetHeight > MAX_IMAGE_RESIZE_PIXELS) {
    throw new Error('调整后的单张图片不能超过 6400 万像素。')
  }

  const scaleX = targetWidth / sourceWidth
  const scaleY = targetHeight / sourceHeight
  return {
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    scaleX,
    scaleY,
    proportional: Math.abs(scaleX - scaleY) < 1e-9,
  }
}

export function getDataUrlByteSize(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return 0
  const metadata = dataUrl.slice(0, commaIndex)
  const payload = dataUrl.slice(commaIndex + 1)
  if (/;base64(?:;|$)/i.test(metadata)) {
    const normalized = payload.replace(/\s/g, '')
    if (!normalized) return 0
    const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding)
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength
  } catch {
    return new TextEncoder().encode(payload).byteLength
  }
}

function getDataUrlFormat(dataUrl: string): ImageResizeOutputFormat {
  const mime = /^data:image\/([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase()
  if (mime === 'jpg' || mime === 'jpeg') return 'jpeg'
  if (mime === 'webp') return 'webp'
  return 'png'
}

const FORMAT_SIZE_WEIGHT: Record<ImageResizeOutputFormat, number> = {
  png: 1,
  jpeg: 0.55,
  webp: 0.42,
}

export function estimateResizedImageByteSize(
  dataUrl: string,
  plan: Pick<ImageResizePlan, 'sourceWidth' | 'sourceHeight' | 'targetWidth' | 'targetHeight'>,
  outputFormat: ImageResizeOutputFormat,
  quality: number,
) {
  const sourceBytes = getDataUrlByteSize(dataUrl)
  if (sourceBytes <= 0) return 0
  const sourcePixels = plan.sourceWidth * plan.sourceHeight
  const targetPixels = plan.targetWidth * plan.targetHeight
  if (sourcePixels <= 0 || targetPixels <= 0) return 0

  const sourceFormat = getDataUrlFormat(dataUrl)
  const formatRatio = FORMAT_SIZE_WEIGHT[outputFormat] / FORMAT_SIZE_WEIGHT[sourceFormat]
  const normalizedQuality = Math.min(100, Math.max(1, quality)) / 100
  const qualityRatio = outputFormat === 'png' ? 1 : 0.35 + normalizedQuality * 0.72
  const estimate = sourceBytes * (targetPixels / sourcePixels) * formatRatio * qualityRatio
  return Math.max(256, Math.round(estimate))
}

export function formatImageFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('图片编码失败'))
    reader.readAsDataURL(blob)
  })
}

export async function resizeImageDataUrl(dataUrl: string, options: ImageResizeOptions) {
  const image = await loadImage(dataUrl)
  const plan = getImageResizePlan(image.naturalWidth, image.naturalHeight, options)
  const canvas = document.createElement('canvas')
  canvas.width = plan.targetWidth
  canvas.height = plan.targetHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas 图片处理。')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  if (options.outputFormat === 'jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
  }
  context.drawImage(image, 0, 0, plan.targetWidth, plan.targetHeight)

  const mimeType = options.outputFormat === 'jpeg' ? 'image/jpeg' : `image/${options.outputFormat}`
  const encoderQuality = options.outputFormat === 'png'
    ? undefined
    : Math.min(100, Math.max(1, options.quality)) / 100
  const blob = await canvasToBlob(canvas, mimeType, encoderQuality)
  return {
    ...plan,
    dataUrl: await blobToDataUrl(blob),
    byteSize: blob.size,
    outputFormat: options.outputFormat,
    quality: options.outputFormat === 'png' ? null : Math.round(encoderQuality! * 100),
  }
}
