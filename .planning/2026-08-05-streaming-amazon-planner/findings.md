# Findings

## Current behavior
- `ApiProfile.streamImages` 是配置级布尔值，Settings 中所有 OpenAI-compatible 配置都能开启；当前帮助文案主要描述图片流式和中间步骤图。
- AI 策划选择的是独立的 `amazonPlannerProfileId`，该配置可以是 Responses API 或 Chat Completions。
- `callAmazonPlannerApi` 没有读取 `profile.streamImages`；Responses 和 Chat 请求体都硬编码 `stream: false`。
- `AmazonPlanner` 只保存 `isPlanning`、`plannerError` 和 AbortController，没有流式文本、事件状态或原始响应状态。
- “策划中...”主按钮在请求期间 disabled；旁边只有“停止”按钮。因此无法按用户期望点击查看实时返回内容。
- 最终处理依赖完整文本：先提取 API 返回文本，再解析严格 JSON，最后一次性应用为 Listing/A+ 策划和保存历史。

## Initial design implication
- 可以复用 `streamImages` 作为“该 API 配置启用流式传输”，但 Settings 文案和 `streamPartialImages` 控件要按 API 模式区分，避免让文本策划配置看起来只能服务生图。
- UI 需要独立的策划运行详情状态；流式增量仅供观察，最终仍要在完成事件后用完整 JSON 走现有解析/归一化逻辑。

## Existing reusable infrastructure
- `listingPlannerApi.ts` 已使用共享 `serverSentEvents.ts` 读取 SSE，并支持 Responses 事件：`response.output_text.delta`、`response.output_text.done`、`response.output_item.done`、`response.completed`。
- 当前 SSE 读取只在服务端意外返回 `text/event-stream` 时生效，没有增量回调给调用方；直到流结束才返回完整文本。
- Agent 模块已有 `onTextDelta` 回调模式，可作为策划 API 的接口风格参考。
- Chat Completions 流式事件需要新增 `choices[0].delta.content` 提取，并从 `[DONE]` 前累计最终 JSON。
- 现有项目没有通用 Modal 组件，但多个对话框共享全屏遮罩、Escape 关闭、阻止背景滚动等本地模式；策划详情可以做成 AmazonPlanner 的局部对话框组件，避免全局 store 扩张。

## Proxy-chain findings
- `deploy/nginx.conf` 的 `/api-proxy` 已配置 `proxy_http_version 1.1`、`proxy_buffering off`、`proxy_request_buffering off`，并将 read/send timeout 设为 600 秒，适合 SSE 透传。
- Node `server/adminServer.mjs` 的代理实现会把所有上游 chunk 收集到 Buffer，等 `end` 后才一次性返回，并有 300 秒 upstream timeout；如果实际部署走这条代理，前端改流式仍无法收到增量，必须同步改成边读边写和客户端断开时取消上游。
- 共享 SSE reader 会忽略 `:` 注释心跳；这没问题，因为网络层字节仍已抵达并维持网关连接。它目前没有显式 signal 参数，但 fetch 被 AbortController 取消时 reader 通常会 reject；测试中应覆盖中途停止和 reader 释放。
- 流式并非绝对消除 524：中转站必须尽早返回响应头/首个 chunk，并持续 flush；若模型首 token 本身超过网关无数据超时，仍需要中转站发送 SSE 注释心跳。

## State and persistence findings
- 策划成功后才创建/保存 `AmazonPlannerSession`；运行中的请求没有持久化记录。
- `AmazonPlannerSession` 当前保存结构化策划、输入和样式状态，不保存 API 原始文本。实时窗口可先作为当前组件内的运行诊断状态；成功后是否长期保存原始 JSON 是产品选择，不是维持连接所必需。
- 推荐本次把最后一次策划原始文本保留在当前页面内，运行中、成功后、失败后都可查看和复制；不写入策划历史，避免显著增加 IndexedDB/导出体积和隐私面。结构化策划本身仍按现有逻辑进入历史。
- 自动 fallback 可能产生多个请求（参考图、纯文本、Responses→Chat）。详情状态应展示当前尝试标签并在切换尝试时清空正文、保留简短尝试日志，避免把多个 JSON 拼接成不可解析文本。

## Final recommendation
- Reuse the existing profile switch to avoid configuration migration and match the user's expectation that enabling streaming on the selected planner profile affects planning.
- Treat live output as diagnostic raw JSON while it is incomplete; after completion, existing structured plan cards remain the primary readable result.
- Include the Node proxy change in the same implementation. Omitting it would make behavior depend on whether the deployment uses direct access, Nginx proxying, or the Node admin proxy.
