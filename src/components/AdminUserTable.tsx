import { useEffect, useState } from 'react'
import { platformRequest, type PlatformUser, type Purpose } from '../lib/platform'
import { SETTINGS_BUTTON, SETTINGS_INPUT } from './ApiProfileEditor'

type UserRow = PlatformUser & { assignmentCounts?: Record<Purpose, number> }
export default function AdminUserTable({ selectedId, busy, revision, onEdit, onRefresh }: { selectedId: string; busy: boolean; revision: number; onEdit: (user: PlatformUser, purpose: Purpose) => void; onRefresh: () => boolean }) {
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10)
  const [draft, setDraft] = useState(''), [query, setQuery] = useState('')
  const [items, setItems] = useState<UserRow[]>([]), [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: query })
    void platformRequest<{ items: UserRow[]; total: number }>(`/studio-api/admin/users?${params}`).then(data => {
      if (!active) return
      const lastPage = Math.max(1, Math.ceil(data.total / pageSize))
      if (page > lastPage) { setPage(lastPage); return }
      setItems(data.items); setTotal(data.total)
    }).catch(e => { if (active) { setError(e.message); setItems([]) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, pageSize, query, revision, reload])
  const search = () => { setPage(1); setQuery(draft.trim()); setReload(n => n + 1) }
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.02]">
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3 dark:border-white/[0.06]">
      <input aria-label="搜索用户" className={`${SETTINGS_INPUT} min-w-40 flex-1 sm:w-auto`} placeholder="搜索用户名、昵称或用户 ID" value={draft} maxLength={100} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search() } }} />
      <button type="button" className={SETTINGS_BUTTON} disabled={busy || loading} onClick={search}>搜索</button>
      <button type="button" className={SETTINGS_BUTTON} disabled={busy || loading} onClick={() => { setDraft(''); setQuery(''); setPage(1); setReload(n => n + 1) }}>重置</button>
      <button type="button" className={SETTINGS_BUTTON} disabled={busy || loading} onClick={() => { if (onRefresh()) setReload(n => n + 1) }}>刷新列表与配置</button>
    </div>
    <div className="overflow-x-auto" aria-busy={loading}>
      <table className="w-full min-w-[440px] text-left text-sm">
        <caption className="sr-only">用户配置管理列表</caption>
        <thead className="bg-gray-50/80 text-xs text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"><tr><th className="px-4 py-3 font-medium">用户</th><th className="px-3 py-3 font-medium">生图配置</th><th className="px-3 py-3 font-medium">策划配置</th></tr></thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
          {loading ? <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400" role="status">正在加载用户…</td></tr> : error ? <tr><td colSpan={3} className="p-4 text-red-500" role="alert">{error}<button type="button" className={`${SETTINGS_BUTTON} ml-3`} onClick={() => setReload(n => n + 1)}>重试</button></td></tr> : !items.length ? <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">{query ? '没有找到匹配用户，请尝试其他关键词。' : '暂无用户，请先在 New API 创建账户。'}</td></tr> : items.map(user => <tr key={user.id} className={`transition-colors ${selectedId === String(user.id) ? 'bg-blue-50/70 dark:bg-blue-500/10' : 'hover:bg-gray-50/70 dark:hover:bg-white/[0.03]'}`}>
            <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-500 dark:bg-blue-500/10">{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="max-w-52 truncate font-medium text-gray-800 dark:text-gray-100">{user.displayName || user.username}</p><p className="mt-0.5 max-w-52 truncate text-xs text-gray-400">@{user.username} · #{user.id}{user.role >= 10 ? ' · 管理员' : ''}</p></div></div></td>
            {(['image', 'planner'] as const).map(purpose => <td key={purpose} className="px-3 py-4"><p className="mb-2 text-xs text-gray-400">{user.assignmentCounts?.[purpose] ? `${user.assignmentCounts[purpose]} 份配置` : '未分配'}</p><button type="button" disabled={busy} aria-label={`配置${user.username}的${purpose === 'image' ? '生图' : '策划'}`} onClick={() => onEdit(user, purpose)} className={`${SETTINGS_BUTTON} !border-blue-200/60 !text-blue-600 dark:!border-blue-400/20 dark:!text-blue-300`}>{purpose === 'image' ? '配置生图' : '配置策划'} <span aria-hidden="true">↗</span></button></td>)}
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-white/[0.06]">
      <div className="flex items-center gap-2"><span>共 {total} 位用户</span><select aria-label="每页用户数" disabled={busy || loading} value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 dark:border-white/10">{[10, 20, 50].map(size => <option key={size} value={size}>{size} 位 / 页</option>)}</select></div>
      <div className="flex items-center gap-2"><button type="button" className={SETTINGS_BUTTON} disabled={busy || loading || page === 1} onClick={() => setPage(p => p - 1)}>上一页</button><span aria-live="polite">{page} / {pages}</span><button type="button" className={SETTINGS_BUTTON} disabled={busy || loading || page >= pages} onClick={() => setPage(p => p + 1)}>下一页</button></div>
    </div>
  </div>
}
