# Findings

- 现有图片编辑页已提供单图 A+ 等比/自定义放大，入口位于右侧“局部与本地处理”区域。
- 单图放大使用共享 `canvasImage` 的加载与编码能力，输出图以 `source: 'derived'` 保存，并创建新的已完成任务。
- 现有 `createAPlusUpscaleTaskFromImage` 还包含同一任务多图批量放大逻辑，但通用批量调整需要允许跨素材/结果图选择、缩小、不同格式与质量，因此应新增独立通用处理模块。
- 编辑页可稳定提供的批处理候选是当前 `inputImages`、风格参考图和当前活动任务的 `outputImages`；底部历史已有“整条任务作为素材”能力，因此无需再复制历史选择器。
- `StoredImage` 已保存宽高但未保存字节数；预估值可由 data URL 的实际编码字节数、源/目标像素比、源/目标格式和质量系数计算，界面必须明确标注为估算而非编码后的精确值。
- 通用调整不能复用 `getCustomUpscalePlan`，因为后者刻意禁止缩小和同尺寸；需要独立的 `contain`（等比适应目标边界）与 `stretch`（固定宽高）尺寸计划。
- `TaskRecord.actualParamsByImage` 可记录批量等比适应时每张不同的真实输出尺寸；无需修改 IndexedDB schema 或任务类型。
