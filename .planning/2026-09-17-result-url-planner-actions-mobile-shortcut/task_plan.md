# 结果 URL 展示、AI 策划操作区与手机 A+ 快捷入口

## Goal

在图片生成结果详情页直接展示后台返回的图片下载 URL 并支持逐条/全部复制；优化截图中拥挤的 AI 策划操作区；把结果卡片“转为手机 A+”快捷按钮放到重试按钮右侧。

## Phases

- [completed] 审计任务原始 URL 的保存链路、详情页现有链接入口、AI 策划布局和卡片按钮顺序。
- [completed] 实现详情页 URL 常驻展示与复制交互，并覆盖下载失败但 URL 已返回的情况。
- [completed] 重构 AI 策划主/辅助操作布局，改善截图所示宽度下的拥挤与层级。
- [completed] 调整结果卡片手机 A+ 快捷按钮位置到重试按钮之后。
- [completed] 补充测试并运行全量测试、构建、差异与页面验收。

## Decisions

- 展示 URL 的来源必须是后台真实响应中已经保存的地址，不从本地图片 ID 或 Blob URL 反推。
- URL 区域默认可见且可复制；多图时逐条编号，并提供“复制全部”。
- AI 策划按钮区保持 AI 策划作为主操作，其余属于辅助操作，避免全部挤在一条视觉基线上。
- 现有手机 A+ 快捷能力只移动位置，不复制状态或转换逻辑。
- 保留当前工作区已有改动，只修改本需求相关文件和计划记录。

## Errors Encountered

- 首次搜索 API 文件时包含了不存在的 `src/lib/imageApi.ts`，`rg` 返回文件不存在；实际入口分布在 `imageApiShared.ts`、`openaiCompatibleImageApi.ts` 与 `falAiImageApi.ts`，后续使用这些真实文件。
- 搜索 Fal 测试时再次把 `src/lib/*.test.ts` 作为 PowerShell 位置参数，触发 Windows 通配符路径错误；随后直接读取已定位的 `falAiImageApi.test.ts`，不再使用该命令形式。
- 第一次更新计划记录时把错误日志的目标文件写成了 `findings.md`，补丁上下文不匹配而被安全拒绝；随后按实际文件位置拆分更新。
- `computer-use` 浏览器清单读取失败，当前没有可用浏览器控制端；不会操作用户线上业务页面，改用用户截图、响应式源码复核、测试和生产构建完成界面验收。
- 最终提取交付行号时，PowerShell 双引号转义使组合 `rg` 正则丢失引号并报未闭合分组；改用 `Select-String -SimpleMatch` 分文件获取，不影响源码或验证结果。
