# 图片下载状态与风格图等待提示

## Goal

中转站返回图片 URL 后，仍在下载的任务显示“下载中”及区别于生成中的 loading 颜色；风格图尚未生成完成导致提交不可用时，悬浮提示明确原因。

## Phases

- [completed] 审计详情页、任务卡状态展示与风格图提交按钮禁用链路。
- [completed] 根据运行任务的图片 URL 状态显示下载中，并调整 loading 颜色。
- [completed] 给风格图等待期间的灰色提交按钮增加可访问的悬浮提示。
- [completed] 做必要的聚焦测试、全量测试、构建和 diff 检查。

## Decisions

- 复用现有 `rawImageUrls` 数据，避免扩展任务数据库字段。
- 只对仍处于 running 且已经收到原始 URL 的任务显示下载中；完成或失败仍遵循原状态。
- 提示需在 disabled 按钮不可接收 hover 的情况下仍可触发。

## Errors Encountered

- 首次构建发现 `styleImageSubmitHint` 引用了稍后声明的 `currentActionSubmitted`；已把提示计算移到该状态声明之后。
