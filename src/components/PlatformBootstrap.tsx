import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { bootstrapPlatform, getPlatformState, loginPlatform, refreshConnections, subscribePlatform } from '../lib/platform'
import LoginScreen from './LoginScreen'

// Account namespace must be established before App/store/db modules are evaluated.
const App = lazy(() => import('../App'))
export default function PlatformBootstrap() {
  const state = useSyncExternalStore(subscribePlatform, getPlatformState)
  const [ready, setReady] = useState(!state.enabled)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setError(''); setReady(!state.enabled)
    bootstrapPlatform().then(() => { if (!cancelled) setReady(true) }).catch(() => { if (!cancelled) setError('暂时无法连接工作台，请稍后重试。') })
    return () => { cancelled = true }
  }, [attempt, state.enabled])
  useEffect(() => {
    if (!state.enabled || !state.user) return
    const refresh = () => { void refreshConnections().catch(() => {}) }
    const timer = setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    const sessionChanged = (event: StorageEvent) => { if (event.key === 'studio.auth-event') window.location.reload() }
    window.addEventListener('storage', sessionChanged)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', sessionChanged) }
  }, [state.enabled, state.user?.id])
  if (ready && (!state.enabled || state.user)) return <Suspense fallback={<main className="login-page login-loading" role="status"><div><span className="login-loading-ring" aria-hidden="true" /><strong>正在打开工作台</strong><p>为你的下一次创作做好准备</p></div></main>}><App /></Suspense>
  return <LoginScreen ready={ready} connectionError={error} onRetry={() => setAttempt(value => value + 1)} onLogin={loginPlatform} />
}
