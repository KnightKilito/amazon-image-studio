import type { AmazonMarketplace } from '../types'

export const DEFAULT_AMAZON_MARKETPLACE: AmazonMarketplace = 'us'

export const AMAZON_MARKETPLACE_OPTIONS: Array<{ value: AmazonMarketplace; label: string }> = [
  { value: 'us', label: '美国站' },
]

export const AMAZON_MARKETPLACE_CONTEXT: Record<AmazonMarketplace, {
  label: string
  domain: string
  primaryLanguage: string
  currency: string
}> = {
  us: {
    label: '美国站',
    domain: 'Amazon.com',
    primaryLanguage: 'US English',
    currency: 'USD',
  },
}

export function normalizeAmazonMarketplace(value: unknown): AmazonMarketplace {
  return value === 'us' ? value : DEFAULT_AMAZON_MARKETPLACE
}
