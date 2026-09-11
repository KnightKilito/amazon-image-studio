# Findings

- 当前工作区包含上一项已完成但尚未提交的 Tab 滚动、策划保活和风格空槽修复；本任务必须保留这些改动并避免无关格式化。
- AmazonPlanner 当前只有本地 `resolution: '2k' | '4k'`，Listing 目标尺寸被硬编码为 `2048x2048` 或 `4096x4096`；A+ 则通过 `resolutionTier` 和模块规格计算各自生成尺寸。
- 策划历史快照当前保存 `resolution` 字段，恢复链路也以该字段为基础；新增自定义 Listing 尺寸需要扩展会话字段并向旧会话兼容，而不能把任意宽高塞进 A+ 的 tier。
- 当前 AI 策划配置名称与 AI 策划/清空/设置按钮位于同一区域，需要读取精确 JSX 后拆成“配置信息行 + 操作行”。
- 正式生图前 `applyPrompt` 会把 `targetSize` 写入全局 TaskParams，因此 Listing 自定义尺寸只要替换 `listingTargetSize` 即可贯穿填入与提交；TaskParams.size 本身是 string。
- 项目已有 `normalizeImageSize` 支持任意 `宽x高` 字符串并按接口边界规范化，自定义选择器应复用它显示/保存最终实际尺寸，避免提交时再次悄悄变化。
- 当前策划 API 只收到 Listing 图片数量，没有收到 Listing 目标尺寸；要让“策划前指定尺寸”真正影响构图，必须把尺寸传进策划提示词，而不只是最后生图参数。
- AI 配置 JSX 当前是两列 grid：左侧配置卡、右侧可增长的按钮组。按钮一多，配置卡被压缩；应改为配置卡独占整行，操作组在下一行横向换行。
- 顶部尺寸目前是 Listing/A+ 共用的 2K/4K 双按钮。最小风险方案是：Listing 模式替换为一个“尺寸 2048×2048/自定义值”按钮打开选择器；A+ 模式继续保留原 2K/4K 档位与模块尺寸算法。
- `normalizeImageSize` 的通用约束是 16 倍数、最长边 3840、像素面积约 0.65M–8.29M、比例不超过 3:1，但当前 Listing 4K 预设直接使用 4096×4096。不能未经审计就用通用 normalize 改写现有 4K 行为。
- 恢复策划历史时只调用 `setResolution(session.resolution)`；新增 `listingTargetSize` 应以可选字段加入会话，旧会话按 resolution 映射为 2048×2048/4096×4096。
- 正式提交会通过 `normalizeParamsForSettings` 再次规范任意 size；因此选择器应展示保存后的规范尺寸，保证预览与实际一致。现有 4096×4096 在正式提交时本来也会进入该规范链。
- 工程已有成熟的 `SizePickerModal`，支持分辨率档位、比例和“自定义宽高”，InputBar 正在使用。优先复用它，不再复制一套尺寸表单；AmazonPlanner 只需提供 Listing 专属按钮、当前值和回调。
- `SizePickerModal` 在 `allowAuto={false}` 时直接提供按比例与自定义宽高两种模式，且包含 2K/4K 档位、最终规范尺寸预览和模型限制说明，完全覆盖本需求；保留其额外 1K 档位不影响 2K/4K 默认选项。
- 策划 API 的系统提示词和用户输入文本都可接收一个新增 `listingTargetSize` 选项；在两处明确 exact canvas/aspect ratio，可确保 Chat/Responses 及紧凑回退请求都按尺寸策划。
- `SizePickerModal` 没有现有组件测试，但 API 简洁：`currentSize/onSelect/onClose/allowAuto`；AmazonPlanner 可直接复用，用户确认后回调返回已经规范化的最终尺寸。
- 策划请求的 Chat 与 Responses 分支分别调用同一个 `buildPlannerInputText`，系统提示则分别走 `buildChatPlannerSystemPrompt`/`buildPlannerInstructions`；新增尺寸选项必须同时向这三处透传。
- 策划历史卡目前不展示 resolution，因此新增尺寸字段不必改卡片布局；恢复函数和“恢复后回写规范会话”需要补字段即可。
- 首版实现复核：Listing 目标尺寸已从 A+ `resolution` 中解耦，默认 2048×2048；SizePicker 确认后才更新，切模式、清空策划结果和普通重新策划都不会重置。
- 旧 4K Listing 会话恢复为当前模型约束下实际使用的 2880×2880（4K 像素预算档位），避免继续显示 4096×4096、正式提交又被规范化的不一致。
- 配置卡已改成整行 `space-y` 结构，配置摘要使用单行截断和 title 提示；所有操作按钮在独立下一行换行，不再挤压配置名称。
- 直接创建本地隔离浏览器标签的替代连接方式成功；真实首页显示单个“尺寸 2048 × 2048”按钮，顶部说明同步显示“2K / 4K / 自定义尺寸”。
- 点击尺寸按钮后，弹窗清楚提供 2K、4K、按比例与“自定义宽高”；切到自定义后正确显示宽度/高度输入和模型规范提示。
- 真实输入 1600×2000 后，弹窗“将使用”实时更新为 1600x2000；确认后顶部按钮、合规“图片规格”和 Prompt Preview 三处同步变为 1600×2000。
- 切换到 A+ 后仍显示其原有 2K/4K 控件；返回 Listing 后自定义 1600×2000 完整保留，满足“除非重新选否则不重置”。
- 页面验证同时发现一个边界：A+ 尚未选中策划模块时，通用 `targetSize` 回退到了 Listing 自定义尺寸，导致 A+ Prompt Preview 暂时显示 1600×2000。需改为 A+ 首模块生成尺寸回退，彻底隔离两套尺寸。
- A+ fallback 修复后真实页面显示其首模块 3536×1184，Listing 返回后仍是 1600×2000；自定义 Listing 尺寸不再影响 A+。
- 实际布局测量确认配置卡与操作区宽度均为 389px，但操作区 top 在配置卡 bottom 下方 8px，确实为独立两行；配置摘要计算样式为 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`，不会再被按钮挤成多行。
- icons.tsx 已有 `ExternalLinkIcon` 与 `HelpCircleIcon`，可直接用于连通性链接和问号说明，不需要新增图标资产。
- 操作栏当前把所有按钮直接放在同一个 flex 中；最小改动是保留 AI 策划/停止为左侧组，其余查看、清空、连通性、问号、设置放入 `ml-auto` 右侧组。
- 实时页面已显示 `连通性检测` 外链和问号按钮；点击问号后弹窗标题、说明文字及 `打开 OpenAI 服务状态页` 外链均可见，链接目标为 `status.openai.com/`。
- 最终全量 Vitest 为 43 个测试文件、426 项测试，全部通过；TypeScript/Vite 生产构建和 `git diff --check` 通过，仅有项目既有的大 chunk 提示。
- 上一任务的 App、InputBar、appNavigation、store 改动完整保留；本轮新增/修改集中在 AmazonPlanner、策划 API、会话类型和 Listing 尺寸工具。
- 最终连通性入口由现有图标系统实现：右侧 `ExternalLinkIcon` 外链按钮 + `HelpCircleIcon` 弹窗按钮；弹窗和按钮都指向用户指定的 OpenAI 状态页。
- 最终全量 Vitest 为 43 个测试文件、426 项测试，生产构建、真实页面回归和 `git diff --check` 均通过；Vite 仅报告未启动可选 admin-api 的既有代理错误。

## Follow-up：Listing 参考图同步

- ListingCopyWorkspace 的参考图是组件本地 `referenceImages: InputImage[]`，会通过 `referenceImageIds` 保存到文案草稿/版本，并在恢复时用 `ensureImageCached` 重新读取。
- 首页参考图位于全局 store 的 `inputImages`，同步应使用现有 `setInputImages`/`addInputImage` action，而不是复制图片记录；这些 InputImage 已在 IndexedDB 中存在，可以直接复用 ID 和 dataUrl。
- 替换入口仍放在“产品参考图”标题右侧，但按钮明确命名为“替换首页参考图”；清空图片和上传参考图在同一操作组中改为窄屏堆叠、桌面横排。
- `setInputImages` 可一次替换首页输入图并同步 gallery 草稿；替换 helper 负责 Listing 内部 ID 去重和首页容量截断，并给出重复/超限反馈。
- 首页限制要把当前风格参考槽位占用计入可用容量，避免同步后超过全局 `referenceImageUploadLimit`。
- 本地 Listing 文案页真实回归在无参考图初始状态下按钮按预期隐藏；有图时由条件渲染显示在“产品参考图”标题右侧。由于浏览器上传属于文件外传操作，本次未通过 UI 上传测试文件，纯逻辑测试覆盖了合并/去重/容量边界。
- 最终全量 Vitest 为 44 个测试文件、428 项测试，生产构建和 `git diff --check` 通过；保留上一任务及用户已有的 package/changelog 等未提交改动。
- 最终页面空状态真实加载通过；未上传本地文件，避免无额外确认的文件外传。

## Follow-up：同步替换与文案页布局

- 当前同步 helper 是追加合并语义，按钮位于“产品参考图”标题右侧，与上传/清空共用一个 flex；用户明确要求改为直接替换首页 `inputImages`，因此应改 helper/测试为 replacement contract，并在 setter 后清理被替换的无引用旧图。
- Listing 文案页的“商品预设”选择器在产品资料卡标题下方；“清空文案”对应 `clearProductCopy`，应移动到预设控件正下方的独立按钮行，不再与参考图操作混排。
- 参考图操作在窄屏下适合堆叠为全宽按钮，桌面端再横向排列；这样不会因按钮文字和标题宽度同时竞争而挤压。
