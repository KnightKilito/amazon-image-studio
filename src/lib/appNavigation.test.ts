import { describe, expect, it } from 'vitest'
import {
  createAppPageScrollPositions,
  getAppPageFromLocation,
  getAppPageScrollPosition,
  rememberAppPageScrollPosition,
} from './appNavigation'

describe('app page hash navigation', () => {
  it('maps editor hashes to the editor page', () => {
    expect(getAppPageFromLocation({ hash: '#editor' })).toBe('editor')
    expect(getAppPageFromLocation({ hash: '#EDITOR' })).toBe('editor')
  })

  it('maps listing copy hashes to the listing copy page', () => {
    expect(getAppPageFromLocation({ hash: '#listing-copy' })).toBe('listing-copy')
    expect(getAppPageFromLocation({ hash: '#LISTING-COPY' })).toBe('listing-copy')
  })

  it('falls back to home for the default and unknown hashes', () => {
    expect(getAppPageFromLocation({ hash: '' })).toBe('home')
    expect(getAppPageFromLocation({ hash: '#home' })).toBe('home')
    expect(getAppPageFromLocation({ hash: '#settings' })).toBe('home')
  })
})

describe('app page scroll positions', () => {
  it('keeps an independent position for every main tab', () => {
    const positions = createAppPageScrollPositions()

    rememberAppPageScrollPosition(positions, 'home', 2480)
    rememberAppPageScrollPosition(positions, 'listing-copy', 620)
    rememberAppPageScrollPosition(positions, 'editor', 140)

    expect(getAppPageScrollPosition(positions, 'home')).toBe(2480)
    expect(getAppPageScrollPosition(positions, 'listing-copy')).toBe(620)
    expect(getAppPageScrollPosition(positions, 'editor')).toBe(140)
  })

  it('starts new tabs at the top and normalizes invalid positions', () => {
    const positions = createAppPageScrollPositions()

    rememberAppPageScrollPosition(positions, 'home', -20)
    rememberAppPageScrollPosition(positions, 'editor', Number.NaN)

    expect(positions).toEqual({ home: 0, 'listing-copy': 0, editor: 0 })
  })
})
