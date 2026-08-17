import { canvasToBlob, loadImage } from './canvasImage'
import {
  MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT,
  MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH,
  PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT,
  PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH,
} from './premiumAPlusLayout'

export type APlusUpscaleFormat = 'premium' | 'mobile'

export interface ImageUpscaleTargetSize {
  width: number
  height: number
}

export const MAX_CUSTOM_UPSCALE_EDGE = 16384
export const MAX_CUSTOM_UPSCALE_PIXELS = 64_000_000

export interface ProportionalUpscalePlan {
  sourceWidth: number
  sourceHeight: number
  targetWidth: number
  targetHeight: number
  scale: number
  scaleX: number
  scaleY: number
  proportional: boolean
  needsUpscale: boolean
}

export function getAPlusMinimumDimensions(format: APlusUpscaleFormat) {
  return format === 'mobile'
    ? { width: MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH, height: MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT }
    : { width: PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH, height: PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT }
}

export function getProportionalUpscalePlan(
  sourceWidth: number,
  sourceHeight: number,
  minimumWidth: number,
  minimumHeight: number,
  preferredScale = 1,
): ProportionalUpscalePlan {
  if (![sourceWidth, sourceHeight, minimumWidth, minimumHeight, preferredScale].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error('图片尺寸无效，无法计算放大比例。')
  }

  const scale = Math.max(1, preferredScale, minimumWidth / sourceWidth, minimumHeight / sourceHeight)
  return {
    sourceWidth,
    sourceHeight,
    targetWidth: Math.ceil(sourceWidth * scale),
    targetHeight: Math.ceil(sourceHeight * scale),
    scale,
    scaleX: scale,
    scaleY: scale,
    proportional: true,
    needsUpscale: scale > 1,
  }
}

export function getCustomUpscalePlan(
  sourceWidth: number,
  sourceHeight: number,
  targetSize: ImageUpscaleTargetSize,
): ProportionalUpscalePlan {
  const { width: targetWidth, height: targetHeight } = targetSize
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every((value) => Number.isFinite(value) && Number.isInteger(value) && value > 0)) {
    throw new Error('请输入有效的整数宽度和高度。')
  }
  if (targetWidth < sourceWidth || targetHeight < sourceHeight) {
    throw new Error(`自定义尺寸不能小于原图 ${sourceWidth} × ${sourceHeight}。`)
  }
  if (targetWidth === sourceWidth && targetHeight === sourceHeight) {
    throw new Error('目标尺寸必须大于原图尺寸。')
  }
  if (targetWidth > MAX_CUSTOM_UPSCALE_EDGE || targetHeight > MAX_CUSTOM_UPSCALE_EDGE) {
    throw new Error(`单边尺寸不能超过 ${MAX_CUSTOM_UPSCALE_EDGE} 像素。`)
  }
  if (targetWidth * targetHeight > MAX_CUSTOM_UPSCALE_PIXELS) {
    throw new Error('目标图片不能超过 6400 万像素。')
  }

  const scaleX = targetWidth / sourceWidth
  const scaleY = targetHeight / sourceHeight
  return {
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    scale: Math.max(scaleX, scaleY),
    scaleX,
    scaleY,
    proportional: Math.abs(scaleX - scaleY) < 1e-9,
    needsUpscale: scaleX > 1 || scaleY > 1,
  }
}

export function getAPlusUpscalePlan(sourceWidth: number, sourceHeight: number, format: APlusUpscaleFormat) {
  const minimum = getAPlusMinimumDimensions(format)
  return getProportionalUpscalePlan(sourceWidth, sourceHeight, minimum.width, minimum.height, 2)
}

export async function upscaleImageDataUrlForAPlus(
  dataUrl: string,
  format: APlusUpscaleFormat,
  targetSize?: ImageUpscaleTargetSize,
) {
  const image = await loadImage(dataUrl)
  const plan = targetSize
    ? getCustomUpscalePlan(image.naturalWidth, image.naturalHeight, targetSize)
    : getAPlusUpscalePlan(image.naturalWidth, image.naturalHeight, format)
  const canvas = document.createElement('canvas')
  canvas.width = plan.targetWidth
  canvas.height = plan.targetHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持 Canvas 图片放大。')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, plan.targetWidth, plan.targetHeight)

  const blob = await canvasToBlob(canvas, 'image/png')
  return {
    dataUrl: await blobToDataUrl(blob),
    ...plan,
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error ?? new Error('图片编码失败'))
    reader.readAsDataURL(blob)
  })
}
