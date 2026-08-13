# 实施发现

- 项目是 React 19 + Vite + TypeScript + Tailwind，包名和仓库标识必须保持不变。
- 当前工作区已有 Brand Story 功能的未提交改动，涉及 AmazonPlanner、类型、Listing 策划和 README。
- 现有自定义 `Select` 已具备动画、暗色模式和自适应展开能力；高级 A+ 内容定位使用一组局部紧凑样式。
- 现有活动 planning 记录属于 Brand Story，Listing 文案功能使用独立目录且不改 `.planning/.active_plan`。
- 路由当前仅支持 `home`/`editor`，Header 由共享 `AppPage` 状态驱动；新页面可以沿用 hash 路由而不引入路由库。
- 图片策划历史快照由 `AmazonPlanner` 直接创建并通过 `taskHistory` 写入 IndexedDB，站点字段可在快照与恢复处做向后兼容。
- 网站不是 Sites starter，且没有 `.openai/hosting.json`；实施时保留现有 Vite/Cloudflare/GitHub Pages 架构。
- 浏览器验收确认桌面端两列宽度一致，手机端无横向溢出；图片数支持 7-12，目标站点支持键盘展开且仅显示美国站。
- 小屏 Header 使用“亚马逊AI”短品牌名并保留三个导航入口，隐藏次要安装/帮助按钮，390px 下所有主导航均完整可见。
- 文案 AI 使用现有策划 profile，支持 Responses/Chat、流式读取、参考图压缩、带图失败纯文本回退，以及一轮规则修复。
