import { describe, expect, it } from 'vitest'
import {
  FLOATING_NOTES_DOCK_STORAGE_KEY,
  clampFloatingNotesDock,
  clampFloatingNotesFreePosition,
  getDefaultFloatingNotesDock,
  getFloatingNotesPanelTop,
  readFloatingNotesDock,
  saveFloatingNotesDock,
  snapFloatingNotesDock,
} from './floatingNotesDock'

function memoryStorage(initial?: string) {
  let value = initial ?? null
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
    read: () => value,
  }
}

describe('floating notes dock', () => {
  const viewport = { width: 1200, height: 900 }

  it('starts lower than the lightbox navigation midpoint', () => {
    const dock = getDefaultFloatingNotesDock(viewport)
    expect(dock.side).toBe('left')
    expect(dock.top + 24).toBeGreaterThan(viewport.height / 2)
  })

  it('snaps to the nearest side and keeps the launcher inside the viewport', () => {
    expect(snapFloatingNotesDock({ left: 90, top: 500 }, viewport)).toEqual({ side: 'left', top: 500 })
    expect(snapFloatingNotesDock({ left: 1100, top: 500 }, viewport)).toEqual({ side: 'right', top: 500 })
    expect(clampFloatingNotesFreePosition({ left: -200, top: 9999 }, viewport)).toEqual({ left: 12, top: 840 })
  })

  it('reclamps saved positions and centers the panel without overflowing', () => {
    expect(clampFloatingNotesDock({ side: 'right', top: 9999 }, viewport)).toEqual({ side: 'right', top: 840 })
    expect(getFloatingNotesPanelTop(840, 640, 900)).toBe(248)
    expect(getFloatingNotesPanelTop(72, 640, 900)).toBe(12)
  })

  it('persists and reloads the snapped side and vertical position', () => {
    const storage = memoryStorage()
    saveFloatingNotesDock({ side: 'right', top: 520 }, storage)
    expect(storage.read()).toContain('"side":"right"')
    expect(readFloatingNotesDock(viewport, storage)).toEqual({ side: 'right', top: 520 })
    expect(JSON.parse(storage.read() || '{}')).toMatchObject({ side: 'right', top: 520 })
    expect(FLOATING_NOTES_DOCK_STORAGE_KEY).toContain('floating-notes-dock')
  })
})
