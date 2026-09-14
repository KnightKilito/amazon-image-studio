# Findings

- `SizePickerModal.tsx` 的“设置图像尺寸”窗口把 `onClick={onClose}` 绑定在整个全屏根容器上，内容面板仅靠 `stopPropagation`；从数字输入框按下、拖到面板外松开时，浏览器合成的 click 会落到共同祖先根容器，因此误触发关闭。
- `BatchImageResizeDialog.tsx` 的“批量调整图片尺寸”使用了同样的根容器 click + 面板 stopPropagation 写法，宽高文本框存在相同风险。
- 设置页不会复现，是因为全屏根容器不处理 click，只有作为独立兄弟节点的遮罩层绑定关闭；从内容区拖到遮罩的手势，其合成 click 落在共同祖先而不是遮罩层，所以不会关闭。
- 最小且一致的修复是把两个尺寸弹窗的关闭点击从全屏根容器移到实际遮罩元素，保留面板、关闭按钮、取消和 Escape 行为不变。
- 两处修复无需额外 pointer 状态：独立遮罩与内容面板为兄弟节点，跨区域框选产生的 click 会落在共同祖先，而共同祖先不再绑定关闭事件。
- 聚焦测试 `BatchImageResizeDialog.test.tsx` 1/1 通过；全量测试 45 个文件、434 项全部通过。
- 生产构建明确以退出码 0 通过；`git diff --check` 通过，仅有 Windows LF/CRLF 转换提示和项目既有的大 chunk 警告。
