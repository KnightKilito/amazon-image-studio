import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const CONFIG_PATH = fileURLToPath(new URL('../config.yaml', import.meta.url))

const DEFAULT_CONFIG = {
  adminServer: {
    port: 8787,
    username: 'admin',
    password: '',
    passwordSha256: '',
  },
  mysql: {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'amazon_image_studio',
  },
  apiProxy: {
    enabled: false,
    locked: false,
    prefix: '/api-proxy',
    target: '',
    changeOrigin: true,
    secure: true,
  },
}

function readConfigFile() {
  if (!existsSync(CONFIG_PATH)) return {}
  const parsed = YAML.parse(readFileSync(CONFIG_PATH, 'utf8'))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function stringValue(value, fallback) {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function envString(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name] : undefined
}

function envNumber(name) {
  const value = envString(name)
  return value === undefined ? undefined : Number(value)
}

function booleanValue(value, fallback) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true
    if (['false', '0', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

function envBoolean(name) {
  return envString(name)
}

function normalizeProxyPrefix(value) {
  const raw = stringValue(value, DEFAULT_CONFIG.apiProxy.prefix).trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return raw ? `/${raw}` : DEFAULT_CONFIG.apiProxy.prefix
}

export function loadAdminConfig() {
  const fileConfig = readConfigFile()
  const adminServer = fileConfig.adminServer && typeof fileConfig.adminServer === 'object'
    ? fileConfig.adminServer
    : {}
  const mysql = fileConfig.mysql && typeof fileConfig.mysql === 'object'
    ? fileConfig.mysql
    : {}
  const apiProxy = fileConfig.apiProxy && typeof fileConfig.apiProxy === 'object'
    ? fileConfig.apiProxy
    : {}

  return {
    adminServer: {
      port: numberValue(envNumber('AIS_ADMIN_PORT') ?? adminServer.port, DEFAULT_CONFIG.adminServer.port),
      username: stringValue(envString('AIS_ADMIN_USERNAME') ?? adminServer.username, DEFAULT_CONFIG.adminServer.username),
      password: stringValue(envString('AIS_ADMIN_PASSWORD') ?? adminServer.password, DEFAULT_CONFIG.adminServer.password),
      passwordSha256: stringValue(envString('AIS_ADMIN_PASSWORD_SHA256') ?? adminServer.passwordSha256, DEFAULT_CONFIG.adminServer.passwordSha256),
    },
    mysql: {
      host: stringValue(envString('AIS_DB_HOST') ?? mysql.host, DEFAULT_CONFIG.mysql.host),
      port: numberValue(envNumber('AIS_DB_PORT') ?? mysql.port, DEFAULT_CONFIG.mysql.port),
      user: stringValue(envString('AIS_DB_USER') ?? mysql.user, DEFAULT_CONFIG.mysql.user),
      password: stringValue(envString('AIS_DB_PASSWORD') ?? mysql.password, DEFAULT_CONFIG.mysql.password),
      database: stringValue(envString('AIS_DB_NAME') ?? mysql.database, DEFAULT_CONFIG.mysql.database),
    },
    apiProxy: {
      enabled: booleanValue(envBoolean('AIS_API_PROXY_ENABLED') ?? apiProxy.enabled, DEFAULT_CONFIG.apiProxy.enabled),
      locked: booleanValue(envBoolean('AIS_API_PROXY_LOCKED') ?? apiProxy.locked, DEFAULT_CONFIG.apiProxy.locked),
      prefix: normalizeProxyPrefix(envString('AIS_API_PROXY_PREFIX') ?? apiProxy.prefix),
      target: stringValue(envString('AIS_API_PROXY_TARGET') ?? apiProxy.target, DEFAULT_CONFIG.apiProxy.target),
      changeOrigin: booleanValue(envBoolean('AIS_API_PROXY_CHANGE_ORIGIN') ?? apiProxy.changeOrigin, DEFAULT_CONFIG.apiProxy.changeOrigin),
      secure: booleanValue(envBoolean('AIS_API_PROXY_SECURE') ?? apiProxy.secure, DEFAULT_CONFIG.apiProxy.secure),
    },
  }
}
