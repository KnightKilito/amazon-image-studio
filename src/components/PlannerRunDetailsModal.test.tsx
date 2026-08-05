import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlannerRunDetailsModal from './PlannerRunDetailsModal'

describe('PlannerRunDetailsModal', () => {
  it('shows streaming request details and an explicit stop action while running', () => {
    const markup = renderToStaticMarkup(
      <PlannerRunDetailsModal
        status="streaming"
        startedAt={Date.now() - 65_000}
        finishedAt={null}
        profileName="AI 策划"
        model="gpt-planner"
        apiMode="responses"
        attempt={{ label: '带参考图策划', apiMode: 'responses', streaming: true }}
        responseText={'{"product":{"title":"Tumbler"'}
        error=""
        running
        onClose={vi.fn()}
        onStop={vi.fn()}
      />,
    )

    expect(markup).toContain('AI 策划运行详情')
    expect(markup).toContain('正在接收')
    expect(markup).toContain('带参考图策划')
    expect(markup).toContain('流式')
    expect(markup).toContain('停止策划')
    expect(markup).toContain('Tumbler')
  })

  it('keeps the final response inspectable after completion', () => {
    const markup = renderToStaticMarkup(
      <PlannerRunDetailsModal
        status="success"
        startedAt={1_000}
        finishedAt={66_000}
        profileName="AI 策划"
        model="gpt-planner"
        apiMode="chat"
        attempt={{ label: 'AI 策划', apiMode: 'chat', streaming: false }}
        responseText="final planner response"
        error=""
        running={false}
        onClose={vi.fn()}
        onStop={vi.fn()}
      />,
    )

    expect(markup).toContain('策划完成')
    expect(markup).toContain('1分05秒')
    expect(markup).toContain('Chat Completions')
    expect(markup).toContain('非流式')
    expect(markup).toContain('final planner response')
    expect(markup).not.toContain('>停止策划</button>')
  })
})
