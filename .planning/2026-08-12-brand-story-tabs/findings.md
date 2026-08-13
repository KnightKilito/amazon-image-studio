# 实施发现

- 当前 `APlusContentType` 只有 standard / standard-large / premium / mobile。
- 当前高级 A+ 独立模块默认把两张 463x625 `brand-story` 卡混在主模块中，没有背景图。
- 自由编排已有完整 `A+BS-BG + A+BS-Cxx` 构建逻辑，但品牌故事配置仅在自由编排编辑器中。
- 当前品牌故事提示词笼统要求“商品专属”，需要改成唯一品牌介绍卡 + 商品模特卡的明确职责。
- 当前会话已经保存 `premiumBrandStoryEnabled` 与 `premiumBrandStoryCardCount`，但没有独立品牌故事内容类型。
- 已抽出统一品牌故事规格构建器，独立 Tab 与高级 A+ 两种布局共用背景、卡片、生成尺寸和提示词规则。
- 高级 A+ 独立模块的六张默认主图已改为 1 张 Hero + 5 张 1464x600 特性图，不再混入竖版品牌故事卡。
- 切换 A+ 类型时清空当前会话 ID；品牌故事 Tab 与高级 A+ 后续策划将分别创建历史记录。
- 旧会话缺少 `premiumBrandStoryEnabled` 时仍按 `false` 恢复，新建页面状态默认开启。
