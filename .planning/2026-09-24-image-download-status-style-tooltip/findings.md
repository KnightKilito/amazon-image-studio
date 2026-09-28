# Findings

- `store.ts` 已在 `onRawImageUrls` 回调将中转站 URL 增量写入任务的 `rawImageUrls`，且在完成和失败时仍保留链接。
- 任务卡仍以 running 直接显示“生成中...”；详情页也有运行态展示，需定位具体 JSX。
- `AmazonPlanner` 有 `isGeneratingAiStyleImage` 以及多个提交按钮，需确认哪个 disabled 路径与风格图等待有关。
- `TaskCard` 的 running 占位图固定显示蓝色 spinner 与“生成中...”；`DetailModal` 的运行预览固定显示蓝色 spinner。两者都能从同一个任务对象读到 `rawImageUrls`。
- 策划页固定操作栏的“提交生成”按钮由 `submitDisabled` 控制，其中非主图方案需要风格参考。AI 风格图生成期间，`isGeneratingAiStyleImage` 为 true 且未取得 `selectedStyleImage`，按钮因此灰色不可点。
- disabled 按钮本身无法稳定接收悬浮事件；应由包裹容器提供 hover/focus 提示，同时保留按钮原有禁用状态。
- 提示仅在当前方案已具备提交条件、处于 AI 风格模式且缺少必需的风格图时出现；风格图生成中和尚未开始生成分别显示对应文案，其他禁用原因不会被误标。
- 下载阶段采用绿色 spinner/状态文字/预览标签，与生成阶段的蓝色区分；完成与失败任务即使保留原始 URL 也不会继续显示下载中。
