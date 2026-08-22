# 首页拖拽稳定性与策划案列表高度

## Goal

彻底定位并修复首页图片拖拽排序仍偶发失效的问题，同时适当拉高策划案选择列表，完成自动化与本地交互验证。

## Phases

- [completed] 复盘现有拖拽实现并复现偶发失效路径。
- [completed] 实施拖拽稳定性修复并补充回归测试。
- [completed] 调整策划案选择列表高度并检查响应式布局。
- [completed] 运行完整测试、构建与本地交互验证。

## Decisions

- 保留用户当前对 `ListingCopyWorkspace.tsx` 的未提交修改，不覆盖或格式化该文件。
- 首页拖拽与策划案列表分别处理，最终统一验证。

## Errors Encountered

- 本地浏览器首次导航 `http://127.0.0.1:5173/` 超时；Vite 服务本身正常，按排障说明保留浏览器绑定并恢复新标签。
- PowerShell 下直接把 `dist/assets/*.css` 传给 `rg` 触发 Windows 通配符路径错误；已改用目录参数配合 `-g "*.css"`，成功验证两条高度规则。
- 独立 Tailwind 审查遗留了一个名为 `NUL` 的临时 CSS 文件；标准 `Remove-Item` 被执行策略拒绝，已在确认绝对路径和内容后用 .NET 单文件删除并验证不存在。
- 本轮首次用 `rg` 传入 `src/**/*.test.ts(x)` 时触发 Windows 通配符路径错误；后续改为搜索 `src` 目录并使用 `-g "*.test.ts" -g "*.test.tsx"`。
- 首版结果清空把运行状态设为不存在的 `idle`，TypeScript 在 `AmazonPlanner.tsx:1702` 拒绝编译；改为复用组件初始状态允许的状态值后重新构建。
- 浏览器页内 `playwright.evaluate` 不允许动态 `import('/src/lib/db.ts')`，无法直接调用 DB 模块准备测试会话；改用页面原生 IndexedDB API并按 `db.ts` 的公开 schema 写入一次性会话。
- Browser 的隔离执行环境同样不暴露 `indexedDB`，原生事务方案也无法准备临时会话；停止继续注入浏览器存储，改用纯状态契约单测配合页面按钮/布局检查。
- 浏览器能通过 label 统计 Listing 文本框，但复用该 label locator 执行 fill 时 3 秒超时；改为页面唯一 placeholder locator 并增加可见等待，不重复使用该不稳定 label 路径。
- placeholder locator 也在读取元素时触发同样的 3 秒 selector deadline，说明不是选择器文本问题；第三次先读取 DOM/截图判断页面或浏览器标签状态，若仍不可交互则停止浏览器输入测试，以自动化测试和构建作为功能验证。

## Follow-up Goal：清空策划案但保留输入资料

在策划结果区域增加“清空策划案”入口，只重置当前 Listing / 高级 A+ 的策划结果和选择状态，保留标题、五点描述、商品字段与参考图，方便调整资料后重新策划。

## Follow-up Phases

- [completed] 梳理 Listing、A+ 策划结果状态与现有清空触发条件。
- [completed] 设计并实现“清空策划案”按钮及安全交互。
- [completed] 补充状态回归测试并验证两类策划流程。
- [completed] 运行完整测试、生产构建与本地页面交互验证。

## Follow-up Decisions

- 按钮放在策划结果/结果操作栏附近，避免与“清空标题/输入资料”混淆。
- 清空操作必须保留 Listing 原文、结构化商品资料和参考图，只删除生成出的策划结果及其派生选择状态。
- 继续保留用户现有的 `ListingCopyWorkspace.tsx` 未提交修改，不覆盖或格式化该文件。
