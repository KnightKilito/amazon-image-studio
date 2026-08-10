import { describe, expect, it } from 'vitest'
import { getAppPageFromLocation } from './appNavigation'

describe('app page hash navigation', () => {
  it('maps editor hashes to the editor page', () => {
    expect(getAppPageFromLocation({ hash: '#editor' })).toBe('editor')
    expect(getAppPageFromLocation({ hash: '#EDITOR' })).toBe('editor')
  })

  it('falls back to home for the default and unknown hashes', () => {
    expect(getAppPageFromLocation({ hash: '' })).toBe('home')
    expect(getAppPageFromLocation({ hash: '#home' })).toBe('home')
    expect(getAppPageFromLocation({ hash: '#settings' })).toBe('home')
  })
})
