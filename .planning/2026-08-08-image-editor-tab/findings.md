# Findings

## 2026-08-08 - Settings pane follow-up

- Current API settings JSX has separate image/planner profile cards and per-card basic fields, but the old shared advanced details block still contains advanced controls after both cards. Preserve those controls, stop rendering the shared block, and render dedicated advanced sections inside each card.

## 2026-08-08 - 配置拆分审计

- `src/lib/apiProfiles.ts` 已有 `activeProfileId`（当前生图配置）和 `amazonPlannerProfileId`（策划配置），`normalizeSettings` 也会在旧的单配置数据中自动拆出 Images API 与 Responses API 两个默认配置；本次沿用这套数据结构，不新增数据库字段。
- `SettingsModal` 当前仍以 `activeProfile` 作为唯一主配置编辑对象，虽然已有“AI 策划配置”下拉框，但下方 URL、Key、模型、API 模式等字段全部编辑的是生图配置，因此 UI 看起来分开但配置内容仍容易混用。
- `AmazonPlanner.tsx` 已经使用 `getAmazonPlannerProfile(settings)`，并单独读取生图 profile 生成风格参考图；主要需要修正通用 Agent/store 流程和设置弹窗的双卡编辑逻辑。
- 图片请求 `submitTask` 使用 `getActiveApiProfile(settings)`；通用 Agent 请求仍在 `store.ts` 的 `submitAgentMessage` 及其重试/再生成路径中使用 `getActiveApiProfile`，这些调用必须切换到 `getAmazonPlannerProfile`。

## Implementation direction

- 设置弹窗保留现有 API profile 管理、导入导出和权限控制，但新增“编辑中的配置”与“用途”概念：图片生成卡绑定 `activeProfileId`，AI 策划卡绑定 `amazonPlannerProfileId`；编辑字段根据当前管理的 profile 变化，选择策划 profile 不会覆盖生图 profile。
- 图片配置下拉只允许 `canApiProfileGenerateImages` 的 profile，策划配置下拉只允许 `isAmazonPlannerProfile` 的 profile；无可用 profile 时继续提供清晰提示。
- `createSettingsForApiProfile` 必须把目标 profile 作为隔离的临时 profile 集合传给请求层；否则当目标是 Responses/Chat 策划 profile 时，规范化逻辑会把它误回退成生图 profile。
- 为兼容曾经把策划 profile 写入 `activeProfileId` 的旧数据，`getActiveApiProfile` 会优先解析首个可生图 profile，并且不再用不匹配的旧顶层字段覆盖该 profile；保留 `normalizeSettings` 的原始 active ID 语义，以兼容 URL 配置导入。

## 2026-08-08 - 参考图复刻审计

- 用户明确要求按参考站点的设置面板交互复刻：左右两张独立卡片，卡片各自拥有用途标题、状态、配置下拉和“管理”按钮；新建配置必须从对应卡片的管理菜单触发，不能依赖一个按当前编辑角色切换的共享管理器。
- 参考图左卡的管理菜单包含：新建配置、重命名、复制一份、复制导入链接、删除当前配置；右卡的管理按钮也应只管理策划 profile。
- 参考图右卡的主体不是简单的复制按钮，而是“连接方式”二选一：单独配置，或复用图片连接（只复用 URL 和 Key），并在下方展示当前复用的 URL/Key 状态及提醒。
- 线上参考 URL 当前通过浏览工具返回 404，因此本次以用户提供的参考截图为视觉与交互依据，并以仓库内现有 `SettingsModal`/`Select` 能力实现。

## Repository baseline

- 项目是 React 19 + Vite + Zustand，不是 UniApp/Vue。
- `src/App.tsx` 当前只渲染首页 Gallery 工作流，Header、InputBar、DetailModal、MaskEditorModal 和 ImageContextMenu 为全局组件。
- 当前工作区已有用户修改：`src/components/AmazonPlanner.tsx`，实现时必须保留。

## Existing reusable capabilities

- `InputBar.tsx` 已包含本地文件上传、多图参考、风格参考图、提示词、参数、遮罩入口和 `submitTask`/`submitAgentMessage` 提交逻辑。
- `MaskEditorModal.tsx` 通过 Zustand 的 `maskEditorImageId` 编辑并保存 `maskDraft`。
- `store.ts` 的 `submitTask` 会将输入图、遮罩、API 配置和任务写入现有 IndexedDB。
- `editOutputs` 可将已有任务输出设置为当前输入，但当前不会切换到新图片编辑页面。
- `ImageContextMenu` 当前“编辑”动作实际是把图片加入参考图，需保留该语义或新增明确的编辑页入口。
- `createPremiumAPlusSliceTask`、`createAPlusUpscaleTask` 和 `createAPlusBatchUpscaleTask` 当前要求来源图片属于 TaskRecord 的 outputImages，适合抽取通用来源/派生任务逻辑后复用。
- `ImageSliceDialog`、`imageSlicing.ts` 和 `imageUpscaling.ts` 已具备预览、几何校验和 Canvas 处理能力。

## Navigation constraints

- 没有 React Router；URL hash 是低风险的页面入口方案。
- `appMode` 的现有持久化/切换逻辑用于 Gallery/Agent，新增页面状态应独立。
