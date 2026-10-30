import { PlatformError } from './newApiClient.mjs'
const fail = message => { throw new PlatformError(400, message) }
export function asManagedProfiles(value) {
  if (Array.isArray(value)) return value
  return Object.entries(value || {}).filter(([kind]) => ['image', 'planner'].includes(kind)).map(([purpose, p]) => ({ ...p, id: p.id || `assigned-${purpose}`, purpose, name: p.name || '管理员配置', isDefault: true }))
}
export function normalizeManagedProfiles(value, previous = []) {
  if (!value || typeof value !== 'object') fail('必须提供配置数组或兼容配置对象')
  const incoming = asManagedProfiles(value)
  if (incoming.length > 100) fail('单个用户最多分配 100 份配置')
  const ids = new Set()
  const result = incoming.map(p => {
    if (!p || !['image', 'planner'].includes(p.purpose) || typeof p.id !== 'string' || !/^[\w-]{1,100}$/.test(p.id) || ids.has(p.id)) fail('配置标识或用途无效／重复')
    ids.add(p.id)
    const old = previous.find(v => v.id === p.id)
    const provider = typeof p.provider === 'string' && p.provider ? p.provider : 'openai'
    const baseUrl = typeof p.baseUrl === 'string' ? p.baseUrl.trim().replace(/\/+$/, '') : ''
    let apiKey = typeof p.apiKey === 'string' ? p.apiKey.trim() : ''
    if (!apiKey && old) {
      if (baseUrl !== old.baseUrl.replace(/\/+$/, '') || provider !== old.provider) fail('更换地址或服务商时必须填写新 Key')
      apiKey = old.apiKey
    }
    let url; try { url = new URL(baseUrl) } catch { fail('API URL 无效') }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('直连 URL 必须为不含凭据、查询参数的 HTTPS 地址')
    if (!apiKey || apiKey.length > 4096 || typeof p.model !== 'string' || !p.model.trim() || p.model.length > 256) fail('配置需要个人 Key 和模型')
    const apiMode = p.apiMode || (p.purpose === 'image' ? 'images' : 'responses')
    if (!(p.purpose === 'image' ? ['images', 'responses', 'chat'] : ['responses', 'chat']).includes(apiMode)) fail('接口类型无效')
    if (provider !== 'openai' && provider !== 'fal') {
      if (!p.customProvider || typeof p.customProvider !== 'object' || !p.customProvider.submit?.path || typeof p.customProvider.name !== 'string') fail('自定义服务商需要完整的接口映射')
    }
    return {
      id: p.id, purpose: p.purpose, name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 100) : '管理员配置',
      provider, baseUrl, apiKey, model: p.model.trim(), apiMode, isDefault: p.isDefault === true,
      timeout: Math.min(600, Math.max(10, Number(p.timeout) || 600)), apiProxy: false,
      codexCli: !!p.codexCli, responseFormatB64Json: !!p.responseFormatB64Json, streamImages: !!p.streamImages,
      streamPartialImages: Math.min(3, Math.max(0, Math.trunc(Number(p.streamPartialImages) || 0))),
      motherImageSupport: ['supported','unsupported'].includes(p.motherImageSupport) ? p.motherImageSupport : 'auto',
      maxMotherSlices: Math.min(7, Math.max(2, Math.trunc(Number(p.maxMotherSlices) || 7))),
      ...(p.providerDrafts && typeof p.providerDrafts === 'object' ? { providerDrafts: p.providerDrafts } : {}),
      ...(provider !== 'openai' && provider !== 'fal' ? { customProvider: p.customProvider } : {}),
    }
  })
  for (const purpose of ['image', 'planner']) {
    const group = result.filter(p => p.purpose === purpose)
    if (group.filter(p => p.isDefault).length > 1) fail('每种用途只能有一份默认管理员配置')
    if (group.length && !group.some(p => p.isDefault)) group[0].isDefault = true
  }
  return result
}
export function legacyProfiles(profiles) {
  return Object.fromEntries(['image','planner'].flatMap(kind => {
    const p = profiles.find(v => v.purpose === kind && v.isDefault) || profiles.find(v => v.purpose === kind)
    return p ? [[kind, p]] : []
  }))
}
export function maskManagedProfiles(profiles) { return profiles.map(p => ({ ...p, apiKey: '', hasKey: !!p.apiKey })) }
