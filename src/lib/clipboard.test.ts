import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyRichTextToClipboard } from './clipboard'

afterEach(() => vi.unstubAllGlobals())

describe('rich text clipboard', () => {
  it('writes HTML and plain text flavors together', async () => {
    class ClipboardItemMock {
      constructor(public readonly data: Record<string, Blob>) {}
    }
    const writtenItems: ClipboardItemMock[][] = []
    const write = vi.fn(async (items: ClipboardItemMock[]) => { writtenItems.push(items) })
    vi.stubGlobal('navigator', { clipboard: { write } })
    vi.stubGlobal('ClipboardItem', ClipboardItemMock)

    await expect(copyRichTextToClipboard('<h2>Title</h2>', 'Title')).resolves.toBe('rich')
    expect(write).toHaveBeenCalledTimes(1)
    const item = writtenItems[0]?.[0]
    expect(item).toBeDefined()
    if (!item) throw new Error('Expected one clipboard item')
    expect(Object.keys(item.data)).toEqual(['text/html', 'text/plain'])
    expect(await item.data['text/html']?.text()).toBe('<h2>Title</h2>')
    expect(await item.data['text/plain']?.text()).toBe('Title')
  })

  it('falls back to plain text when rich clipboard writing is unavailable', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    vi.stubGlobal('ClipboardItem', undefined)

    await expect(copyRichTextToClipboard('<h2>Title</h2>', 'Title')).resolves.toBe('plain')
    expect(writeText).toHaveBeenCalledWith('Title')
  })
})
