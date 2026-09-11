import type { InputImage } from '../types'

export function replaceInputImagesWithReferenceImages(
  incomingImages: readonly InputImage[],
  limit: number,
) {
  const seenIds = new Set<string>()
  const uniqueIncoming: InputImage[] = []
  let duplicateCount = 0

  for (const image of incomingImages) {
    if (seenIds.has(image.id)) {
      duplicateCount += 1
      continue
    }
    seenIds.add(image.id)
    uniqueIncoming.push(image)
  }

  const images = uniqueIncoming.slice(0, Math.max(0, Math.trunc(limit)))
  return {
    images,
    duplicateCount,
    skippedCount: Math.max(0, uniqueIncoming.length - images.length),
  }
}
