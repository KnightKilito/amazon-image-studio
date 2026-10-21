import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMParser } from '@xmldom/xmldom'
import { strToU8, zipSync } from 'fflate'
import { buildListingKnowledgePrompt, createPersonalKnowledgeDocument, decodeKnowledgeText, extractDocxKnowledgeText, MAX_KNOWLEDGE_FILE_BYTES } from './personalKnowledge'

afterEach(() => vi.unstubAllGlobals())

describe('personal knowledge document parsing', () => {
  it('stores original text files locally with both AI usage options off', async () => {
    const file = new File(['写作规则\r\n不要虚构产品事实'], '规范.md', { type: 'text/markdown' })
    const document = await createPersonalKnowledgeDocument(file)
    expect(document).toMatchObject({ filename: '规范.md', summary: '', enabledForListing: false, text: '写作规则\n不要虚构产品事实', byteSize: file.size })
    expect(document.originalFile).toBe(file)
  })

  it('decodes Unicode BOMs without leaving garbage in the text', () => {
    expect(decodeKnowledgeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41]))).toBe('A')
    expect(decodeKnowledgeText(new Uint8Array([0xff, 0xfe, 0x41, 0x00]))).toBe('A')
    expect(decodeKnowledgeText(new Uint8Array([0xfe, 0xff, 0x00, 0x41]))).toBe('A')
  })

  it('extracts real DOCX paragraphs, tabs, escaped text and line breaks without reading other archive files', () => {
    vi.stubGlobal('DOMParser', DOMParser)
    const archive = zipSync({
      'word/document.xml': strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>真实规则 &amp; 示例</w:t><w:tab/><w:t>第二列</w:t><w:br/><w:t>&lt;script&gt;不是脚本&lt;/script&gt;</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p></w:body></w:document>'),
      'word/secret.xml': strToU8('SHOULD_NOT_APPEAR'),
    })
    expect(extractDocxKnowledgeText(archive)).toBe('真实规则 & 示例\t第二列\n<script>不是脚本</script>\n第二段')
  })

  it('rejects empty, unsupported and oversized uploads', async () => {
    await expect(createPersonalKnowledgeDocument(new File([''], '空.txt'))).rejects.toThrow('没有可读取')
    await expect(createPersonalKnowledgeDocument(new File(['pdf'], '资料.pdf'))).rejects.toThrow('目前支持')
    await expect(createPersonalKnowledgeDocument(new File(['binary\0'], 'binary.txt'))).rejects.toThrow('二进制')
    const huge = { name: 'huge.txt', size: MAX_KNOWLEDGE_FILE_BYTES + 1, arrayBuffer: vi.fn() }
    await expect(createPersonalKnowledgeDocument(huge as unknown as File)).rejects.toThrow('10 MB')
    expect(huge.arrayBuffer).not.toHaveBeenCalled()
  })

  it('rejects DOCX entities or archives without a Word document', () => {
    expect(() => extractDocxKnowledgeText(zipSync({ 'word/document.xml': strToU8('<!DOCTYPE doc [<!ENTITY x SYSTEM "file:///secret">]><doc>&x;</doc>') }))).toThrow('外部实体')
    expect(() => extractDocxKnowledgeText(zipSync({ 'not-word.txt': strToU8('text') }))).toThrow('有效的 .docx')
  })
})

describe('listing knowledge prompt selection', () => {
  it('includes only enabled, saved, nonempty summaries, never the document body', () => {
    const documents = [
      { filename: '使用.txt', enabledForListing: true, summary: '使用这份概要', text: 'PRIVATE_FULL_TEXT' },
      { filename: '关闭.txt', enabledForListing: false, summary: 'DO_NOT_SEND_DISABLED', text: 'PRIVATE_FULL_TEXT' },
      { filename: '空.txt', enabledForListing: true, summary: '   ', text: 'PRIVATE_FULL_TEXT' },
    ]
    const prompt = buildListingKnowledgePrompt(documents)
    expect(prompt).toContain('使用这份概要')
    expect(prompt).toContain('不是产品事实')
    expect(prompt).not.toContain('PRIVATE_FULL_TEXT')
    expect(prompt).not.toContain('DO_NOT_SEND_DISABLED')
    expect(buildListingKnowledgePrompt(documents.map((document) => ({ ...document, enabledForListing: false })))).toBe('')
  })

  it('rejects over-budget summaries rather than silently truncating them', () => {
    expect(() => buildListingKnowledgePrompt([{ filename: 'large', enabledForListing: true, summary: 'a'.repeat(24001) }])).toThrow('24000')
  })
})
