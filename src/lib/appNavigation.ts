import type { AppPage } from '../types'

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
