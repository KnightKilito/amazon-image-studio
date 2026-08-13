/**
 * Legacy Premium A+ compatibility surface.
 * New main-content layout code should import the content-type-aware helpers from `aPlusLayout`.
 */
export {
  A_PLUS_LAYOUT_MAX_SLOTS as PREMIUM_A_PLUS_MAX_SLOTS,
  A_PLUS_LAYOUT_PRESETS as PREMIUM_A_PLUS_LAYOUT_PRESETS,
  A_PLUS_PURPOSE_OPTIONS as PREMIUM_A_PLUS_PURPOSE_OPTIONS,
  MAX_A_PLUS_CAROUSEL_SLIDES as MAX_PREMIUM_CAROUSEL_SLIDES,
  MAX_A_PLUS_MOTHER_SLICES as MAX_PREMIUM_MOTHER_SLICES,
  MIN_A_PLUS_CAROUSEL_SLIDES as MIN_PREMIUM_CAROUSEL_SLIDES,
  MIN_A_PLUS_MOTHER_SLICES as MIN_PREMIUM_MOTHER_SLICES,
  MOBILE_A_PLUS_SLICE_HEIGHT,
  MOBILE_A_PLUS_SLICE_WIDTH,
  MOBILE_A_PLUS_UPLOAD_SLICE_HEIGHT,
  MOBILE_A_PLUS_UPLOAD_SLICE_WIDTH,
  PREMIUM_A_PLUS_SLICE_HEIGHT,
  PREMIUM_A_PLUS_SLICE_WIDTH,
  PREMIUM_A_PLUS_UPLOAD_SLICE_HEIGHT,
  PREMIUM_A_PLUS_UPLOAD_SLICE_WIDTH,
  createAPlusLayoutGroup as createPremiumAPlusGroup,
  getAPlusGroupKindLabel as getPremiumAPlusGroupKindLabel,
  getAPlusGroupSlotCost as getPremiumAPlusGroupSlotCost,
  getAPlusLayoutPreset as getPremiumAPlusLayoutPreset,
  getAPlusLayoutSlotCount as getPremiumAPlusSlotCount,
  getAPlusPurposeLabel as getPremiumAPlusPurposeLabel,
  getAPlusPurposeObjective as getPremiumAPlusPurposeObjective,
  isAPlusMotherImageSize,
  normalizeAPlusLayoutGroup as normalizePremiumAPlusGroup,
  normalizeAPlusLayoutGroups as normalizePremiumAPlusGroups,
} from './aPlusLayout'

export { getAPlusMotherImageSize } from './aPlusLayout'

import { getAPlusMotherImageSize } from './aPlusLayout'

export function getPremiumMotherImageSize(sliceCount: number) {
  return getAPlusMotherImageSize('premium', sliceCount, '2K')
}

export function getMobileMotherImageSize(sliceCount: number) {
  return getAPlusMotherImageSize('mobile', sliceCount, '2K')
}

export function isPremiumMotherImageSize(size: string) {
  const canonical = size.trim().toLowerCase()
  return Array.from({ length: 6 }, (_, index) => getPremiumMotherImageSize(index + 2)).includes(canonical)
}

export function isMobileMotherImageSize(size: string) {
  const canonical = size.trim().toLowerCase()
  return (['2K', '4K'] as const).some((tier) => (
    Array.from({ length: 6 }, (_, index) => getAPlusMotherImageSize('mobile', index + 2, tier)).includes(canonical)
  ))
}
