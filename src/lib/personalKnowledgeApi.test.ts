import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultOpenAIProfile } from './apiProfiles'
import { summarizePersonalKnowledge } from './personalKnowledgeApi'

afterEach(() => vi.unstubAllGlobals())

describe('personal knowledge planner summaries', () => {
  it.each(['responses', 'chat'] as const)('uses the selected planner model and %s API without image parameters', async (apiMode) => {
    const profile = createDefaultOpenAIProfile({ id: 'planner', name: '策划配置', apiMode, model: 'planner-text-model', apiKey: 'planner-key', baseUrl: 'https://planner.example/v1' })
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => new Response(JSON.stringify(apiMode === 'chat' ? { choices: [{ message: { content: '可编辑概要' } }] } : { output_text: '可编辑概要' }), { headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await summarizePersonalKnowledge('需要整理的文档正文', profile)).toBe('可编辑概要')
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toContain(apiMode === 'chat' ? 'chat/completions' : 'responses')
    const body = JSON.parse(String(request.body))
    expect(body.model).toBe('planner-text-model')
    expect(body.stream).toBe(false)
    expect(JSON.stringify(body)).toContain('需要整理的文档正文')
    expect(JSON.stringify(body)).not.toContain('image_url')
    expect(body).not.toHaveProperty('size')
    expect(request.headers).toMatchObject({ Authorization: 'Bearer planner-key' })
  })

  it('rejects unsupported modes and large summaries before sending any data', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const profile = createDefaultOpenAIProfile({ apiKey: 'key', apiMode: 'images' })
    await expect(summarizePersonalKnowledge('正文', profile)).rejects.toThrow('Chat Completions')
    await expect(summarizePersonalKnowledge('a'.repeat(60001), { ...profile, apiMode: 'responses' })).rejects.toThrow('60000')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('links cancellation to the planner request and does not return late content', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      controller.abort()
      expect(options.signal?.aborted).toBe(true)
      return new Response(JSON.stringify({ output_text: 'late' }), { headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(summarizePersonalKnowledge('正文', createDefaultOpenAIProfile({ apiKey: 'key', apiMode: 'responses' }), controller.signal)).rejects.toThrow('已停止概要生成')
  })
})
