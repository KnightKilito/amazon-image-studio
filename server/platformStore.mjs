import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export const DEFAULT_POLICY = { defaultDirect: true, allowCustomDirect: true, adFreeThresholdCny: 10, allowPasswordChange: true }

export function createPlatformStore(filename, encryptionKey) {
  const key = Buffer.from(encryptionKey, 'base64')
  if (key.length !== 32) throw new Error('STUDIO_ENCRYPTION_KEY must be 32 random bytes encoded as base64')
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assignments (user_id INTEGER PRIMARY KEY, value TEXT NOT NULL, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proxy_tokens (user_id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, actor INTEGER NOT NULL, action TEXT NOT NULL, target INTEGER, created INTEGER NOT NULL);`)
  function seal(value) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
  }
  function unseal(value) {
    const data = Buffer.from(value, 'base64')
    const cipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
    cipher.setAuthTag(data.subarray(12, 28))
    return JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString())
  }
  return {
    close: () => db.close(),
    policy: () => ({ ...DEFAULT_POLICY, ...JSON.parse(db.prepare("SELECT value FROM settings WHERE id='policy'").get()?.value || '{}') }),
    setPolicy(value) { db.prepare("INSERT INTO settings VALUES ('policy', ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(JSON.stringify(value)) },
    settings: () => JSON.parse(db.prepare("SELECT value FROM settings WHERE id='admin_access'").get()?.value || '{}'),
    setSettings(value) { db.prepare("INSERT INTO settings VALUES ('admin_access', ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(JSON.stringify(value)) },
    assignment(userId) {
      const row = db.prepare('SELECT * FROM assignments WHERE user_id=?').get(userId)
      return row ? { profiles: unseal(row.value), version: row.version } : { profiles: {}, version: 0 }
    },
    setAssignment(userId, profiles) {
      db.prepare('INSERT INTO assignments VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value, version=version+1').run(userId, seal(profiles))
    },
    allAssignments() { return db.prepare('SELECT * FROM assignments ORDER BY user_id').all().map(row => ({ userId: row.user_id, profiles: unseal(row.value), version: row.version })) },
    updateAssignments(changes) {
      db.exec('BEGIN IMMEDIATE')
      try {
        for (const change of changes) {
          const current = db.prepare('SELECT version FROM assignments WHERE user_id=?').get(change.userId)?.version || 0
          if (current !== change.version) throw Object.assign(new Error('配置已被其他操作修改，请重新加载预览'), { status: 409 })
          db.prepare('INSERT INTO assignments VALUES (?, ?, 1) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value, version=version+1').run(change.userId, seal(change.profiles))
        }
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
    },
    session(id) {
      const row = db.prepare('SELECT value FROM sessions WHERE id=? AND expires>?').get(id, Date.now())
      return row ? unseal(row.value) : null
    },
    putSession(id, value, expires) {
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now())
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, expires=excluded.expires').run(id, seal(value), expires)
    },
    deleteSession(id) { db.prepare('DELETE FROM sessions WHERE id=?').run(id) },
    deleteUserSessions(userId) {
      for (const row of db.prepare('SELECT id, value FROM sessions').all()) {
        if (unseal(row.value).user.id === userId) db.prepare('DELETE FROM sessions WHERE id=?').run(row.id)
      }
    },
    token(userId) { const row = db.prepare('SELECT value FROM proxy_tokens WHERE user_id=?').get(userId); return row ? unseal(row.value) : null },
    putToken(userId, value) { db.prepare('INSERT INTO proxy_tokens VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET value=excluded.value').run(userId, seal(value)) },
    audit(actor, action, target = null) { db.prepare('INSERT INTO audit(actor, action, target, created) VALUES (?, ?, ?, ?)').run(actor, action, target, Date.now()) },
  }
}
