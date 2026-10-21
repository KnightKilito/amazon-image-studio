import { useCallback, useMemo, useRef, useState } from 'react'
import { downloadImageIds, formatExportFileTime } from '../lib/downloadImages'
import { getFilteredTaskHistory } from '../lib/taskHistory'
import { addTasksOutputsToInputImages, removeMultipleTasks, updateTaskInStore, useStore } from '../store'

interface Props {
  variant?: 'dock' | 'inline'
}

export default function TaskSelectionToolbar({ variant = 'dock' }: Props) {
  const tasks = useStore((s) => s.tasks)
  const selectedTaskIds = useStore((s) => s.selectedTaskIds)
  const setSelectedTaskIds = useStore((s) => s.setSelectedTaskIds)
  const clearSelection = useStore((s) => s.clearSelection)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const filterStatus = useStore((s) => s.filterStatus)
  const filterFavorite = useStore((s) => s.filterFavorite)
  const searchQuery = useStore((s) => s.searchQuery)
  const filterProductTitle = useStore((s) => s.filterProductTitle)
  const filterWorkflow = useStore((s) => s.filterWorkflow)
  const filterAspect = useStore((s) => s.filterAspect)
  const historyPage = useStore((s) => s.historyPage)
  const historyPageSize = useStore((s) => s.historyPageSize)
  const addingReferencesRef = useRef(false)
  const [isAddingReferences, setIsAddingReferences] = useState(false)

  const visibleTaskIds = useMemo(() => {
    const filteredTasks = getFilteredTaskHistory(tasks, {
      searchQuery,
      filterStatus,
      filterFavorite,
      filterProductTitle,
      filterWorkflow,
      filterAspect,
    })
    const start = (historyPage - 1) * historyPageSize
    return filteredTasks.slice(start, start + historyPageSize).map((task) => task.id)
  }, [filterAspect, filterFavorite, filterProductTitle, filterStatus, filterWorkflow, historyPage, historyPageSize, searchQuery, tasks])
  const areAllVisibleTasksSelected = visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedTaskIds.includes(id))

  const handleSelectAllToggle = useCallback(() => {
    const visibleTaskIdSet = new Set(visibleTaskIds)
    setSelectedTaskIds((current) => areAllVisibleTasksSelected
      ? current.filter((id) => !visibleTaskIdSet.has(id))
      : Array.from(new Set([...current, ...visibleTaskIds])))
  }, [areAllVisibleTasksSelected, setSelectedTaskIds, visibleTaskIds])

  const handleToggleFavorite = useCallback(() => {
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(task.id))
    const allFavorite = selectedTasks.length > 0 && selectedTasks.every((task) => task.isFavorite)
    const nextFavorite = !allFavorite
    setConfirmDialog({
      title: nextFavorite ? '批量收藏' : '批量取消收藏',
      message: nextFavorite
        ? `确定要收藏选中的 ${selectedTaskIds.length} 条记录吗？`
        : `确定要取消收藏选中的 ${selectedTaskIds.length} 条记录吗？`,
      confirmText: nextFavorite ? '确认收藏' : '确认取消',
      action: () => {
        selectedTaskIds.forEach((id) => updateTaskInStore(id, { isFavorite: nextFavorite }))
        clearSelection()
      },
    })
  }, [clearSelection, selectedTaskIds, setConfirmDialog, tasks])

  const handleDeleteSelected = useCallback(() => {
    setConfirmDialog({
      title: '批量删除',
      message: `确定要删除选中的 ${selectedTaskIds.length} 条记录吗？`,
      action: () => { void removeMultipleTasks(selectedTaskIds) },
    })
  }, [selectedTaskIds, setConfirmDialog])

  const handleDownloadSelected = useCallback(async () => {
    const selectedTasks = tasks.filter((task) => selectedTaskIds.includes(task.id))
    const imageIds = selectedTasks.flatMap((task) => task.outputImages || [])
    if (imageIds.length === 0) {
      showToast('选中的记录没有图片', 'info')
      return
    }

    try {
      const time = formatExportFileTime(new Date())
      const { successCount, failCount } = await downloadImageIds(imageIds, `batch-${time}`)
      if (successCount === 0) showToast('下载失败', 'error')
      else if (failCount > 0) showToast(`部分下载失败：成功 ${successCount}，失败 ${failCount}`, 'error')
      else showToast(successCount > 1 ? `下载成功：${successCount} 张图片` : '下载成功', 'success')
    } catch (error) {
      console.error(error)
      showToast('下载失败', 'error')
    }
    clearSelection()
  }, [clearSelection, selectedTaskIds, showToast, tasks])

  const handleAddReferences = useCallback(async () => {
    if (addingReferencesRef.current) return
    const selectedIds = new Set(selectedTaskIds)
    const selectedTasks = tasks.filter((task) => selectedIds.has(task.id))
    if (!selectedTasks.some((task) => task.outputImages?.length)) {
      showToast('选中的记录没有可加入的结果图片', 'info')
      return
    }
    const page = useStore.getState().appPage
    addingReferencesRef.current = true
    setIsAddingReferences(true)
    try {
      const result = await addTasksOutputsToInputImages(selectedTasks, () => useStore.getState().appPage === page)
      if (result.cancelled) return
      const details = [
        result.addedImageIds.length ? `已加入 ${result.addedImageIds.length} 张参考图` : '',
        result.duplicateCount ? `${result.duplicateCount} 张重复图片已跳过` : '',
        result.skippedCount ? `${result.skippedCount} 张因参考图数量达到上限未加入（风格图也占用名额）` : '',
        result.missingImageIds.length ? `${result.missingImageIds.length} 张图片已丢失或读取失败` : '',
      ].filter(Boolean)
      showToast(details.join('，') || '没有可加入的结果图片', result.addedImageIds.length ? (result.skippedCount || result.missingImageIds.length ? 'info' : 'success') : result.missingImageIds.length ? 'error' : 'info')
      if ((result.addedImageIds.length || result.duplicateCount) && !result.skippedCount && !result.missingImageIds.length) {
        setSelectedTaskIds((current) => current.filter((id) => !selectedIds.has(id)))
      }
    } catch (error) {
      showToast(`加入参考图失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      addingReferencesRef.current = false
      setIsAddingReferences(false)
    }
  }, [selectedTaskIds, setSelectedTaskIds, showToast, tasks])

  if (selectedTaskIds.length === 0) return null

  return (
    <div className={variant === 'dock' ? 'mb-3 flex min-w-0 justify-center lg:justify-end' : 'flex min-w-0 justify-end'} data-task-selection-toolbar>
      <div className="pointer-events-auto flex max-w-full items-center overflow-x-auto rounded-full border border-gray-200/50 bg-white/90 p-1 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur dark:border-white/10 dark:bg-gray-800/90 dark:shadow-lg [&>button]:shrink-0 [&>div]:shrink-0">
        <span aria-live="polite" className="shrink-0 whitespace-nowrap pl-2 pr-1 text-[11px] font-semibold text-gray-500 dark:text-gray-300">已选 {selectedTaskIds.length}</span>
        <button type="button" onClick={clearSelection} className="p-2 text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" title="取消选择" aria-label="取消选择">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/20" />
        <button type="button" onClick={handleSelectAllToggle} className="p-2 text-blue-500 transition-colors hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300" title={areAllVisibleTasksSelected ? '取消选择当前页' : '全选当前页'} aria-label={areAllVisibleTasksSelected ? '取消选择当前页' : '全选当前页'}>
          {areAllVisibleTasksSelected ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M9 12l2 2 4-4" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path strokeDasharray="4 4" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" /></svg>
          )}
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/20" />
        <button type="button" onClick={() => void handleAddReferences()} disabled={isAddingReferences} aria-busy={isAddingReferences} title={isAddingReferences ? '正在加入参考图…' : '批量加入参考图（选中记录的全部结果图片）'} aria-label="批量加入参考图" className="p-2 text-violet-500 transition-colors hover:text-violet-600 disabled:cursor-wait disabled:opacity-40 dark:text-violet-400 dark:hover:text-violet-300">
          {isAddingReferences ? <span className="block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M3 16l5-5 6 6 3-3 4 4M19 2v6M16 5h6" /><circle cx="8" cy="7" r="1" /></svg>}
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/20" />
        <button type="button" onClick={handleToggleFavorite} className="p-2 text-yellow-500 transition-colors hover:text-yellow-600 dark:text-yellow-400 dark:hover:text-yellow-300" title="收藏/取消收藏" aria-label="收藏或取消收藏选中记录">
          {selectedTaskIds.every((id) => tasks.find((task) => task.id === id)?.isFavorite) ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
          )}
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/20" />
        <button type="button" onClick={() => void handleDownloadSelected()} className="p-2 text-green-500 transition-colors hover:text-green-600 dark:text-green-400 dark:hover:text-green-300" title="批量下载" aria-label="批量下载">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </button>
        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-white/20" />
        <button type="button" onClick={handleDeleteSelected} className="p-2 text-red-500 transition-colors hover:text-red-600 dark:text-red-400 dark:hover:text-red-300" title="删除选中" aria-label="删除选中">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  )
}
