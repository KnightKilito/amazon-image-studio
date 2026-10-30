import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getActiveApiProfile, getAmazonPlannerProfile, DEFAULT_SETTINGS, createDefaultOpenAIProfile, normalizeSettings } from './apiProfiles'
import { accountStorageKey, getPlatformState, setPlatformStateForTests, requestProfile, selectedRoute, profileHeaders, makeSiteProfile, optionOverrides, type Connections } from './platform'
import { buildApiUrl, shouldUseApiProxy } from './devProxy'
import { callImageApi } from './api'
import { DEFAULT_PARAMS } from '../types'
import { summarizePersonalKnowledge } from './personalKnowledgeApi'
import { callAgentConversationTitleApi } from './agentApi'
import { getPlatformModelOptions } from './platform'

const assigned = createDefaultOpenAIProfile({ id: 'assigned-image', baseUrl: 'https://relay.example/v1', apiKey: 'assigned-private-key', model: 'image-test', apiMode: 'images' })
const config: Connections = { profiles: { image: assigned, planner: { ...assigned, id: 'assigned-planner', model: 'text-test', apiMode: 'chat' } }, version: 3,
  policy: { defaultDirect: true, allowCustomDirect: true, adFreeThresholdCny: 10 }, proxy: { imageModel: 'image-test', plannerModel: 'text-test', plannerApiMode: 'chat' } }
const initial = { enabled: true, user: { id: 7, username: 'user', displayName: 'user', role: 1 }, csrf: 'csrf-test', connections: config, selections: {} }
const imageResult = () => new Response(JSON.stringify({ data: [{ b64_json: 'aW1hZ2U=' }] }), { headers: { 'Content-Type': 'application/json' } })

describe('platform routing boundaries', () => {
  it('offers assigned and default models even without global model lists, separating purposes', () => {
    setPlatformStateForTests(initial)
    expect(getPlatformModelOptions('image', 'my-image')).toEqual(['image-test', 'my-image'])
    expect(getPlatformModelOptions('planner')).toEqual(['text-test'])
    setPlatformStateForTests({ ...initial, connections: { ...config, adminAccess: { modelIds: ['recommended', ' image-test ', 'recommended'] }, managedProfiles: [{ ...assigned, purpose: 'image', model: 'assigned-new' }] } })
    expect(getPlatformModelOptions('image')).toEqual(['recommended', 'image-test', 'assigned-new'])
    expect(getPlatformModelOptions('planner')).toEqual(['text-test'])
  })
  beforeEach(() => { setPlatformStateForTests(initial) })
  afterEach(() => { setPlatformStateForTests({ enabled: false, user: null, csrf: '', connections: null, selections: {} }); vi.restoreAllMocks(); vi.unstubAllEnvs() })
  it('defaults to assigned direct without putting its key in display profiles or settings', () => {
    const profile = getActiveApiProfile(DEFAULT_SETTINGS)
    expect(profile.apiKey).toBe('')
    expect(profile.baseUrl).toBe('')
    expect(profile.provider).not.toBe('openai')
    expect(JSON.stringify(DEFAULT_SETTINGS)).not.toContain(assigned.apiKey)
    expect(requestProfile('image', profile).apiKey).toBe(assigned.apiKey)
    expect(getAmazonPlannerProfile(DEFAULT_SETTINGS)?.model).toBe('text-test')
  })
  it('direct image calls bypass forced proxy and never use wallet endpoints', async () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'true'); vi.stubEnv('VITE_API_PROXY_LOCKED', 'true')
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(imageResult())
    await callImageApi({ settings: DEFAULT_SETTINGS, prompt: 'test', params: { ...DEFAULT_PARAMS, n: 1 }, inputImageDataUrls: [] })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://relay.example/v1/images/generations')
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer assigned-private-key' })
    expect(shouldUseApiProxy(true, { enabled: true, locked: true, prefix: '/api-proxy', changeOrigin: true, secure: true })).toBe(false)
  })
  it('planner uses its assigned connection directly', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '概要' } }] })))
    await summarizePersonalKnowledge('some text', getAmazonPlannerProfile(DEFAULT_SETTINGS)!)
    expect(fetch.mock.calls[0][0]).toBe('https://relay.example/v1/chat/completions')
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer assigned-private-key' })
  })
  it('agent titles honor the planner Chat protocol and assigned credential', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '<title>测试标题</title>' } }] })))
    const result = await callAgentConversationTitleApi({ settings: DEFAULT_SETTINGS, profile: assigned, prompt: 'test' })
    expect(result).toBe('测试标题')
    expect(fetch.mock.calls[0][0]).toBe('https://relay.example/v1/chat/completions')
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer assigned-private-key' })
  })
  it('proxy selection uses session headers only and includes correct purpose', async () => {
    setPlatformStateForTests({ ...initial, selections: { image: 'proxy' } })
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(imageResult())
    await callImageApi({ settings: DEFAULT_SETTINGS, prompt: 'test', params: { ...DEFAULT_PARAMS, n: 1 }, inputImageDataUrls: [] })
    expect(fetch.mock.calls[0][0]).toBe('/studio-api/ai/v1/images/generations')
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ 'X-Studio-CSRF': 'csrf-test', 'X-Studio-Purpose': 'image' })
    expect(new Headers(fetch.mock.calls[0][1]?.headers).has('Authorization')).toBe(false)
  })
  it('missing or revoked direct assignment cannot silently use proxy or stale custom key', async () => {
    setPlatformStateForTests({ ...initial, connections: { ...config, profiles: {} } })
    const fetch = vi.spyOn(globalThis, 'fetch')
    await expect(callImageApi({ settings: { ...DEFAULT_SETTINGS, apiKey: 'stale-local-key' }, prompt: 'test', params: DEFAULT_PARAMS, inputImageDataUrls: [] })).rejects.toThrow('尚未分配')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('custom permission is enforced even when an old choice is persisted', () => {
    setPlatformStateForTests({ ...initial, connections: { ...config, policy: { ...config.policy, allowCustomDirect: false } }, selections: { image: 'custom' } })
    expect(() => requestProfile('image', assigned)).toThrow('已关闭自定义直连')
  })
  it('custom planner reuse-image refers to local credentials, never the assigned image placeholder', () => {
    setPlatformStateForTests({ ...initial, selections: { image: 'assigned', planner: 'custom' } })
    const settings = { ...DEFAULT_SETTINGS, plannerConnectionMode: 'reuse-image' as const, profiles: DEFAULT_SETTINGS.profiles.map(p => p.id === DEFAULT_SETTINGS.activeProfileId ? { ...p, apiKey: 'local-personal-key', baseUrl: 'https://personal.example/v1' } : p) }
    const planner = getAmazonPlannerProfile(settings)!
    expect(planner.apiKey).not.toBe('assigned-private-key')
    expect(planner.baseUrl).not.toBe('https://relay.example/v1')
  })
  it('default changes do not overwrite explicit choices; resolved requests keep their credentials', () => {
    const resolved = requestProfile('image', getActiveApiProfile(DEFAULT_SETTINGS))
    setPlatformStateForTests({ ...initial, connections: { ...config, profiles: {}, policy: { ...config.policy, defaultDirect: false } }, selections: { image: 'assigned' } })
    expect(selectedRoute('image')).toBe('assigned')
    expect(requestProfile('image', resolved)).toBe(resolved)
    expect(profileHeaders(resolved).Authorization).toBe('Bearer assigned-private-key')
    expect(selectedRoute('planner')).toBe('proxy')
  })
  it('isolates account storage without renaming the standalone legacy space', () => {
    expect(accountStorageKey('amazon-image-studio')).toBe('amazon-image-studio:user:7')
    setPlatformStateForTests({ ...initial, user: { ...initial.user, id: 8 } })
    expect(accountStorageKey('amazon-image-studio')).toBe('amazon-image-studio:user:8')
    setPlatformStateForTests({ ...initial, enabled: false })
    expect(accountStorageKey('amazon-image-studio')).toBe('amazon-image-studio')
  })
  it('blocks http, same-site and credential-bearing custom targets', () => {
    setPlatformStateForTests({ ...initial, selections: { image: 'custom' } })
    for (const baseUrl of ['http://relay.example', 'https://u:p@relay.example', 'https://relay.example?key=secret']) {
      expect(() => requestProfile('image', { ...assigned, baseUrl })).toThrow()
    }
    expect(buildApiUrl('/studio-api/ai', 'responses', null, false)).toBe('/studio-api/ai/v1/responses')
  })
  it('uses selected profiles rather than a second route picker, with free model and advanced settings', async () => {
    const settings = normalizeSettings(DEFAULT_SETTINGS)
    const managed = getActiveApiProfile(settings)
    const patch = { model: 'custom-image-model', streamImages: true, streamPartialImages: 3, timeout: 180, responseFormatB64Json: true }
    const changed = normalizeSettings({ ...settings, profiles: settings.profiles.map(p => p.id === managed.id ? { ...p, ...patch, managedOverrides: optionOverrides(patch) } : p) })
    const actual = requestProfile('image', getActiveApiProfile(changed))
    expect(actual).toMatchObject(patch)
    expect(actual.apiKey).toBe('assigned-private-key')
    const site = { ...makeSiteProfile('image', 'site-own'), model: 'another-image-model', timeout: 120 }
    const siteSettings = normalizeSettings({ ...changed, profiles: [...changed.profiles, site], activeProfileId: site.id })
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(imageResult())
    await callImageApi({ settings: siteSettings, prompt: 'test', params: DEFAULT_PARAMS, inputImageDataUrls: [] })
    expect(fetch.mock.calls[0][0]).toBe('/studio-api/ai/v1/images/generations')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).model).toBe('another-image-model')
    expect(JSON.stringify(siteSettings)).not.toContain('assigned-private-key')
    expect(JSON.stringify(siteSettings)).not.toContain('https://relay.example')
  })
  it('preserves selected managed profile and overrides through refreshed defaults and revocation', () => {
    const first = normalizeSettings(DEFAULT_SETTINGS)
    const p = getActiveApiProfile(first)
    const saved = normalizeSettings({ ...first, profiles: first.profiles.map(item => item.id === p.id ? { ...item, managedOverrides: { model: 'my-choice' } } : item) })
    setPlatformStateForTests({ ...initial, connections: { ...config, version: 4, profiles: { ...config.profiles, image: { ...assigned, model: 'new-default', name: '改名配置' } } } })
    expect(getActiveApiProfile(saved)).toMatchObject({ model: 'my-choice', name: '改名配置' })
    setPlatformStateForTests({ ...initial, connections: { ...config, version: 5, profiles: {} } })
    expect(() => requestProfile('image', getActiveApiProfile(saved))).toThrow('已撤销')
  })
  it('multiple assignments retain distinct names and metadata without exporting connection secrets', () => {
    setPlatformStateForTests({ ...initial, connections: { ...config, managedProfiles: [{ ...assigned, name: '公司一', purpose: 'image', isDefault: true }, { ...assigned, id: 'other-image', name: '公司二', purpose: 'image' }, { ...config.profiles.planner!, purpose: 'planner', isDefault: true }] } })
    const settings = normalizeSettings(DEFAULT_SETTINGS)
    const names = settings.profiles.filter(p => p.source === 'assigned').map(p => p.name)
    expect(names).toContain('公司一'); expect(names).toContain('公司二')
    const selected = normalizeSettings({ ...settings, activeProfileId: 'managed-other-image' })
    expect(getActiveApiProfile(selected).name).toBe('公司二')
    expect(JSON.stringify(selected)).not.toContain('assigned-private-key')
  })
  it('managed overrides cannot replace credentials or inject invalid option shapes', () => {
    const patch = optionOverrides({ model: 'new-model', timeout: 99999, apiKey: 'attacker', baseUrl: 'https://attacker.example', provider: 'fal', streamImages: 'not-boolean' } as unknown as Partial<typeof assigned>)
    expect(patch).toEqual({ model: 'new-model', timeout: 600 })
    const p = getActiveApiProfile(DEFAULT_SETTINGS)
    expect(() => requestProfile('image', { ...p, model: 'https://attacker.example' })).toThrow('模型 ID')
  })
})
