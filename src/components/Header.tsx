import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useTooltip } from '../hooks/useTooltip'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import { loginAdmin, logoutAdmin, readAdminToken, saveAdminToken } from '../lib/adminApi'
import ViewportTooltip from './ViewportTooltip'
import HelpModal from './HelpModal'
import { HelpCircleIcon, InstallIcon, SettingsIcon } from './icons'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isInstalledPwa() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function AdminModal({ onClose }: { onClose: () => void }) {
  const adminAccess = useStore((s) => s.adminAccess)
  const isAdminAuthenticated = useStore((s) => s.isAdminAuthenticated)
  const setAdminAccess = useStore((s) => s.setAdminAccess)
  const setAdminAuthenticated = useStore((s) => s.setAdminAuthenticated)
  const syncAdminAccess = useStore((s) => s.syncAdminAccess)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  const handleLogin = async () => {
    setError('')
    setIsChecking(true)
    try {
      const result = await loginAdmin(username, password)
      saveAdminToken(result.token)
      setAdminAccess(result.adminAccess, { persist: false })
      setAdminAuthenticated(true)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsChecking(false)
    }
  }

  const handleLogout = async () => {
    const token = readAdminToken()
    saveAdminToken('')
    setAdminAuthenticated(false)
    await logoutAdmin(token).catch(() => {})
    await syncAdminAccess()
  }

  return (
    <div
      data-no-drag-select
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md dark:bg-black/40" />
      <div
        className="relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-5 shadow-[0_8px_40px_rgb(0,0,0,0.12)] ring-1 ring-black/5 dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">管理员</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.06]"
          >
            关闭
          </button>
        </div>

        {isAdminAuthenticated ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
              已登录管理员
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200/70 px-3 py-3 dark:border-white/[0.08]">
                <span className="text-sm text-gray-700 dark:text-gray-200">允许游客修改 API 请求地址</span>
                <button
                  type="button"
                  onClick={() => setAdminAccess({ allowGuestEditApiUrl: !adminAccess.allowGuestEditApiUrl })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminAccess.allowGuestEditApiUrl ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  role="switch"
                  aria-checked={adminAccess.allowGuestEditApiUrl}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adminAccess.allowGuestEditApiUrl ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200/70 px-3 py-3 dark:border-white/[0.08]">
                <span className="text-sm text-gray-700 dark:text-gray-200">允许游客查看 API 请求地址</span>
                <button
                  type="button"
                  onClick={() => setAdminAccess({ allowGuestViewApiUrl: !adminAccess.allowGuestViewApiUrl })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminAccess.allowGuestViewApiUrl ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  role="switch"
                  aria-checked={adminAccess.allowGuestViewApiUrl}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adminAccess.allowGuestViewApiUrl ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200/70 px-3 py-3 dark:border-white/[0.08]">
                <span className="text-sm text-gray-700 dark:text-gray-200">允许游客创建新 API 配置</span>
                <button
                  type="button"
                  onClick={() => setAdminAccess({ allowGuestCreateApiProfile: !adminAccess.allowGuestCreateApiProfile })}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminAccess.allowGuestCreateApiProfile ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  role="switch"
                  aria-checked={adminAccess.allowGuestCreateApiProfile}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adminAccess.allowGuestCreateApiProfile ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <div className="rounded-xl border border-gray-200/70 px-3 py-3 dark:border-white/[0.08]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700 dark:text-gray-200">统一游客 AI 策划 API URL</span>
                  <button
                    type="button"
                    onClick={() => setAdminAccess({ unifiedGuestPlannerApiUrlEnabled: !adminAccess.unifiedGuestPlannerApiUrlEnabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminAccess.unifiedGuestPlannerApiUrlEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    role="switch"
                    aria-checked={adminAccess.unifiedGuestPlannerApiUrlEnabled}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adminAccess.unifiedGuestPlannerApiUrlEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {adminAccess.unifiedGuestPlannerApiUrlEnabled && (
                  <input
                    value={adminAccess.unifiedGuestPlannerApiUrl}
                    onChange={(event) => setAdminAccess({ unifiedGuestPlannerApiUrl: event.target.value })}
                    type="text"
                    placeholder="https://api.example.com/v1"
                    className="mt-3 w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
                  />
                )}
              </div>
              <div className="rounded-xl border border-gray-200/70 px-3 py-3 dark:border-white/[0.08]">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-700 dark:text-gray-200">统一游客 AI 生图 API URL</span>
                  <button
                    type="button"
                    onClick={() => setAdminAccess({ unifiedGuestImageApiUrlEnabled: !adminAccess.unifiedGuestImageApiUrlEnabled })}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${adminAccess.unifiedGuestImageApiUrlEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                    role="switch"
                    aria-checked={adminAccess.unifiedGuestImageApiUrlEnabled}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adminAccess.unifiedGuestImageApiUrlEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {adminAccess.unifiedGuestImageApiUrlEnabled && (
                  <input
                    value={adminAccess.unifiedGuestImageApiUrl}
                    onChange={(event) => setAdminAccess({ unifiedGuestImageApiUrl: event.target.value })}
                    type="text"
                    placeholder="https://api.example.com/v1"
                    className="mt-3 w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
                  />
                )}
              </div>
              <label className="block rounded-xl border border-gray-200/70 px-3 py-3 dark:border-white/[0.08]">
                <span className="mb-2 block text-sm text-gray-700 dark:text-gray-200">上传参考图上限数量</span>
                <input
                  value={adminAccess.referenceImageUploadLimit}
                  onChange={(event) => setAdminAccess({ referenceImageUploadLimit: event.target.valueAsNumber })}
                  type="number"
                  min={1}
                  max={64}
                  step={1}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              退出管理员
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">账号</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                type="text"
                autoComplete="username"
                className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleLogin()
                }}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-xl border border-gray-200/70 bg-white/70 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200"
              />
            </label>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <button
              type="button"
              onClick={() => void handleLogin()}
              disabled={isChecking}
              className="w-full rounded-xl bg-blue-500 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChecking ? '登录中...' : '登录'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const isAdminAuthenticated = useStore((s) => s.isAdminAuthenticated)
  const [showHelp, setShowHelp] = useState(false)
  const [showAdmin, setShowAdmin] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPwaInstalled, setIsPwaInstalled] = useState(isInstalledPwa)

  const installTooltip = useTooltip()
  const helpTooltip = useTooltip()
  const settingsTooltip = useTooltip()
  const adminTooltip = useTooltip()

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setIsPwaInstalled(false)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsPwaInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (installPrompt) {
      const promptEvent = installPrompt
      setInstallPrompt(null)

      try {
        await promptEvent.prompt()
        const choice = await promptEvent.userChoice
        setIsPwaInstalled(choice.outcome === 'accepted')
      } catch {
        setIsPwaInstalled(isInstalledPwa())
      }
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      if (isIos) {
        setConfirmDialog({
          title: '安装为应用',
          message: '在 Safari 浏览器中，点击底部「分享」按钮，选择「添加到主屏幕」即可安装此应用。',
          showCancel: false,
          confirmText: '我知道了',
          icon: 'info',
          action: () => {},
        })
      } else {
        setConfirmDialog({
          title: '安装为应用',
          message: '请在浏览器的菜单中选择「添加到主屏幕」或「安装应用」。\n\n（如果在微信等内置浏览器中，请先在外部浏览器打开）',
          showCancel: false,
          confirmText: '我知道了',
          icon: 'info',
          action: () => {},
        })
      }
    }
  }

  return (
    <>
      <header data-no-drag-select className="safe-area-top fixed top-0 left-0 right-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/80">
        <div className="safe-area-x safe-header-inner mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="min-w-0 pr-3">
            <span className="text-[17px] font-bold tracking-tight text-gray-800 transition-colors hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300 sm:text-lg">
              亚马逊图片工作台
            </span>
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            {!isPwaInstalled && (
              <div
                className="relative"
                {...installTooltip.handlers}
              >
                <button
                  onClick={() => {
                    dismissAllTooltips()
                    handleInstallClick()
                  }}
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-900"
                  aria-label="安装为应用"
                >
                  <InstallIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
                <ViewportTooltip visible={installTooltip.visible} className="whitespace-nowrap">
                  安装为应用
                </ViewportTooltip>
              </div>
            )}
            <div
              className="relative"
              {...helpTooltip.handlers}
            >
              <button
                onClick={() => {
                  dismissAllTooltips()
                  setShowHelp(true)
                }}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-900"
                aria-label="操作指南"
              >
                <HelpCircleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <ViewportTooltip visible={helpTooltip.visible} className="whitespace-nowrap">
                操作指南
              </ViewportTooltip>
            </div>
            <div
              className="relative"
              {...settingsTooltip.handlers}
            >
              <button
                onClick={() => setShowSettings(true)}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-900"
                aria-label="设置"
              >
                <SettingsIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <ViewportTooltip visible={settingsTooltip.visible} className="whitespace-nowrap">
                设置
              </ViewportTooltip>
            </div>
            <div
              className="relative"
              {...adminTooltip.handlers}
            >
              <button
                onClick={() => {
                  dismissAllTooltips()
                  setShowAdmin(true)
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${isAdminAuthenticated ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900'}`}
                aria-label="管理员登录"
              >
                {isAdminAuthenticated ? '管理员' : '管理员登录'}
              </button>
              <ViewportTooltip visible={adminTooltip.visible} className="whitespace-nowrap">
                管理游客权限
              </ViewportTooltip>
            </div>
          </div>
        </div>
      </header>

      <div className="safe-area-top invisible pointer-events-none" aria-hidden="true">
        <div className="safe-header-inner" />
      </div>
      {showHelp && <HelpModal appMode="gallery" onClose={() => setShowHelp(false)} />}
      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
    </>
  )
}
