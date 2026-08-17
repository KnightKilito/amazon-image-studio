# 亚马逊AI工作台

面向 Amazon Listing 与 A+ Content 的 AI 文案、图片策划和生成工作台。输入商品信息与参考图，即可生成中英文 Listing 文案、利润建议、分镜方案、提示词并逐张出图。

[🌐 作者博客](https://meochun.fun) · [🐛 反馈问题](https://github.com/KnightKilito/amazon-image-studio/issues) · [📝 更新日志](#-更新日志)

> 在线体验和本地应用均不内置 API Key。请使用自己的 OpenAI 或兼容服务，并自行承担调用费用。

## ✨ 功能

- 🪶 Listing 图片策划：默认 `MAIN + PT01-PT06`，可自定义为 `7-12` 张。
- 📝 Listing 文案：生成美国站 Item Name、Item Highlight、五点、长描述、关键词与中文对照，并测算 FBM/FBA 利润。
- ✒️ A+ 图片策划：支持普通、标准、高级、手机 A+ 与独立品牌故事；高级 A+ 的独立模块和自由编排均可同步策划 From the brand。
- 🖼️ 图片编辑：支持 AI 编辑、输入主图切换、局部遮罩、A+ 母图切割、本地等比放大和高级/手机 A+ 转换准备。
- 💾 参考图、遮罩编辑、视觉风格、历史记录、批量下载与本地 IndexedDB 存储。
- 🧠 支持 OpenAI / OpenAI 兼容接口、OpenRouter，以及独立的 Chat Completions / Responses 策划配置。
- 📒 内置 Amazon 主图、附图与 A+ 尺寸规则；生成时会带入目标分辨率与合规约束。

## 📸 截图

<!-- 截图预留：上传后将图片放至 docs/screenshots/，并取消对应 img 标签的注释。 -->

<!--
<p align="center">
  <img src="docs/screenshots/overview.png" alt="亚马逊AI工作台主界面" width="100%">
</p>

<p align="center">
  <img src="docs/screenshots/planner.png" alt="Listing 与 A+ 图片策划" width="100%">
</p>

<p align="center">
  <img src="docs/screenshots/settings.png" alt="API 与管理员设置" width="100%">
</p>
-->

## 🚀 快速开始

要求：Node.js 20+、npm。

```powershell
npm ci
npm run dev
```

打开终端显示的地址，通常为 `http://127.0.0.1:5173/` 。Windows 也可双击 `start-amazon-image-studio.bat`；停止服务请按 `Ctrl + C`，或运行 `stop-amazon-image-studio.bat`。

常用命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发环境 |
| `npm run build` | 构建静态文件到 `dist/` |
| `npm run test` | 运行测试 |
| `npm run admin:server` | 启动管理员 API |

## 📖 使用流程

1. 在右上角设置中分别配置生图 API 与 AI 策划 API。
2. 进入 [`Listing 文案`](src/docs/05-listing-copy.md)，填写产品事实、成本和重量，按需上传参考图，生成并检查中英文文案、标题分析与建议定价。
3. 返回首页选择 `Listing 图` 或 `A+ 图`，粘贴已确认的文案并执行 AI 策划；高级 A+ 可选择独立模块、自由编排和是否同步策划 From the brand。
4. 在 [`图片编辑`](src/docs/06-image-editor.md) 中继续处理素材：可做 AI 局部编辑、遮罩、A+ 母图切割或本地等比放大。
5. 逐张提交生成；文案版本、图片结果和本地处理派生任务均保存在本地历史中，可恢复、筛选、复用、编辑或下载。

生图建议使用 `Images API (/v1/images)` 与 `gpt-image-2`。策划使用文本或多模态模型，建议选择 `Chat Completions (/chat/completions)` 或 `Responses API (/v1/responses)`。DeepSeek 官方 Chat Completions 不接收参考图，应用会自动以纯文本请求策划。

## 🛠️ 管理与部署

前端可作为 Vite 静态站点部署，构建命令为 `npm run build`，输出目录为 `dist/`。GitHub Pages、Cloudflare Pages 等静态托管均可使用此构建产物。

需要统一管理游客权限、API URL、模型列表和参考图上限时，另行部署 Node 管理 API 与 MySQL：

```powershell
Copy-Item config.example.yaml config.yaml
npm run admin:server
```

编辑 `config.yaml` 中的管理员账户和 MySQL 连接信息。生产环境需将 `/admin-api` 反向代理到 Node 服务；跨域 API 才需要启用可选的 `/api-proxy`，并应通过 `allowedTargets` 限制目标地址。部署示例见 [config.example.yaml](config.example.yaml) 与 [deploy/nginx.conf](deploy/nginx.conf)。

### 部署 FAQ

**构建或启动失败怎么办？** 确认使用 Node.js 20+，在项目根目录执行 `npm ci` 后重试。部署静态站点时，安装命令为 `npm ci`，构建命令为 `npm run build`，发布目录为 `dist/`。

**为什么管理员设置没有生效？** 静态前端不保存统一配置。确认 Node 管理 API 正在运行、MySQL 可访问，且生产反向代理已将 `/admin-api` 转发至该服务。

**什么情况下需要 `/api-proxy`？** 仅当第三方 API 不允许浏览器跨域请求时启用。公网环境不要开启无目标限制的转发，优先以 `allowedTargets` 配置白名单。

**本地端口被占用怎么办？** 停止已有开发服务，或使用 Vite 输出的其他端口；Windows 脚本可运行 `stop-amazon-image-studio.bat`，不会强制结束无关进程。

## 📄 许可与来源

本项目以 [MIT License](LICENSE) 发布，基于 [CookSleep/gpt_image_playground](https://github.com/CookSleep/gpt_image_playground) 和 [Ali-Aria/amazon-image-studio](https://github.com/Ali-Aria/amazon-image-studio) 修改。源码不包含任何 API Key、模型服务或免费调用额度。

## 📝 更新日志

按自然周（周一至周日）整理，最新一周在最上方。完整记录同步维护于 [CHANGELOG.md](CHANGELOG.md)。

<details open>
<summary><strong>2026-08-03 至 2026-08-09</strong> - v0.2.1：AI 标记与历史记录分页</summary>

- 下载图片时可写入 AI 生成标记，便于后续识别和管理。
- 历史记录新增分页浏览，改善大量任务下的查找与操作体验。
- 修复新建 API 配置的异常处理；同步整理 README、站内版本日志和应用版本标识。
- 提交：`565b35a`、`c7f1b42`、`b6e100d`。

</details>

<details>
<summary><strong>2026-07-27 至 2026-08-02</strong> - 高级 A+ 母图、切图与本地批量放大</summary>

- 高级 A+ 新增独立模块与自由编排，可将独立大图、连续母图、轮播图和品牌故事组合为一套内容结构。
- 连续母图支持按计划一次生成，并在图片详情中按高度等分切割；切图前会校验实际尺寸与比例，避免静默拉伸或裁切。
- 优化转为手机 A+ 流程，支持确认母图片数并按移动端比例生成、切割连续内容。
- 高级 A+ 与手机 A+ 图片支持浏览器本地等比放大，支持一次处理多张图片，原图不会被覆盖。
- 修复切图数量限制，提升多片母图的可用性；同步完善高级 A+、切图与站内使用文档。
- 提交：`d5daf97`、`5fb5c0e`、`f4f10a3`、`3dfa58a`。

</details>

<details>
<summary><strong>2026-07-20 至 2026-07-26</strong> - 默认输出参数与视觉风格体验</summary>

- 新建任务和“编辑输出”统一默认使用 `PNG` 与 `high` 质量，减少重复配置。
- 优化图片详情页、模块概述与生成操作区的布局和按钮排列。
- 调整视觉风格编辑与选择界面，改善策划过程中的信息层级。
- 提交：`bc9cd6c`、`358d0c3`、`5dfa440`、`2d3c40c`、`41773b6`。

</details>

<details>
<summary><strong>2026-07-13 至 2026-07-19</strong> - AI 风格图优化</summary>

- 修复风格图上传和保存异常。
- 优化 AI 生成风格图的提示与策划逻辑，减少模板化输出。
- 提交：`07f76a6`、`1a1f18d`。

</details>

<details>
<summary><strong>2026-07-06 至 2026-07-12</strong> - A+ 转换与显式风格参考图</summary>

- 图片详情新增“转为高级 A+”和“转为手机 A+”快捷入口。
- 右侧参考图区域新增独立的风格参考图槽位，支持上传、替换、预览和移除；MAIN 主图会自动清空该槽位以避免误用风格图。
- 转换为高级 A+ 或手机 A+ 时不再继承隐藏风格参考图，并会按当前转换结果覆盖右侧输入内容。
- 提交：`a5bde15`、`66ea052`、`d306c39`。

</details>

<details>
<summary><strong>2026-06-22 至 2026-06-28</strong> - 管理员统一配置与接口兼容</summary>

- 新增管理员登录和统一配置管理，可控制游客查看或修改 API URL、修改服务商类型、创建自定义服务商，并配置模型列表和参考图上传上限。
- 新增 Node 管理 API 的 YAML / 环境变量配置读取，以及 MySQL 持久化的管理员与系统设置。
- 完善同源 API 代理与浏览器直连模式，修复 Node 转发请求问题。
- AI 策划在 Responses API 不兼容时会自动降级重试 Chat Completions，并修复第三方中转站、参考图上限和不支持流式响应的兼容问题。
- 提交：`1e98206`、`37ec732`、`8ce1264`、`8d35648`、`fd6ab8c`、`be8ea59`、`15deaad`、`54f0ec0`、`bf5759e`。

</details>

<details>
<summary><strong>2026-06-15 至 2026-06-21</strong> - 自定义策划数量、A+ 模块编排与提示词分辨率</summary>

- Listing AI 策划支持自定义图片数量，默认仍为 7 张，可在 `7-12` 张之间选择，数量包含 `MAIN` 主图。
- A+ 策划前可在右侧“模块编排”中逐行添加同尺寸模块、删除模块，并可恢复当前 A+ 类型默认编排；每个 A+ 类型支持 `1-12` 张模块。
- A+ 自定义模块数量会进入 AI 策划请求，schema、系统提示词、用户提示词、Chat JSON guide 和结果校验都会按当前模块清单执行。
- 生图最终提示词会自动追加期望输出分辨率，例如 `2048x2048` 或 `4096x4096`，让模型在提示词层面也知道目标尺寸。
- Agent 批量生图和图片工具调用同步加入输出分辨率约束，减少生成尺寸和当前参数脱节。
- 开发代理会在 API URL 与本地代理目标一致时自动启用，降低本地 HTTP/内网接口配置成本。
- 提交：随本次 `main` 推送发布。

</details>

<details>
<summary><strong>2026-06-08 至 2026-06-14</strong> - DeepSeek 策划兼容与部署提示</summary>

- AI 策划检测到 `https://api.deepseek.com` 时自动跳过参考图，仅发送纯文本 Chat Completions 请求，避免 DeepSeek 官方接口因 `image_url` 报错。
- 补充 DeepSeek 策划配置说明，明确官方 Chat Completions 当前不接收参考图。
- DeepSeek Chat Completions 和 Responses 策划统一按纯文本模型处理，增加反脑补约束，并在设置页和 Amazon 面板提示用户补齐产品关键特征。
- 补充 Vercel 体验版调用 HTTP API 的 HTTPS 安全策略提示。
- 提交：`8927ad1`、`8a42d09`、`b2ab475`。

</details>

<details>
<summary><strong>2026-06-01 至 2026-06-07</strong> - OpenRouter、参考图压缩与策划体验</summary>

- OpenRouter 生图改走 Chat Completions 图片生成，修复普通 Images API 路径下的 404。
- OpenRouter 请求补齐 `image_config.aspect_ratio` 和 `image_config.image_size`，A+ 非 1:1 图片会映射到最接近的支持比例，减少实际输出回落到 1024 级别。
- 风格板生成新增“停止”按钮，并把停止信号接入 OpenRouter、OpenAI Images API、自定义接口和 fal 请求链路。
- 参考图请求前会压缩、控尺寸并校验负载，修复大参考图导致的 413。
- 普通生图限制为 Images API，OpenRouter 图片模型保留兼容入口，避免误用不支持生图的配置。
- README 增加在线体验说明，Windows 启动脚本会在启动前自动检查并安装依赖。
- 优化 Amazon Planner 引导、API 默认配置、图片编辑流程、A+ 策划规则、风格控制和合规提示。
- 提交：`dd63338`、`9cdecd0`、`dc5e54d`、`031069d`、`56be7df`、`bff26ca`、`7d13774`、`ed43bf5`、`73c70f4`。

</details>

<details>
<summary><strong>2026-05-25 至 2026-05-31</strong> - Amazon 策划工作流、知识规则与本地化</summary>

- 大幅更新 Amazon Planner 工作流，强化 Listing 图片和 A+ 图片的策划、选择和生成流程。
- 调整图片默认参数、历史记录字段、任务展示和分类继承逻辑。
- 更新 dev proxy、mock image API、接口兼容测试和参数兼容逻辑。
- 内置 Amazon 图片规范、附图策划逻辑和 A+ 尺寸知识文档。
- 策划接口会引用内置知识规则，提高 Listing / A+ 策划稳定性。
- 项目名称统一调整为“亚马逊AI工作台”，同步页面标题、PWA manifest、启动脚本和界面文案。
- README 增加更完整的本地安装、启动和交付说明，历史记录搜索栏增加清理能力。
- 优化 Amazon Planner 工作流说明、Listing 图片策划模板、复制逻辑和相关测试。
- 提交：`a85312c`、`7c231bf`、`899532d`、`5cc09c4`、`0c8b9ec`、`d1de756`、`81a3fbd`、`3778620`。

</details>

<details>
<summary><strong>2026-05-18 至 2026-05-24</strong> - 项目初始化、部署配置与 A+ 模板</summary>

- 完成项目初始化，包含前端应用、图片生成、图片编辑、历史记录、设置页、PWA、代理和部署基础配置。
- 配置 GitHub Pages 工作流，并支持 main 分支推送后部署。
- 更新部署文档、安装路径说明和项目 GitHub 链接。
- 完善 README 使用说明。
- 优化 A+ Planner 模板、模块文案和任务历史展示。
- 默认关闭流式输出，降低默认配置复杂度。
- 提交：`ab63d9b`、`78ef9ea`、`3826fbc`、`ae118af`、`94c5cca`、`d929bdc`、`5860ddd`、`93f9585`、`f9198cb`。

</details>
