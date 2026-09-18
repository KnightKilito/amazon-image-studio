# Findings

- 详情页当前在按钮文案、弹窗 `format` 和确认提交三个位置都用 `task.category?.aPlusType === 'mobile' ? 'mobile' : 'premium'` 推断；分类缺失或上传图默认都会落到高级 A+，正是误报来源。
- `ImageSliceDialog` 当前只允许选择切片数量，格式由父组件固定传入，`onConfirm` 也只返回数量。
- 底层 `validateAPlusMotherGeometry(width, height, count, format)` 和 Canvas 切片函数已经完整支持 premium/mobile；错误只在 UI 输入层，不需要修改算法或数据库。
- 当前比例校验是警告型：即使比例不匹配仍允许按高度等分切割。新交互应继续允许用户确认，只让提示随用户选定类型实时切换。
- 图片编辑页已经在右侧先选择 A+ 类型再打开同一弹窗；为避免重复入口改变现有流程，弹窗增加可选的类型选择开关，详情页开启、编辑页保持现状。
- 新增组件测试覆盖详情页显式类型选择与编辑页紧凑模式；几何测试明确约束同一张 1200x2700 三片母图在 mobile 下有效、premium 下无效，防止再次用错误类型误判。
