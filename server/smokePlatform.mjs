// Explicit opt-in integration test. Creates and removes ONLY its own disposable Docker container.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import assert from 'node:assert/strict'
import { createPlatformServer } from './platformServer.mjs'
import { createPlatformStore } from './platformStore.mjs'
import { NewApiClient } from './newApiClient.mjs'
import http from 'node:http'

const container = `studio-contract-${Date.now()}`
const secret = randomBytes(32).toString('hex')
const password = randomBytes(24).toString('base64') + 'aA1!'
let owned = false; let server; let store; let supplier
try {
  execFileSync('docker', ['run', '-d', '--name', container, '-p', '127.0.0.1::3000', '--tmpfs', '/data', '-e', `SESSION_SECRET=${secret}`, 'calciumion/new-api:v1.0.0-rc.46'], { stdio: 'pipe' })
  owned = true
  const mapped = execFileSync('docker', ['port', container, '3000/tcp'], { encoding: 'utf8' }).trim()
  const upstreamUrl = `http://${mapped}`
  let ready = false
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(upstreamUrl + '/api/setup')).ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'New API did not start')
  const setup = await fetch(upstreamUrl + '/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'smokeadmin', password, confirmPassword: password, SelfUseModeEnabled: false, DemoSiteEnabled: false }) }).then(r => r.json())
  assert.ok(setup.success, 'New API setup rejected')
  const api = new NewApiClient(upstreamUrl)
  const root = await api.login('smokeadmin', password)
  assert.equal((await api.self(root.auth)).role, 100)
  console.log('PASS real New API initialization, login and identity')
  await api.request('/api/user/', root.auth, 'POST', { username: 'smokeuser', password, role: 1, display_name: 'Smoke User' })
  const user = await api.login('smokeuser', password)
  assert.equal((await api.self(user.auth)).role, 1)
  store = createPlatformStore(':memory:', randomBytes(32).toString('base64'))
  const token = await api.proxyToken(user.auth, store, ['gpt-image-2', 'gpt-5.5'])
  assert.ok(token.startsWith('sk-'))
  assert.equal(await api.proxyToken(user.auth, store, ['gpt-image-2']), token)
  console.log('PASS real per-user token create, search, reveal and reuse')
  const origin = 'http://localhost:5173'
  const app = createPlatformServer({ config: { origin, newApiUrl: upstreamUrl, secureCookie: false, quotaPerCny: 500000, imageModel: 'gpt-image-2', plannerModel: 'gpt-5.5', plannerApiMode: 'responses', maxBodyBytes: 24 * 1024 * 1024 }, store, upstream: api })
  server = app.server
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  async function login(name) {
    const response = await fetch(base + '/studio-api/session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, password }) })
    assert.equal(response.status, 200)
    const body = await response.json()
    return { cookie: response.headers.get('set-cookie').split(';')[0], csrf: body.csrf }
  }
  const adminSession = await login('smokeadmin'); const userSession = await login('smokeuser')
  const get = (path, session) => fetch(base + path, { headers: { Cookie: session.cookie } })
  assert.equal((await get('/studio-api/admin/docs/guide', userSession)).status, 403)
  assert.equal((await get('/studio-api/admin/docs/guide', adminSession)).status, 200)
  assert.equal((await get('/studio-api/me/wallet', userSession)).status, 200)
  const listing = await get('/studio-api/admin/users', adminSession)
  assert.equal(listing.status, 200)
  assert.ok((await listing.json()).items.some(item => item.username === 'smokeuser'))
  console.log('PASS real adapter sessions, administrator guide 200/403, wallet and user list')
  supplier = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* Consume the bounded test request. */ }
    assert.equal(req.headers.authorization, 'Bearer smoke-only-procurement-key')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id: 'smoke-chat', object: 'chat.completion', model: 'gpt-4o-mini', choices: [{ index: 0, message: { role: 'assistant', content: 'local test result' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1000, completion_tokens: 1000, total_tokens: 2000 } }))
  })
  await new Promise(resolve => supplier.listen(0, '0.0.0.0', resolve))
  await api.request('/api/channel/', root.auth, 'POST', { mode: 'single', channel: { name: 'local-smoke-supplier', type: 1, status: 1, base_url: `http://host.docker.internal:${supplier.address().port}`, key: 'smoke-only-procurement-key', models: 'gpt-4o-mini', group: 'default' } })
  const before = (await api.self(root.auth)).quota
  // Internal model restrictions follow this test config, not any external model provider.
  app.server.closeAllConnections()
  await new Promise(resolve => app.server.close(resolve))
  const billingApp = createPlatformServer({ config: { origin, newApiUrl: upstreamUrl, secureCookie: false, quotaPerCny: 500000, imageModel: 'gpt-image-2', plannerModel: 'gpt-4o-mini', plannerApiMode: 'chat', maxBodyBytes: 24 * 1024 * 1024 }, store, upstream: api })
  server = billingApp.server
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const billingResponse = await fetch(`http://127.0.0.1:${server.address().port}/studio-api/ai/v1/chat/completions`, { method: 'POST', headers: { Cookie: adminSession.cookie, Origin: origin, 'X-Studio-CSRF': adminSession.csrf, 'X-Studio-Purpose': 'planner', 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'test' }], stream: false }) })
  const billingBody = await billingResponse.text()
  assert.equal(billingResponse.status, 200, billingBody)
  assert.ok(billingBody.includes('local test result'))
  const after = (await api.self(root.auth)).quota
  assert.ok(after < before, 'New API should actually settle quota for the local mocked supplier request')
  console.log('PASS real proxy -> New API -> local mock supplier -> real wallet debit (no paid upstream requests)')
  await api.request('/api/user/auth/refresh', user.auth, 'POST', {})
  console.log('PASS real refresh cookie flow')
  const searched = await fetch(`http://127.0.0.1:${server.address().port}/studio-api/admin/users?page=1&pageSize=10&q=smokeuser`, { headers: { Cookie: adminSession.cookie } }).then(r => r.json())
  assert.equal(searched.items.length, 1)
  assert.equal(searched.items[0].username, 'smokeuser')
  assert.deepEqual(searched.items[0].assignmentCounts, { image: 0, planner: 0 })
  const nextPassword = randomBytes(24).toString('base64') + 'zZ2!'
  const passwordReply = await fetch(`http://127.0.0.1:${server.address().port}/studio-api/me/password`, { method: 'PUT', headers: { Cookie: userSession.cookie, Origin: origin, 'X-Studio-CSRF': userSession.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: password, newPassword: nextPassword }) })
  assert.equal(passwordReply.status, 200, await passwordReply.text())
  await assert.rejects(api.login('smokeuser', password))
  assert.equal((await api.login('smokeuser', nextPassword)).user.username, 'smokeuser')
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/studio-api/session`, { headers: { Cookie: userSession.cookie } })).status, 401)
  console.log('PASS real user search and security-proof password change, old password rejected, new password login and workbench session revocation')
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (supplier) { supplier.closeAllConnections(); await new Promise(resolve => supplier.close(resolve)) }
  store?.close()
  if (owned) { execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' }); console.log('Removed disposable contract-test container; no user services or data changed.') }
}
