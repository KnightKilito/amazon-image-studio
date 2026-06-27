import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { loadAdminConfig } from './server/config.mjs'
import { normalizeDevProxyConfig } from './src/lib/devProxy'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const adminConfig = loadAdminConfig()

function loadDevProxyConfig() {
  try {
    return normalizeDevProxyConfig(
      JSON.parse(readFileSync('./dev-proxy.config.json', 'utf-8')) as unknown,
    )
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return null
    throw error
  }
}

export default defineConfig(({ command }) => {
  const configApiProxy = normalizeDevProxyConfig(adminConfig.apiProxy)
  const fileDevProxyConfig = command === 'serve' ? loadDevProxyConfig() : null
  const devProxyConfig = command === 'serve'
    ? (configApiProxy?.enabled ? configApiProxy : fileDevProxyConfig)
    : null
  const clientApiProxyConfig = configApiProxy?.enabled ? configApiProxy : devProxyConfig
  const adminApiPort = String(adminConfig.adminServer.port)
  const apiProxyUsesAdminServer = Boolean(configApiProxy?.enabled)
  const rewriteDevProxyPath = (path: string) => {
    const [pathname, search = ''] = path.split('?')
    const rewrittenPath = pathname.replace(
      new RegExp(`^${devProxyConfig!.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      '',
    )
    return `${rewrittenPath}${search ? `?${search}` : ''}`
  }
  const proxy = {
    '/admin-api': {
      target: `http://localhost:${adminApiPort}`,
      changeOrigin: true,
    },
    ...(devProxyConfig?.enabled
      ? {
          [devProxyConfig.prefix]: {
            target: apiProxyUsesAdminServer ? `http://localhost:${adminApiPort}` : devProxyConfig.target,
            changeOrigin: apiProxyUsesAdminServer ? true : devProxyConfig.changeOrigin,
            secure: apiProxyUsesAdminServer ? false : devProxyConfig.secure,
            rewrite: apiProxyUsesAdminServer
              ? undefined
              : rewriteDevProxyPath,
          },
        }
      : {}),
  }

  return {
    plugins: [react()],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __DEV_PROXY_CONFIG__: JSON.stringify(devProxyConfig),
      __API_PROXY_CONFIG__: JSON.stringify(clientApiProxyConfig),
    },
    server: {
      host: true,
      proxy,
    },
  }
})
