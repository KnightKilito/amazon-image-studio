import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { stampServiceWorker } from '../../build/serviceWorkerCache'

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')

describe('automatic service worker cache identifiers', () => {
  it('uses stable content identifiers rather than a manually updated application version', () => {
    const assets = [{ name: 'dist/a.js', content: 'a' }, { name: 'public/icon.svg', content: 'icon' }]
    const first = stampServiceWorker(source, assets)
    expect(first).toBe(stampServiceWorker(source, [...assets].reverse()))
    expect(first).not.toContain('__SW_BUILD_ID__')
    expect(first).toContain("const CACHE_NAME = 'amazon-image-studio'")
    expect(source).toContain('__SW_BUILD_ID__')
    expect(first).not.toBe(stampServiceWorker(source, [{ ...assets[0], content: 'changed' }, assets[1]]))
    expect(first).not.toBe(stampServiceWorker(source, [assets[0], { ...assets[1], content: 'new icon' }]))
    const changedWorker = stampServiceWorker(`${source}\n// worker policy changed`, assets)
    expect(first.match(/assets-([a-f\d]{16})/)?.[1]).not.toBe(changedWorker.match(/assets-([a-f\d]{16})/)?.[1])
  })

  it('fails a build if the expected source marker has been accidentally removed', () => {
    expect(() => stampServiceWorker('no marker', [])).toThrow('占位符')
  })
})

function worker() {
  const base = 'https://example.com/studio/'
  const entries = new Map<string, Map<string, Response>>()
  const listeners = new Map<string, (event: Record<string, unknown>) => void>()
  const keyOf = (request: string | { url: string }) => new URL(typeof request === 'string' ? request : request.url, `${base}sw.js`).href
  const getEntries = (name: string) => {
    if (!entries.has(name)) entries.set(name, new Map())
    return entries.get(name)!
  }
  const caches = {
    open: vi.fn(async (name: string) => ({
      addAll: async (urls: string[]) => { urls.forEach((url) => getEntries(name).set(keyOf(url), new Response('shell', { headers: { 'content-type': 'text/html' } }))) },
      put: async (request: string | { url: string }, response: Response) => { getEntries(name).set(keyOf(request), response.clone()) },
    })),
    keys: vi.fn(async () => [...entries.keys()]),
    delete: vi.fn(async (name: string) => entries.delete(name)),
    match: vi.fn(async (request: string | { url: string }, options: { cacheName: string }) => entries.get(options.cacheName)?.get(keyOf(request))?.clone()),
  }
  const fetchMock = vi.fn(async (_request: unknown) => new Response('network', { headers: { 'content-type': 'text/html' } }))
  const self = {
    location: { href: `${base}sw.js`, origin: 'https://example.com' },
    addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => {}), clients: { claim: vi.fn(async () => {}) },
  }
  const context = createContext({ self, caches, fetch: fetchMock, URL, Response, Set, Promise })
  runInContext(stampServiceWorker(source, []), context)
  const cacheKey = runInContext('CACHE_KEY', context) as string
  const dispatch = (type: string, extra = {}) => {
    const pending: Promise<unknown>[] = []
    let response: Promise<Response> | undefined
    listeners.get(type)!({ ...extra, waitUntil: (promise: Promise<unknown>) => pending.push(promise), respondWith: (promise: Promise<Response>) => { response = promise } })
    return { completion: Promise.all(pending), response }
  }
  const request = (path: string, mode = 'cors', method = 'GET') => ({ url: new URL(path, base).href, mode, method })
  return { base, entries, getEntries, caches, fetchMock, self, cacheKey, dispatch, request }
}

describe('service worker cache boundaries', () => {
  it('precaches the shell in the current content cache and completes installation', async () => {
    const runtime = worker()
    await runtime.dispatch('install').completion
    expect(runtime.entries.size).toBe(1)
    expect(runtime.cacheKey).toMatch(/^amazon-image-studio-assets-[a-f\d]{16}$/)
    expect(runtime.getEntries(runtime.cacheKey).has(`${runtime.base}index.html`)).toBe(true)
    expect(runtime.self.skipWaiting).toHaveBeenCalledOnce()
  })

  it('removes old project caches but preserves other same-origin applications', async () => {
    const runtime = worker()
    const old = ['amazon-image-studio-v0.4.5', 'amazon-image-studio-v0.4.6', 'amazon-image-studio-assets-old', 'amazon-image-studio']
    for (const name of [...old, runtime.cacheKey, 'other-project-cache', 'amazon-image-studio-vendor']) runtime.getEntries(name)
    await runtime.dispatch('activate').completion
    expect([...runtime.entries.keys()].sort()).toEqual([runtime.cacheKey, 'other-project-cache', 'amazon-image-studio-vendor'].sort())
    expect(runtime.self.clients.claim).toHaveBeenCalledOnce()
  })

  it('fetches navigation online and uses only its own cached shell offline', async () => {
    const runtime = worker()
    runtime.getEntries('other-project').set(`${runtime.base}index.html`, new Response('wrong shell'))
    let event = runtime.dispatch('fetch', { request: runtime.request('editor', 'navigate') })
    expect(await (await event.response!).text()).toBe('network')
    await event.completion
    runtime.fetchMock.mockRejectedValueOnce(new Error('offline'))
    event = runtime.dispatch('fetch', { request: runtime.request('editor', 'navigate') })
    expect(await (await event.response!).text()).toBe('network')
    await event.completion
    expect(runtime.caches.match).toHaveBeenCalledWith(`${runtime.base}index.html`, { cacheName: runtime.cacheKey })
  })

  it('does not replace a valid shell with HTTP errors or JSON responses', async () => {
    const runtime = worker()
    runtime.getEntries(runtime.cacheKey).set(`${runtime.base}index.html`, new Response('good shell'))
    for (const response of [new Response('error', { status: 503, headers: { 'content-type': 'text/html' } }), new Response('{}', { headers: { 'content-type': 'application/json' } })]) {
      runtime.fetchMock.mockResolvedValueOnce(response)
      const event = runtime.dispatch('fetch', { request: runtime.request('', 'navigate') })
      await event.response
      await event.completion
      expect(await runtime.getEntries(runtime.cacheKey).get(`${runtime.base}index.html`)!.clone().text()).toBe('good shell')
    }
  })

  it('caches hashed static assets without a network round trip on a subsequent fetch', async () => {
    const runtime = worker()
    const request = runtime.request('assets/index-HASH.js')
    let event = runtime.dispatch('fetch', { request })
    expect(await (await event.response!).text()).toBe('network')
    await event.completion
    event = runtime.dispatch('fetch', { request })
    expect(await (await event.response!).text()).toBe('network')
    await event.completion
    expect(runtime.fetchMock).toHaveBeenCalledOnce()
  })

  it('does not intercept APIs, POSTs, cross-origin images or its own worker script', () => {
    const runtime = worker()
    for (const request of [runtime.request('/studio-api/admin/docs/guide'), runtime.request('/studio-api/me/connections'), runtime.request('/admin-api/settings'), runtime.request('/api-proxy/images/generations'), runtime.request('assets/index.js', 'cors', 'POST'), runtime.request('https://images.example/a.png'), runtime.request('sw.js')]) {
      expect(runtime.dispatch('fetch', { request }).response).toBeUndefined()
    }
    expect(runtime.caches.open).not.toHaveBeenCalled()
  })

  it('returns the network resource even when a cache write is unavailable', async () => {
    const runtime = worker()
    runtime.caches.open.mockRejectedValueOnce(new Error('quota'))
    const event = runtime.dispatch('fetch', { request: runtime.request('assets/index-HASH.js') })
    expect(await (await event.response!).text()).toBe('network')
    await expect(event.completion).resolves.toBeDefined()
  })
})
