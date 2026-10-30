import { useId, useState, type FormEvent, type ReactNode, type SVGProps } from 'react'
import './login-screen.css'

type IconName = 'user' | 'lock' | 'arrow' | 'eye' | 'eye-off' | 'info' | 'sparkle'
function LoginIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    'eye-off': <><path d="m3 3 18 18M10 5.2A13 13 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.2 6.2A19 19 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.5-1.3M10 10a3 3 0 0 0 4 4" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 10v6M12 7h.01" /></>,
    sparkle: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="M20 2v4m-2-2h4" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}

// A code-native product study, not a generated result or a preview of private user data.
function ProductStudy() {
  const id = useId().replace(/:/g, '')
  return <svg className="login-product-study" viewBox="0 0 520 340" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-body`} x1="232" y1="90" x2="349" y2="245" gradientUnits="userSpaceOnUse"><stop stopColor="#bac8bb" /><stop offset=".38" stopColor="#dbe2d5" /><stop offset=".65" stopColor="#c4cebe" /><stop offset="1" stopColor="#8d9e8e" /></linearGradient>
      <linearGradient id={`${id}-lid`} x1="245" y1="65" x2="329" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#596c61" /><stop offset=".45" stopColor="#819587" /><stop offset="1" stopColor="#42564b" /></linearGradient>
      <linearGradient id={`${id}-floor`} x1="260" y1="225" x2="260" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="#e7ebe1" /><stop offset="1" stopColor="#f2f2e9" /></linearGradient>
      <filter id={`${id}-shadow`} x="125" y="220" width="320" height="100"><feGaussianBlur stdDeviation="14" /></filter>
    </defs>
    <path fill="#e7ece4" d="M0 0h520v340H0z" />
    <circle cx="420" cy="45" r="170" fill="#f1f3eb" />
    <path d="M0 232 520 207v133H0V232Z" fill={`url(#${id}-floor)`} />
    <path d="m75 232 91-74 94 70-91 80-94-76Z" fill="#eef0e8" />
    <path d="m75 232 94 76v32H75V232Z" fill="#d8dfd3" />
    <path d="m169 308 91-80v112h-91v-32Z" fill="#e2e7db" />
    <ellipse cx="294" cy="264" rx="92" ry="13" fill="#788b76" opacity=".27" filter={`url(#${id}-shadow)`} />
    <path d="M250 87h73c12 0 21 10 20 22l-9 138c-1 15-15 24-47 24s-46-9-47-24l-10-138c-1-12 8-22 20-22Z" fill={`url(#${id}-body)`} />
    <path d="M339 117h12c24 0 30 17 27 38-3 24-18 44-43 44" stroke="#879b88" strokeWidth="15" />
    <path d="M339 116h12c24 0 30 17 27 38-3 24-18 44-43 44" stroke="#cbd5c6" strokeWidth="9" />
    <path d="M247 112c0 50 4 99 8 136" stroke="#edf0e7" strokeWidth="4" opacity=".65" strokeLinecap="round" />
    <ellipse cx="286" cy="92" rx="57" ry="14" fill="#aab9a8" />
    <rect x="231" y="72" width="110" height="22" rx="8" fill={`url(#${id}-lid)`} />
    <ellipse cx="286" cy="73" rx="55" ry="11" fill="#8a9c8d" />
    <ellipse cx="286" cy="72" rx="47" ry="7" fill="#657c6a" />
    <path d="m298 70 8-26" stroke="#b4c2ad" strokeWidth="9" strokeLinecap="round" />
    <path d="m300 67 7-24" stroke="#d4ddc9" strokeWidth="3" strokeLinecap="round" />
    <path d="M270 185h33M276 192h21" stroke="#657f6d" strokeWidth="1.7" strokeLinecap="round" opacity=".6" />
    <circle cx="287" cy="166" r="7" stroke="#657f6d" strokeWidth="1.5" opacity=".6" />
    <path d="M416 250c-21-18-14-45-7-62 21 21 28 41 7 62Z" fill="#879d82" /><path d="M416 250c4-31 25-45 45-49-4 24-18 47-45 49Z" fill="#a8b79c" /><path d="m413 271 4-34" stroke="#6d8668" strokeWidth="2" />
  </svg>
}

interface Props {
  ready: boolean
  connectionError: string
  onRetry: () => void
  onLogin: (username: string, password: string) => Promise<void>
}

export default function LoginScreen({ ready, connectionError, onRetry, onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const error = loginError || connectionError
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || busy) return
    if (!username.trim() || !password) { setLoginError('请输入用户名和密码。'); return }
    setBusy(true); setLoginError(''); setShowPassword(false)
    try { await onLogin(username.trim(), password) }
    catch (e) { setLoginError((e instanceof Error ? e.message : '暂时无法登录，请稍后重试').replace(/New API/g, '登录服务')); setBusy(false) }
  }
  return <main className="login-page">
    <header className="login-header">
      <div className="login-brand"><span className="login-brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="14" y="4" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" /><rect x="4" y="14" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" /><path d="m17 12 1.5 3.5L22 17l-3.5 1.5L17 22l-1.5-3.5L12 17l3.5-1.5L17 12Z" fill="currentColor" /></svg></span><span>亚马逊 AI 工作台<small>CONTENT STUDIO</small></span></div>
      <span className="login-header-caption">专注商品内容创作</span>
    </header>
    <div className="login-layout">
      <section className="login-intro" aria-labelledby="login-intro-title">
        <p className="login-eyebrow"><span />从商品信息，到完整内容</p>
        <h2 id="login-intro-title">好商品，<br />值得<span className="login-heading-accent">被看见。</span></h2>
        <p className="login-intro-copy">写好每一句文案，打磨每一张图片。<br />让 Listing 与 A+ 的创作，变得更从容。</p>
        <div className="login-artwork" aria-hidden="true">
          <div className="login-paper-back" />
          <div className="login-product-card"><div className="login-product-toolbar"><span className="login-frame-dots"><i /><i /><i /></span><span>PRODUCT STUDY</span><span>创作示意</span></div><ProductStudy /><div className="login-product-caption"><span>日常之物，也有自己的光。</span></div></div>
          <div className="login-artwork-label"><LoginIcon name="sparkle" /><div><strong>把想法，变成画面</strong><span>文案与视觉，在同一个工作台</span></div></div>
        </div>
        <div className="login-workflow"><span><b>01</b> Listing 文案</span><i /><span><b>02</b> 图片策划</span><i /><span><b>03</b> 生成与编辑</span></div>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-heading"><span className="login-form-eyebrow">WELCOME BACK</span><h1 id="login-title">欢迎回来</h1><p>登录工作台，继续你的下一次创作。</p></div>
        <form className="login-form" onSubmit={submit} aria-busy={busy}>
          <div className="login-field"><label htmlFor="studio-username">用户名</label><div className="login-input-wrap"><LoginIcon name="user" /><input id="studio-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={128} required disabled={busy} value={username} placeholder="输入你的工作台账号" onChange={e => { setUsername(e.target.value); setLoginError('') }} aria-describedby={error ? 'login-error' : undefined} /></div></div>
          <div className="login-field"><label htmlFor="studio-password">密码</label><div className="login-input-wrap"><LoginIcon name="lock" /><input id="studio-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={512} required disabled={busy} value={password} placeholder="输入登录密码" onChange={e => { setPassword(e.target.value); setLoginError('') }} onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))} onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)} aria-describedby={capsLock ? 'login-caps-lock' : error ? 'login-error' : undefined} /><button className="login-password-toggle" type="button" disabled={busy} aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} aria-controls="studio-password" onClick={() => setShowPassword(!showPassword)}><LoginIcon name={showPassword ? 'eye-off' : 'eye'} /></button></div>{capsLock && <p id="login-caps-lock" className="login-field-hint" role="status">大写锁定已开启</p>}</div>
          {error && <div id="login-error" role="alert" className="login-error"><LoginIcon name="info" /><div><p>{error}</p>{connectionError && <button type="button" onClick={() => { setLoginError(''); onRetry() }}>重新连接<LoginIcon name="arrow" /></button>}</div></div>}
          <button className="login-submit" type="submit" disabled={busy || !ready}>{busy || !ready && !connectionError ? <span className="login-spinner" aria-hidden="true" /> : null}<span>{busy ? '正在登录…' : !ready ? connectionError ? '等待连接恢复' : '正在连接工作台…' : '登录工作台'}</span>{!busy && ready && <LoginIcon name="arrow" />}</button>
        </form>
        <div className="login-form-footer"><span className="login-help-caption">使用管理员为你开通的本站账号</span><button className="login-help-button" type="button" aria-expanded={helpOpen} aria-controls="login-help" onClick={() => setHelpOpen(!helpOpen)}>没有账号或忘记密码？</button>{helpOpen && <p id="login-help" className="login-help-text">请联系站点管理员开通账号或重置密码。这里使用工作台账号，无需填写 API Key，也不要使用中转站的登录密码。</p>}</div>
      </section>
    </div>
    <footer className="login-footer"><span>文案 · 策划 · 生图 · 编辑</span><span>v{__APP_VERSION__}</span></footer>
  </main>
}
