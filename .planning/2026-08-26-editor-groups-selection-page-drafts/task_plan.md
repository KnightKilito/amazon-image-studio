# 图片编辑素材管理、多选与跨页草稿

## Goal

完善图片编辑页的素材/结果管理与底部历史多选操作，并确保首页、Listing 文案页、图片编辑页切换时各自文本草稿不丢失。

## Phases

- [completed] 审计编辑页左栏结构、图片引用删除、TaskGrid 多选工具栏及三页文本状态生命周期。
- [completed] 实现左栏素材/结果分组、分组清空和单张删除，并保护当前主图/任务引用状态。
- [completed] 让编辑页底部历史拥有与首页一致的多选入口和批量操作。
- [completed] 以最小改动实现首页、Listing 文案页、编辑页独立草稿在 Tab 切换时保留，并补状态测试。
- [completed] 运行聚焦测试、全量 Vitest、生产构建和 diff 检查。

## Follow-up：编辑页显式多选入口

- [completed] 增加编辑页“多选/退出多选”模式，使普通点击可连续勾选任务，同时保留首页原有详情点击和 Ctrl/Cmd 多选行为。
- [completed] 解除编辑页任务卡片原生图片拖拽与鼠标框选的冲突，使编辑页无需进入模式即可直接拖框多选。
- [completed] 增加选择态角标与回归测试，并重新执行全量测试、构建和 diff 检查。

## Decisions

- 优先复用现有 store action、TaskGrid 和 InputBar 批量操作，不复制第二套任务选择逻辑。
- 页面草稿优先持久化到现有 Zustand 页面草稿，而不是常驻渲染三个重型页面；若真实结构不支持低复杂度实现，再向用户确认。
- 删除操作必须通过现有引用清理机制，不能直接删除 IndexedDB 图片记录。
- 工作区当前干净。

## Errors Encountered

- 首次切换活动计划时使用了错误的上一计划目录名 `2026-08-25-style-image-fill`；读取 `.planning/.active_plan` 后确认真实名称为 `2026-08-25-style-reference-fill`，未产生文件改动。
- 首次搜索页面路由时 PowerShell 字符串中的双引号破坏了 `rg` 正则，得到未闭合分组错误；其他并行审计结果正常，后续改用单引号或分拆固定字符串搜索。
- 首次构建发现抽取批量工具栏时误删了 InputBar 其他功能仍使用的 `tasks` selector（两处 Agent/结果逻辑）；已仅恢复该 selector，不恢复已迁出的批量处理代码。
- 共享工具栏首次 SSR 测试返回空字符串：Zustand 在服务端渲染使用初始快照，不读取测试中后设的状态。已在该测试文件内用保持 action/static 方法的 selector mock 读取实时 store，不改变生产组件。
