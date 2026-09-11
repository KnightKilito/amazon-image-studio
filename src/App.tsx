import { useEffect, useLayoutEffect, useRef } from 'react'
import { initStore } from './store'
import { useStore } from './store'
import {
  createAppPageScrollPositions,
  getAppPageFromLocation,
  getAppPageScrollPosition,
  rememberAppPageScrollPosition,
} from './lib/appNavigation'
import { buildSettingsFromUrlParams, clearUrlSettingParams, hasUrlSettingParams } from './lib/urlSettings'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import Header from './components/Header'
import AmazonPlanner from './components/AmazonPlanner'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'
import ImageEditorWorkspace from './components/ImageEditorWorkspace'
import ListingCopyWorkspace from './components/ListingCopyWorkspace'
import { useGlobalClickSuppression } from './lib/clickSuppression'

export default function App() {
  const setSettings = useStore((s) => s.setSettings)
  const appPage = useStore((s) => s.appPage)
  const setAppPage = useStore((s) => s.setAppPage)
  const visitedPagesRef = useRef(new Set([appPage]))
  const pageScrollPositionsRef = useRef(createAppPageScrollPositions())
  const activeScrollPageRef = useRef(appPage)
  const restoringPageScrollRef = useRef(false)
  if (activeScrollPageRef.current !== appPage && typeof window !== 'undefined') {
    rememberAppPageScrollPosition(pageScrollPositionsRef.current, activeScrollPageRef.current, window.scrollY)
    restoringPageScrollRef.current = true
  }
  visitedPagesRef.current.add(appPage)
  useDockerApiUrlMigrationNotice()
  useGlobalClickSuppression()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const nextSettings = buildSettingsFromUrlParams(useStore.getState().settings, searchParams)

    setSettings(nextSettings)

    if (hasUrlSettingParams(searchParams)) {
      clearUrlSettingParams(searchParams)

      const nextSearch = searchParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }

    initStore()
    void useStore.getState().syncAdminAccess()
    useStore.getState().setAppMode('gallery')
  }, [setSettings])

  useEffect(() => {
    const syncPageFromLocation = () => setAppPage(getAppPageFromLocation())
    syncPageFromLocation()
    window.addEventListener('hashchange', syncPageFromLocation)
    return () => window.removeEventListener('hashchange', syncPageFromLocation)
  }, [setAppPage])

  useEffect(() => {
    const rememberCurrentPageScroll = () => {
      if (restoringPageScrollRef.current) return
      rememberAppPageScrollPosition(pageScrollPositionsRef.current, activeScrollPageRef.current, window.scrollY)
    }
    window.addEventListener('scroll', rememberCurrentPageScroll, { passive: true })
    return () => window.removeEventListener('scroll', rememberCurrentPageScroll)
  }, [])

  useLayoutEffect(() => {
    activeScrollPageRef.current = appPage
    restoringPageScrollRef.current = true
    const restoreScroll = () => {
      window.scrollTo({
        top: getAppPageScrollPosition(pageScrollPositionsRef.current, appPage),
        left: 0,
        behavior: 'auto',
      })
    }
    restoreScroll()
    let releaseFrame = 0
    const restoreFrame = window.requestAnimationFrame(() => {
      restoreScroll()
      releaseFrame = window.requestAnimationFrame(() => {
        restoringPageScrollRef.current = false
      })
    })
    return () => {
      window.cancelAnimationFrame(restoreFrame)
      if (releaseFrame) window.cancelAnimationFrame(releaseFrame)
    }
  }, [appPage])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  return (
    <>
      <Header />
      {/* Keep the planner mounted so an in-flight AI planning request survives main-tab switches. */}
      <div hidden={appPage !== 'home'} aria-hidden={appPage !== 'home'}>
        <main data-home-main data-drag-select-surface className="home-main-with-dock pb-48 lg:pb-10">
          <div className="safe-area-x max-w-7xl mx-auto lg:!px-6">
            <AmazonPlanner />
            {appPage === 'home' && (
              <>
                <SearchBar />
                <TaskGrid />
              </>
            )}
          </div>
        </main>
        {appPage === 'home' && <InputBar />}
      </div>
      {visitedPagesRef.current.has('listing-copy') && (
        <div hidden={appPage !== 'listing-copy'} aria-hidden={appPage !== 'listing-copy'}>
          <ListingCopyWorkspace />
        </div>
      )}
      {appPage === 'editor' && <ImageEditorWorkspace />}
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <ConfirmDialog />
      <Toast />
      <MaskEditorModal />
      <ImageContextMenu />
    </>
  )
}
