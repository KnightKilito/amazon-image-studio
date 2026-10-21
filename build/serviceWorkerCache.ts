import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

export interface CacheBuildAsset { name: string; content: string | Uint8Array }

export function stampServiceWorker(source: string, assets: readonly CacheBuildAsset[]) {
  if (!source.includes('__SW_BUILD_ID__')) throw new Error('sw.js 缺少自动缓存标识占位符。')
  const hash = createHash('sha256').update(source)
  for (const asset of [...assets].sort((a, b) => a.name.localeCompare(b.name))) {
    hash.update('\0').update(asset.name).update('\0').update(asset.content)
  }
  return source.replace('__SW_BUILD_ID__', hash.digest('hex').slice(0, 16))
}

function readPublicAssets(directory: string, prefix = 'public'): CacheBuildAsset[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry): CacheBuildAsset[] => {
    const name = `${prefix}/${entry.name}`
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return readPublicAssets(path, name)
    return entry.isFile() ? [{ name, content: readFileSync(path) }] : []
  })
}

export function serviceWorkerCachePlugin(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'automatic-service-worker-cache',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    writeBundle(options, bundle) {
      if (!config.publicDir) return
      const source = readFileSync(join(config.publicDir, 'sw.js'), 'utf8')
      const assets: CacheBuildAsset[] = [
        ...readPublicAssets(config.publicDir),
        ...Object.values(bundle).map((asset) => ({ name: `dist/${asset.fileName}`, content: asset.type === 'chunk' ? asset.code : asset.source })),
      ]
      const outDir = resolve(config.root, options.dir ?? config.build.outDir)
      writeFileSync(join(outDir, 'sw.js'), stampServiceWorker(source, assets))
    },
  }
}
