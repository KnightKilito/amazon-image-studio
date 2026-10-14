# 下载重试与 A+ 透明边排查

## Goal
增加仅重新下载图片的操作；本地启动，用历史 A+ 策划验证生图及透明边来源。保护已有改动，不重新策划或批量消耗额度。

## Phases
- [complete] 检查下载失败恢复链、A+ 尺寸处理与附件像素。
- [complete] 实现重新下载及 store 测试。
- [pending] 本地历史策划生图验证：等待用户浏览器连接，IAB 同 origin 也无历史配置。
- [complete] 完成回归检查与初步结论。

## Next Step
等待 Edge 连接恢复后，从用户历史高级 A+ 策划仅提交必要的验证生图，比较接口原图。

## Errors
- 初次浏览器 inventory：Edge 连接 nodeRepl.fetch 失败，尝试独立 IAB 本地标签。
- PowerShell rg 文件通配路径错误，改用目录搜索和 glob。
- 开发端口 5173 EACCES：现有用户服务已监听，另起临时 18080 服务成功。
- IAB 首次加载超时，重新绑定成功。
