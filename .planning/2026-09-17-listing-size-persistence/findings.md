# Findings

- 当前工作区包含上一项已完成需求的未提交改动；本次只在相关持久化链路上增量修改。
- `AmazonPlanner` 的 `listingTargetSize` 目前以组件 state 初始化为固定默认值 `DEFAULT_LISTING_TARGET_SIZE`；页面刷新会重新执行该默认初始化。
- 用户选择尺寸时只调用 `setListingTargetSize`，并尝试更新“当前策划历史 session”；当尚未创建 session、session 写入延迟或页面只是普通重载时，没有独立持久化来源可以恢复最后一次选择。
- 策划历史数据结构虽然已有可选 `listingTargetSize`，但它属于某次历史快照，不等于用户全局的最后尺寸偏好；恢复某条历史还会主动覆盖当前尺寸。
- 项目 Zustand 持久化目前覆盖页面参数、设置和输入草稿，但没有 Amazon Planner 的 Listing 尺寸偏好字段。
- `listingImageSize.ts` 已提供 `normalizeListingTargetSize`、默认值和会话兼容函数，可以直接复用于 store 持久化校验，无需新增一套尺寸解析规则。
- 最稳妥的方案是把当前 Listing 尺寸提升为 Zustand 持久字段：组件直接订阅 store，不再用 `useState(DEFAULT...)`；这样 localStorage hydration、Tab 卸载重挂载和历史恢复都只使用一个数据源。
- 历史恢复当前会设置会话保存的尺寸；改为 store 后该恢复结果也会成为当前持久尺寸，后续刷新保持恢复后的实际页面状态。
- 清空策划案与清空输入目前没有主动设置尺寸，因此迁移后会自然保留当前尺寸，符合需求。
- 已新增 `amazonPlannerListingTargetSize` Zustand 持久字段和规范化 setter；AmazonPlanner 直接订阅这一字段，移除了组件本地默认 state，因此 hydration 和组件重挂载不会再回落默认值。
- 策划历史恢复继续调用同一 setter，恢复后的尺寸会成为当前持久状态；普通清空流程不触碰该字段。
- 新增 store 回归测试覆盖：用户选择值进入持久快照、刷新合并恢复、旧版无字段回落默认、非法持久值安全回落默认。
- 聚焦测试 2 个文件、102 项通过；生产构建和差异检查通过。
- 最终全量验证通过：45 个测试文件、436 项测试全部通过；生产构建和 `git diff --check` 通过，仅有项目既有的大 chunk 与 Windows LF/CRLF 提示。
