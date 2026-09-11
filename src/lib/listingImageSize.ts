import { calculateImageSize, normalizeImageSize } from './size'

export type ListingResolution = '2k' | '4k'

const FALLBACK_LISTING_SIZE_BY_RESOLUTION: Record<ListingResolution, string> = {
  '2k': '2048x2048',
  '4k': '2880x2880',
}

export const DEFAULT_LISTING_TARGET_SIZE = FALLBACK_LISTING_SIZE_BY_RESOLUTION['2k']

export function getListingPresetSize(resolution: ListingResolution) {
  const tier = resolution === '4k' ? '4K' : '2K'
  return calculateImageSize(tier, '1:1') ?? FALLBACK_LISTING_SIZE_BY_RESOLUTION[resolution]
}

export function normalizeListingTargetSize(
  size: string | null | undefined,
  fallback = DEFAULT_LISTING_TARGET_SIZE,
) {
  const normalized = normalizeImageSize(size?.trim() || '')
  return /^\d+x\d+$/.test(normalized) ? normalized : fallback
}

export function getPlannerSessionListingTargetSize(session: {
  resolution: ListingResolution
  listingTargetSize?: string
}) {
  return normalizeListingTargetSize(session.listingTargetSize, getListingPresetSize(session.resolution))
}

export function formatListingTargetSize(size: string) {
  return normalizeListingTargetSize(size).replace('x', ' × ')
}
