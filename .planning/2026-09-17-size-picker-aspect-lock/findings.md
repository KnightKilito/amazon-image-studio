# Findings

- 当前任务开始时工作区包含此前已完成需求的未提交改动；本次不会回退这些内容。
- `SizePickerModal` 自定义宽高目前只有两个独立 number 输入框，中间是不可交互的乘号图标；没有比例状态或同步换算。
- `BatchImageResizeDialog` 已有成熟实现：`ratioLocked` 默认 true、`lockedAspectRatioRef` 保存锁定比例、宽高 onChange 调用 `getLockedResizeCompanionDimension`，重新上锁时按当前有效宽高刷新比例。
- 共享换算函数已有单元测试，覆盖 4:3、16:9 和无效输入；SizePicker 可直接复用，避免产生不同取整规则。
- 批量窗口的锁/解锁按钮具备 aria-label、aria-pressed、title 和明暗主题样式，可按 SizePicker 的较柔和表单风格复用结构。
- 组件层目前没有 `SizePickerModal` 测试；可增加服务端静态渲染测试，确认自定义尺寸初始渲染为锁定按钮，并继续依赖共享纯函数测试换算精度。
- SizePicker 已增加默认开启的比例锁、初始宽高比 ref、双向联动 onChange 和重新上锁时的有效整数校验；无效/空输入不会覆盖另一边。
- 自定义宽高布局改为三列网格，锁按钮位于两个输入框之间，并用说明文字明确当前锁定状态；锁/解锁均有 aria-label、aria-pressed 和 title。
- 新增 `SizePickerModal.test.tsx`，确认自定义尺寸模式默认渲染闭锁状态；与共享换算测试合计 7 项通过，生产构建与差异检查通过。
- 最终全量验证通过：46 个测试文件、437 项测试全部通过；生产构建和 `git diff --check` 通过，仅有项目既有的大 chunk 与 Windows LF/CRLF 提示。
