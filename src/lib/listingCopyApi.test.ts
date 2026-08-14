import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOpenAIProfile } from './apiProfiles'
import { DEFAULT_LISTING_COPY_INPUT } from './listingCopy'
import { DEFAULT_LISTING_COPY_PROMPTS } from './listingCopyKnowledge'
import { generateListingCopy } from './listingCopyApi'

afterEach(() => vi.unstubAllGlobals())

function validPayload(itemName = 'Women Mule Sandals with Block Heel') {
  return {
    titleAnalysis: '### 商品身份判断\n\nWomen → Mule Sandals → Block Heel → Slip-On。主标题优先保留核心品类、鞋跟结构与穿脱方式，让买家在搜索结果中快速确认商品；辅助标题承接材质、鞋底与通勤场景。这样的关键词分层既节省字符预算，也能为 COSMO 关系与 Alexa 商品问答提供清晰属性节点。',
    itemName: { en: itemName, zh: '女士粗跟穆勒凉鞋' },
    itemHighlight: { en: 'Slip-On Comfort with Rubber Outsole for Office Wear', zh: '便捷套脚穿着配橡胶鞋底适合通勤' },
    bullets: Array.from({ length: 5 }, (_, index) => ({ en: `${index + 1}. [Signature Feature ${index + 1}]: Supported benefit for polished everyday styling.`, zh: `${index + 1}. [特色卖点 ${index + 1}]：真实设计带来精致日常搭配价值。` })),
    longDescription: {
      en: '**Polished Ease for Every Step**\n\n**A refined silhouette brings effortless character to everyday styling.** This factual description turns confirmed design details into a clear reason to buy.\n\n**Perfect For:**\n• Office-ready looks\n• Weekend plans\n• Dinner styling\n\n**Specifications:**\n• Category: Mule sandals\n• Heel: Block heel\n\n**Step into the day with a polished finish that feels distinctly your own.**',
      zh: '**从容步履：精致穆勒凉鞋**\n\n**利落轮廓为日常造型注入不费力的精致感。** 这段文案将已经确认的设计信息转化为清晰的购买价值。\n\n**完美适用于：**\n• 办公室通勤造型\n• 周末休闲安排\n• 晚餐约会穿搭\n\n**规格说明：**\n• 品类：穆勒凉鞋\n• 鞋跟：粗跟\n\n**穿上这份恰到好处的精致，让每一步都展现自己的从容风格。**',
    },
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
    expect(body.text.format.schema.properties.itemName.properties.en.maxLength).toBe(75)
    expect(body.text.format.schema.properties.itemHighlight.properties.en.maxLength).toBe(125)
    expect(body.text.format.schema.properties.titleAnalysis.minLength).toBe(80)
    expect(body.text.format.schema.required).toContain('titleAnalysis')
    expect(body.instructions).not.toContain('Item Name English must contain at most 75')
    expect(body.instructions).toContain('Target marketplace: 美国站, Amazon.com')
    expect(body.instructions).toContain('Title instructions:')
    expect(body.instructions).toContain('COSMO语义图谱')
    expect(body.instructions).toContain('Five-bullet instructions:')
    expect(body.instructions).toContain('请大胆写出五条让买家产生拥有欲')
    expect(body.instructions).toContain('Long-description instructions:')
    expect(body.instructions).toContain('Perfect For:')
    expect(body.instructions).toContain('Fixed title restriction:')
    expect(body.instructions).toContain('Title planning output: titleAnalysis')
    expect(body.instructions).toContain('Creative direction:')
    expect(body.instructions).toContain('A textured, grooved, lugged, or rubber outsole can reasonably support anti-slip or strong-grip wording')
    expect(body.instructions).toContain('consider the visible platform height and effective foot pitch together')
    expect(body.instructions).toContain('Do not create a warning merely because no laboratory test or certification was supplied')
    expect(body.instructions).toContain('Never discuss missing inputs, uncertainty, source data, or the information-gathering process')
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
    const titleSection = body.instructions.split('\n\nFive-bullet instructions:')[0]
    expect(titleSection).toContain('Title instructions:\nCUSTOM TITLE')
    expect(titleSection).toContain('Fixed title restriction: Item Name and Item Highlight must not contain English commas, Chinese commas, or the standalone English word "and".')
    expect(titleSection).toContain('Title planning output: titleAnalysis')
    expect(body.instructions).not.toContain('Item Name English must contain at most 75')
    expect(body.instructions).toContain('place only commercially useful gaps in missingFacts')
  })

  it('streams raw Responses data through the listing generation callbacks', async () => {
    const payloadText = JSON.stringify(validPayload())
    const splitAt = Math.floor(payloadText.length / 2)
    const streamBody = [
      `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: payloadText.slice(0, splitAt) })}`,
      '',
      `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: payloadText.slice(splitAt) })}`,
      '',
      'data: [DONE]',
      '',
    ].join('\n')
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(streamBody, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const deltas: string[] = []
    const statuses: string[] = []

    const generated = await generateListingCopy({
      ...baseOptions,
      profile: { ...baseOptions.profile, streamImages: true },
      onTextDelta: (delta) => deltas.push(delta),
      onStatusChange: (status) => statuses.push(status),
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.stream).toBe(true)
    expect(deltas.join('')).toBe(payloadText)
    expect(statuses).toEqual(['waiting', 'streaming', 'streaming', 'parsing'])
    expect(generated.rawResponseText).toBe(payloadText)
    expect(generated.validationIssues).toEqual([])
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

  it('keeps reference images attached when repairing a valid multimodal response', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(validPayload('A'.repeat(76))))
      .mockResolvedValueOnce(jsonResponse(validPayload()))
    vi.stubGlobal('fetch', fetchMock)

    const generated = await generateListingCopy({ ...baseOptions, referenceImageDataUrls: ['data:image/png;base64,YQ=='] })
    const repairBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(generated.repaired).toBe(true)
    expect(repairBody.input[0].content).toHaveLength(2)
    expect(repairBody.input[0].content[1]).toMatchObject({ type: 'input_image' })
    expect(repairBody.instructions).toContain('Item Name 超过 75 字符')
  })

  it('accepts persuasive long copy without forcing one exact section template', async () => {
    const payload = validPayload()
    payload.longDescription = {
      en: 'A sculptural heel turns every entrance into a moment. The polished mule profile brings confident glamour to evening styling while the slip-on shape keeps the look effortless. Wear it when the outfit deserves a striking final note.',
      zh: '雕塑感鞋跟让每一次登场都成为焦点。利落的穆勒轮廓为晚间造型注入自信光芒，套穿鞋型又保留不费力的从容。适合在整体穿搭需要一笔醒目收尾时穿着。',
    }
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    const generated = await generateListingCopy(baseOptions)
    expect(generated.repaired).toBe(false)
    expect(generated.validationIssues).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('revises the current result from a seller follow-up while keeping facts and images in context', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(validPayload()))
    vi.stubGlobal('fetch', fetchMock)
    const attempts: string[] = []

    const generated = await generateListingCopy({
      ...baseOptions,
      referenceImageDataUrls: ['data:image/png;base64,YQ=='],
      previousRaw: JSON.stringify(validPayload()),
      refinementInstruction: '保留标题，结合凹凸橡胶鞋底突出防滑与强抓地。',
      onAttemptStart: (attempt) => attempts.push(attempt.label),
    })
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const userText = body.input[0].content[0].text
    expect(attempts).toEqual(['根据追问优化当前文案'])
    expect(body.input[0].content).toHaveLength(2)
    expect(userText).toContain("Seller follow-up request:\n保留标题，结合凹凸橡胶鞋底突出防滑与强抓地。")
    expect(userText).toContain('Current Listing JSON:')
    expect(userText).toContain('Black women mule sandals')
    expect(userText).toContain('Preserve strong content and fields that the seller did not ask to change')
    expect(generated.validationIssues).toEqual([])
  })

  it('repairs internal missing-information language leaked into customer-facing copy', async () => {
    const leaked = validPayload()
    leaked.bullets[0] = {
      en: '1. [Product Form]: Footwear details were not provided.',
      zh: '1. [产品形式]：闭合方式未提供。',
    }
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(leaked))
      .mockResolvedValueOnce(jsonResponse(validPayload()))
    vi.stubGlobal('fetch', fetchMock)

    const generated = await generateListingCopy(baseOptions)
    const repairBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(generated.repaired).toBe(true)
    expect(generated.validationIssues).toEqual([])
    expect(repairBody.instructions).toContain('五点使用了资料字段式小标题')
    expect(repairBody.instructions).toContain('包含面向内部的缺失信息措辞')
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
