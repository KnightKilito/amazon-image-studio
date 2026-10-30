import type { ApiProfile } from '../types'

/** Early form feedback only; the server remains the authority for validation. */
export function validateManagedProfileDrafts(profiles: Array<ApiProfile & { hasKey?: boolean }>): string | null {
  for (const [index, profile] of profiles.entries()) {
    const label = `第 ${index + 1} 份${profile.purpose === 'planner' ? '策划' : '生图'}配置「${profile.name.trim() || '管理员配置'}」`
    let url: URL
    try { url = new URL(profile.baseUrl.trim()) } catch { return `${label}：请填写完整的 HTTPS API URL，例如 https://relay.example/v1。` }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return `${label}：API URL 必须为 HTTPS 地址，不能包含账号密码、查询参数或片段。`
    if (!profile.apiKey.trim() && !profile.hasKey) return `${label}：请填写该用户的个人 API Key。`
    if (!profile.model.trim()) return `${label}：请选择或填写模型。`
  }
  return null
}
