export interface AmazonPlannerResultSnapshot {
  listingText: string
  draft: unknown
  referenceImages: readonly unknown[]
  listingImageCount: number
  aPlusConfiguration: unknown
  visualStyleMode: 'builtin' | 'ai'
  styleDensityMode: 'rich' | 'minimal'
  imagePlans: readonly unknown[]
  aPlusPlans: readonly unknown[]
  seriesStyleGuides: {
    listing: string
    aplus: string
  }
  selectedPlanIndex: number | null
  selectedAPlusPlanIndex: number | null
}

export type ClearedAmazonPlannerResultSnapshot<T extends AmazonPlannerResultSnapshot> = Omit<
  T,
  'imagePlans' | 'aPlusPlans' | 'seriesStyleGuides' | 'selectedPlanIndex' | 'selectedAPlusPlanIndex'
> & {
  imagePlans: []
  aPlusPlans: []
  seriesStyleGuides: {
    listing: ''
    aplus: ''
  }
  selectedPlanIndex: null
  selectedAPlusPlanIndex: null
}

/** 只清除策划输出，保留重新策划所需的原始资料与前置配置。 */
export function clearAmazonPlannerResultSnapshot<T extends AmazonPlannerResultSnapshot>(
  snapshot: T,
): ClearedAmazonPlannerResultSnapshot<T> {
  return {
    ...snapshot,
    imagePlans: [],
    aPlusPlans: [],
    seriesStyleGuides: { listing: '', aplus: '' },
    selectedPlanIndex: null,
    selectedAPlusPlanIndex: null,
  }
}
