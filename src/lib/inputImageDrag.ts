export interface InputImageDropRect {
  index: number
  left: number
  right: number
  top: number
  bottom: number
}

export function resolveInputImageDragSourceIndex(
  images: readonly { id: string }[],
  imageId: string | null,
): number | null {
  if (!imageId) return null
  const index = images.findIndex((image) => image.id === imageId)
  return index >= 0 ? index : null
}

export function hasInputImageDragPassedThreshold(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
  threshold = 6,
) {
  return Math.hypot(clientX - startX, clientY - startY) >= threshold
}

interface InputImageDropRow {
  top: number
  bottom: number
  items: InputImageDropRect[]
}

function getVerticalDistance(row: InputImageDropRow, clientY: number) {
  if (clientY < row.top) return row.top - clientY
  if (clientY > row.bottom) return clientY - row.bottom
  return 0
}

/**
 * Resolves an insertion index from the visual thumbnail grid, including the
 * horizontal and vertical gaps where elementFromPoint cannot find a thumbnail.
 */
export function resolveInputImageDropIndex(
  rects: InputImageDropRect[],
  clientX: number,
  clientY: number,
): number | null {
  const validRects = rects
    .filter((rect) => Number.isInteger(rect.index) && rect.right > rect.left && rect.bottom > rect.top)
    .sort((a, b) => a.top - b.top || a.left - b.left)

  if (validRects.length === 0) return null

  const rows: InputImageDropRow[] = []
  for (const rect of validRects) {
    const centerY = (rect.top + rect.bottom) / 2
    const row = rows.find((candidate) => centerY >= candidate.top && centerY <= candidate.bottom)
    if (row) {
      row.top = Math.min(row.top, rect.top)
      row.bottom = Math.max(row.bottom, rect.bottom)
      row.items.push(rect)
    } else {
      rows.push({ top: rect.top, bottom: rect.bottom, items: [rect] })
    }
  }

  const row = rows.reduce((nearest, candidate) => (
    getVerticalDistance(candidate, clientY) < getVerticalDistance(nearest, clientY)
      ? candidate
      : nearest
  ))
  const items = [...row.items].sort((a, b) => a.left - b.left)

  for (const item of items) {
    if (clientX < (item.left + item.right) / 2) return item.index
  }
  return items[items.length - 1].index + 1
}
