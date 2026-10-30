import { useState } from 'react'
import type { ApiProfile, CustomProviderDefinition } from '../types'
import { normalizeCustomProviderDefinition, switchApiProfileProvider } from '../lib/apiProfiles'
import Select from './Select'
import ModelIdInput from './ModelIdInput'

export const SETTINGS_INPUT = 'w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:ring-blue-500/20'
export const SETTINGS_CARD = 'rounded-2xl border border-gray-200/70 bg-white/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]'
export const SETTINGS_BUTTON = 'rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]'
export const SETTINGS_PRIMARY = 'rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40'
export function SettingSwitch({ label, value, onChange, disabled = false }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-sm text-gray-700 dark:text-gray-200">{label}</span><button type="button" role="switch" aria-label={label} aria-checked={value} disabled={disabled} onClick={() => onChange(!value)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${value ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} /></button></div>
}
export interface EditorPermissions { hideConnection?: boolean; showUrl?: boolean; editUrl?: boolean; editProvider?: boolean; editName?: boolean; editKey?: boolean; createProvider?: boolean }
interface Props {
  profile: ApiProfile; purpose: 'image' | 'planner'; onChange: (patch: Partial<ApiProfile>, commit?: boolean) => void
  modelOptions: string[]; permissions?: EditorPermissions; existingKey?: boolean
  providerOptions?: Array<{ label: string; value: string | number; variant?: 'action' | 'danger' }>
  onProviderChange?: (value: string) => void; onProviderReorder?: (source: string | number, target: string | number, position: 'before' | 'after' | null) => void; legacyProxy?: boolean
}
const template: CustomProviderDefinition = { id: 'custom-http', name: '自定义服务商', template: 'http-image', submit: { path: 'images/generations', method: 'POST', contentType: 'json', body: { model: '$profile.model', prompt: '$prompt', size: '$params.size', n: '$params.n' }, result: { imageUrlPaths: ['data.*.url'], b64JsonPaths: ['data.*.b64_json'] } } }

/** The same controlled editor is used for personal profiles and administrator assignments. */
export default function ApiProfileEditor({ profile: p, purpose, onChange, modelOptions, permissions = {}, existingKey, providerOptions, onProviderChange, onProviderReorder, legacyProxy }: Props) {
  const [visibleKey, setVisibleKey] = useState(false)
  const [manifest, setManifest] = useState<string | null>(null)
  const [error, setError] = useState('')
  const hidden = !!permissions.hideConnection
  const patch = (value: Partial<ApiProfile>) => onChange(value, true)
  const ownProviders = [{ label: 'OpenAI 兼容接口', value: 'openai' }, { label: 'fal.ai', value: 'fal' }, ...(p.customProvider ? [{ label: p.customProvider.name, value: p.provider }] : []), ...(permissions.createProvider !== false ? [{ label: '创建自定义服务商', value: '__custom__', variant: 'action' as const }] : [])]
  return <div className="mt-4 space-y-4 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
    <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">配置名称</span><input aria-label="配置名称" className={SETTINGS_INPUT} value={p.name} disabled={permissions.editName === false} onChange={e => onChange({ name: e.target.value })} onBlur={e => patch({ name: e.target.value })} /></label>
    {!hidden && <>
      <div><span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">服务商</span><Select ariaLabel="服务商" className={SETTINGS_INPUT} value={p.provider} disabled={permissions.editProvider === false} options={providerOptions || ownProviders} onReorder={onProviderReorder} onChange={value => {
        if (onProviderChange) { onProviderChange(String(value)); return }
        if (value === '__custom__') { setManifest(JSON.stringify(p.customProvider || template, null, 2)); return }
        patch(switchApiProfileProvider(p, String(value), p.customProvider?.id === value ? p.customProvider : undefined))
      }} /></div>
      {p.customProvider && permissions.createProvider !== false && <button type="button" className={SETTINGS_BUTTON} onClick={() => setManifest(JSON.stringify(p.customProvider, null, 2))}>编辑自定义服务商接口映射</button>}
      {permissions.showUrl !== false && <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">API URL</span><input aria-label="API URL" className={SETTINGS_INPUT} value={p.baseUrl} disabled={permissions.editUrl === false} placeholder="https://relay.example/v1" onChange={e => onChange({ baseUrl: e.target.value })} onBlur={e => patch({ baseUrl: e.target.value.trim() })} /></label>}
      <label className="block"><span className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">API Key</span><div className="relative"><input aria-label="API Key" className={`${SETTINGS_INPUT} pr-14`} type={visibleKey ? 'text' : 'password'} value={p.apiKey} disabled={permissions.editKey === false} autoComplete="new-password" placeholder={existingKey ? '已保存，留空保留；更换地址或服务商须填写新 Key' : 'sk-...'} onChange={e => onChange({ apiKey: e.target.value })} onBlur={e => patch({ apiKey: e.target.value.trim() })} /><button type="button" disabled={permissions.editKey === false} className="absolute right-3 top-3 text-xs text-gray-400 hover:text-blue-500" onClick={() => setVisibleKey(!visibleKey)}>{visibleKey ? '隐藏' : '显示'}</button></div></label>
    </>}
    {hidden && <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">{p.source === 'site' ? '通过本站提供服务，使用后扣本站余额。' : '连接由管理员维护，不能修改或导出连接信息。'}模型与下方高级设置可自行调整。</p>}
    <ModelIdInput label={purpose === 'image' ? '图片模型' : '策划模型'} value={p.model} options={modelOptions} placeholder="选择推荐模型或手动填写模型 ID" onChange={model => onChange({ model })} onCommit={model => patch({ model })} />
    <details open className={SETTINGS_CARD}>
      <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-200">高级设置<span className="ml-2 text-xs font-normal text-gray-400">{purpose === 'image' ? '生图专用' : '策划专用'}</span></summary>
      <div className="mt-4 space-y-4">
        <div><span className="mb-1.5 block text-xs text-gray-500 dark:text-gray-400">API 接口</span><Select ariaLabel="API 接口" className={SETTINGS_INPUT} value={p.apiMode} options={[...(purpose === 'image' ? [{ label: 'Images API', value: 'images' }] : []), { label: 'Responses API', value: 'responses' }, { label: 'Chat Completions', value: 'chat' }]} onChange={value => patch({ apiMode: value })} /></div>
        <SettingSwitch label="流式传输" value={!!p.streamImages} onChange={streamImages => patch({ streamImages })} />
        {purpose === 'image' && <div><span className="mb-1.5 block text-xs text-gray-500">生图中间步骤图片数</span><Select ariaLabel="生图中间步骤图片数" className={SETTINGS_INPUT} value={p.streamPartialImages ?? 0} disabled={!p.streamImages} options={[0,1,2,3].map(n => ({ label: n === 0 ? '0，不请求' : `${n} 张`, value: n }))} onChange={value => patch({ streamPartialImages: Number(value) })} /><p className="mt-1 text-xs text-gray-400">实际返回的中间图像可能产生额外费用。</p></div>}
        <SettingSwitch label="返回 Base64 图片数据" value={!!p.responseFormatB64Json} onChange={responseFormatB64Json => patch({ responseFormatB64Json })} />
        <SettingSwitch label="Codex CLI 兼容模式" value={!!p.codexCli} onChange={codexCli => patch({ codexCli })} />
        {purpose === 'image' && <div className="space-y-3"><span className="text-sm text-gray-600 dark:text-gray-300">高级 A+ 连续母图能力</span><Select ariaLabel="连续母图支持" className={SETTINGS_INPUT} value={p.motherImageSupport || 'auto'} options={[{ label: '自动尝试', value: 'auto' }, { label: '确认支持', value: 'supported' }, { label: '不支持', value: 'unsupported' }]} onChange={value => patch({ motherImageSupport: value })} /><Select ariaLabel="最大连续片数" className={SETTINGS_INPUT} value={p.maxMotherSlices || 7} disabled={p.motherImageSupport === 'unsupported'} options={[2,3,4,5,6,7].map(n => ({ label: `${n} 片`, value: n }))} onChange={value => patch({ maxMotherSlices: Number(value) })} /></div>}
        <label className="block"><span className="mb-1.5 block text-xs text-gray-500">请求超时（秒）</span><input aria-label="请求超时（秒）" type="number" min={10} max={600} className={SETTINGS_INPUT} value={p.timeout} onChange={e => onChange({ timeout: Number(e.target.value) })} onBlur={e => patch({ timeout: Math.max(10, Math.min(600, Number(e.target.value) || 600)) })} /></label>
        {legacyProxy && !hidden && <SettingSwitch label="API 代理" value={!!p.apiProxy} onChange={apiProxy => patch({ apiProxy })} />}
        <p className="text-xs leading-relaxed text-gray-400">参数是否支持由实际模型服务决定；高级设置不会改变所选配置的连接来源。</p>
      </div>
    </details>
    {manifest !== null && <div className={`${SETTINGS_CARD} space-y-3`}><h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">自定义服务商接口映射</h4><textarea aria-label="服务商 JSON" className={`${SETTINGS_INPUT} min-h-64 font-mono text-xs`} value={manifest} onChange={e => setManifest(e.target.value)} /><p className="text-xs text-gray-400">支持 submit、editSubmit、poll、字段模板和结果映射，与个人配置使用相同的 JSON 格式。Key 填在上方独立字段，不写入接口模板。</p>{error && <p role="alert" className="text-xs text-red-500">{error}</p>}<button type="button" className={SETTINGS_PRIMARY} onClick={() => { try { const spec = normalizeCustomProviderDefinition(JSON.parse(manifest)); if (!spec) throw new Error('接口定义无效'); patch({ provider: spec.id, customProvider: spec }); setManifest(null); setError('') } catch(e) { setError(e instanceof Error ? e.message : 'JSON 无效') } }}>保存接口映射</button><button type="button" className={`${SETTINGS_BUTTON} ml-2`} onClick={() => setManifest(null)}>取消</button></div>}
  </div>
}
