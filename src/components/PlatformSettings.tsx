import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getPlatformState, subscribePlatform, getPlatformAccess, platformRequest, refreshConnections, logoutPlatform, type PlatformUser, type Purpose, type RoutePolicy } from '../lib/platform'
import type { AdminAccessSettings, ApiProfile } from '../types'
import { createDefaultOpenAIProfile } from '../lib/apiProfiles'
import ApiProfileEditor, { SETTINGS_INPUT as input, SETTINGS_CARD as card, SETTINGS_BUTTON as button, SETTINGS_PRIMARY as primary, SettingSwitch } from './ApiProfileEditor'
import Select from './Select'
import { Checkbox } from './Checkbox'
import { useStore } from '../store'
import { validateManagedProfileDrafts } from '../lib/managedProfileValidation'
import AdminUserTable from './AdminUserTable'
import ChangePasswordForm from './ChangePasswordForm'

interface Wallet { balance: number; currency: string; logs: Array<{ id: number; time: number; model: string; amount: number }> }
export function AccountSettings() {
  const platform = useSyncExternalStore(subscribePlatform, getPlatformState)
  const [wallet, setWallet] = useState<Wallet | null>(null), [error, setError] = useState('')
  const refresh = () => { setError(''); void platformRequest<Wallet>('/studio-api/me/wallet').then(setWallet).catch(e => setError(e.message)) }
  useEffect(refresh, [])
  return <div className="mx-auto max-w-3xl space-y-4">
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">已登录{(platform.user?.role || 0) >= 10 ? '管理员' : '用户'} · {platform.user?.displayName}</div>
    <section className={card}><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">本站钱包</h3><p className="my-4 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">{wallet ? `¥${wallet.balance.toLocaleString('zh-CN', { maximumFractionDigits: 4 })}` : '—'}</p><p className="mb-4 text-xs leading-relaxed text-gray-500">仅选择“本站”配置时扣本站余额。管理员配置和自定义直连不扣本站余额，额度由实际中转站管理。当前充值请联系管理员。</p><button className={button} onClick={refresh}>刷新余额与账单</button></section>
    {!!wallet?.logs.length && <section className={card}><h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">最近本站消费</h3><ul className="space-y-2 text-xs text-gray-500">{wallet.logs.map(log => <li key={log.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-gray-50/80 p-3 dark:bg-white/[0.03]"><span>{new Date(log.time * 1000).toLocaleString()} · {log.model}</span><span>¥{log.amount.toLocaleString('zh-CN', { maximumFractionDigits: 6 })}</span></li>)}</ul></section>}
    {platform.connections?.policy.allowPasswordChange && <ChangePasswordForm />}
    {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
    <button className={`${button} w-full`} onClick={() => void logoutPlatform().catch(e => setError(e.message))}>退出登录</button>
  </div>
}
function ModelOptions({ title, values, change }: { title: string; values: string[]; change: (values: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => { const value = draft.trim(); if (value && !values.includes(value)) change([...values, value]); setDraft('') }
  return <section className={card}><h4 className="mb-3 text-sm text-gray-700 dark:text-gray-200">{title}</h4><div className="flex gap-2"><input aria-label={title} className={input} value={draft} onChange={e => setDraft(e.target.value)} placeholder="输入模型 ID" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} /><button className={primary} onClick={add}>新增</button></div><ul className="mt-3 space-y-2">{values.map(value => <li key={value} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/70 px-3 py-2.5 text-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-200"><span className="min-w-0 break-all">{value}</span><button className="shrink-0 text-xs text-red-500 hover:text-red-600" onClick={() => change(values.filter(v => v !== value))}>删除</button></li>)}</ul><p className="mt-2 text-xs text-gray-400">作为推荐下拉项；用户也可手动输入服务支持的模型。</p></section>
}
type ManagedDraft = ApiProfile & { hasKey?: boolean }
interface BulkRow { userId: number; version: number; profileId: string; name: string; purpose: Purpose; baseUrl: string; selected?: boolean; apiKey?: string }
export function AdministratorSettings() {
  const platform = useSyncExternalStore(subscribePlatform, getPlatformState)
  const [access, setAccess] = useState(getPlatformAccess)
  const [policy, setPolicy] = useState<RoutePolicy>(platform.connections!.policy)
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null), [tableRevision, setTableRevision] = useState(0)
  const [savedDraft, setSavedDraft] = useState('[]')
  const editorHeading = useRef<HTMLDivElement>(null)
  const [target, setTarget] = useState(''), [loaded, setLoaded] = useState(''), [version, setVersion] = useState(0)
  const [profiles, setProfiles] = useState<ManagedDraft[]>([]), [editing, setEditing] = useState('')
  const [assignmentResult, setAssignmentResult] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [savingProfiles, setSavingProfiles] = useState(false)
  const [bulkKind, setBulkKind] = useState<Purpose>('image'), [bulkUrl, setBulkUrl] = useState(''), [rows, setRows] = useState<BulkRow[]>([]), [preview, setPreview] = useState(false)
  const admin = (platform.user?.role || 0) >= 10
  const editAccess = (patch: Partial<AdminAccessSettings>) => setAccess(current => ({ ...current, ...patch }))
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setNotice(''); try { await work() } catch(e) { setError(e instanceof Error ? e.message : '操作失败') } finally { setBusy(false) } }
  useEffect(() => { if (loaded) editorHeading.current?.scrollIntoView({ block: 'start', behavior: 'auto' }) }, [loaded, editing])
  if (!admin) return null
  const edited = profiles.find(p => p.id === editing)
  const newProfile = (purpose: Purpose) => {
    const defaultUrl = purpose === 'image' ? access.unifiedGuestImageApiUrlEnabled && access.unifiedGuestImageApiUrl : access.unifiedGuestPlannerApiUrlEnabled && access.unifiedGuestPlannerApiUrl
    const p = { ...createDefaultOpenAIProfile({ id: `admin-${crypto.randomUUID()}`, name: '管理员配置', baseUrl: defaultUrl || '', model: purpose === 'image' ? platform.connections!.proxy.imageModel : platform.connections!.proxy.plannerModel, apiMode: purpose === 'image' ? 'images' : platform.connections!.proxy.plannerApiMode }), purpose, isDefault: !profiles.some(v => v.purpose === purpose) }
    setProfiles([...profiles, p]); setEditing(p.id)
  }
  const editUser = (user: PlatformUser, purpose: Purpose) => {
    if (loaded && JSON.stringify(profiles) !== savedDraft && !window.confirm('当前用户配置尚未保存。放弃这些修改并切换配置？')) return
    void run(async () => {
      const data = await platformRequest<{ managedProfiles: ManagedDraft[]; version: number }>(`/studio-api/admin/users/${user.id}/connections`)
      setAssignmentResult(null); setSelectedUser(user); setTarget(String(user.id)); setLoaded(String(user.id)); setVersion(data.version)
      setSavedDraft(JSON.stringify(data.managedProfiles))
      const existing = data.managedProfiles.find(p => p.purpose === purpose && p.isDefault) || data.managedProfiles.find(p => p.purpose === purpose)
      if (existing) { setProfiles(data.managedProfiles); setEditing(existing.id) }
      else {
        const defaultUrl = purpose === 'image' ? access.unifiedGuestImageApiUrlEnabled && access.unifiedGuestImageApiUrl : access.unifiedGuestPlannerApiUrlEnabled && access.unifiedGuestPlannerApiUrl
        const draft = { ...createDefaultOpenAIProfile({ id: `admin-${crypto.randomUUID()}`, name: '管理员配置', baseUrl: defaultUrl || '', model: purpose === 'image' ? platform.connections!.proxy.imageModel : platform.connections!.proxy.plannerModel, apiMode: purpose === 'image' ? 'images' : platform.connections!.proxy.plannerApiMode }), purpose, isDefault: true }
        setProfiles([...data.managedProfiles, draft]); setEditing(draft.id)
      }
    })
  }
  const saveProfiles = async () => {
    setAssignmentResult(null)
    const validation = validateManagedProfileDrafts(profiles)
    if (validation) { setAssignmentResult({ kind: 'error', text: validation }); return }
    setBusy(true); setSavingProfiles(true)
    try {
      const result = await platformRequest<{ version: number }>(`/studio-api/admin/users/${target}/connections`, { method: 'PUT', body: JSON.stringify({ managedProfiles: profiles, version }) })
      // A successful PUT is committed even if a subsequent refresh fails.
      setVersion(result.version)
      const masked = profiles.map(p => ({ ...p, hasKey: !!p.apiKey.trim() || !!p.hasKey, apiKey: '' }))
      setProfiles(masked); setSavedDraft(JSON.stringify(masked)); setTableRevision(n => n + 1)
      setAssignmentResult({ kind: 'success', text: '用户配置已保存。用户刷新页面后可在「设置 → API 配置」中选择；自选模型和高级选项不会被覆盖。' })
      try {
        const data = await platformRequest<{ managedProfiles: ManagedDraft[]; version: number }>(`/studio-api/admin/users/${target}/connections`)
        setProfiles(data.managedProfiles); setVersion(data.version); setSavedDraft(JSON.stringify(data.managedProfiles))
        await refreshConnections()
      } catch {
        setAssignmentResult({ kind: 'success', text: '用户配置已保存，但页面同步失败。请重新加载用户配置确认，无需重复提交。' })
      }
    } catch (e) {
      setAssignmentResult({ kind: 'error', text: e instanceof Error ? e.message : '保存失败，请稍后重试。' })
    } finally { setBusy(false); setSavingProfiles(false) }
  }
  const refreshUserTable = () => {
    if (loaded && JSON.stringify(profiles) !== savedDraft && !window.confirm('当前配置尚未保存。放弃修改并从后台刷新？')) return false
    if (loaded) void run(async () => {
      const data = await platformRequest<{ managedProfiles: ManagedDraft[]; version: number }>(`/studio-api/admin/users/${loaded}/connections`)
      setProfiles(data.managedProfiles); setSavedDraft(JSON.stringify(data.managedProfiles)); setVersion(data.version)
      setEditing(data.managedProfiles.some(p => p.id === editing) ? editing : data.managedProfiles[0]?.id || '')
      setAssignmentResult({ kind: 'success', text: '已重新加载该用户的配置。' })
    })
    return true
  }
  const permissionFields: Array<[keyof AdminAccessSettings, string]> = [
    ['allowGuestEditApiUrl', '允许普通用户修改 API 请求地址'], ['allowGuestViewApiUrl', '允许普通用户查看 API 请求地址'],
    ['allowGuestCreateApiProfile', '允许普通用户创建新 API 配置'], ['allowGuestEditApiProvider', '允许普通用户修改服务商类型'], ['allowGuestCreateCustomProvider', '允许普通用户创建自定义服务商'],
  ]
  return <div className="space-y-6">
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">已登录管理员</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}
    <section className="space-y-3"><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">站点权限</h3>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className={card}><SettingSwitch label="默认走直连配置" value={policy.defaultDirect} onChange={defaultDirect => setPolicy({ ...policy, defaultDirect })} /><p className="mt-2 text-xs text-gray-400">只决定初次进入的默认配置，不覆盖用户已选配置。</p></div>
        <div className={card}><SettingSwitch label="允许用户配置自定义直连配置" value={policy.allowCustomDirect} onChange={allowCustomDirect => setPolicy({ ...policy, allowCustomDirect })} /></div>
        <div className={card}><SettingSwitch label="允许在工作台修改密码（过渡期）" value={!!policy.allowPasswordChange} onChange={allowPasswordChange => setPolicy({ ...policy, allowPasswordChange })} /><p className="mt-2 text-xs leading-relaxed text-gray-400">保存站点设置后生效。关闭后隐藏账户页入口，后台也拒绝修改密码请求；之后可引导用户到 New API 处理。</p></div>
        {permissionFields.map(([key, label]) => <div key={key} className={card}><SettingSwitch label={label} value={!!access[key]} onChange={value => editAccess({ [key]: value })} /></div>)}
      </div>
      <p className="text-xs leading-relaxed text-gray-400">地址／服务商权限适用于用户自己的配置。管理员配置及本站配置始终隐藏连接信息；“创建新配置”控制用户创建，自定义直连另受总开关限制。</p>
      <div className="grid gap-3 xl:grid-cols-2">{(['planner','image'] as const).map(kind => {
        const enabledKey = kind === 'image' ? 'unifiedGuestImageApiUrlEnabled' : 'unifiedGuestPlannerApiUrlEnabled'
        const urlKey = kind === 'image' ? 'unifiedGuestImageApiUrl' : 'unifiedGuestPlannerApiUrl'
        return <div key={kind} className={`${card} space-y-3`}><SettingSwitch label={`统一管理员 AI ${kind === 'image' ? '生图' : '策划'} API URL`} value={access[enabledKey]} onChange={value => editAccess({ [enabledKey]: value })} />{access[enabledKey] && <input aria-label={`${kind === 'image' ? '生图' : '策划'}统一 URL`} className={input} value={access[urlKey]} onChange={e => editAccess({ [urlKey]: e.target.value })} />}<p className="text-xs leading-relaxed text-gray-400">用于新增管理员配置的默认地址。已有配置请使用下方批量更换，填写各自新 Key 后确认；不影响用户自定义配置。关闭开关不撤回已经提交的批量更换。</p></div>
      })}</div>
      <div className="grid gap-3 xl:grid-cols-2"><label className={card}><span className="mb-3 block text-sm text-gray-700 dark:text-gray-200">上传参考图上限数量</span><input aria-label="上传参考图上限数量" className={input} type="number" min={1} max={64} value={access.referenceImageUploadLimit} onChange={e => editAccess({ referenceImageUploadLimit: Math.max(1, Math.min(64, Number(e.target.value) || 1)) })} /></label><label className={card}><span className="mb-3 block text-sm text-gray-700 dark:text-gray-200">免广告余额阈值（元）</span><input aria-label="免广告余额阈值" className={input} type="number" min={0} step="0.01" value={policy.adFreeThresholdCny} onChange={e => setPolicy({ ...policy, adFreeThresholdCny: Number(e.target.value) })} /><span className="mt-2 block text-xs text-gray-400">严格大于此值享受权益；尚未启用广告投放。</span></label></div>
      <div className="grid gap-3 xl:grid-cols-2"><ModelOptions title="图片模型下拉选项" values={access.modelIds} change={modelIds => editAccess({ modelIds })} /><ModelOptions title="策划模型下拉选项" values={access.plannerModelIds} change={plannerModelIds => editAccess({ plannerModelIds })} /></div>
      <button disabled={busy} className={primary} onClick={() => void run(async () => { await platformRequest('/admin-api/settings', { method: 'PUT', body: JSON.stringify({ adminAccess: access }) }); await platformRequest('/studio-api/admin/policy', { method: 'PUT', body: JSON.stringify(policy) }); await refreshConnections(); await useStore.getState().syncAdminAccess(); setNotice('站点权限与推荐模型已保存') })}>保存站点设置</button>
    </section>
    <fieldset disabled={busy} className={`${card} min-w-0 space-y-4`} onChange={() => setAssignmentResult(null)}><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">给用户分配配置</h3><p className="text-xs text-gray-400">账户创建、禁用和人工加款仍在自己的 New API 管理端操作。每种用途可分配多份配置，保存后自动出现在用户的 API 配置列表。保存会提交该用户的全部配置，请确保每份配置均已填完整。</p>
      <AdminUserTable selectedId={target} busy={busy} revision={tableRevision} onEdit={editUser} onRefresh={refreshUserTable} />
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      {loaded && loaded === target && <>
        <div ref={editorHeading} className="scroll-mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50/70 px-4 py-3 dark:bg-blue-500/10"><div><p className="text-sm font-semibold text-blue-700 dark:text-blue-200">正在编辑 · {selectedUser?.displayName || selectedUser?.username}</p><p className="mt-1 text-xs text-blue-500">@{selectedUser?.username} · 用户 #{target}</p></div><span className="text-xs text-blue-500">{JSON.stringify(profiles) !== savedDraft ? '有未保存的修改' : '已与后台同步'}</span></div>
        <div className="flex flex-wrap gap-2"><button className={button} onClick={() => newProfile('image')}>新增生图配置</button><button className={button} onClick={() => newProfile('planner')}>新增策划配置</button></div>
        {!!profiles.length && <Select ariaLabel="编辑已分配配置" className={input} value={editing} onChange={value => setEditing(String(value))} options={profiles.map(p => ({ label: `${p.purpose === 'image' ? '生图' : '策划'} · ${p.name}${p.isDefault ? ' · 默认' : ''}`, value: p.id }))} />}
        {edited && <div className="rounded-2xl bg-gray-50/60 p-4 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3"><Checkbox label="作为此用途的初始默认配置" checked={!!edited.isDefault} onChange={value => setProfiles(profiles.map(p => p.purpose === edited.purpose ? { ...p, isDefault: p.id === edited.id ? value : false } : p))} /><button className="text-xs text-red-500" onClick={() => { setProfiles(profiles.filter(p => p.id !== edited.id)); setEditing(profiles.find(p => p.id !== edited.id)?.id || '') }}>撤销这份配置</button></div>
          <ApiProfileEditor key={edited.id} profile={edited} purpose={edited.purpose!} existingKey={edited.hasKey} modelOptions={edited.purpose === 'image' ? access.modelIds : access.plannerModelIds} onChange={patch => setProfiles(profiles.map(p => p.id === edited.id ? { ...p, ...patch } : p))} />
        </div>}
        <div className="space-y-3">
          <button type="button" disabled={busy} aria-busy={savingProfiles} className={primary} onClick={() => void saveProfiles()}>{savingProfiles ? '正在保存…' : '保存用户配置'}</button>
          {assignmentResult && <p role={assignmentResult.kind === 'error' ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm leading-relaxed ${assignmentResult.kind === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>{assignmentResult.text}</p>}
        </div>
      </>}
    </fieldset>
    <section className={`${card} space-y-4`}><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">批量更换管理员配置的中转站</h3><p className="text-xs leading-relaxed text-gray-400">只更新所选管理员配置，不修改用户自定义配置。每行填写独立的新 Key，预览后再提交；缺少 Key 或版本冲突会整批拒绝。</p>
      <div className="flex flex-wrap gap-2"><Select ariaLabel="批量用途" className={input} value={bulkKind} options={[{ label: '生图配置', value: 'image' }, { label: '策划配置', value: 'planner' }]} onChange={value => { setBulkKind(value); setRows([]); setPreview(false) }} /><button className={button} disabled={busy} onClick={() => void run(async () => { const data = await platformRequest<{rows: BulkRow[]}>('/studio-api/admin/connections'); setRows(data.rows.filter(r => r.purpose === bulkKind).map(r => ({ ...r, selected: true, apiKey: '' }))); setBulkUrl(bulkKind === 'image' ? access.unifiedGuestImageApiUrl : access.unifiedGuestPlannerApiUrl); setPreview(false) })}>加载受影响配置</button></div>
      {!!rows.length && <><label className="block"><span className="mb-2 block text-xs text-gray-500">新的统一地址</span><input aria-label="批量新 URL" className={input} value={bulkUrl} onChange={e => { setBulkUrl(e.target.value); setPreview(false) }} /></label><div className="space-y-3">{rows.map((row, index) => <div key={`${row.userId}:${row.profileId}`} className="rounded-xl border border-gray-200/60 p-3 dark:border-white/[0.06]"><Checkbox label={`用户 #${row.userId} · ${row.name}`} checked={!!row.selected} onChange={selected => { setRows(rows.map((r, i) => i === index ? { ...r, selected } : r)); setPreview(false) }} /><p className="my-2 break-all text-xs text-gray-400">{row.baseUrl} → {bulkUrl || '待填写'}</p><input aria-label={`用户 ${row.userId} 配置 ${row.name} 新 Key`} className={input} type="password" autoComplete="new-password" value={row.apiKey || ''} placeholder="这个用户的新个人 Key（必填）" disabled={!row.selected} onChange={e => { setRows(rows.map((r, i) => i === index ? { ...r, apiKey: e.target.value } : r)); setPreview(false) }} /></div>)}</div>
        {preview && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">预览验证通过：将更新 {rows.filter(r => r.selected).length} 份管理员配置的地址及个人 Key；用户自己的配置保持不变。</p>}
        <button disabled={busy || !rows.some(r => r.selected)} className={primary} onClick={() => void run(async () => { const selected = rows.filter(r => r.selected); if (selected.some(r => !r.apiKey?.trim()) || !bulkUrl.trim()) throw new Error('请为每份选中的配置填写新 Key 和新 URL'); await platformRequest('/studio-api/admin/connections/bulk', { method: 'POST', body: JSON.stringify({ preview: !preview, rows: selected.map(r => ({ userId: r.userId, profileId: r.profileId, version: r.version, baseUrl: bulkUrl.trim(), apiKey: r.apiKey })) }) }); if (!preview) { setPreview(true); setNotice('请检查上方变更预览，再确认提交') } else { setRows([]); setPreview(false); setLoaded(''); setProfiles([]); await refreshConnections(); setNotice('批量变更已完成') } })}>{preview ? '确认批量更换' : '预览批量变更'}</button>
      </>}
    </section>
  </div>
}
