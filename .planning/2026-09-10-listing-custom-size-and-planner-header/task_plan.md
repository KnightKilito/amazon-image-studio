# Listing 自定义策划尺寸与配置区布局

## Goal

把 Listing 策划前的 2K/4K 选择升级为可展开的尺寸选择按钮：保留 2K/4K 预设，并允许用户输入具体宽高；自定义尺寸一经选择持续保留，直到用户主动重新选择。同步优化“AI 策划配置”与 AI 策划、清空策划案、设置三个按钮的布局，避免当前配置名称被挤压换行。

## Phases

- [completed] 审计 Listing 尺寸状态、会话持久化、提示词/生图尺寸传递和策划操作区 DOM。
- [completed] 设计并实现预设/自定义尺寸选择器及稳定保留语义。
- [completed] 把自定义尺寸贯穿策划会话、提示词预览和正式生图，并补回归测试。
- [completed] 重排 AI 策划配置与操作按钮区域，验证桌面和窄屏布局。
- [completed] 运行聚焦测试、全量测试、生产构建与本地页面验证。

## Decisions

- 默认仍使用当前 2K；2K/4K 作为快捷预设保留。
- 自定义宽高按像素输入，必须为正整数并限制在项目可接受范围内；用户确认后持续使用该尺寸，切换策划模式不自动重置。
- 仅 Listing 图开放任意宽高；A+ 继续使用其模块规格和现有 2K/4K 生成倍率，避免破坏 A+ 尺寸规则。
- 当前 AI 策划配置名称单独占一行/区域，操作按钮放到独立操作组，避免互相抢宽度。
- 保留上一任务尚未提交的 App、InputBar、appNavigation 与 store 相关修改；除非尺寸模型确实需要，否则不触碰这些文件。

## Errors Encountered

- 当前会话未提供 `update_plan` 工具；文件化计划已成功创建，后续以 `task_plan.md` 为唯一计划状态源。
- 一次兼容性搜索包含不存在的 `src/lib/imageApi.ts`，`rg` 返回路径错误；实际图片 API 实现在其他模块，已从 `TaskParams` 与 `normalizeImageSize` 确认自定义 string 尺寸链路，后续不再使用该路径。
- 首次桌面页面连接的全局状态读取返回 `nodeRepl.fetch request failed`，未获得浏览器清单；按错误协议不重复同一调用，重置会话后将直接创建隔离的本地浏览器标签。
- 首轮页面回归发现 A+ 未选择模块时 Prompt Preview 会借用 Listing 自定义尺寸；已定位为 `targetSize` 的 fallback 条件，修正为 A+ 自身首模块尺寸后再继续验证。
- 本地 Vite 日志报告可选 `/admin-api/settings` 代理 `ECONNREFUSED`，原因是管理服务未启动；不影响本次纯前端尺寸与布局验证，属于现有开发环境提示。

## Follow-up：Listing 参考图同步到首页

### Goal

在 Listing 文案页增加“替换首页参考图”入口，用当前文案页已选参考图整体替换首页的 `inputImages`，保持 Listing 图顺序并遵循首页参考图数量上限。

### Phases

- [completed] 审计 Listing 文案参考图状态、首页图片 store action 和数量上限提示。
- [completed] 实现替换按钮与去重/容量行为。
- [completed] 补回归测试并运行全量测试、构建和本地页面验证。
