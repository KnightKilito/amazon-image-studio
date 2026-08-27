import { describe, expect, it } from 'vitest'
import { shouldToggleTaskSelection } from '../lib/taskSelection'

describe('TaskGrid selection entry', () => {
  it('uses normal clicks for selection while explicit multi-select mode is active', () => {
    expect(shouldToggleTaskSelection(true, 0, false)).toBe(true)
  })

  it('continues toggling after the first task is selected', () => {
    expect(shouldToggleTaskSelection(false, 1, false)).toBe(true)
  })

  it('keeps the normal detail click outside selection mode', () => {
    expect(shouldToggleTaskSelection(false, 0, false)).toBe(false)
    expect(shouldToggleTaskSelection(false, 0, true)).toBe(true)
  })
})
