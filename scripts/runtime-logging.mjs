import { appendFileSync, existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

export const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Also collect logs left by external tools (for example IDE Git/Java helpers).
// Never overwrite an earlier log, and leave locked files alone.
export function collectRootLogs(root = projectDirectory) {
  const logDirectory = join(root, 'log')
  mkdirSync(logDirectory, { recursive: true })
  const failures = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.log')) continue
    let destination = join(logDirectory, entry.name)
    if (existsSync(destination)) destination += `.${randomUUID()}`
    try {
      renameSync(join(root, entry.name), destination)
    } catch {
      failures.push(entry.name)
    }
  }
  return failures
}

export function installRuntimeLogging(name, root = projectDirectory) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid log name')
  const failures = collectRootLogs(root)
  if (failures.length) process.stderr.write(`[log] Unable to move locked logs: ${failures.join(', ')}\n`)
  const restores = []
  for (const [channel, stream] of [['out', process.stdout], ['err', process.stderr]]) {
    const path = join(root, 'log', `${name}.${channel}.log`)
    // Keep the original terminal behavior, including TTY, callbacks and exit signals.
    const original = stream.write
    let warned = false
    stream.write = function (chunk, encoding, callback) {
      try {
        appendFileSync(path, chunk, typeof encoding === 'string' ? encoding : undefined)
      } catch {
        // A full disk or permissions error must not take down the application.
        if (!warned) {
          warned = true
          process.stderr === stream
            ? original.call(stream, `[log] Cannot write ${path}\n`)
            : process.stderr.write(`[log] Cannot write ${path}\n`)
        }
      }
      return original.call(this, chunk, encoding, callback)
    }
    restores.push(() => { stream.write = original })
  }
  return () => restores.forEach((restore) => restore())
}

// This file is a Node preload, so npm arguments go straight to the real CLI.
const entry = basename(process.argv[1] || '')
const logName = entry === 'vite.js' ? (process.argv[2] === 'build' ? 'build' : process.argv[2] === 'preview' ? 'preview' : 'vite')
  : entry === 'tsc' ? 'build'
  : entry === 'adminServer.mjs' ? 'admin-server'
  : entry === 'mock-image-api.mjs' ? 'mock-api'
  : null
if (logName) installRuntimeLogging(logName)
