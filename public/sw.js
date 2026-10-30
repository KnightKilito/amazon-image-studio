// 固定项目名称；构建标识由 Vite 自动写入，不需要跟随应用版本手动修改。
const CACHE_NAME = 'amazon-image-studio'
const CACHE_KEY = `${CACHE_NAME}-assets-__SW_BUILD_ID__`
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './pwa-icon.svg']
const SHELL_URL = new URL('./index.html', self.location.href).href
const SHELL_URLS = new Set(APP_SHELL.map((path) => new URL(path, self.location.href).href))
const STATIC_PATHS = ['./assets/', './style-presets/'].map((path) => new URL(path, self.location.href).pathname)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_KEY).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) =>
      key !== CACHE_KEY && (key === CACHE_NAME || key.startsWith(`${CACHE_NAME}-assets-`) || /^amazon-image-studio-v\d/.test(key)),
    ).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/\/(studio-api|admin-api|api-proxy)(\/|$)/.test(url.pathname)) return

  if (request.mode === 'navigate') {
    const network = fetch(request)
    event.waitUntil(network.then(async (response) => {
      if (response.ok && !response.redirected && response.headers.get('content-type')?.includes('text/html')) {
        const copy = response.clone()
        const cache = await caches.open(CACHE_KEY)
        await cache.put(SHELL_URL, copy)
      }
    }).catch(() => {}))
    event.respondWith(network.catch(async () => {
      const cached = await caches.match(SHELL_URL, { cacheName: CACHE_KEY })
      return cached || Response.error()
    }))
    return
  }

  // 仅缓存本站构建资源；管理接口、API 代理、远程图片等不写入此缓存。
  if (!SHELL_URLS.has(url.href) && !STATIC_PATHS.some((path) => url.pathname.startsWith(path))) return

  let cacheWrite = Promise.resolve()
  const result = caches.match(request, { cacheName: CACHE_KEY }).catch(() => undefined).then(async (cached) => {
    if (cached) return cached
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      cacheWrite = caches.open(CACHE_KEY).then((cache) => cache.put(request, copy)).catch(() => {})
    }
    return response
  })
  event.respondWith(result)
  event.waitUntil(result.then(() => cacheWrite).catch(() => {}))
})
