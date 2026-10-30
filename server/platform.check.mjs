import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createPlatformServer, readPlatformConfig } from './platformServer.mjs'
import { createPlatformStore } from './platformStore.mjs'
import { PlatformError } from './newApiClient.mjs'

const origin = 'https://studio.example'
test('planner default follows deployment default but honors explicit configuration', () => {
  assert.equal(readPlatformConfig({ STUDIO_QUOTA_PER_CNY: '500000' }).plannerModel, 'gpt-6.1-sol')
  assert.equal(readPlatformConfig({ STUDIO_QUOTA_PER_CNY: '500000', STUDIO_PLANNER_MODEL: 'custom-model' }).plannerModel, 'custom-model')
})
const key = randomBytes(32).toString('base64')
const profile = { baseUrl: 'https://relay.example/v1', apiKey: 'private-user-key', model: 'image-test', apiMode: 'images' }
async function fixture(t, options = {}) {
  const calls = []; const users = new Map([[1, { id: 1, username: 'admin', role: 100, status: 1, quota: 2000 }], [2, { id: 2, username: 'user', role: 1, status: 1, quota: 2000 }], [3, { id: 3, username: 'other', role: 1, status: 1, quota: 500 }]])
  const ai = http.createServer(async (req, res) => {
    const chunks = []; for await (const part of req) chunks.push(part)
    calls.push({ url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() })
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"data":[{"b64_json":"test"}]}')
  })
  await new Promise(resolve => ai.listen(0, '127.0.0.1', resolve))
  const newApiUrl = `http://127.0.0.1:${ai.address().port}`
  const config = { origin, newApiUrl, secureCookie: false, quotaPerCny: 100, imageModel: 'image-test', plannerModel: 'text-test', plannerApiMode: 'responses', maxBodyBytes: 1024 }
  const store = createPlatformStore(':memory:', key)
  const upstream = {
    async login(username, password) {
      const user = [...users.values()].find(v => v.username === username)
      if (!user || password !== 'password') throw new PlatformError(401, '登录失败')
      return { user, auth: { userId: user.id, accessToken: 'private-dashboard-access', cookie: 'private-refresh=secret' } }
    },
    async self(auth) { if (!users.has(auth.userId)) throw new PlatformError(401, '失效'); return users.get(auth.userId) },
    async changePassword(auth, user, currentPassword) {
      if (currentPassword !== 'password') throw new PlatformError(400, '当前密码验证失败')
      calls.push({ passwordChangedFor: user.id })
    },
    async request(path) {
      if (path.startsWith('/api/user/?')) return { items: [...users.values()], total: users.size }
      if (/^\/api\/user\/\d+$/.test(path)) return users.get(Number(path.split('/').at(-1))) || Promise.reject(new PlatformError(404, '不存在'))
      if (path.startsWith('/api/log/self')) return { items: [{ id: 1, created_at: 1, model_name: 'image-test', quota: 20, token: 'must-not-leak' }] }
      return {}
    },
    async proxyToken(auth) { return `sk-private-internal-${auth.userId}` },
  }
  const { server } = createPlatformServer({ config, store, upstream, ...options })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  t.after(async () => { server.closeAllConnections(); ai.closeAllConnections(); await Promise.all([new Promise(r => server.close(r)), new Promise(r => ai.close(r))]); store.close() })
  async function call(path, { session, method = 'GET', body, headers = {} } = {}) {
    return fetch(base + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookie, 'X-Studio-CSRF': session.csrf } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  }
  async function login(username) {
    const response = await call('/studio-api/session', { method: 'POST', body: { username, password: 'password' } })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(JSON.stringify(data).includes('private-dashboard'), false)
    return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: data.csrf }
  }
  return { call, login, calls, store, users }
}

test('administrator guide requires current role; absent document fails closed', async t => {
  const f = await fixture(t)
  assert.equal((await f.call('/studio-api/admin/docs/guide')).status, 401)
  const user = await f.login('user'); const admin = await f.login('admin')
  assert.equal((await f.call('/studio-api/admin/docs/guide', { session: user })).status, 403)
  const response = await f.call('/studio-api/admin/docs/guide', { session: admin })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.match((await response.json()).markdown, /管理员手册/)
  f.users.get(1).role = 1
  assert.equal((await f.call('/studio-api/admin/docs/guide', { session: admin })).status, 403)
})

test('password changes require policy, CSRF, current password and revoke only the user sessions', async t => {
  const f = await fixture(t)
  const user = await f.login('user'), peer = await f.login('user'), admin = await f.login('admin')
  const body = { currentPassword: 'password', newPassword: 'changed-password-123!' }
  assert.equal((await f.call('/studio-api/me/password', { method: 'PUT', body })).status, 401)
  assert.equal((await f.call('/studio-api/me/password', { session: user, method: 'PUT', body, headers: { 'X-Studio-CSRF': 'bad' } })).status, 403)
  assert.equal((await f.call('/studio-api/admin/policy', { session: user, method: 'PUT', body: { ...f.store.policy(), allowPasswordChange: false } })).status, 403)
  f.store.setPolicy({ ...f.store.policy(), allowPasswordChange: false })
  assert.equal((await f.call('/studio-api/me/password', { session: user, method: 'PUT', body })).status, 403)
  f.store.setPolicy({ ...f.store.policy(), allowPasswordChange: true })
  assert.equal((await f.call('/studio-api/me/password', { session: user, method: 'PUT', body: { ...body, currentPassword: 'wrong' } })).status, 400)
  assert.equal((await f.call('/studio-api/session', { session: user })).status, 200)
  const response = await f.call('/studio-api/me/password', { session: user, method: 'PUT', body })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await f.call('/studio-api/session', { session: peer })).status, 401)
  assert.equal((await f.call('/studio-api/session', { session: user })).status, 401)
  assert.equal((await f.call('/studio-api/session', { session: admin })).status, 200)
  assert.equal(f.calls.filter(c => c.passwordChangedFor === 2).length, 1)
})

test('password attempts are rate limited and validation never changes credentials', async t => {
  const f = await fixture(t), session = await f.login('user')
  for (let i = 0; i < 5; i++) assert.equal((await f.call('/studio-api/me/password', { session, method: 'PUT', body: { currentPassword: 'password', newPassword: 'short' } })).status, 400)
  assert.equal((await f.call('/studio-api/me/password', { session, method: 'PUT', body: { currentPassword: 'password', newPassword: 'long-enough-password' } })).status, 429)
  assert.equal(f.calls.filter(c => c.passwordChangedFor).length, 0)
})
test('guide missing is not replaced with public content', async t => {
  const f = await fixture(t, { guidePath: '/nonexistent-admin-guide-test.md' })
  assert.equal((await f.call('/studio-api/admin/docs/guide', { session: await f.login('admin') })).status, 503)
})
test('assignment privacy, defaults, update and revoke; no upstream wallet mutation', async t => {
  const f = await fixture(t); const admin = await f.login('admin'); const user = await f.login('user'); const other = await f.login('other')
  const route = '/studio-api/admin/users/2/connections'
  assert.equal((await f.call(route, { session: user, method: 'PUT', body: { profiles: { image: profile } } })).status, 403)
  assert.equal((await f.call(route, { session: admin, method: 'PUT', body: { profiles: { image: profile } } })).status, 200)
  const assigned = await (await f.call('/studio-api/me/connections', { session: user })).json()
  assert.equal(assigned.profiles.image.apiKey, profile.apiKey)
  assert.deepEqual(assigned.policy, { defaultDirect: true, allowCustomDirect: true, adFreeThresholdCny: 10, allowPasswordChange: true })
  const foreign = await (await f.call('/studio-api/me/connections', { session: other })).json()
  assert.deepEqual(foreign.profiles, {})
  const edit = await (await f.call(route, { session: admin })).json()
  assert.equal(edit.profiles.image.apiKey, ''); assert.equal(edit.profiles.image.hasKey, true)
  assert.equal(f.users.get(2).quota, 2000); assert.equal(f.calls.length, 0)
  await f.call(route, { session: admin, method: 'PUT', body: { profiles: {} } })
  assert.deepEqual((await (await f.call('/studio-api/me/connections', { session: user })).json()).profiles, {})
})
test('csrf, source and origin controls; no arbitrary proxy target', async t => {
  const f = await fixture(t); const admin = await f.login('admin')
  for (const headers of [{ Origin: 'https://evil.example' }, { 'X-Studio-CSRF': 'bad' }]) {
    assert.equal((await f.call('/studio-api/admin/policy', { session: admin, method: 'PUT', headers, body: { defaultDirect: false } })).status, 403)
  }
  assert.equal((await f.call('/studio-api/ai/v1/images/generations?target=https://evil.example', { session: admin, method: 'POST' })).status, 400)
  assert.equal((await f.call('/api-proxy/images/generations', { session: admin, method: 'POST' })).status, 404)
})
test('proxy injects per-user key and strips browser auth/cookies; caps payload; revoked users rejected', async t => {
  const f = await fixture(t); const user = await f.login('user')
  const request = { session: user, method: 'POST', headers: { 'X-Studio-Purpose': 'image', Authorization: 'Bearer attacker' }, body: { model: 'image-test', prompt: 'test' } }
  assert.equal((await f.call('/studio-api/ai/v1/images/generations', request)).status, 200)
  assert.equal(f.calls[0].headers.authorization, 'Bearer sk-private-internal-2')
  assert.equal(f.calls[0].headers.cookie, undefined)
  assert.equal(f.calls[0].url, '/v1/images/generations')
  assert.equal((await f.call('/studio-api/ai/v1/images/generations', { ...request, body: { prompt: 'x'.repeat(2000) } })).status, 413)
  f.users.get(2).quota = 0
  assert.equal((await f.call('/studio-api/ai/v1/images/generations', request)).status, 402)
  f.users.get(2).status = 2
  assert.equal((await f.call('/studio-api/me/connections', { session: user })).status, 401)
})
test('wallet uses upstream quota, only redacted logs, strict ad-free threshold', async t => {
  const f = await fixture(t); const user = await f.login('user')
  f.users.get(2).quota = 1000
  let data = await (await f.call('/studio-api/me/wallet', { session: user })).json()
  assert.equal(data.balance, 10); assert.equal(data.adFree, false)
  assert.equal(JSON.stringify(data).includes('must-not-leak'), false)
  f.users.get(2).quota = 1001
  data = await (await f.call('/studio-api/me/wallet', { session: user })).json()
  assert.equal(data.adFree, true)
  await f.call('/studio-api/session', { session: user, method: 'DELETE' })
  assert.equal((await f.call('/studio-api/me/wallet', { session: user })).status, 401)
})
test('credentials encrypted on disk and survive database reopen with matching key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-store-'))
  try {
    const filename = join(dir, 'test.sqlite'); const db = createPlatformStore(filename, key)
    db.setAssignment(2, { image: profile }); db.putSession('id', { secret: 'unique-session-secret' }, Date.now() + 10000); db.close()
    const disk = readFileSync(filename).toString()
    assert.equal(disk.includes(profile.apiKey), false); assert.equal(disk.includes('unique-session-secret'), false)
    const reopened = createPlatformStore(filename, key)
    assert.equal(reopened.assignment(2).profiles.image.apiKey, profile.apiKey); reopened.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
test('invalid encryption key and missing conversion fail startup', () => {
  assert.throws(() => createPlatformStore(':memory:', ''), /32 random bytes/)
  assert.throws(() => readPlatformConfig({}), /QUOTA_PER_CNY/)
})

test('multiple full managed profiles and atomic batch supplier changes with revision checks', async t => {
  const f = await fixture(t); const admin = await f.login('admin'); const user = await f.login('user')
  const path = '/studio-api/admin/users/2/connections'
  const profiles = [{ ...profile, id: 'one', purpose: 'image', name: '公司配置', provider: 'openai', isDefault: true, timeout: 180, streamImages: true, streamPartialImages: 3, motherImageSupport: 'supported', maxMotherSlices: 4 }, { ...profile, id: 'two', purpose: 'image', name: '另一份', provider: 'fal' }]
  assert.equal((await f.call(path, { session: admin, method: 'PUT', body: { managedProfiles: profiles, version: 0 } })).status, 200)
  const read = await (await f.call('/studio-api/me/connections', { session: user })).json()
  assert.equal(read.managedProfiles.length, 2)
  assert.equal(read.managedProfiles[0].timeout, 180); assert.equal(read.managedProfiles[0].name, '公司配置'); assert.equal(read.managedProfiles[1].provider, 'fal')
  const rows = [{ userId: 2, profileId: 'one', version: 1, baseUrl: 'https://new.example/v1', apiKey: 'new-individual-key' }]
  const bulk = '/studio-api/admin/connections/bulk'
  assert.equal((await f.call(bulk, { session: user, method: 'POST', body: { rows } })).status, 403)
  assert.equal((await f.call(bulk, { session: admin, method: 'POST', body: { rows, preview: true } })).status, 200)
  assert.equal(f.store.assignment(2).version, 1)
  assert.equal((await f.call(bulk, { session: admin, method: 'POST', body: { rows: [...rows, { ...rows[0], profileId: 'two', apiKey: '' }] } })).status, 400)
  assert.equal(f.store.assignment(2).version, 1)
  assert.equal((await f.call(bulk, { session: admin, method: 'POST', body: { rows } })).status, 200)
  assert.equal(f.store.assignment(2).version, 2)
  assert.equal(f.store.assignment(2).profiles[0].baseUrl, 'https://new.example/v1')
  assert.equal(f.store.assignment(2).profiles[1].baseUrl, profile.baseUrl)
  assert.equal((await f.call(bulk, { session: admin, method: 'POST', body: { rows } })).status, 409)
  assert.equal((await f.call(path, { session: admin, method: 'PUT', body: { managedProfiles: profiles, version: 1 } })).status, 409)
})
