import { canvasToBlob, loadImage } from './canvasImage'
import {
  MAX_PREMIUM_MOTHER_SLICES,
  MOBILE_A_PLUS_SLICE_HEIGHT,
  MOBILE_A_PLUS_SLICE_WIDTH,
  MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT,
  MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH,
  MIN_PREMIUM_MOTHER_SLICES,
  PREMIUM_A_PLUS_SLICE_HEIGHT,
  PREMIUM_A_PLUS_SLICE_WIDTH,
  PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT,
  PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH,
} from './premiumAPlusLayout'

export type APlusSliceFormat = 'premium' | 'mobile'

export interface PremiumSliceValidation {
  valid: boolean
  actualRatio: number
  expectedRatio: number
  relativeError: number
  sliceWidth: number
  sliceHeight: number
  lowResolution: boolean
  message: string
}

export function normalizePremiumSliceCount(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return MIN_PREMIUM_MOTHER_SLICES
  return Math.min(MAX_PREMIUM_MOTHER_SLICES, Math.max(MIN_PREMIUM_MOTHER_SLICES, Math.trunc(numeric)))
}

export function getPremiumMotherExpectedRatio(sliceCount: number) {
  return getAPlusMotherExpectedRatio(sliceCount, 'premium')
}

function getSliceGeometry(format: APlusSliceFormat) {
  return format === 'mobile'
    ? {
        label: '手机 A+',
        sliceWidth: MOBILE_A_PLUS_SLICE_WIDTH,
        sliceHeight: MOBILE_A_PLUS_SLICE_HEIGHT,
        uploadWidth: MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH,
        uploadHeight: MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT,
      }
    : {
        label: '高级 A+',
        sliceWidth: PREMIUM_A_PLUS_SLICE_WIDTH,
        sliceHeight: PREMIUM_A_PLUS_SLICE_HEIGHT,
        uploadWidth: PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH,
        uploadHeight: PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT,
      }
}

export function getAPlusMotherExpectedRatio(sliceCount: number, format: APlusSliceFormat = 'premium') {
  const count = normalizePremiumSliceCount(sliceCount)
  const geometry = getSliceGeometry(format)
  return geometry.sliceWidth / (geometry.sliceHeight * count)
}

export function validatePremiumMotherGeometry(
  width: number,
  height: number,
  sliceCount: number,
  tolerance = 0.0125,
): PremiumSliceValidation {
  return validateAPlusMotherGeometry(width, height, sliceCount, 'premium', tolerance)
}

export function validateAPlusMotherGeometry(
  width: number,
  height: number,
  sliceCount: number,
  format: APlusSliceFormat = 'premium',
  tolerance = 0.0125,
): PremiumSliceValidation {
  const count = normalizePremiumSliceCount(sliceCount)
  const geometry = getSliceGeometry(format)
  const actualRatio = width > 0 && height > 0 ? width / height : 0
  const expectedRatio = getAPlusMotherExpectedRatio(count, format)
  const relativeError = expectedRatio > 0 ? Math.abs(actualRatio - expectedRatio) / expectedRatio : 1
  const sliceWidth = width
  const sliceHeight = height / count
  const valid = width > 0 && height > 0 && relativeError <= tolerance
  const lowResolution = sliceWidth < geometry.uploadWidth || sliceHeight < geometry.uploadHeight
  return {
    valid,
    actualRatio,
    expectedRatio,
    relativeError,
    sliceWidth,
    sliceHeight,
    lowResolution,
    message: valid
      ? lowResolution
        ? `比例正确，但每片约 ${Math.round(sliceWidth)}x${Math.round(sliceHeight)}，低于 ${geometry.label} 建议上传尺寸。`
        : `比例正确，可切成 ${count} 张约 ${Math.round(sliceWidth)}x${Math.round(sliceHeight)} 的 ${geometry.label} 图片。`
      : `当前比例 ${actualRatio.toFixed(3)} 与 ${count} 片 ${geometry.label} 目标比例 ${expectedRatio.toFixed(3)} 不一致，不能自动切割。`,
  }
}

export function getVerticalSliceBounds(height: number, sliceCount: number) {
  const count = normalizePremiumSliceCount(sliceCount)
  return Array.from({ length: count }, (_, index) => {
    const start = Math.round((height * index) / count)
    const end = Math.round((height * (index + 1)) / count)
    return { y: start, height: Math.max(1, end - start) }
  })
}

export async function sliceImageDataUrlVertically(dataUrl: string, sliceCount: number, format: APlusSliceFormat = 'premium') {
  const image = await loadImage(dataUrl)
  const validation = validateAPlusMotherGeometry(image.naturalWidth, image.naturalHeight, sliceCount, format)
  if (!validation.valid) throw new Error(validation.message)

  const bounds = getVerticalSliceBounds(image.naturalHeight, sliceCount)
  const slices: Array<{ dataUrl: string; width: number; height: number }> = []
  for (const bound of bounds) {
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = bound.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持 Canvas 图片切割')
    context.drawImage(
      image,
      0,
      bound.y,
      image.naturalWidth,
      bound.height,
      0,
      0,
      image.naturalWidth,
      bound.height,
    )
    const blob = await canvasToBlob(canvas, 'image/png')
    slices.push({
      dataUrl: await blobToDataUrl(blob),
      width: image.naturalWidth,
      height: bound.height,
    })
  }
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    validation,
    slices,
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
