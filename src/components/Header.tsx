import { lazy, Suspense, useEffect, useState } from 'react'
import { useStore } from '../store'
import { useTooltip } from '../hooks/useTooltip'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import { navigateToAppPage } from '../lib/appNavigation'
import ViewportTooltip from './ViewportTooltip'
import { HelpCircleIcon, InstallIcon, SettingsIcon } from './icons'

const HelpModal = lazy(() => import('./HelpModal'))

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isInstalledPwa() {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}


export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const appPage = useStore((s) => s.appPage)
  const setAppPage = useStore((s) => s.setAppPage)
  const [showHelp, setShowHelp] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isPwaInstalled, setIsPwaInstalled] = useState(isInstalledPwa)

  const installTooltip = useTooltip()
  const helpTooltip = useTooltip()
  const settingsTooltip = useTooltip()

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
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
          <h1 className="min-w-0 shrink-0 pr-1">
            <span className="text-sm font-bold tracking-tight text-gray-800 transition-colors hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300 sm:hidden">亚马逊AI</span>
            <span className="hidden text-lg font-bold tracking-tight text-gray-800 transition-colors hover:text-gray-600 dark:text-gray-100 dark:hover:text-gray-300 sm:inline">亚马逊AI工作台</span>
          </h1>
          <nav aria-label="主导航" className="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
            {([
              { page: 'home' as const, label: '首页' },
              { page: 'listing-copy' as const, label: 'Listing 文案' },
              { page: 'editor' as const, label: '图片编辑' },
            ]).map(({ page, label }) => {
              const active = appPage === page
              return (
                <button
                  key={page}
                  type="button"
                  data-app-page={page}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setAppPage(page)
                    navigateToAppPage(page)
                  }}
                  className={`shrink-0 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-3.5 sm:text-sm ${active
                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-gray-200'
                    }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isPwaInstalled && (
              <div
                className="relative hidden sm:block"
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
                aria-label="使用文档"
              >
                <HelpCircleIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <ViewportTooltip visible={helpTooltip.visible} className="whitespace-nowrap">
                使用文档
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
          </div>
        </div>
      </header>

      <div className="safe-area-top invisible pointer-events-none" aria-hidden="true">
        <div className="safe-header-inner" />
      </div>
      {showHelp && (
        <Suspense fallback={null}>
          <HelpModal onClose={() => setShowHelp(false)} />
        </Suspense>
      )}
    </>
  )
}
