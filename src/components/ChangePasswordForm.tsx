import { useState } from 'react'
import { platformRequest } from '../lib/platform'
import { SETTINGS_CARD, SETTINGS_INPUT, SETTINGS_PRIMARY } from './ApiProfileEditor'

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false)
  return <section className={`${SETTINGS_CARD} space-y-4`}>
    <div><h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">修改登录密码</h3><p className="mt-1.5 text-xs leading-relaxed text-gray-400">过渡期入口，与本站 New API 账户同步。修改成功后需要重新登录，不影响已分配的 API 配置。</p></div>
    {done ? <div className="space-y-3"><p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">密码已修改，旧工作台会话已失效。请使用新密码登录。</p><button type="button" className={SETTINGS_PRIMARY} onClick={() => window.location.reload()}>返回登录</button></div> : <form className="space-y-3" onSubmit={async e => {
      e.preventDefault(); setError('')
      if (!currentPassword) { setError('请输入当前密码'); return }
      if ([...newPassword].length < 8 || [...newPassword].length > 128 || new TextEncoder().encode(newPassword).length > 72) { setError('新密码需为 8–128 个字符，UTF-8 长度不超过 72 字节（建议使用英文、数字与符号）'); return }
      if (newPassword !== confirmPassword) { setError('两次输入的新密码不一致'); return }
      if (currentPassword === newPassword) { setError('新密码不能与当前密码相同'); return }
      setBusy(true)
      try { await platformRequest('/studio-api/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }); setDone(true) }
      catch (err) { setError(err instanceof Error ? err.message : '修改失败，请稍后再试') }
      finally { setBusy(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }
    }}>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block"><span className="mb-1.5 block text-xs text-gray-500">当前密码</span><input className={SETTINGS_INPUT} aria-label="当前密码" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1.5 block text-xs text-gray-500">新密码</span><input className={SETTINGS_INPUT} aria-label="新密码" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required /></label><label className="block"><span className="mb-1.5 block text-xs text-gray-500">确认新密码</span><input className={SETTINGS_INPUT} aria-label="确认新密码" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></label></div>
        <button className={SETTINGS_PRIMARY} type="submit" aria-busy={busy}>{busy ? '正在修改…' : '确认修改密码'}</button>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
    </form>}
  </section>
}
