# 使用文档完善计划

## 目标

根据当前代码与界面，补充高级 A+ 品牌策划、Listing 文案页和图片编辑页的使用说明，并完成文档一致性检查。

## 阶段

- [complete] 盘点现有文档与对应功能入口
- [complete] 编写/更新用户使用文档
- [complete] 校验链接、术语和构建结果

## 错误记录

| PowerShell 变量插值错误 | 读取组件片段时字符串中的 `$path:` 被误解析 | 改用 `${path}` 形式后重试 |
| `npm.cmd run build` 类型检查失败 | 现有 `src/lib/clipboard.test.ts` 第 17 行对空数组/undefined 的类型断言报错 | 文档改动未触及该测试；改用文档测试和 Vite 构建分别验证 |
