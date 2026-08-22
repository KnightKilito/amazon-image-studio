# Findings

- 上次修复已经把落点判定从单个缩略图扩展到了整个网格间隙，并避开了页面级文件拖入监听；纯落点算法已有单测覆盖。
- 当前桌面拖拽仍依赖原生 HTML5 DnD，并同时把缩略图外层和整面编辑按钮设为 `draggable`。实际拖拽起点落在嵌套按钮时会形成两个 draggable 节点，这条交互链路在浏览器里容易出现未启动或事件落点不一致。
- 拖拽源在 state、ref 和 DataTransfer 中保存的都是数组索引；若拖拽期间输入图状态发生刷新，索引会失去稳定身份，应改为按图片 id 在落下时重新解析当前索引。
- 全局 `App` 还会阻止以 `img` 元素为目标的 dragstart，需要确认事件目标和捕获阶段是否会误伤缩略图排序。
- `moveInputImage` 自身会按“插入缝隙索引”修正前移/后移偏差，且无效目标会直接保持原状态，未发现 store 层越界问题。
- 项目没有安装 Testing Library / jsdom / Playwright，现有组件测试主要采用服务端渲染；拖拽的 DOM 交互回归应以浏览器真实页面为主，纯函数单测用于覆盖坐标和身份解析。
- 策划案列表已从固定 `420/480px` 上限调整为移动端 `min(65vh, 500px)`、桌面端 `min(70vh, 600px)`，兼顾更大可视区域和小屏不溢出。
- 在本地真实首页的 4 张参考图上，从第一张中央沿缩略图横向拖到末尾，当前实现未发生任何顺序变化；第一张的可交互命中区域几乎完全是嵌套的编辑按钮（约 `50.4×50.4px`，外层仅 `52×52px`），验证了拖拽入口而非落点算法仍是主要薄弱点。
- 修复方向确定为 Pointer Events：移动超过阈值后进入排序、捕获活动指针，源图片按稳定 id 记录，并在释放坐标重新计算落点；普通点击仍保留编辑/预览行为。
- 浏览器 CUA 拖拽确实产生完整的 pointerdown → pointermove → pointerup（主指针、左键、坐标正确），所以可以用于新状态机的真实验证；当前首版 Pointer 实现仍未提交重排，继续跟踪最终 from/to 状态。
- 额外确认旧实现有一个确定性响应式缺口：`draggable={!isMobile}` 以 `<640px` 视口宽度关闭原生拖拽，桌面分屏/窄窗口下鼠标排序会完全失效；Pointer Events 方案消除了这种按窗口宽度猜测输入设备的逻辑。
- 首版 pointer capture 绑定在原始 `event.target`；浏览器日志显示按下源图后，移动事件进入了鼠标下方的其他缩略图而非源图闭包，说明 SVG 等细粒度命中节点上的 capture 并不可靠。需把 capture 归一到命中的按钮 HTMLElement（或缩略图外层）并验证轻点行为。
- 改用 window 捕获级 pointermove/up 后，真实拖拽完整算出了 `fromIdx=1, toIdx=4` 并调用 `moveInputImage`，但 DOM 顺序随即保持原样；说明仍有首页/策划模块的状态同步把排序写回旧顺序，而不是指针事件或坐标问题。下一步审计 `AmazonPlanner` 对 `inputImages`/`referenceImageIds` 的同步 effect。
- `AmazonPlanner` 只在显式恢复历史会话时调用 `setInputImages(restoredReferences)`，没有发现持续监听 `referenceImageIds` 并覆盖首页顺序的 effect；`syncActiveInputDraft` 也会原样返回 `inputImages` patch。需要在 store 调用前后记录实际状态，以区分 store 拒绝移动（例如 mask 约束）和随后写回。
- 诊断日志确认 store 在拖拽提交后立即从 `[A,B,C,D]` 正确变为 `[A,C,D,B]`，50ms 后仍正确，但稍后 DOM 又回到旧序。每次复测都在页面 reload 后立刻拖动，最符合 `initStore()` 异步图片恢复使用启动时旧快照、完成后覆盖用户新排序的竞态；这也是“偶尔失效”的另一条真实路径。
- `initStore` 的确先保存 `persistedInputImages`，逐张异步读取 IndexedDB，完成后直接 `setInputImages(restoredInputImages)`；当页面加载后立刻排序、增删图片时，会用启动旧序覆盖最新交互。现已改为按最新列表顺序合并恢复出的 data URL，不再重新加入已删除项，也不丢失加载期间新增项。
- 浏览器复测：等待初始化完成后，第二张拖到末尾稳定得到 `[A,C,D,B]`；刷新后立即拖仍会回到旧序，证明启动期还有另一处草稿恢复覆盖，需要继续审计 `galleryInputDraft` 的异步补图与 appMode 切换，而 Pointer 排序本身已在稳定状态下通过。
- 第二处覆盖已确认：`galleryInputDraft` 补图完成后会把启动时的 `restoredGalleryDraft` 同时写回可见 `inputImages`。现已同样基于最新 gallery 草稿合并恢复数据，并保留加载期间的排序、增删、提示词和风格参考变更。
- `PLAN_LIST_CLASS` 同时用于 Listing 策划图列表、A+ 策划图列表和可编辑 A+ 模块列表；一次响应式高度调整可覆盖用户所说的策划案选择列表相关视图。
## 独立审查补充（启动恢复链）

- 首页排序的直接竞态已修复，但同一 `initStore()` 恢复链中的根级风格参考图与 Agent 草稿仍可能用启动快照覆盖初始化期间的最新操作。
- 恢复策略应统一为：以 `useStore.getState()` 的最新状态为准，只给仍是同一 ID 的占位项补 `dataUrl`；已清空、替换、新增、删除和重排都必须保留。
- 启动孤儿清理还需要在删除前重新检查实时 store 引用，避免把初始化期间刚上传的图片当成孤儿删除。
- 审查提出的“网格外松手也会排序”经代码复核不成立：`getImageDropIndexAtPoint` 在计算落点前已有网格边界判断。
- 风格参考图现在使用单图合并 helper：只在最新状态仍引用启动时同一 ID 且缺少 `dataUrl` 时补图，清空或替换不会被回滚。
- Agent 草稿恢复改为先读取旧草稿图片，再与 `saveActiveAgentInputDrafts(useStore.getState())` 得到的最新草稿逐项合并；新增、删除、重排和最新文案均优先保留。
- 孤儿图片删除前增加实时 `isImageReferencedByState` 复核，覆盖初始化期间刚上传并已进入当前状态的图片。
- 完整改动后的全量 Vitest 为 400/400，通过 TypeScript 与 Vite 生产构建；构建只报告既有的 500 kB chunk 警告。
- 二次独立审查确认根级输入、风格图、gallery 和 active agent 的最新状态优先链路正确；唯一剩余中风险是 Planner/ListingCopy 会话引用不在 AppState，启动期间新保存的会话图片仍需在孤儿删除前刷新引用快照。
- 更稳妥的清理边界是：在 `initStore()` 入口与任务/会话并行取得“启动时已有图片 ID”作为唯一候选，并在真正清理前再刷新 Planner/ListingCopy 会话引用；启动后新存入的图片不会进入本轮清理候选。
- 最终真实浏览器回归再次复现最高风险时序（页面刷新完成后立即拖拽）：第 2 张稳定移动至末尾，2.5 秒后仍保持新顺序，说明启动恢复不再覆盖排序。
- 当前本地页面没有可选择的历史策划案，因此无法直接展开“仅策划案”选择列表做截图；该列表与 Listing/A+/可编辑 A+ 三处共用的高度类已由生产 CSS 验证覆盖。
- Store 测试使用内存 Map 模拟 IndexedDB；现有 `initStore()` 用例可以继续扩展，但精确构造延迟 `getImage` 需要把 DB mock 改为可控 mock，改动面大于合并 helper 单测。
- 最终页面日志没有新增业务异常；只看到项目既有的 React 空 `img src` 开发警告，发生于持久化占位图尚未补回数据 URL 的短暂阶段，与拖拽失败无关。
- 最终状态检查仅包含本任务文件、规划记录，以及用户原有的 `ListingCopyWorkspace.tsx` 未提交修改；本次没有触碰该用户文件。

## 清空策划案流程

- 用户希望“重新策划”不再依赖先清空标题/五点描述再重新粘贴；新的清空动作需要把输入资料和策划结果拆开管理。
- 高级 A+ 是明确用例，因此不能只处理 Listing 结果；应同时覆盖当前模式下的 A+ 策划结果及其模块/选中状态。
- 现有 `clearListingPlan()` 是“全部重置”：会清空 `listingText`、两类 plans、A+ 模块规格/布局、风格、选择索引和当前会话 ID；这正是用户目前必须重新粘贴 Listing 原文的原因。
- 真正的“清空策划案”应从现有全清空函数拆出结果级 reset，至少清除 `imagePlans` / `aPlusPlans`、当前选择、系列风格、AI/预设风格派生选择、错误与执行进度，同时保留 `listingText`、`draft`、参考图及用户配置的 A+ 前置规划。
- 现有操作区已经在 AI 策划按钮、停止/查看返回、设置旁放置“清空”，且使用可换行布局；这里最适合增加明确的“清空策划案”，同时把原含糊的全重置动作标为“清空输入”。
- 清空结果后把 `currentPlannerSessionId` 置空，但不删除历史会话：旧策划仍可从“策划历史”恢复，下一次策划会新建会话，因此无需再弹一次确认框。
- 结果级清空应保留 `visualStyleMode` 与 `styleDensityMode` 这类策划前偏好，但移除本轮生成的 `seriesStyleGuides`、`aiVisualStyle`、风格参考选择及运行详情，避免旧结果污染下一轮引导。
- `restorePlannerSession()` 能从 IndexedDB 会话完整恢复 mode、A+ 类型/布局/模块规格、Listing 原文、draft 和 plans；可在本地浏览器临时写入一个唯一测试会话、通过公开“策划历史”界面恢复并在测试后删除，以端到端验证清空边界，不依赖真实 API。
- 测试会话采用 `visualStyleMode: 'ai'` 且不带 AI 风格图，可避开预设风格图片加载；高级 A+ plan、Listing 原文和 `draft.productTitle` 足以验证按钮出现、结果消失与输入保留。
- 当前 Browser evaluate 运行在隔离环境，不支持模块加载或 IndexedDB；继续绕过会增加风险，状态保留应由纯 helper 的输入/输出契约覆盖，页面回归只承担按钮样式与无回归检查。
- DOM 诊断显示两次 fill 实际已成功，超时发生在同一复合命令后续复用 locator 读取状态，而不是输入动作本身；页面正确显示“清空输入”，且没有策划结果时不显示“清空策划案”。
- 使用新鲜 role locator 点击“清空输入”后，Listing 文本框恢复为空且按钮消失，原有全清空入口的基础行为未回归。
- 最终 `git diff --check` 通过，源码无调试日志或临时测试会话 ID；浏览器仅有此前已确认的空 `img src` React 开发警告，没有本次清空流程引入的业务异常。
