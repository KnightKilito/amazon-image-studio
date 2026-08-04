import { describe, expect, it } from 'vitest'
import { embedSyntheticPerformerXmp } from './xmpMetadata'

const keyword = 'contains-synthetic-performer'
const decoder = new TextDecoder()

describe('embedSyntheticPerformerXmp', () => {
  it('writes a standard XMP APP1 segment to JPEG images', async () => {
    const source = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
    const result = await embedSyntheticPerformerXmp(source)
    const bytes = new Uint8Array(await result.arrayBuffer())
    const text = decoder.decode(bytes)

    expect(Array.from(bytes.subarray(0, 4))).toEqual([0xff, 0xd8, 0xff, 0xe1])
    expect(text).toContain('http://ns.adobe.com/xap/1.0/')
    expect(text).toContain(`<dc:subject><rdf:Bag><rdf:li>${keyword}</rdf:li></rdf:Bag></dc:subject>`)
  })

  it('writes an XMP iTXt chunk before the PNG IEND chunk', async () => {
    const source = new Blob([new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])], { type: 'image/png' })
    const result = await embedSyntheticPerformerXmp(source)
    const text = decoder.decode(await result.arrayBuffer())

    expect(text).toContain('iTXtXML:com.adobe.xmp')
    expect(text).toContain(`<rdf:li>${keyword}</rdf:li>`)
    expect(text.indexOf('XML:com.adobe.xmp')).toBeLessThan(text.indexOf('IEND'))
  })

  it('writes an XMP RIFF chunk and sets the WebP VP8X metadata flag', async () => {
    const bytes = new Uint8Array(30)
    bytes.set(new TextEncoder().encode('RIFF'), 0)
    new DataView(bytes.buffer).setUint32(4, 22, true)
    bytes.set(new TextEncoder().encode('WEBPVP8X'), 8)
    new DataView(bytes.buffer).setUint32(16, 10, true)
    const source = new Blob([bytes], { type: 'image/webp' })

    const result = await embedSyntheticPerformerXmp(source)
    const output = new Uint8Array(await result.arrayBuffer())
    const text = decoder.decode(output)

    expect(output[20] & 0x04).toBe(0x04)
    expect(text).toContain('XMP ')
    expect(text).toContain(`<rdf:li>${keyword}</rdf:li>`)
    expect(new DataView(output.buffer).getUint32(4, true)).toBe(output.length - 8)
  })

  it('updates existing XMP without duplicating the subject keyword', async () => {
    const source = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
    const first = await embedSyntheticPerformerXmp(source)
    const second = await embedSyntheticPerformerXmp(first)
    const text = decoder.decode(await second.arrayBuffer())

    expect(text.split(keyword)).toHaveLength(2)
  })

  it('leaves unsupported image formats unchanged', async () => {
    const source = new Blob(['gif-data'], { type: 'image/gif' })
    expect(await embedSyntheticPerformerXmp(source)).toBe(source)
  })
})
