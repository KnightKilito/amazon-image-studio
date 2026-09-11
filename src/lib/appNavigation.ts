import type { AppPage } from '../types'

export type AppPageScrollPositions = Record<AppPage, number>

function normalizeScrollPosition(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function createAppPageScrollPositions(): AppPageScrollPositions {
  return {
    home: 0,
    'listing-copy': 0,
    editor: 0,
  }
}

export function rememberAppPageScrollPosition(
  positions: AppPageScrollPositions,
  page: AppPage,
  scrollY: number,
) {
  positions[page] = normalizeScrollPosition(scrollY)
}

export function getAppPageScrollPosition(positions: AppPageScrollPositions, page: AppPage) {
  return normalizeScrollPosition(positions[page])
}

export function getAppPageFromLocation(location: Pick<Location, 'hash'> = window.location): AppPage {
  const hash = location.hash.toLowerCase()
  if (hash === '#editor') return 'editor'
  if (hash === '#listing-copy') return 'listing-copy'
  return 'home'
}

export function navigateToAppPage(page: AppPage) {
  if (typeof window === 'undefined') return
  const nextHash = page === 'editor' ? '#editor' : page === 'listing-copy' ? '#listing-copy' : '#home'
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}
