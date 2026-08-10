import type { AppPage } from '../types'

export function getAppPageFromLocation(location: Pick<Location, 'hash'> = window.location): AppPage {
  return location.hash.toLowerCase() === '#editor' ? 'editor' : 'home'
}

export function navigateToAppPage(page: AppPage) {
  if (typeof window === 'undefined') return
  const nextHash = page === 'editor' ? '#editor' : '#home'
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}
