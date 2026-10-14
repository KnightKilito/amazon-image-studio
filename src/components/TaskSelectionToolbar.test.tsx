import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store')>()
  const mockedUseStore = ((selector: (state: ReturnType<typeof actual.useStore.getState>) => unknown) => (
    selector(actual.useStore.getState())
  )) as typeof actual.useStore
  Object.assign(mockedUseStore, actual.useStore)
  return { ...actual, useStore: mockedUseStore }
})
import { DEFAULT_PARAMS, type TaskRecord } from '../types'
import { useStore } from '../store'
import TaskSelectionToolbar from './TaskSelectionToolbar'

function createTask(id: string, isFavorite = false): TaskRecord {
  return {
    id,
    prompt: id,
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    outputImages: [`${id}-image`],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    isFavorite,
    category: { workflow: 'gallery' },
  }
}

describe('TaskSelectionToolbar', () => {
  afterEach(() => {
    useStore.setState({ tasks: [], selectedTaskIds: [] })
  })

  it('reuses the complete batch action toolbar in inline editor layout', () => {
    useStore.setState({
      tasks: [createTask('task-a'), createTask('task-b')],
      selectedTaskIds: ['task-a', 'task-b'],
      searchQuery: '',
      filterStatus: 'all',
      filterFavorite: false,
      filterProductTitle: '',
      filterWorkflow: 'all',
      filterAspect: 'all',
      historyPage: 1,
      historyPageSize: 12,
    })

    const markup = renderToStaticMarkup(<TaskSelectionToolbar variant="inline" />)

    expect(markup).toContain('已选 2')
    expect(markup).toContain('取消选择当前页')
    expect(markup).toContain('收藏或取消收藏选中记录')
    expect(markup).toContain('批量下载')
    expect(markup).toContain('删除选中')
  })

  it('renders nothing without selected history tasks', () => {
    useStore.setState({ tasks: [createTask('task-a')], selectedTaskIds: [] })
    expect(renderToStaticMarkup(<TaskSelectionToolbar variant="inline" />)).toBe('')
  })

  it('shows the selected count in the home dock as well', () => {
    useStore.setState({ tasks: [createTask('a'), createTask('b'), createTask('c')], selectedTaskIds: ['a', 'b', 'c'] })
    const markup = renderToStaticMarkup(<TaskSelectionToolbar />)
    expect(markup).toContain('已选 3')
    expect(markup).toContain('aria-live="polite"')
  })
})
