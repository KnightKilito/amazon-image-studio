import { describe, expect, it } from 'vitest'
import { clearAmazonPlannerResultSnapshot } from './amazonPlannerReset'

describe('clearAmazonPlannerResultSnapshot', () => {
  it('clears Listing planning output while preserving the source input and references', () => {
    const draft = { productTitle: 'Keep this title', sellingPoints: 'Keep these bullets' }
    const referenceImages = [{ id: 'reference-a', dataUrl: 'data:image/png;base64,a' }]
    const result = clearAmazonPlannerResultSnapshot({
      listingText: 'Title: Keep this title\n- Keep bullet one',
      draft,
      referenceImages,
      listingImageCount: 7,
      aPlusConfiguration: { type: 'standard-large' },
      visualStyleMode: 'builtin',
      styleDensityMode: 'rich',
      imagePlans: [{ slot: 'MAIN' }],
      aPlusPlans: [],
      seriesStyleGuides: { listing: 'old listing guide', aplus: '' },
      selectedPlanIndex: 0,
      selectedAPlusPlanIndex: null,
    })

    expect(result).toMatchObject({
      listingText: 'Title: Keep this title\n- Keep bullet one',
      listingImageCount: 7,
      visualStyleMode: 'builtin',
      styleDensityMode: 'rich',
      imagePlans: [],
      aPlusPlans: [],
      seriesStyleGuides: { listing: '', aplus: '' },
      selectedPlanIndex: null,
      selectedAPlusPlanIndex: null,
    })
    expect(result.draft).toBe(draft)
    expect(result.referenceImages).toBe(referenceImages)
  })

  it('preserves premium A+ planning configuration while clearing its generated modules', () => {
    const aPlusConfiguration = {
      type: 'premium',
      layoutMode: 'composed',
      moduleSpecs: [{ slot: 'PREMIUM-01' }],
      brandStoryEnabled: true,
    }
    const result = clearAmazonPlannerResultSnapshot({
      listingText: 'Premium A+ source copy',
      draft: { productTitle: 'Premium product' },
      referenceImages: [],
      listingImageCount: 7,
      aPlusConfiguration,
      visualStyleMode: 'ai',
      styleDensityMode: 'minimal',
      imagePlans: [],
      aPlusPlans: [{ slot: 'PREMIUM-01' }, { slot: 'PREMIUM-02' }],
      seriesStyleGuides: { listing: '', aplus: 'old A+ guide' },
      selectedPlanIndex: null,
      selectedAPlusPlanIndex: 1,
    })

    expect(result.aPlusConfiguration).toBe(aPlusConfiguration)
    expect(result).toMatchObject({
      listingText: 'Premium A+ source copy',
      visualStyleMode: 'ai',
      styleDensityMode: 'minimal',
      imagePlans: [],
      aPlusPlans: [],
      seriesStyleGuides: { listing: '', aplus: '' },
      selectedPlanIndex: null,
      selectedAPlusPlanIndex: null,
    })
  })
})
