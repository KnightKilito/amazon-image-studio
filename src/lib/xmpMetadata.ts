const SYNTHETIC_PERFORMER_KEYWORD = 'contains-synthetic-performer'
const JPEG_XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\u0000'
const PNG_XMP_KEYWORD = 'XML:com.adobe.xmp'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function embedSyntheticPerformerXmp(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const type = blob.type.toLowerCase()

  if (type === 'image/jpeg' || isJpeg(bytes)) {
    return toBlob(embedJpegXmp(bytes), 'image/jpeg')
  }
  if (type === 'image/png' || isPng(bytes)) {
    return toBlob(embedPngXmp(bytes), 'image/png')
  }
  if (type === 'image/webp' || isWebp(bytes)) {
    return toBlob(embedWebpXmp(bytes), 'image/webp')
  }
  return blob
}

function embedJpegXmp(bytes: Uint8Array): Uint8Array {
  if (!isJpeg(bytes)) return bytes

  const xmpHeader = encoder.encode(JPEG_XMP_HEADER)
  let offset = 2
  let existingStart = -1
  let existingEnd = -1
  let existingXmp: string | undefined

  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1]
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = readUint16Be(bytes, offset + 2)
    if (length < 2 || offset + 2 + length > bytes.length) break
    const dataStart = offset + 4
    const dataEnd = offset + 2 + length
    if (marker === 0xe1 && startsWith(bytes, dataStart, xmpHeader)) {
      existingStart = offset
      existingEnd = dataEnd
      existingXmp = decoder.decode(bytes.subarray(dataStart + xmpHeader.length, dataEnd))
      break
    }
    offset = dataEnd
  }

  const packet = encoder.encode(addKeywordToXmp(existingXmp))
  const payloadLength = xmpHeader.length + packet.length
  if (payloadLength + 2 > 0xffff) throw new Error('XMP metadata is too large for a JPEG APP1 segment')

  const segment = new Uint8Array(payloadLength + 4)
  segment[0] = 0xff
  segment[1] = 0xe1
  writeUint16Be(segment, 2, payloadLength + 2)
  segment.set(xmpHeader, 4)
  segment.set(packet, 4 + xmpHeader.length)

  return existingStart >= 0
    ? concatBytes(bytes.subarray(0, existingStart), segment, bytes.subarray(existingEnd))
    : concatBytes(bytes.subarray(0, 2), segment, bytes.subarray(2))
}

function embedPngXmp(bytes: Uint8Array): Uint8Array {
  if (!isPng(bytes)) return bytes

  let offset = 8
  let insertOffset = bytes.length
  let existingStart = -1
  let existingEnd = -1
  let existingXmp: string | undefined

  while (offset + 12 <= bytes.length) {
    const length = readUint32Be(bytes, offset)
    const end = offset + 12 + length
    if (end > bytes.length) break
    const type = ascii(bytes, offset + 4, 4)
    if (type === 'iTXt') {
      const dataStart = offset + 8
      const keywordEnd = findByte(bytes, 0, dataStart, offset + 8 + length)
      if (keywordEnd >= 0 && ascii(bytes, dataStart, keywordEnd - dataStart) === PNG_XMP_KEYWORD) {
        const compressionFlag = bytes[keywordEnd + 1]
        const languageEnd = findByte(bytes, 0, keywordEnd + 3, offset + 8 + length)
        const translatedEnd = languageEnd >= 0 ? findByte(bytes, 0, languageEnd + 1, offset + 8 + length) : -1
        if (compressionFlag === 0 && translatedEnd >= 0) {
          existingXmp = decoder.decode(bytes.subarray(translatedEnd + 1, offset + 8 + length))
          existingStart = offset
          existingEnd = end
        }
      }
    }
    if (type === 'IEND') {
      insertOffset = offset
      break
    }
    offset = end
  }

  const chunk = createPngChunk('iTXt', concatBytes(
    encoder.encode(PNG_XMP_KEYWORD),
    new Uint8Array([0, 0, 0, 0, 0]),
    encoder.encode(addKeywordToXmp(existingXmp)),
  ))

  return existingStart >= 0
    ? concatBytes(bytes.subarray(0, existingStart), chunk, bytes.subarray(existingEnd))
    : concatBytes(bytes.subarray(0, insertOffset), chunk, bytes.subarray(insertOffset))
}

function embedWebpXmp(bytes: Uint8Array): Uint8Array {
  if (!isWebp(bytes)) return bytes

  const chunks: Uint8Array[] = []
  let offset = 12
  let existingXmp: string | undefined
  let xmpIndex = -1

  while (offset + 8 <= bytes.length) {
    const size = readUint32Le(bytes, offset + 4)
    const paddedSize = size + (size % 2)
    const end = offset + 8 + paddedSize
    if (end > bytes.length) break
    const type = ascii(bytes, offset, 4)
    const chunk = bytes.slice(offset, end)
    if (type === 'XMP ') {
      if (xmpIndex < 0) {
        existingXmp = decoder.decode(bytes.subarray(offset + 8, offset + 8 + size))
        xmpIndex = chunks.length
        chunks.push(chunk)
      }
    } else {
      if (type === 'VP8X' && size >= 1) chunk[8] |= 0x04
      chunks.push(chunk)
    }
    offset = end
  }

  const xmpChunk = createWebpChunk('XMP ', encoder.encode(addKeywordToXmp(existingXmp)))
  if (xmpIndex >= 0) chunks[xmpIndex] = xmpChunk
  else chunks.push(xmpChunk)

  const body = concatBytes(...chunks)
  const result = concatBytes(encoder.encode('RIFF'), new Uint8Array(4), encoder.encode('WEBP'), body)
  writeUint32Le(result, 4, result.length - 8)
  return result
}

function addKeywordToXmp(existing?: string): string {
  if (!existing?.trim()) return createXmpPacket()
  if (new RegExp(`<rdf:li(?:\\s[^>]*)?>\\s*${SYNTHETIC_PERFORMER_KEYWORD}\\s*</rdf:li>`, 'i').test(existing)) return existing

  const subjectPattern = /(<dc:subject(?:\s[^>]*)?>[\s\S]*?<rdf:Bag(?:\s[^>]*)?>)([\s\S]*?)(<\/rdf:Bag>[\s\S]*?<\/dc:subject>)/i
  if (subjectPattern.test(existing)) {
    return existing.replace(subjectPattern, `$1$2<rdf:li>${SYNTHETIC_PERFORMER_KEYWORD}</rdf:li>$3`)
  }

  const subject = `<dc:subject><rdf:Bag><rdf:li>${SYNTHETIC_PERFORMER_KEYWORD}</rdf:li></rdf:Bag></dc:subject>`
  if (/<\/rdf:Description>/i.test(existing)) {
    return existing.replace(/<\/rdf:Description>/i, `${subject}</rdf:Description>`)
  }
  return createXmpPacket()
}

function createXmpPacket(): string {
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:subject><rdf:Bag><rdf:li>${SYNTHETIC_PERFORMER_KEYWORD}</rdf:li></rdf:Bag></dc:subject></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type)
  const chunk = new Uint8Array(data.length + 12)
  writeUint32Be(chunk, 0, data.length)
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)
  writeUint32Be(chunk, data.length + 8, crc32(concatBytes(typeBytes, data)))
  return chunk
}

function createWebpChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(8 + data.length + (data.length % 2))
  chunk.set(encoder.encode(type), 0)
  writeUint32Le(chunk, 4, data.length)
  chunk.set(data, 8)
  return chunk
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8 && ascii(bytes, 1, 3) === 'PNG' && bytes[0] === 0x89
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP'
}

function startsWith(bytes: Uint8Array, offset: number, expected: Uint8Array) {
  if (offset + expected.length > bytes.length) return false
  return expected.every((value, index) => bytes[offset + index] === value)
}

function findByte(bytes: Uint8Array, value: number, start: number, end: number) {
  for (let index = start; index < end; index++) if (bytes[index] === value) return index
  return -1
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function readUint16Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function writeUint16Be(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = (value >>> 8) & 0xff
  bytes[offset + 1] = value & 0xff
}

function readUint32Be(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
}

function writeUint32Be(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value)
}

function readUint32Le(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true)
}

function writeUint32Le(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true)
}

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function toBlob(bytes: Uint8Array, type: string) {
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type })
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
