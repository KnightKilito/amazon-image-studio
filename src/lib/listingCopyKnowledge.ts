import type { ListingCopyPrompts } from '../types'
import titlePromptSource from '../../参考物料/标题Prompt.txt?raw'
import titleNotes20250813Source from '../../参考物料/【笔记】20250813-标题1.md?raw'
import titleNotes20251013Source from '../../参考物料/【笔记】20251013-标题2.md?raw'

export interface ListingCopyKnowledgeSource {
  id: 'title-prompt' | 'notes-20250813' | 'notes-20251013'
  filename: string
  label: string
  content: string
}

export const LISTING_COPY_KNOWLEDGE_SOURCES: ListingCopyKnowledgeSource[] = [
  {
    id: 'title-prompt',
    filename: '标题Prompt.txt',
    label: '标题 Prompt',
    content: titlePromptSource.trim(),
  },
  {
    id: 'notes-20250813',
    filename: '【笔记】20250813-标题1.md',
    label: '2025-08-13 笔记',
    content: titleNotes20250813Source.trim(),
  },
  {
    id: 'notes-20251013',
    filename: '【笔记】20251013-标题2.md',
    label: '2025-10-13 笔记',
    content: titleNotes20251013Source.trim(),
  },
]

const PREVIOUS_DEFAULT_LISTING_TITLE_PROMPT = `${titlePromptSource.trim()}

标题格式补充要求：Item Name 和 Item Highlight 都不要使用英文逗号、中文逗号，也不要使用独立单词 and。需要连接属性时使用自然的空格、介词或 with 等结构，避免用逗号堆砌关键词。`

const PREVIOUS_DEFAULT_LISTING_BULLETS_PROMPT = `请根据产品资料、参考图以及最终采用的标题信息，撰写严格五条中英文对照的五点描述。所有卖点必须有明确依据，不得因为常见鞋款通常具备某项功能就自行补充。

格式参考《SKU标题.docx》：英文和中文每条都必须以“序号 + 方括号小标题”开头，然后再写正文，例如：
1. [Heel & Height]
Features a stable wedge heel design...

中文对应格式：
1. [鞋跟与高度]
采用稳定的坡跟设计……

序号必须依次为 1–5；方括号小标题应短而具体，先让买家快速抓住这一点的主题。正文建议用一至两句或两行展开，不要把小标题和其他要点重复写成长段。

鞋靴商品按以下顺序组织：
1. 设计与穿戴方式：说明最显著的设计元素，以及系带、套脚、搭扣等真实穿戴方式。
2. 鞋头与关键结构：说明鞋头类型、装饰、材质或其他能帮助买家理解外观和适配性的结构。
3. 鞋跟、鞋底与功能：说明鞋跟类型或高度，以及有证据支持的防滑、舒适等特点。
4. 搭配与适用场景：说明真实可用的搭配方式，以及日常、通勤、沙滩、聚会等适用场景。
5. 注意事项：优先写尺码建议、窄版提示或材质特性；没有可靠注意事项时，补充前四点尚未覆盖的事实型材质或场景信息。

通用商品使用相同的信息逻辑，将鞋头、鞋跟等鞋靴字段替换为该品类最关键的结构和功能。每一点应具体、自然、易扫读，避免重复标题或其他要点。禁止出现保证、售后政策、绝对化承诺、未经证实的认证或功效。英文符合美国消费者表达习惯，中文准确对照且不增加新事实。`

const PREVIOUS_DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT = `请根据产品资料、参考图、标题和五点描述，撰写中英文对照的长描述。格式参考《SKU标题.docx》：英文和中文都先输出一行独立的大标题，例如“Elegant Summer Elevation: Suede Wedge Heel Thong Sandals”或“优雅夏日增高：坡跟夹趾凉鞋”，空一行后再写正文。大标题要有画面感并准确概括商品，不得编造卖点。

正文采用稳定的富文本式层次，但返回纯文本：

1. 开头准确说明产品是什么、适合谁，以及最核心的购买价值。
2. 展开有依据的设计、材质、结构、穿戴或使用体验。
3. 自然说明搭配方式、目标人群和真实适用场景。
4. 可根据资料加入“Key Features:”/“核心特点：”、适用场景或规格说明，并用项目符号逐条展示；资料不足时不要为了凑格式而编造。
5. 在倒数部分补充必要的尺码、材质、使用或信息缺失注意事项。
6. 最后一段必须是一句优雅、自然、与商品和使用场景相关的收束语，例如从清晨海风到夜晚晚餐的穿着画面；它应提升阅读体验，但不能使用绝对化承诺或新增事实。

正文使用多个自然段，便于系统转换成安全 HTML 和富文本预览。使用自然、连贯、便于美国消费者阅读的纯文本，不直接输出 HTML。只写用户提供或参考图能够可靠确认的事实；不得虚构品牌故事、认证、奖项、医学功效、保证、售后政策或绝对化承诺。资料不足时不要用空泛营销话术补齐，应将缺失事实和风险分别放入 missingFacts 与 complianceWarnings。中文应准确对应英文，不增加英文中不存在的信息。`

export const DEFAULT_LISTING_TITLE_PROMPT = titlePromptSource.trim()

export const DEFAULT_LISTING_BULLETS_PROMPT = `你是一位懂时尚审美、消费者心理与 Amazon 转化的资深美国站文案。请大胆写出五条让买家产生拥有欲的中英文对照卖点：文字要精致、有画面、有节奏，像优秀品牌文案，而不是产品参数说明书。

先从产品资料与参考图中挑出最能决定点击和购买的五组信息，再把每组信息写成“鲜明特征 + 审美或使用价值 + 穿搭/场景想象”。允许把清晰可见的轮廓、色彩、装饰、鞋型和风格转化为诸如 dramatic、sleek、glamorous、statement-making、effortlessly polished 等审美感受；也可以自然联想到派对、晚宴、约会、舞台、度假或日常造型，只要这些是搭配建议而不是虚构的技术属性。

格式保持易复制：
- 英文：1. [16 cm Statement Stiletto]: A soaring 16 cm stiletto heel creates a dramatic leg-lengthening silhouette made for entrances that deserve attention.
- 中文：1. [16厘米瞩目细高跟]：高耸的16厘米细高跟勾勒修长利落的腿部线条，让每一次登场都自带令人无法忽视的气场。
- 严格五条，序号依次为 1–5；方括号后接冒号；每条写 1–2 句完整销售文案。
- 小标题要像购买理由，优先使用具体设计、视觉效果或场景价值，不要使用 Product Form、Basic Information、产品形式、基本信息等资料字段名。

文风要自信而不胆怯。不要为了规避风险把句子写成“适合需要某项信息的消费者”，也不要向买家交代哪些资料没填。缺失内容放入 missingFacts 即可。只有材质、尺寸、结构、性能、认证等客观事实必须有依据；审美表达、情绪价值和合理的穿搭场景可以充分发挥。英文按自然的美国营销语言创作，中文保持同等感染力，不要生硬直译。`

const PREVIOUS_MARKDOWN_LISTING_LONG_DESCRIPTION_PROMPT = `你是一位为时尚与生活方式品牌撰稿的高级创意文案。请把这件商品写成一个买家愿意停下来阅读、能够想象自己穿上或使用它的故事。目标是精致、华丽、有层次、有情绪张力，而不是谨慎的参数汇总。

以一个有画面感的加粗大标题开场，再用一句加粗短句定下气质。正文用 3–5 个自然段层层推进：从第一眼的视觉吸引力写到关键设计，从材质与结构写到造型价值，再把商品带入真实而令人向往的场景。多使用具体、生动且不过分浮夸的词汇，让轮廓、光泽、花卉、透明感、鞋跟、线条或色彩真正“被看见”；可以用 **加粗短语** 突出核心卖点。

根据内容自然加入：
**Perfect For:** / **完美适用于：** 用项目符号给出富有画面的穿搭或使用场景。
**Specifications:** / **规格说明：** 用项目符号整理已经确认的客观信息。

结尾必须像品牌广告语一样优雅、有余韵，让买家产生行动冲动。例如：“穿上这份闪耀与锋芒，让每一步都成为目光停留的理由。”英文和中文应分别符合各自语言的审美，不要像逐字翻译。

创作空间要充分：清晰可见的设计可以延伸为审美效果，品类与风格可以延伸为合理的穿搭灵感和场景想象。事实红线只针对未经证实的材质、尺寸、结构、性能、认证和功效；不要因为某个次要字段缺失就压低整篇文案的感染力，也不要在买家文案中讨论缺失资料。返回 Markdown 纯文本，不输出 HTML。`

export const DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT = `你是一位为时尚与生活方式品牌撰稿的高级创意文案。请把这件商品写成一个买家愿意停下来阅读、能够想象自己穿上或使用它的故事。目标是精致、华丽、有层次、有情绪张力，而不是谨慎的参数汇总。

以一个有画面感的独立大标题开场，再用一句独立短句定下气质。正文用 3–5 个自然段层层推进：从第一眼的视觉吸引力写到关键设计，从材质与结构写到造型价值，再把商品带入真实而令人向往的场景。多使用具体、生动且不过分浮夸的词汇，让轮廓、光泽、花卉、透明感、鞋跟、线条或色彩真正“被看见”。通过标题、独立短句、自然分段和项目符号突出重点，不使用任何 Markdown 或 HTML 标记。

根据内容自然加入：
Perfect For: / 完美适用于：用项目符号给出富有画面的穿搭或使用场景。
Specifications: / 规格说明：用项目符号整理已经确认的客观信息。

结尾必须像品牌广告语一样优雅、有余韵，让买家产生行动冲动。例如：“穿上这份闪耀与锋芒，让每一步都成为目光停留的理由。”英文和中文应分别符合各自语言的审美，不要像逐字翻译。

创作空间要充分：清晰可见的设计可以延伸为审美效果，品类与风格可以延伸为合理的穿搭灵感和场景想象。事实红线只针对未经证实的材质、尺寸、结构、性能、认证和功效；不要因为某个次要字段缺失就压低整篇文案的感染力，也不要在买家文案中讨论缺失资料。返回可直接提交的纯文本，不输出 Markdown 语法或 HTML 标签。`

export const DEFAULT_LISTING_COPY_PROMPTS: ListingCopyPrompts = {
  title: DEFAULT_LISTING_TITLE_PROMPT,
  bullets: DEFAULT_LISTING_BULLETS_PROMPT,
  longDescription: DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT,
}

const LEGACY_DEFAULT_BUSINESS_PROMPT = `请基于用户填写的产品资料和参考图，撰写清晰、自然、具有购买意图的美国站 Listing 文案。

优先表达最能帮助消费者理解产品和做出购买决定的真实卖点。必须包含用户指定的词，避开禁止使用的词；资料不足时明确指出，不要猜测或编造。英文应符合美国消费者的阅读习惯，中文对照应准确简洁。`

const LEGACY_EMBEDDED_KNOWLEDGE_PROMPT_START = '作为亚马逊 Listing 优化专家，请以 COSMO 语义图谱和 Alexa for Shopping'

function isRestrainedDefaultBulletsPrompt(value: string) {
  return value.startsWith('你正在为 Amazon.com 买家撰写能促成购买的五点描述')
    && value.includes('绝对禁止在五点中出现')
    && value.includes('缺少的资料只能写入 missingFacts')
}

function isRestrainedDefaultLongDescriptionPrompt(value: string) {
  return value.startsWith('你正在撰写面向 Amazon.com 买家的品牌感长描述')
    && value.includes('英文建议约 250–450 词')
    && value.includes('绝对禁止在长描述中出现')
}

function isMarkdownDefaultLongDescriptionPrompt(value: string) {
  return value.startsWith('你是一位为时尚与生活方式品牌撰稿的高级创意文案')
    && value.includes('以一个有画面感的加粗大标题开场')
    && value.includes('返回 Markdown 纯文本，不输出 HTML')
}

export function cloneDefaultListingCopyPrompts(): ListingCopyPrompts {
  return { ...DEFAULT_LISTING_COPY_PROMPTS }
}

export function normalizeListingCopyPrompts(
  prompts?: Partial<ListingCopyPrompts> | null,
  legacyPrompt?: string,
): ListingCopyPrompts {
  if (prompts) {
    const title = prompts.title?.trim()
    const bullets = prompts.bullets?.trim()
    const longDescription = prompts.longDescription?.trim()
    return {
      title: !title || title === PREVIOUS_DEFAULT_LISTING_TITLE_PROMPT ? DEFAULT_LISTING_TITLE_PROMPT : title,
      bullets: !bullets || bullets === PREVIOUS_DEFAULT_LISTING_BULLETS_PROMPT || isRestrainedDefaultBulletsPrompt(bullets) ? DEFAULT_LISTING_BULLETS_PROMPT : bullets,
      longDescription: !longDescription || longDescription === PREVIOUS_DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT || longDescription === PREVIOUS_MARKDOWN_LISTING_LONG_DESCRIPTION_PROMPT || isMarkdownDefaultLongDescriptionPrompt(longDescription) || isRestrainedDefaultLongDescriptionPrompt(longDescription) ? DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT : longDescription,
    }
  }

  const legacy = legacyPrompt?.trim() ?? ''
  const isOldDefault = !legacy
    || legacy === LEGACY_DEFAULT_BUSINESS_PROMPT
    || legacy.startsWith(LEGACY_EMBEDDED_KNOWLEDGE_PROMPT_START)
  if (isOldDefault) return cloneDefaultListingCopyPrompts()

  const supplement = `\n\n历史自定义补充要求：\n${legacy}`
  return {
    title: `${DEFAULT_LISTING_TITLE_PROMPT}${supplement}`,
    bullets: `${DEFAULT_LISTING_BULLETS_PROMPT}${supplement}`,
    longDescription: `${DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT}${supplement}`,
  }
}
