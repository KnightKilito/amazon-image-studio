# Findings

- 当前管理员只维护一组 `modelIds`，`Header` 的管理员弹窗可添加/删除。
- 设置页生图模型已经引用 `adminAccess.modelIds` 显示候选；策划模型需继续检查两个输入布局。
- 当前真正显示的 `renderProfileBasics` 窗格中，图片模型和策划模型都只有普通 `<input>`；旧的可输入下拉实现在 `{false && (...)}` 隐藏区，解释了功能回退。
- 管理员配置保存到服务端 JSON，并在客户端 `store.ts` 与 `server/adminServer.mjs` 各做一次规范化；新增字段需要两边同步，旧 `modelIds` 继续作为图片模型选项。
- 新 UI 可以抽取一个小型可输入下拉组件，供实际生图和策划窗格复用，保留自由输入与当前 profile.model 的更新机制。
- 当前设置弹窗主体有滚动容器，因此新下拉按可用空间自动向上或向下展开，避免模型字段靠近底部时选项被遮挡。
- `modelIds` 原字段保留并用于图片模型列表；`plannerModelIds` 新字段在客户端和服务端分别做清洗、去重和默认空列表。用户已有的 `profile.model` 文本不做迁移或覆盖。
