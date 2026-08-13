import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOpenAIProfile } from './apiProfiles'
import { DEFAULT_LISTING_COPY_INPUT } from './listingCopy'
import { DEFAULT_LISTING_COPY_PROMPTS } from './listingCopyKnowledge'
import { generateListingCopy } from './listingCopyApi'

afterEach(() => vi.unstubAllGlobals())

function validPayload(itemName = 'Women Mule Sandals with Block Heel') {
  return {
    itemName: { en: itemName, zh: '女士粗跟穆勒凉鞋' },
    itemHighlight: { en: 'Slip-On Comfort with Rubber Outsole for Office and Casual Wear', zh: '便捷套脚穿着，橡胶鞋底适合通勤与休闲' },
    bullets: Array.from({ length: 5 }, (_, index) => ({ en: `Supported benefit ${index + 1}`, zh: `真实卖点 ${index + 1}` })),
    longDescription: { en: 'A factual long description.', zh: '基于事实的长描述。' },
    coreKeywords: [{ en: 'mule sandals', zh: '穆勒凉鞋' }, { en: 'block heel shoes', zh: '粗跟鞋' }, { en: 'slip on shoes', zh: '一脚蹬鞋' }],
    backendSearchTerms: { en: 'office slip on footwear casual block heel', zh: '通勤套脚休闲粗跟鞋' },
    missingFacts: [],
    complianceWarnings: [],
  }
}

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const baseOptions = {
  input: { ...DEFAULT_LISTING_COPY_INPUT, productDescription: 'Black women mule sandals', category: 'Mule Sandals' },
  prompts: DEFAULT_LISTING_COPY_PROMPTS,
  marketplace: 'us' as const,
  profile: createDefaultOpenAIProfile({ baseUrl: 'https://api.example.com/v1', apiKey: 'test-key', apiMode: 'responses', model: 'gpt-test' }),
  referenceImageDataUrls: [] as string[],
}

describe('generateListingCopy', () => {
  it('sends a strict bilingual schema and returns valid copy', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(validPayload()))
    vi.stubGlobal('fetch', fetchMock)

    const generated = await generateListingCopy(baseOptions)
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.text.format.schema.properties.bullets.minItems).toBe(5)
    expect(body.instructions).toContain('Item Name English must contain at most 75')
    expect(body.instructions).toContain('Target marketplace: 美国站, Amazon.com')
    expect(body.instructions).toContain('Title instructions:')
    expect(body.instructions).toContain('COSMO语义图谱')
    expect(body.instructions).toContain('Five-bullet instructions:')
    expect(body.instructions).toContain('设计与穿戴方式')
    expect(body.instructions).toContain('Long-description instructions:')
    expect(body.instructions).toContain('结尾补充必要的尺码')
    expect(generated.validationIssues).toEqual([])
    expect(generated.result.bullets).toHaveLength(5)
  })

  it('sends all three editable prompts while retaining the fixed safety contract', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(validPayload()))
    vi.stubGlobal('fetch', fetchMock)

    await generateListingCopy({
      ...baseOptions,
      prompts: { title: 'CUSTOM TITLE', bullets: 'CUSTOM BULLETS', longDescription: 'CUSTOM DESCRIPTION' },
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.instructions).toContain('Title instructions:\nCUSTOM TITLE')
    expect(body.instructions).toContain('Five-bullet instructions:\nCUSTOM BULLETS')
    expect(body.instructions).toContain('Long-description instructions:\nCUSTOM DESCRIPTION')
    expect(body.instructions).toContain('Item Name English must contain at most 75')
    expect(body.instructions).toContain('never infer appearance')
  })

  it('repairs an over-limit title once and keeps product facts in the repair request', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(validPayload('A'.repeat(76))))
      .mockResolvedValueOnce(jsonResponse(validPayload('Women Mule Sandals with Block Heel')))
    vi.stubGlobal('fetch', fetchMock)

    const generated = await generateListingCopy(baseOptions)
    const repairBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(generated.repaired).toBe(true)
    expect(generated.validationIssues).toEqual([])
    expect(repairBody.input[0].content[0].text).toContain('Black women mule sandals')
    expect(repairBody.instructions).toContain('Item Name 超过 75 字符')
  })

  it('retries without reference images when the multimodal request fails', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'unsupported image input' } }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(jsonResponse(validPayload()))
    vi.stubGlobal('fetch', fetchMock)

    const generated = await generateListingCopy({ ...baseOptions, referenceImageDataUrls: ['data:image/png;base64,YQ=='] })
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(generated.validationIssues).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(retryBody.input[0].content).toHaveLength(1)
  })
})
