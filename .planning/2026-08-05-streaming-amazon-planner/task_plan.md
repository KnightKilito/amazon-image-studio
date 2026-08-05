# AI 策划流式响应方案

## Goal
设计 AI 策划的真实流式请求与可查看的实时策划输出，降低长请求因网关静默超时导致 524 的概率，并保持现有最终 JSON 策划结果兼容。

## Phases
- [complete] 1. 调研当前配置、请求、状态 UI、错误处理及代理链路
- [complete] 2. 明确流式协议、增量文本解析和兼容降级策略
- [complete] 3. 设计“策划中”可点击详情交互及状态模型
- [complete] 4. 列出实施步骤、测试范围、风险与验收标准
- [complete] 5. 向用户提交方案，等待批准后再实施

## Implementation Phases
- [complete] 6. 实现 Responses/Chat 策划流式请求、增量回调与单元测试
- [complete] 7. 实现可点击的策划运行详情窗口与设置文案
- [complete] 8. 将 Node API 代理改为流式透传
- [complete] 9. 运行完整测试、构建和浏览器视觉验证

## Approved Implementation Plan

### 1. Make planner requests genuinely streaming
- In `src/lib/listingPlannerApi.ts`, use `profile.streamImages` as the profile-level streaming switch.
- Send `stream: true` for both Responses and Chat Completions planner requests when enabled; preserve the current non-stream path when disabled.
- Add callbacks such as `onAttemptStart`, `onStatusChange`, and `onTextDelta` to expose progress without coupling API code to React.
- Responses: accumulate `response.output_text.delta`, prefer completed text when provided, then run existing JSON parsing and normalization.
- Chat: accumulate `choices[].delta.content` until `[DONE]`, then run the same final parser.
- Keep existing automatic fallback behavior. Each fallback starts a separately labelled attempt and resets the visible current-response buffer.

### 2. Add planner run details UI
- Add a small local `PlannerRunDetailsModal` component consistent with existing modal styling.
- Change the running primary button from disabled to clickable; clicking `策划中...` opens the details modal rather than starting another request.
- Show status, elapsed time, selected profile/model/API mode, current fallback attempt, and live returned text.
- Include copy, auto-scroll, close, and stop controls. Closing the modal does not cancel planning; stop explicitly aborts it.
- Keep the latest text visible after success/failure until a new run begins, so the result or partial output can be inspected.
- Do not persist raw streaming text into planner history in this iteration; existing structured plan history remains unchanged.

### 3. Clarify the existing setting
- Keep the persisted `streamImages` field for backward compatibility; do not introduce a second planner-only toggle.
- Update Settings copy by API mode: Images describes partial image streaming; Chat/Responses describes streamed text/planner responses.
- Hide or de-emphasize the partial-image-count selector where it has no meaning, especially Chat Completions planner profiles.

### 4. Preserve streaming through the app proxy
- Refactor `server/adminServer.mjs` `/api-proxy` from full-response buffering to immediate header forwarding and chunk piping.
- Preserve safe header filtering and timeout behavior; propagate client disconnect/abort to the upstream request.
- Keep Nginx streaming settings, which already disable proxy buffering.
- Do not fabricate browser-side heartbeats. Document that an upstream relay still needs early SSE output or its own heartbeat if it remains silent longer than its edge timeout.

### 5. Verification
- Add `listingPlanner.test.ts` cases for Responses deltas, Chat deltas, split SSE chunks, completed payload fallback, stream errors, abort, non-stream compatibility, and multi-attempt fallback labelling/reset.
- Add a focused modal/component test for opening details during a run, live text updates, close-without-cancel, copy, and explicit stop.
- Verify the Node proxy with a local delayed SSE source to prove the first chunk reaches the client before upstream completion.
- Run the focused tests, full Vitest suite, TypeScript/Vite build, and desktop/mobile browser checks.

## Acceptance Criteria
- With streaming enabled, the relay log records the planner call as streaming and browser DevTools shows `text/event-stream` plus incrementally arriving chunks.
- The running button is clickable and displays live response content without starting a duplicate request.
- A slow request remains connected when the upstream emits chunks within gateway limits.
- Final Listing/A+ plans are identical in structure to the current non-stream result.
- Turning streaming off preserves current behavior.
- Automatic fallback, cancellation, direct API access, Node proxy access, and Nginx proxy access remain functional.

## Known Limitation
- Streaming greatly reduces idle gateway timeouts but cannot bypass an inner Cloudflare layer that receives no first byte or no heartbeat from its own origin. That part must be fixed by the relay provider.

## Constraints
- 本轮只制定计划，不修改产品代码。
- 复用现有 API 配置的流式开关，但明确其对策划请求的含义。
- 同时兼容 Responses API 与 Chat Completions。
- 流式传输必须从中转站实时到达浏览器；仅请求体写 `stream: true` 不足以保证维持连接。

## Errors Encountered
- 初次组合 PowerShell 文件检查因部分路径不存在返回退出码 1；已有 `.planning` 目录正常，不影响调研。
- 详情窗口完成态测试最初用宽泛字符串断言，误匹配“关闭窗口不会停止策划”说明；已收紧为停止按钮标签断言。
