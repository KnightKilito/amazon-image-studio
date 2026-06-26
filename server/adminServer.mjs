import crypto from 'node:crypto'
import http from 'node:http'
import mysql from 'mysql2/promise'

const DB_NAME = process.env.AIS_DB_NAME || 'amazon_image_studio'
const PORT = Number(process.env.AIS_ADMIN_PORT || 8787)
const SESSION_TTL_MS = 12 * 60 * 60 * 1000

const DEFAULT_ADMIN_USERNAME = process.env.AIS_ADMIN_USERNAME || 'admin'
const LEGACY_ADMIN_PASSWORD_SHA256 = '757c484a1e18c9f3724235680fba5790cbe59530f65a0d1360bc054c28da682c'
const DEFAULT_ADMIN_PASSWORD_SHA256 = process.env.AIS_ADMIN_PASSWORD_SHA256 ||
  (process.env.AIS_ADMIN_PASSWORD ? sha256Hex(process.env.AIS_ADMIN_PASSWORD) : LEGACY_ADMIN_PASSWORD_SHA256)

const DEFAULT_ADMIN_ACCESS = {
  allowGuestEditApiUrl: true,
  allowGuestViewApiUrl: true,
  allowGuestCreateApiProfile: false,
  unifiedGuestPlannerApiUrlEnabled: false,
  unifiedGuestPlannerApiUrl: '',
  unifiedGuestImageApiUrlEnabled: false,
  unifiedGuestImageApiUrl: '',
  referenceImageUploadLimit: 16,
  modelIds: [],
}

const sessions = new Map()

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

function getMysqlConfig(database) {
  return {
    host: process.env.AIS_DB_HOST || '127.0.0.1',
    port: Number(process.env.AIS_DB_PORT || 3306),
    user: process.env.AIS_DB_USER || 'root',
    password: process.env.AIS_DB_PASSWORD || '',
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  }
}

async function ensureDatabase() {
  const root = await mysql.createConnection(getMysqlConfig(undefined))
  try {
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  } finally {
    await root.end()
  }
}

let pool

async function ensureSchema() {
  await ensureDatabase()
  pool = mysql.createPool(getMysqlConfig(DB_NAME))
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      password_sha256 CHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await pool.query(
    `INSERT IGNORE INTO admin_users (username, password_sha256) VALUES (?, ?)`,
    [DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD_SHA256],
  )
  await pool.query(
    `INSERT IGNORE INTO admin_settings (setting_key, setting_value) VALUES ('admin_access', CAST(? AS JSON))`,
    [JSON.stringify(DEFAULT_ADMIN_ACCESS)],
  )
}

function normalizeAdminAccess(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const limit = Number(input.referenceImageUploadLimit)
  const modelIds = Array.isArray(input.modelIds)
    ? Array.from(new Set(input.modelIds
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)))
    : DEFAULT_ADMIN_ACCESS.modelIds
  return {
    allowGuestEditApiUrl: Boolean(input.allowGuestEditApiUrl),
    allowGuestViewApiUrl: Boolean(input.allowGuestViewApiUrl),
    allowGuestCreateApiProfile: Boolean(input.allowGuestCreateApiProfile),
    unifiedGuestPlannerApiUrlEnabled: Boolean(input.unifiedGuestPlannerApiUrlEnabled),
    unifiedGuestPlannerApiUrl: typeof input.unifiedGuestPlannerApiUrl === 'string' ? input.unifiedGuestPlannerApiUrl : '',
    unifiedGuestImageApiUrlEnabled: Boolean(input.unifiedGuestImageApiUrlEnabled),
    unifiedGuestImageApiUrl: typeof input.unifiedGuestImageApiUrl === 'string' ? input.unifiedGuestImageApiUrl : '',
    referenceImageUploadLimit: Number.isFinite(limit) ? Math.max(1, Math.min(64, Math.trunc(limit))) : DEFAULT_ADMIN_ACCESS.referenceImageUploadLimit,
    modelIds,
  }
}

async function readAdminAccess() {
  const [rows] = await pool.query(`SELECT setting_value FROM admin_settings WHERE setting_key = 'admin_access' LIMIT 1`)
  const raw = rows[0]?.setting_value
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  return normalizeAdminAccess({ ...DEFAULT_ADMIN_ACCESS, ...parsed })
}

async function writeAdminAccess(patch) {
  const current = await readAdminAccess()
  const next = normalizeAdminAccess({ ...current, ...patch })
  await pool.query(
    `INSERT INTO admin_settings (setting_key, setting_value)
     VALUES ('admin_access', CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [JSON.stringify(next)],
  )
  return next
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  })
  res.end(text)
}

async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function getBearerToken(req) {
  const value = req.headers.authorization || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? ''
}

function isAuthenticated(req) {
  const token = getBearerToken(req)
  const session = token ? sessions.get(token) : null
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token)
    return false
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS
  return true
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (!url.pathname.startsWith('/admin-api')) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  try {
    if (req.method === 'GET' && url.pathname === '/admin-api/settings') {
      sendJson(res, 200, { adminAccess: await readAdminAccess() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/admin-api/login') {
      const body = await readJson(req)
      const username = typeof body.username === 'string' ? body.username.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const [rows] = await pool.query(
        `SELECT password_sha256 FROM admin_users WHERE username = ? LIMIT 1`,
        [username],
      )
      const expectedHash = rows[0]?.password_sha256
      const actualHash = sha256Hex(password)
      if (
        typeof expectedHash !== 'string' ||
        expectedHash.length !== actualHash.length ||
        !crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash))
      ) {
        sendJson(res, 401, { error: '账号或密码不正确' })
        return
      }
      const token = crypto.randomBytes(32).toString('hex')
      sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS })
      sendJson(res, 200, { token, adminAccess: await readAdminAccess() })
      return
    }

    if (req.method === 'POST' && url.pathname === '/admin-api/logout') {
      const token = getBearerToken(req)
      if (token) sessions.delete(token)
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'PUT' && url.pathname === '/admin-api/settings') {
      if (!isAuthenticated(req)) {
        sendJson(res, 401, { error: '请先登录管理员' })
        return
      }
      const body = await readJson(req)
      sendJson(res, 200, { adminAccess: await writeAdminAccess(body.adminAccess ?? body) })
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

await ensureSchema()

http.createServer(handleRequest).listen(PORT, () => {
  console.log(`Admin API listening on http://localhost:${PORT}/admin-api`)
  console.log(`MySQL database: ${DB_NAME}`)
})
