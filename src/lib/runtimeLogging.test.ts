import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const roots: string[] = []
const loggerUrl = pathToFileURL(join(process.cwd(), 'scripts/runtime-logging.mjs')).href
function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'studio-logging-'))
  roots.push(root)
  return root
}
function run(root: string, body: string) {
  return spawnSync(process.execPath, ['--input-type=module', '-e',
    `import { collectRootLogs, installRuntimeLogging } from ${JSON.stringify(loggerUrl)};
     const root = ${JSON.stringify(root)}; ${body}`], { encoding: 'utf8' })
}
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })))

describe('project runtime logs', () => {
  it('collects root logs without overwriting previous files or touching other files', () => {
    const root = temporaryRoot()
    mkdirSync(join(root, 'log'))
    writeFileSync(join(root, 'log', 'old.log'), 'previous')
    writeFileSync(join(root, 'old.log'), 'new')
    writeFileSync(join(root, '.hidden.log'), 'hidden')
    writeFileSync(join(root, 'config.json'), '{}')
    mkdirSync(join(root, 'folder.log'))
    const result = run(root, 'console.log(JSON.stringify(collectRootLogs(root)))')
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('[]')
    const names = readdirSync(join(root, 'log'))
    expect(names).toHaveLength(3)
    expect(readFileSync(join(root, 'log', 'old.log'), 'utf8')).toBe('previous')
    const collected = names.find((name) => name.startsWith('old.log.'))!
    expect(readFileSync(join(root, 'log', collected), 'utf8')).toBe('new')
    expect(readdirSync(root)).toEqual(expect.arrayContaining(['config.json', 'folder.log', 'log']))
    expect(readdirSync(root)).not.toContain('old.log')
  })

  it('keeps stdout, stderr, binary chunks and callbacks while appending across launches', () => {
    const root = temporaryRoot()
    for (let i = 0; i < 2; i++) {
      const result = run(root, `installRuntimeLogging('test', root);
        process.stdout.write(Buffer.from('你好'), () => console.log(' callback'));
        console.error('error');`)
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('你好 callback')
      expect(result.stderr).toContain('error')
    }
    expect(readFileSync(join(root, 'log', 'test.out.log'), 'utf8')).toBe('你好 callback\n你好 callback\n')
    expect(readFileSync(join(root, 'log', 'test.err.log'), 'utf8')).toBe('error\nerror\n')
  })

  it('does not crash the command when writing a log fails', () => {
    const root = temporaryRoot()
    mkdirSync(join(root, 'log', 'test.out.log'), { recursive: true })
    const result = run(root, `installRuntimeLogging('test', root); console.log('still running');`)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('still running')
    expect(result.stderr).toContain('[log] Cannot write')
  })

  it('restores terminal methods and rejects unsafe log names', () => {
    const root = temporaryRoot()
    const result = run(root, `const restore = installRuntimeLogging('test', root);
      console.log('logged'); restore(); console.log('terminal only');
      try { installRuntimeLogging('../bad', root); process.exitCode = 1 } catch {}`)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('terminal only')
    expect(readFileSync(join(root, 'log', 'test.out.log'), 'utf8')).toBe('logged\n')
  })
})
