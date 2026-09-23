import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import FloatingNotes from './FloatingNotes'

describe('FloatingNotes', () => {
  it('renders a movable launcher at the docked default position', () => {
    const markup = renderToStaticMarkup(<FloatingNotes />)

    expect(markup).toContain('data-floating-notes-launcher')
    expect(markup).toContain('拖动可吸附侧边')
    expect(markup).toContain('left:12px')
    expect(markup).toMatch(/top:\d+(?:\.\d+)?px/)
    expect(markup).not.toContain('-translate-y-1/2')
  })
})
