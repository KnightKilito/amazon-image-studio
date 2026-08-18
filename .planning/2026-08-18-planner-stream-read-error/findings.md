# Findings

- 策划功能的 SSE 读取与请求编排集中在 `src/lib/listingPlannerApi.ts`，相关回归测试位于 `src/lib/listingPlanner.test.ts`。
- 策划配置使用 `streamImages` 作为文本流式开关；请求支持 Responses API 与 Chat Completions 两种模式，需分别确认断流后的行为。
- `readJsonServerSentEvents` 在 `reader.read()` 抛错时直接透传浏览器/代理的原始异常；`stream read error` 因此未经分类直接到 UI。
- 现有策划自动降级只识别空文本、部分 HTTP 网关状态与图片不兼容错误，不识别成功建立 SSE 后的读取中断，所以不会触发任何恢复。
- 对断流直接重复流式请求仍可能再次命中相同代理问题；更合适的单次恢复是以相同 API 模式和输入关闭流式传输重试，随后再沿用现有 Responses/Chat 与纯文本降级链。
- 本地 API 代理在上游响应开始后发生 `error` 时会销毁下游响应；浏览器正会把这类半途断连接收为流读取异常，因此客户端必须把它视为传输层中断而不是策划 JSON 错误。
- `AmazonPlanner` 在每次 `onAttemptStart` 时会清空上一次尝试的流式预览，因此自动切到非流式重试不会把前一次残缺文本与新结果拼接。
- 除浏览器读取器直接抛错外，兼容中转也可能把同名 `stream read error` 包装在 SSE error 事件内；恢复分类需覆盖这两条来源，但不应把任意模型内容/JSON错误误判为网络断流。
- 工程已有全局 `ConfirmDialog` 与 store `setConfirmDialog`，支持自定义确认/取消文案和 action；适合在 `AmazonPlanner` 捕获断流后询问用户，无需新增一套弹窗组件。
- 策划执行入口 `createAiPlan` 当前会在 catch 后 finally 释放 AbortController；确认弹窗 action 在本轮异步调用结束后执行，可安全重新进入策划流程。
- 确认弹窗支持 `tone: warning`、自定义“确认/取消”文案和异步 action 包装；现有 store 示例也采用 `void submit...` 方式在用户确认后重新提交。
- `createAiPlan` 只有一个按钮调用点且使用无参闭包触发；确认弹窗可以直接再次调用同一入口，保持当前 API 配置不变。
- 最终按用户要求不引入异常专用的非流式参数：确认后按当前 API 配置重试，避免异常处理擅自改变用户的流式设置。
