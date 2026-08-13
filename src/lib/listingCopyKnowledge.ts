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

export const DEFAULT_LISTING_TITLE_PROMPT = titlePromptSource.trim()

export const DEFAULT_LISTING_BULLETS_PROMPT = `请根据产品资料、参考图以及最终采用的标题信息，撰写严格五条中英文对照的五点描述。所有卖点必须有明确依据，不得因为常见鞋款通常具备某项功能就自行补充。

鞋靴商品按以下顺序组织：
1. 设计与穿戴方式：说明最显著的设计元素，以及系带、套脚、搭扣等真实穿戴方式。
2. 鞋头与关键结构：说明鞋头类型、装饰、材质或其他能帮助买家理解外观和适配性的结构。
3. 鞋跟、鞋底与功能：说明鞋跟类型或高度，以及有证据支持的防滑、舒适等特点。
4. 搭配与适用场景：说明真实可用的搭配方式，以及日常、通勤、沙滩、聚会等适用场景。
5. 注意事项：优先写尺码建议、窄版提示或材质特性；没有可靠注意事项时，补充前四点尚未覆盖的事实型材质或场景信息。

通用商品使用相同的信息逻辑，将鞋头、鞋跟等鞋靴字段替换为该品类最关键的结构和功能。每一点应具体、自然、易扫读，避免重复标题或其他要点。笔记中的“每点两行”只作为信息密度建议，不强制插入换行，也不要写成长段。禁止出现保证、售后政策、绝对化承诺、未经证实的认证或功效。英文符合美国消费者表达习惯，中文准确对照且不增加新事实。`

export const DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT = `请根据产品资料、参考图、标题和五点描述，撰写中英文对照的长描述。两份笔记强调长描述可以采用稳定模板，并将注意事项放在最后；请按以下结构组织，但不要照抄标题或五点：

1. 开头准确说明产品是什么、适合谁，以及最核心的购买价值。
2. 展开有依据的设计、材质、结构、穿戴或使用体验。
3. 自然说明搭配方式、目标人群和真实适用场景。
4. 结尾补充必要的尺码、材质、使用或信息缺失注意事项。

使用自然、连贯、便于美国消费者阅读的纯文本，不输出 HTML。只写用户提供或参考图能够可靠确认的事实；不得虚构品牌故事、认证、奖项、医学功效、保证、售后政策或绝对化承诺。资料不足时不要用空泛营销话术补齐，应将缺失事实和风险分别放入 missingFacts 与 complianceWarnings。中文应准确对应英文，不增加英文中不存在的信息。`

export const DEFAULT_LISTING_COPY_PROMPTS: ListingCopyPrompts = {
  title: DEFAULT_LISTING_TITLE_PROMPT,
  bullets: DEFAULT_LISTING_BULLETS_PROMPT,
  longDescription: DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT,
}

const LEGACY_DEFAULT_BUSINESS_PROMPT = `请基于用户填写的产品资料和参考图，撰写清晰、自然、具有购买意图的美国站 Listing 文案。

优先表达最能帮助消费者理解产品和做出购买决定的真实卖点。必须包含用户指定的词，避开禁止使用的词；资料不足时明确指出，不要猜测或编造。英文应符合美国消费者的阅读习惯，中文对照应准确简洁。`

const LEGACY_EMBEDDED_KNOWLEDGE_PROMPT_START = '作为亚马逊 Listing 优化专家，请以 COSMO 语义图谱和 Alexa for Shopping'

export function cloneDefaultListingCopyPrompts(): ListingCopyPrompts {
  return { ...DEFAULT_LISTING_COPY_PROMPTS }
}

export function normalizeListingCopyPrompts(
  prompts?: Partial<ListingCopyPrompts> | null,
  legacyPrompt?: string,
): ListingCopyPrompts {
  if (prompts) {
    return {
      title: prompts.title?.trim() || DEFAULT_LISTING_TITLE_PROMPT,
      bullets: prompts.bullets?.trim() || DEFAULT_LISTING_BULLETS_PROMPT,
      longDescription: prompts.longDescription?.trim() || DEFAULT_LISTING_LONG_DESCRIPTION_PROMPT,
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
