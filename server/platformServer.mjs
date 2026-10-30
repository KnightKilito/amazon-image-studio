import http from 'node:http'
import https from 'node:https'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createPlatformStore } from './platformStore.mjs'
import { NewApiClient, PlatformError } from './newApiClient.mjs'
import { asManagedProfiles, normalizeManagedProfiles, legacyProfiles, maskManagedProfiles } from './managedProfiles.mjs'

const GUIDE = fileURLToPath(new URL('../docs/admin-guide.md', import.meta.url))
const SESSION_TTL = 12 * 60 * 60 * 1000
const AI_PATHS = new Set(['/images/generations', '/images/edits', '/responses', '/chat/completions'])
const hash = text => createHash('sha256').update(text).digest('hex')
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const fail = (status, message) => { throw new PlatformError(status, message) }

export function readPlatformConfig(env = process.env) {
  const origin = new URL(env.STUDIO_ORIGIN || 'http://localhost:5173').origin
  const upstream = new URL(env.NEW_API_URL || 'http://127.0.0.1:3000')
  if (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password || upstream.search || upstream.hash) throw new Error('Invalid NEW_API_URL')
  const quotaPerCny = Number(env.STUDIO_QUOTA_PER_CNY)
  if (!Number.isFinite(quotaPerCny) || quotaPerCny <= 0) throw new Error('Set STUDIO_QUOTA_PER_CNY to the same quota/CNY conversion used by New API')
  return {
    origin, newApiUrl: upstream.href.replace(/\/+$/, ''), port: Number(env.STUDIO_PORT || 8787),
    database: resolve(env.STUDIO_DB_PATH || 'data/studio.sqlite'), encryptionKey: env.STUDIO_ENCRYPTION_KEY || '', quotaPerCny,
    imageModel: env.STUDIO_IMAGE_MODEL || 'gpt-image-2', plannerModel: env.STUDIO_PLANNER_MODEL || 'gpt-6.1-sol',
    plannerApiMode: env.STUDIO_PLANNER_API_MODE === 'chat' ? 'chat' : 'responses',
    secureCookie: origin.startsWith('https:'), maxBodyBytes: 24 * 1024 * 1024,
  }
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(body))
}
async function bodyJson(req) {
  let bytes = 0; const chunks = []
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 128 * 1024) fail(413, '请求过大'); chunks.push(chunk) }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { fail(400, 'JSON 格式错误') }
}

export function createPlatformServer({ config, store = createPlatformStore(config.database, config.encryptionKey), upstream = new NewApiClient(config.newApiUrl), guidePath = GUIDE }) {
  const userLocks = new Map(); const counters = new Map(); const active = new Set()
  function limit(key, max, windowMs) {
    const now = Date.now()
    if (counters.size > 10000) for (const [k, v] of counters) if (v.end < now) counters.delete(k)
    const item = counters.get(key)
    if (!item || item.end < now) { counters.set(key, { count: 1, end: now + windowMs }); return }
    if (++item.count > max) fail(429, '请求过于频繁，请稍后重试')
  }
  async function locked(key, fn) {
    const prior = userLocks.get(key) || Promise.resolve()
    const work = prior.catch(() => {}).then(fn)
    userLocks.set(key, work)
    try { return await work } finally { if (userLocks.get(key) === work) userLocks.delete(key) }
  }
  const cookieName = config.secureCookie ? '__Host-studio' : 'studio_session'
  const setCookie = (res, value, maxAge) => res.setHeader('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secureCookie ? '; Secure' : ''}`)
  async function authenticate(req) {
    const raw = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
    if (!raw || !/^[a-f0-9]{64}$/.test(raw)) fail(401, '请先登录')
    const id = hash(raw)
    return locked(`session:${id}`, async () => {
      const session = store.session(id)
      if (!session) fail(401, '登录已失效，请重新登录')
      let user
      try { user = await upstream.self(session.auth) }
      catch (error) { if (error.status === 401 || error.status === 403) store.deleteSession(id); throw error }
      if (Number(user.id) !== session.auth.userId || (user.status !== undefined && user.status !== 1)) { store.deleteSession(id); fail(401, '账户已停用') }
      session.user = user
      store.putSession(id, session, session.expires)
      return { ...session, id }
    })
  }
  function checkWrite(req, session) {
    if (req.headers.origin !== config.origin) fail(403, '请求来源不允许')
    if (session && !safeEqual(req.headers['x-studio-csrf'], session.csrf)) fail(403, '会话校验失败，请刷新后重试')
  }
  function publicUser(user) { return { id: user.id, username: user.username, displayName: user.display_name || user.username, role: user.role } }
  function connections(userId) {
    const assignment = store.assignment(userId)
    const managedProfiles = asManagedProfiles(assignment.profiles)
    return { version: assignment.version, profiles: legacyProfiles(managedProfiles), managedProfiles, policy: store.policy(), adminAccess: store.settings(), proxy: {
      imageModel: config.imageModel, plannerModel: config.plannerModel, plannerApiMode: config.plannerApiMode,
    } }
  }
  async function proxy(req, res, session, path) {
    if (req.method !== 'POST' || !AI_PATHS.has(path)) fail(404, '不支持的代理接口')
    const purpose = req.headers['x-studio-purpose']
    if (!['image', 'planner'].includes(purpose) || (path.startsWith('/images/') && purpose !== 'image')) fail(400, '缺少有效的请求用途')
    const slot = purpose
    if (active.has(slot) || active.has(`user:${session.user.id}`)) fail(429, '代理忙碌，请等待当前请求完成后再提交')
    if (Number(req.headers['content-length'] || 0) > config.maxBodyBytes) fail(413, '本站代理请求体上限为 24 MiB，请减少参考图')
    if (session.user.quota <= 0) fail(402, '本站余额不足；直连服务不使用本站余额')
    active.add(slot); active.add(`user:${session.user.id}`)
    try {
      const token = await locked(`token:${session.user.id}`, () => upstream.proxyToken(session.auth, store, [config.imageModel, config.plannerModel]))
      const url = new URL(`${config.newApiUrl}/v1${path}`)
      const transport = url.protocol === 'https:' ? https : http
      await new Promise((resolveProxy, rejectProxy) => {
        const outbound = transport.request(url, { method: 'POST', headers: {
          Authorization: `Bearer ${token}`, 'Content-Type': req.headers['content-type'] || 'application/json',
          ...(req.headers['content-length'] ? { 'Content-Length': req.headers['content-length'] } : {}),
        } }, response => {
          res.writeHead(response.statusCode || 502, { 'Content-Type': response.headers['content-type'] || 'application/json', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' })
          pipeline(response, res).then(resolveProxy, rejectProxy)
        })
        outbound.setTimeout(600000, () => outbound.destroy(new Error('timeout')))
        outbound.on('error', rejectProxy)
        const disconnected = () => { if (!res.writableFinished) outbound.destroy(new Error('client disconnected')) }
        res.once('close', disconnected)
        outbound.once('close', () => res.off('close', disconnected))
        let size = 0
        const capped = new Transform({ transform(chunk, encoding, done) { size += chunk.length; done(size > config.maxBodyBytes ? new PlatformError(413, '请求体超过代理上限') : null, chunk) } })
        pipeline(req, capped, outbound).catch(rejectProxy)
      })
    } finally { active.delete(slot); active.delete(`user:${session.user.id}`) }
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, config.origin)
      const path = url.pathname
      res.setHeader('Cache-Control', 'no-store')
      if (path === '/studio-api/health' && req.method === 'GET') return json(res, 200, { ok: true })
      if (path === '/studio-api/session' && req.method === 'POST') {
        checkWrite(req)
        // Deliberately use the socket peer, not spoofable forwarding headers. Behind nginx this is a global cap.
        limit(`login:${req.socket.remoteAddress}`, 20, 60000)
        const input = await bodyJson(req)
        if (typeof input.username !== 'string' || typeof input.password !== 'string' || !input.username || !input.password || input.username.length > 128 || input.password.length > 512) fail(400, '请输入用户名和密码')
        const { auth, user } = await upstream.login(input.username, input.password)
        const raw = randomBytes(32).toString('hex'); const csrf = randomBytes(32).toString('hex'); const expires = Date.now() + SESSION_TTL
        store.putSession(hash(raw), { auth, user, csrf, expires }, expires)
        setCookie(res, raw, SESSION_TTL / 1000)
        return json(res, 200, { user: publicUser(user), csrf })
      }
      if (!path.startsWith('/studio-api/') && path !== '/admin-api/settings') fail(404, '接口不存在')
      const session = await authenticate(req)
      const userId = session.user.id
      if (req.headers['x-studio-user'] && req.headers['x-studio-user'] !== String(userId)) fail(409, '账户已在其他页面切换，请重新加载')
      if (!['GET', 'HEAD'].includes(req.method)) checkWrite(req, session)
      if (path.startsWith('/studio-api/admin/') && session.user.role < 10) fail(403, '仅管理员可访问')
      limit(`user:${userId}`, 180, 60000)
      if (path === '/studio-api/session' && req.method === 'GET') return json(res, 200, { user: publicUser(session.user), csrf: session.csrf })
      if (path === '/studio-api/session' && req.method === 'DELETE') {
        store.deleteSession(session.id); setCookie(res, '', 0)
        await upstream.request('/api/user/auth/logout', session.auth, 'POST', {}).catch(() => {})
        return json(res, 200, { ok: true })
      }
      if (path === '/studio-api/me/connections' && req.method === 'GET') return json(res, 200, connections(userId))
      if (path === '/studio-api/me/password' && req.method === 'PUT') {
        if (!store.policy().allowPasswordChange) fail(403, '管理员已关闭工作台修改密码入口，请联系管理员')
        limit(`password:${userId}`, 5, 15 * 60000)
        const input = await bodyJson(req)
        if (typeof input.currentPassword !== 'string' || !input.currentPassword || input.currentPassword.length > 512 || typeof input.newPassword !== 'string' || [...input.newPassword].length < 8 || [...input.newPassword].length > 128 || Buffer.byteLength(input.newPassword) > 72 || input.currentPassword === input.newPassword) fail(400, '请输入当前密码和不同的新密码；新密码为 8–128 个字符，且 UTF-8 长度不超过 72 字节')
        await locked(`password:${userId}`, async () => {
          if (!store.policy().allowPasswordChange) fail(403, '管理员已关闭工作台修改密码入口')
          await upstream.changePassword(session.auth, session.user, input.currentPassword, input.newPassword)
          store.deleteUserSessions(userId)
          store.audit(userId, 'password.change')
        })
        setCookie(res, '', 0)
        return json(res, 200, { ok: true })
      }
      if (path === '/studio-api/me/wallet' && req.method === 'GET') {
        const logs = await upstream.request('/api/log/self?p=1&page_size=20&type=2', session.auth)
        return json(res, 200, { balance: session.user.quota / config.quotaPerCny, currency: 'CNY', quotaPerCny: config.quotaPerCny,
          adFree: session.user.quota > store.policy().adFreeThresholdCny * config.quotaPerCny,
          logs: (logs?.items || []).map(v => ({ id: v.id, time: v.created_at, model: v.model_name, amount: v.quota / config.quotaPerCny })),
        })
      }
      if (path === '/studio-api/admin/docs/guide' && req.method === 'GET') {
        let markdown; try { markdown = await readFile(guidePath, 'utf8') } catch { fail(503, '管理员手册未部署，请检查 docs/admin-guide.md') }
        return json(res, 200, { markdown })
      }
      if (path === '/studio-api/admin/policy') {
        if (req.method === 'GET') return json(res, 200, store.policy())
        if (req.method === 'PUT') {
          const input = await bodyJson(req)
          if (typeof input.defaultDirect !== 'boolean' || typeof input.allowCustomDirect !== 'boolean' || !Number.isFinite(input.adFreeThresholdCny) || input.adFreeThresholdCny < 0) fail(400, '策略参数无效')
          if (input.allowPasswordChange !== undefined && typeof input.allowPasswordChange !== 'boolean') fail(400, '修改密码开关必须为布尔值')
          store.setPolicy({ defaultDirect: input.defaultDirect, allowCustomDirect: input.allowCustomDirect, adFreeThresholdCny: input.adFreeThresholdCny, allowPasswordChange: input.allowPasswordChange ?? store.policy().allowPasswordChange })
          store.audit(userId, 'policy.update'); return json(res, 200, store.policy())
        }
      }
      if (path === '/studio-api/admin/users' && req.method === 'GET') {
        const page = Math.max(1, Math.min(10000, Math.floor(Number(url.searchParams.get('page')) || 1)))
        const pageSize = [10, 20, 50].includes(Number(url.searchParams.get('pageSize'))) ? Number(url.searchParams.get('pageSize')) : 10
        const keyword = (url.searchParams.get('q') || '').trim().slice(0, 100)
        const query = new URLSearchParams({ p: String(page), page_size: String(pageSize), ...(keyword ? { keyword } : {}) })
        const data = await upstream.request(`/api/user/${keyword ? 'search' : ''}?${query}`, session.auth)
        return json(res, 200, { items: (data?.items || []).map(user => {
          const profiles = asManagedProfiles(store.assignment(user.id).profiles)
          return { ...publicUser(user), assignmentCounts: { image: profiles.filter(p => p.purpose === 'image').length, planner: profiles.filter(p => p.purpose === 'planner').length } }
        }), total: data?.total || 0, pageSize })
      }
      if (path === '/studio-api/admin/connections' && req.method === 'GET') {
        return json(res, 200, { rows: store.allAssignments().flatMap(record => asManagedProfiles(record.profiles).map(p => ({
          userId: record.userId, version: record.version, profileId: p.id, name: p.name, purpose: p.purpose, baseUrl: p.baseUrl,
        }))) })
      }
      if (path === '/studio-api/admin/connections/bulk' && req.method === 'POST') {
        const input = await bodyJson(req)
        if (!Array.isArray(input.rows) || !input.rows.length || input.rows.length > 100) fail(400, '请选择 1–100 份配置')
        const changes = new Map(); const seen = new Set(); const preview = []
        for (const row of input.rows) {
          if (!Number.isSafeInteger(row.userId) || row.userId <= 0 || !Number.isInteger(row.version) || typeof row.profileId !== 'string' || typeof row.apiKey !== 'string' || !row.apiKey.trim()) fail(400, '每份配置都需要新 Key、用户 ID 和版本')
          const identity = row.userId + ':' + row.profileId
          if (seen.has(identity)) fail(400, '批量变更包含重复配置')
          seen.add(identity)
          if (!changes.has(row.userId)) {
            await upstream.request('/api/user/' + row.userId, session.auth)
            const current = store.assignment(row.userId)
            if (current.version !== row.version) fail(409, '配置已改变，请重新加载')
            changes.set(row.userId, { userId: row.userId, version: row.version, profiles: asManagedProfiles(current.profiles) })
          }
          const change = changes.get(row.userId)
          if (change.version !== row.version) fail(409, '同一用户的配置版本不一致')
          const old = change.profiles.find(p => p.id === row.profileId)
          if (!old) fail(404, '配置已撤销，请重新加载')
          preview.push({ userId: row.userId, profileId: old.id, name: old.name, purpose: old.purpose, from: old.baseUrl, to: row.baseUrl })
          change.profiles = normalizeManagedProfiles(change.profiles.map(p => p.id === row.profileId ? { ...p, baseUrl: row.baseUrl, apiKey: row.apiKey } : p), change.profiles)
        }
        if (input.preview !== true) {
          try { store.updateAssignments([...changes.values()]) } catch (error) { if (error.status === 409) fail(409, error.message); throw error }
          store.audit(userId, 'connections.bulk')
        }
        return json(res, 200, { rows: preview, applied: input.preview !== true })
      }
      const match = path.match(/^\/studio-api\/admin\/users\/(\d+)\/connections$/)
      if (match) {
        const targetId = Number(match[1])
        await upstream.request('/api/user/' + targetId, session.auth)
        const assignment = store.assignment(targetId)
        const previous = asManagedProfiles(assignment.profiles)
        if (req.method === 'GET') {
          const managedProfiles = maskManagedProfiles(previous)
          return json(res, 200, { version: assignment.version, profiles: legacyProfiles(managedProfiles), managedProfiles })
        }
        if (req.method === 'PUT') {
          const input = await bodyJson(req)
          const profiles = normalizeManagedProfiles(input.managedProfiles ?? input.profiles, previous)
          try { store.updateAssignments([{ userId: targetId, version: input.version ?? assignment.version, profiles }]) } catch (error) { if (error.status === 409) fail(409, error.message); throw error }
          store.audit(userId, 'connections.update', targetId)
          return json(res, 200, { ok: true, version: store.assignment(targetId).version })
        }
      }
      if (path === '/admin-api/settings') {
        if (req.method === 'GET') return json(res, 200, { adminAccess: store.settings() })
        if (req.method === 'PUT') {
          if (session.user.role < 10) fail(403, '仅管理员可修改')
          const input = await bodyJson(req)
          if (!input.adminAccess || typeof input.adminAccess !== 'object' || Array.isArray(input.adminAccess)) fail(400, '配置无效')
          store.setSettings(input.adminAccess); store.audit(userId, 'settings.update')
          return json(res, 200, { adminAccess: store.settings() })
        }
      }
      if (path.startsWith('/studio-api/ai/v1/')) {
        if (url.search) fail(400, '代理不接受自定义目标或查询参数')
        return await proxy(req, res, session, path.slice('/studio-api/ai/v1'.length))
      }
      fail(404, '接口不存在')
    } catch (error) {
      if (res.headersSent) res.destroy()
      else if (!res.destroyed) json(res, error.status || 502, { error: error instanceof PlatformError ? error.message : '服务暂时不可用，请联系管理员' })
    }
  })
  server.requestTimeout = 620000
  server.headersTimeout = 15000
  return { server, store }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = readPlatformConfig()
  const { server } = createPlatformServer({ config })
  server.listen(config.port, process.env.STUDIO_HOST || '127.0.0.1', () => console.log(`Studio platform listening on ${config.port}`))
}
