import type { ApiProfile, AdminAccessSettings, CustomProviderDefinition } from '../types'
import { readRuntimeEnv } from './runtimeEnv'

export type Purpose = 'image' | 'planner'
export type RouteSelection = 'assigned' | 'custom' | 'proxy'
export interface RoutePolicy { defaultDirect: boolean; allowCustomDirect: boolean; adFreeThresholdCny: number; allowPasswordChange?: boolean }
export interface PlatformUser { id: number; username: string; displayName: string; role: number }
export interface Connections {
  profiles: Partial<Record<Purpose, ApiProfile>>; version: number; policy: RoutePolicy
  managedProfiles?: ApiProfile[]
  adminAccess?: Partial<AdminAccessSettings>
  proxy: { imageModel: string; plannerModel: string; plannerApiMode: 'chat' | 'responses' }
}
interface PlatformState { enabled: boolean; user: PlatformUser | null; csrf: string; connections: Connections | null; selections: Partial<Record<Purpose, RouteSelection>> }
let state: PlatformState = { enabled: readRuntimeEnv(import.meta.env?.VITE_PLATFORM_ENABLED) === 'true', user: null, csrf: '', connections: null, selections: {} }
const listeners = new Set<() => void>()
export const getPlatformState = () => state
export const subscribePlatform = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
function update(patch: Partial<PlatformState>) { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
export const accountStorageKey = (key: string) => state.enabled ? `${key}:user:${state.user?.id ?? 'guest'}` : key

export async function platformRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'same-origin', cache: 'no-store', headers: {
    'Content-Type': 'application/json', 'X-Studio-CSRF': state.csrf, ...(state.user ? { 'X-Studio-User': String(state.user.id) } : {}), ...init.headers,
  } })
  if ((response.status === 401 || response.status === 409) && state.user) {
    update({ user: null, csrf: '', connections: null, selections: {} })
    window.location.reload()
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error || `请求失败：${response.status}`), { status: response.status })
  return data
}
export async function bootstrapPlatform() {
  if (!state.enabled) return
  try {
    const session = await platformRequest<{ user: PlatformUser; csrf: string }>('/studio-api/session')
    update(session)
    let selections: Record<string, unknown> = {}
    try { selections = JSON.parse(localStorage.getItem(accountStorageKey('studio.routes')) || '{}') || {} } catch { /* Ignore a corrupt preference; never infer a paid route. */ }
    update({ selections: Object.fromEntries(Object.entries(selections).filter(([kind, v]) => ['image', 'planner'].includes(kind) && ['assigned', 'custom', 'proxy'].includes(String(v)))) })
    await refreshConnections()
  } catch (error) { if (state.user || (error as { status?: number }).status !== 401) throw error }
}
export async function refreshConnections() {
  if (!state.enabled || !state.user) return
  const session = await platformRequest<{ user: PlatformUser; csrf: string }>('/studio-api/session')
  if (session.user.id !== state.user.id) { update({ user: null, connections: null, csrf: '', selections: {} }); window.location.reload(); return }
  update(session)
  const connections = await platformRequest<Connections>('/studio-api/me/connections')
  update({ connections })
}
export async function loginPlatform(username: string, password: string) {
  await platformRequest('/studio-api/session', { method: 'POST', body: JSON.stringify({ username, password }) })
  try { localStorage.setItem('studio.auth-event', String(Date.now())) } catch { /* Login still works when storage is unavailable. */ }
  window.location.reload()
}
export async function logoutPlatform() {
  await platformRequest('/studio-api/session', { method: 'DELETE' })
  update({ user: null, csrf: '', connections: null, selections: {} })
  try { localStorage.setItem('studio.auth-event', String(Date.now())) } catch { /* The server session is already revoked. */ }
  window.location.reload()
}
export function selectRoute(kind: Purpose, route: RouteSelection) {
  const selections = { ...state.selections, [kind]: route }
  try { localStorage.setItem(accountStorageKey('studio.routes'), JSON.stringify(selections)) } catch { /* Keep the explicit choice for this page session. */ }
  update({ selections })
}
export function selectedRoute(kind: Purpose): RouteSelection {
  return state.selections[kind] || (state.connections?.policy.defaultDirect !== false ? 'assigned' : 'proxy')
}
export function routeLabel(kind: Purpose) {
  const route = selectedRoute(kind)
  return route === 'proxy' ? '本站代理 · 扣本站余额' : route === 'custom' ? '自己的直连 · 不扣本站余额' : '管理员直连 · 不扣本站余额'
}
export const DEFAULT_PLATFORM_ACCESS: AdminAccessSettings = {
  allowGuestEditApiUrl: true, allowGuestViewApiUrl: true, allowGuestCreateApiProfile: true,
  allowGuestEditApiProvider: true, allowGuestCreateCustomProvider: true,
  unifiedGuestPlannerApiUrlEnabled: false, unifiedGuestPlannerApiUrl: '', unifiedGuestImageApiUrlEnabled: false, unifiedGuestImageApiUrl: '',
  referenceImageUploadLimit: 16, modelIds: [], plannerModelIds: [],
}
export const getPlatformAccess = () => ({ ...DEFAULT_PLATFORM_ACCESS, ...state.connections?.adminAccess })
export function getPlatformModelOptions(purpose: Purpose, currentModel = ''): string[] {
  const access = getPlatformAccess()
  const profiles = state.connections?.managedProfiles ?? Object.entries(state.connections?.profiles || {}).map(([kind, profile]) => ({ ...profile, purpose: kind }))
  const configured = purpose === 'image' ? access.modelIds : access.plannerModelIds
  const defaultModel = purpose === 'image' ? state.connections?.proxy.imageModel : state.connections?.proxy.plannerModel
  return [...new Set([
    ...(Array.isArray(configured) ? configured : []),
    ...profiles.filter(p => p.purpose === purpose).map(p => p.model),
    defaultModel, currentModel,
  ].filter((model): model is string => typeof model === 'string' && !!model.trim()).map(model => model.trim()))]
}
export const MANAGED_OPTION_KEYS = ['model', 'apiMode', 'timeout', 'codexCli', 'responseFormatB64Json', 'streamImages', 'streamPartialImages', 'motherImageSupport', 'maxMotherSlices'] as const
export function optionOverrides(value: Partial<ApiProfile> = {}): ApiProfile['managedOverrides'] {
  const result: NonNullable<ApiProfile['managedOverrides']> = {}
  if (typeof value.model === 'string') result.model = value.model.slice(0, 256)
  if (value.apiMode && ['images','responses','chat'].includes(value.apiMode)) result.apiMode = value.apiMode
  for (const key of ['codexCli','responseFormatB64Json','streamImages'] as const) if (typeof value[key] === 'boolean') result[key] = value[key]
  if (typeof value.timeout === 'number' && Number.isFinite(value.timeout)) result.timeout = Math.min(600, Math.max(10, value.timeout))
  if (typeof value.streamPartialImages === 'number' && Number.isFinite(value.streamPartialImages)) result.streamPartialImages = Math.min(3, Math.max(0, Math.trunc(value.streamPartialImages)))
  if (typeof value.maxMotherSlices === 'number' && Number.isFinite(value.maxMotherSlices)) result.maxMotherSlices = Math.min(7, Math.max(2, Math.trunc(value.maxMotherSlices)))
  if (value.motherImageSupport && ['auto','supported','unsupported'].includes(value.motherImageSupport)) result.motherImageSupport = value.motherImageSupport
  return result
}
export function assignedProfiles(): ApiProfile[] {
  return state.connections?.managedProfiles || Object.entries(state.connections?.profiles || {}).map(([purpose, p]) => ({ ...p!, purpose: purpose as Purpose, isDefault: true }))
}
function assignedView(raw: ApiProfile, saved?: ApiProfile): ApiProfile {
  const overrides = optionOverrides(saved?.managedOverrides)
  return { ...raw, ...overrides, id: `managed-${raw.id}`, source: 'assigned', managedId: raw.id,
    name: raw.name || '管理员配置', provider: `managed-provider-${raw.id}`, baseUrl: '', apiKey: '', apiProxy: false,
    providerDrafts: undefined, customProvider: undefined, managedOverrides: overrides, unavailable: false,
  }
}
export function makeSiteProfile(kind: Purpose, id: string): ApiProfile {
  return { id, name: '本站', source: 'site', purpose: kind, provider: 'site', baseUrl: '', apiKey: '',
    model: kind === 'image' ? state.connections?.proxy.imageModel || '' : state.connections?.proxy.plannerModel || '',
    apiMode: kind === 'image' ? 'images' : state.connections?.proxy.plannerApiMode || 'responses',
    timeout: 600, apiProxy: false, codexCli: false, streamImages: false, streamPartialImages: 0,
  }
}
export function mergePlatformProfiles(input: { profiles: ApiProfile[]; activeProfileId: string; amazonPlannerProfileId: string; platformProfilesVersion?: number }) {
  if (!state.enabled) return input
  const managed = assignedProfiles()
  const oldManaged = input.profiles.filter(p => p.source === 'assigned')
  const own = input.profiles.filter(p => p.source !== 'assigned')
  const list = [...managed.map(p => assignedView(p, oldManaged.find(v => v.managedId === p.id))), ...own.map(p => p.source === 'site' ? { ...p, provider: 'site', baseUrl: '', apiKey: '', providerDrafts: undefined } : p)]
  // Keep revoked selected profiles as blocked references; never fall back to a charged route.
  for (const old of oldManaged) if (!list.some(p => p.id === old.id) && !(old.managedId?.startsWith('unassigned-') && managed.some(p => p.purpose === old.purpose))) list.push({ ...old, provider: `managed-provider-${old.managedId}`, baseUrl: '', apiKey: '', providerDrafts: undefined, unavailable: true })
  let activeProfileId = input.activeProfileId, amazonPlannerProfileId = input.amazonPlannerProfileId
  if (input.platformProfilesVersion !== 2) {
    for (const kind of ['image', 'planner'] as const) {
      const choice = state.selections[kind] || (state.connections?.policy.defaultDirect === false ? 'proxy' : 'assigned')
      let id = kind === 'image' ? activeProfileId : amazonPlannerProfileId
      if (choice === 'assigned') {
        const selected = managed.find(p => p.purpose === kind && p.isDefault) || managed.find(p => p.purpose === kind)
        if (selected) id = `managed-${selected.id}`
        else {
          id = `managed-unassigned-${kind}`
          list.push({ ...makeSiteProfile(kind, id), name: '管理员配置（尚未分配）', source: 'assigned', provider: 'managed', managedId: `unassigned-${kind}`, unavailable: true })
        }
      } else if (choice === 'proxy') { const p = makeSiteProfile(kind, `site-migrated-${kind}`); list.push(p); id = p.id }
      if (kind === 'image') activeProfileId = id; else amazonPlannerProfileId = id
    }
  }
  // A newly assigned default replaces only the empty onboarding placeholder, never a user selection.
  for (const kind of ['image','planner'] as const) {
    const key = kind === 'image' ? 'activeProfileId' : 'amazonPlannerProfileId'
    const id = key === 'activeProfileId' ? activeProfileId : amazonPlannerProfileId
    if (id === `managed-unassigned-${kind}`) {
      const p = managed.find(p => p.purpose === kind && p.isDefault) || managed.find(p => p.purpose === kind)
      if (p) { if (kind === 'image') activeProfileId = `managed-${p.id}`; else amazonPlannerProfileId = `managed-${p.id}` }
    }
  }
  return { profiles: list, activeProfileId, amazonPlannerProfileId, platformProfilesVersion: 2 }
}
export function displayProfile(kind: Purpose, local: ApiProfile): ApiProfile {
  if (!state.enabled) return local
  return { ...local, platformRoute: { purpose: kind, selection: local.source === 'assigned' ? 'assigned' : local.source === 'site' ? 'proxy' : 'custom', version: state.connections?.version || 0 } }
}
export function managedProviderDefinition(provider: string): CustomProviderDefinition | null {
  const raw = assignedProfiles().find(p => `managed-provider-${p.id}` === provider)
  return raw?.customProvider ? { ...raw.customProvider, id: provider } : null
}
/** Resolve adapter capabilities without putting connection data into UI/storage profiles. */
export function runtimeProvider(provider: string | undefined): string {
  if (provider === 'site') return 'openai'
  const raw = assignedProfiles().find(p => `managed-provider-${p.id}` === provider)
  return raw && !raw.customProvider ? raw.provider : provider || 'openai'
}
export function runtimeBaseUrl(profile: Pick<ApiProfile, 'provider' | 'baseUrl'>): string {
  return assignedProfiles().find(p => `managed-provider-${p.id}` === profile.provider)?.baseUrl || profile.baseUrl
}
const resolvedProfiles = new WeakSet<ApiProfile>()
export function requestProfile(kind: Purpose, input: ApiProfile): ApiProfile {
  if (!state.enabled || resolvedProfiles.has(input)) return input
  if (!state.user || !state.connections) throw new Error('请先登录，等待个人配置加载完成')
  let profile = displayProfile(kind, input)
  if (input.source === 'assigned') {
    const raw = assignedProfiles().find(p => p.id === input.managedId && p.purpose === kind)
    if (!raw) throw new Error('管理员配置尚未分配或已撤销，请在设置中选择其他配置')
    profile = { ...raw, ...optionOverrides(input.managedOverrides), ...optionOverrides(input), source: 'assigned', managedId: raw.id,
      id: input.id, provider: raw.customProvider ? `managed-provider-${raw.id}` : raw.provider, platformRoute: profile.platformRoute }
  } else if (input.source === 'site') {
    profile = { ...profile, provider: 'openai', baseUrl: '/studio-api/ai', apiKey: 'studio-session', apiProxy: false }
  } else {
    if (!state.connections.policy.allowCustomDirect && state.user.role < 10) throw new Error('管理员已关闭自定义直连，请选择管理员配置或本站配置')
    profile.apiProxy = false
  }
  if (!profile.apiKey || !profile.baseUrl || !profile.model) throw new Error('配置不完整，请在设置中填写配置或选择其他配置。本站配置消耗本站余额。')
  if ((input.source === 'assigned' || input.source === 'site') && /:\/\//.test(profile.model)) throw new Error('模型请填写模型 ID，不要填写请求 URL')
  if (profile.platformRoute?.selection !== 'proxy') {
    const url = new URL(profile.baseUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('平台直连必须使用不携带凭据和查询参数的 HTTPS URL')
    if (typeof window !== 'undefined' && url.origin === window.location.origin) throw new Error('直连目标不能指向本站，请选择中转站地址或明确使用代理模式')
  }
  resolvedProfiles.add(profile)
  return profile
}
export function profileHeaders(profile: ApiProfile): Record<string, string> {
  return state.enabled && profile.platformRoute?.selection === 'proxy'
    ? { 'X-Studio-CSRF': state.csrf, 'X-Studio-Purpose': profile.platformRoute.purpose, 'X-Studio-User': String(state.user?.id ?? '') }
    : { Authorization: `Bearer ${profile.apiKey}` }
}

// Test seam; never exported to the browser as an administrative API.
export function setPlatformStateForTests(value: PlatformState) { update(value) }
