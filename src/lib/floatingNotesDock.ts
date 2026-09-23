export type FloatingNotesDockSide = 'left' | 'right'

export interface FloatingNotesDockPosition {
  side: FloatingNotesDockSide
  top: number
}

export interface FloatingNotesFreePosition {
  left: number
  top: number
}

export interface FloatingNotesViewport {
  width: number
  height: number
}

export interface FloatingNotesDockStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const FLOATING_NOTES_DOCK_STORAGE_KEY = 'amazon-image-studio.floating-notes-dock.v1'
export const FLOATING_NOTES_LAUNCHER_SIZE = 48
export const FLOATING_NOTES_EDGE_GAP = 12
export const FLOATING_NOTES_PANEL_GAP = 12
export const FLOATING_NOTES_TOP_INSET = 72
const DEFAULT_VERTICAL_RATIO = 0.66

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function clampFloatingNotesTop(top: number, viewportHeight: number) {
  const maxTop = Math.max(FLOATING_NOTES_TOP_INSET, viewportHeight - FLOATING_NOTES_LAUNCHER_SIZE - FLOATING_NOTES_EDGE_GAP)
  return clamp(Number.isFinite(top) ? top : FLOATING_NOTES_TOP_INSET, FLOATING_NOTES_TOP_INSET, maxTop)
}

export function getDefaultFloatingNotesDock(viewport: FloatingNotesViewport): FloatingNotesDockPosition {
  const centeredTop = viewport.height * DEFAULT_VERTICAL_RATIO - FLOATING_NOTES_LAUNCHER_SIZE / 2
  return { side: 'left', top: clampFloatingNotesTop(centeredTop, viewport.height) }
}

export function clampFloatingNotesDock(position: FloatingNotesDockPosition, viewport: FloatingNotesViewport): FloatingNotesDockPosition {
  return {
    side: position.side === 'right' ? 'right' : 'left',
    top: clampFloatingNotesTop(position.top, viewport.height),
  }
}

export function getFloatingNotesDockLeft(side: FloatingNotesDockSide, viewportWidth: number) {
  return side === 'left'
    ? FLOATING_NOTES_EDGE_GAP
    : Math.max(FLOATING_NOTES_EDGE_GAP, viewportWidth - FLOATING_NOTES_LAUNCHER_SIZE - FLOATING_NOTES_EDGE_GAP)
}

export function clampFloatingNotesFreePosition(position: FloatingNotesFreePosition, viewport: FloatingNotesViewport): FloatingNotesFreePosition {
  return {
    left: clamp(position.left, FLOATING_NOTES_EDGE_GAP, Math.max(FLOATING_NOTES_EDGE_GAP, viewport.width - FLOATING_NOTES_LAUNCHER_SIZE - FLOATING_NOTES_EDGE_GAP)),
    top: clampFloatingNotesTop(position.top, viewport.height),
  }
}

export function snapFloatingNotesDock(position: FloatingNotesFreePosition, viewport: FloatingNotesViewport): FloatingNotesDockPosition {
  const clamped = clampFloatingNotesFreePosition(position, viewport)
  const centerX = clamped.left + FLOATING_NOTES_LAUNCHER_SIZE / 2
  return {
    side: centerX <= viewport.width / 2 ? 'left' : 'right',
    top: clamped.top,
  }
}

export function getFloatingNotesPanelTop(dockTop: number, panelHeight: number, viewportHeight: number) {
  const preferredTop = dockTop + FLOATING_NOTES_LAUNCHER_SIZE / 2 - panelHeight / 2
  const maxTop = Math.max(FLOATING_NOTES_EDGE_GAP, viewportHeight - panelHeight - FLOATING_NOTES_EDGE_GAP)
  return clamp(preferredTop, FLOATING_NOTES_EDGE_GAP, maxTop)
}

function getDefaultStorage(): FloatingNotesDockStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readFloatingNotesDock(
  viewport: FloatingNotesViewport,
  storage: FloatingNotesDockStorage | null = getDefaultStorage(),
) {
  const fallback = getDefaultFloatingNotesDock(viewport)
  if (!storage) return fallback
  try {
    const raw = storage.getItem(FLOATING_NOTES_DOCK_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<FloatingNotesDockPosition>
    if ((parsed.side !== 'left' && parsed.side !== 'right') || typeof parsed.top !== 'number') return fallback
    return clampFloatingNotesDock({ side: parsed.side, top: parsed.top }, viewport)
  } catch {
    return fallback
  }
}

export function saveFloatingNotesDock(
  position: FloatingNotesDockPosition,
  storage: FloatingNotesDockStorage | null = getDefaultStorage(),
) {
  if (!storage) return
  try {
    storage.setItem(FLOATING_NOTES_DOCK_STORAGE_KEY, JSON.stringify(position))
  } catch {
    // 位置持久化失败时仍保留当前会话状态。
  }
}
