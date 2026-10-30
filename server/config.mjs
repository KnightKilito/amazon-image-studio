import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'

const CONFIG_PATH = fileURLToPath(new URL('../config.yaml', import.meta.url))

const DEFAULT_CONFIG = {
  adminServer: {
    port: 8787,
  },
  apiProxy: {
    enabled: false,
    locked: false,
    prefix: '/api-proxy',
    target: '',
    allowAllTargets: false,
    allowedTargets: [],
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

function normalizeStringList(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(
    value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  ))
}

export function loadAdminConfig() {
  const fileConfig = readConfigFile()
  const adminServer = fileConfig.adminServer && typeof fileConfig.adminServer === 'object'
    ? fileConfig.adminServer
    : {}
  const apiProxy = fileConfig.apiProxy && typeof fileConfig.apiProxy === 'object'
    ? fileConfig.apiProxy
    : {}

  return {
    adminServer: {
      port: numberValue(envNumber('AIS_ADMIN_PORT') ?? adminServer.port, DEFAULT_CONFIG.adminServer.port),
    },
    apiProxy: {
      enabled: booleanValue(envBoolean('AIS_API_PROXY_ENABLED') ?? apiProxy.enabled, DEFAULT_CONFIG.apiProxy.enabled),
      locked: booleanValue(envBoolean('AIS_API_PROXY_LOCKED') ?? apiProxy.locked, DEFAULT_CONFIG.apiProxy.locked),
      prefix: normalizeProxyPrefix(envString('AIS_API_PROXY_PREFIX') ?? apiProxy.prefix),
      target: stringValue(envString('AIS_API_PROXY_TARGET') ?? apiProxy.target, DEFAULT_CONFIG.apiProxy.target),
      allowAllTargets: booleanValue(envBoolean('AIS_API_PROXY_ALLOW_ALL_TARGETS') ?? apiProxy.allowAllTargets, DEFAULT_CONFIG.apiProxy.allowAllTargets),
      allowedTargets: normalizeStringList(apiProxy.allowedTargets),
      changeOrigin: booleanValue(envBoolean('AIS_API_PROXY_CHANGE_ORIGIN') ?? apiProxy.changeOrigin, DEFAULT_CONFIG.apiProxy.changeOrigin),
      secure: booleanValue(envBoolean('AIS_API_PROXY_SECURE') ?? apiProxy.secure, DEFAULT_CONFIG.apiProxy.secure),
    },
  }
}
