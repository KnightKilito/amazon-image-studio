import test from 'node:test'
import assert from 'node:assert/strict'
import { NewApiClient } from './newApiClient.mjs'
import { createPlatformStore } from './platformStore.mjs'
import { randomBytes } from 'node:crypto'

const success = (data, headers = {}) => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json', ...headers } })
test('password update uses a scoped proof, rotated logout and never sends privilege fields', async () => {
  const requests = []
  const client = new NewApiClient('http://new-api:3000', async (url, init) => {
    requests.push({ url, init })
    if (url.endsWith('/verify')) return success({ proof_token: 'proof-only' })
    if (url.endsWith('/self')) return success({ access_token: 'rotated-access' })
    return success({})
  })
  await client.changePassword({ userId: 2, accessToken: 'original' }, { id: 2, username: 'user', role: 1, quota: 10 }, 'current-secret', 'next-secret')
  assert.equal(JSON.parse(requests[0].init.body).scope, 'account.password.change')
  assert.equal(requests[1].init.headers['X-Security-Proof'], 'proof-only')
  assert.equal(JSON.parse(requests[1].init.body).original_password, 'current-secret')
  assert.equal('role' in JSON.parse(requests[1].init.body), false)
  assert.equal(requests[2].init.headers.Authorization, 'Bearer rotated-access')
})
test('failed security proof never submits a password update or leaks upstream errors', async () => {
  let calls = 0
  const client = new NewApiClient('http://new-api:3000', async () => { calls++; return new Response(JSON.stringify({ success: false, message: 'private-detail' }), { status: 403 }) })
  await assert.rejects(client.changePassword({}, { username: 'user' }, 'wrong-secret', 'next-secret'), error => error.status === 400 && !error.message.includes('private-detail'))
  assert.equal(calls, 1)
})
test('login, access refresh and full token key contract', async () => {
  const requests = []; let tokenCreated = false
  const client = new NewApiClient('http://new-api:3000', async (url, init) => {
    requests.push({ url, init })
    if (url.endsWith('/login')) return success({ access_token: 'access-1', user: { id: 7, role: 1 } }, { 'Set-Cookie': 'refresh=secret; HttpOnly; Path=/' })
    if (url.endsWith('/self') && init.headers.Authorization === 'Bearer access-1') return new Response('{"success":false}', { status: 401 })
    if (url.endsWith('/auth/refresh')) return success({ access_token: 'access-2' })
    if (url.endsWith('/self')) return success({ id: 7, role: 1, status: 1 })
    if (url.includes('/token/search')) return success({ items: tokenCreated ? [{ id: 9, name: JSON.parse(requests.find(r => r.url.endsWith('/token/')).init.body).name }] : [] })
    if (url.endsWith('/token/')) { tokenCreated = true; return success(null) }
    if (url.endsWith('/9/key')) return success({ key: 'opaque-token' })
    throw new Error('unexpected route')
  })
  const { auth } = await client.login('user', 'password')
  assert.equal(auth.cookie, 'refresh=secret'); assert.equal((await client.self(auth)).id, 7)
  assert.equal(auth.accessToken, 'access-2')
  const db = createPlatformStore(':memory:', randomBytes(32).toString('base64'))
  try {
    assert.equal(await client.proxyToken(auth, db, ['image', 'text']), 'sk-opaque-token')
    const created = JSON.parse(requests.find(r => r.url.endsWith('/token/')).init.body)
    assert.equal(created.unlimited_quota, true); assert.equal(created.model_limits_enabled, false); assert.equal(created.model_limits, '')
    assert.equal(created.allow_user_quota_query, false)
    assert.equal(await client.proxyToken(auth, db, ['image', 'text']), 'sk-opaque-token')
    assert.equal(requests.filter(r => r.url.endsWith('/token/')).length, 1)
  } finally { db.close() }
})
test('uncertain create does not blindly issue a second token', async () => {
  let creates = 0
  const db = createPlatformStore(':memory:', randomBytes(32).toString('base64'))
  const client = new NewApiClient('http://new-api:3000', async url => {
    if (url.includes('/search')) return success({ items: [] })
    creates++; throw new Error('network timeout with unknown upstream result')
  })
  try {
    await assert.rejects(client.proxyToken({ userId: 7 }, db, ['model']))
    await assert.rejects(client.proxyToken({ userId: 7 }, db, ['model']), /待核实/)
    assert.equal(creates, 1)
  } finally { db.close() }
})
