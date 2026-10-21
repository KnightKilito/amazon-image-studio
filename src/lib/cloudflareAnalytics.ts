// Web Analytics 公开站点标识，不是 Cloudflare API 密钥。
export const CLOUDFLARE_ANALYTICS_TOKEN = '07552a86f85b4757bddcf879a173bdfb'
export const CLOUDFLARE_ANALYTICS_SCRIPT = 'https://static.cloudflareinsights.com/beacon.min.js'

interface AnalyticsOptions {
  production: boolean
  hostname: string
  document: Document
  token?: string
}

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  return host === '0.0.0.0' || host.startsWith('127.') || host.startsWith('10.')
    || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
}

/** 不等待网络、不参与 React 生命周期，也不读取业务输入或本地存储。 */
export function installCloudflareAnalytics({ production, hostname, document: doc, token = CLOUDFLARE_ANALYTICS_TOKEN }: AnalyticsOptions) {
  if (!production || isLocalHostname(hostname) || !/^[a-f\d]{32}$/i.test(token)) return

  const install = () => {
    try {
      // CF 在返回 HTML 时可能已自动注入；必须在解析完成后检查。
      if (doc.querySelector('script[data-cf-beacon], script[src^="https://static.cloudflareinsights.com/beacon.min.js"], script[src^="//static.cloudflareinsights.com/beacon.min.js"]')) return
      const script = doc.createElement('script')
      script.type = 'module'
      script.async = true
      script.src = CLOUDFLARE_ANALYTICS_SCRIPT
      script.setAttribute('data-cf-beacon', JSON.stringify({ token }))
      // 被网络、CSP 或拦截器阻止时不重试，不弹业务错误，也不阻塞应用。
      script.addEventListener('error', () => {}, { once: true })
      doc.body.appendChild(script)
    } catch {
      // 访问统计是可选附加能力，安装失败不能中断主应用。
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', install, { once: true })
  else install()
}
