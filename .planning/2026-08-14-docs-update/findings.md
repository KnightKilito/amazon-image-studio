# 调研记录

- 现有用户文档主要位于 `README.md` 与 `src/docs/01-listing.md`、`02-premium-aplus.md`、`03-operations.md`。
- `README.md` 已提到 Listing 文案、高级 A+ 与图片编辑，但更像功能概览；需要补充新页面的入口、完整操作流程和页面间衔接。
- `src/docs/04-changelog.md` 已记录 Listing 编辑页和图片编辑页，但尚未形成面向用户的具体操作说明。
- 当前代码入口：`Header.tsx` 提供 `Listing 文案`、`图片编辑` 页面；`ListingCopyWorkspace.tsx` 负责文案生成/优化/历史，`ImageEditorWorkspace.tsx` 负责图片编辑、A+ 目标、切片和提示词准备。
- Listing 文案页实际提供：Marketplace 选择、产品事实/成本与物流字段、最多 8 张产品参考图、内置知识库查看、AI 生成、历史版本恢复/删除、标题策划分析、中英文文案编辑与复制、当前文案二次优化、FBM/FBA 定价利润预估。
- 图片编辑页实际提供：输入图/风格参考/输出结果切换、AI 编辑提示词输入、遮罩编辑、将结果继续编辑、当前图预览/下载、Premium A+ 或 Mobile A+ 目标选择、A+ 母图切割、浏览器本地等比放大、准备转为高级/手机 A+。
- 高级 A+ 当前文档已覆盖独立模块、自由编排、连续母图和切图；品牌故事部分仍需按最新代码补充“独立品牌故事/高级 A+ 内嵌品牌故事”的区别、卡片数量和策划注意事项。
