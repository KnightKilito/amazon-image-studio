import { describe, expect, it, vi } from 'vitest'
import { CLOUDFLARE_ANALYTICS_SCRIPT, CLOUDFLARE_ANALYTICS_TOKEN, installCloudflareAnalytics } from './cloudflareAnalytics'

function createDocument(readyState = 'complete') {
  const events = new EventTarget()
  const scripts: Array<ReturnType<typeof createScript>> = []
  function createScript() {
    const attributes = new Map<string, string>()
    return {
      type: '', async: false, src: '',
      setAttribute: (key: string, value: string) => { attributes.set(key, value) },
      getAttribute: (key: string) => attributes.get(key),
      addEventListener: vi.fn(),
    }
  }
  const doc = {
    readyState,
    createElement: vi.fn(createScript),
    querySelector: vi.fn(() => scripts.find((script) => script.getAttribute('data-cf-beacon') !== undefined || /^(https:)?\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/.test(script.src)) ?? null),
    addEventListener: events.addEventListener.bind(events),
    body: { appendChild: vi.fn((script: ReturnType<typeof createScript>) => { scripts.push(script); return script }) },
  }
  return { doc, document: doc as unknown as Document, scripts, createScript, events }
}

describe('Cloudflare analytics installation', () => {
  it('adds the official module once with only the public site token', () => {
    const fixture = createDocument()
    const options = { production: true, hostname: 'example.com', document: fixture.document }
    installCloudflareAnalytics(options)
    installCloudflareAnalytics(options)
    expect(fixture.scripts).toHaveLength(1)
    expect(fixture.scripts[0]).toMatchObject({ src: CLOUDFLARE_ANALYTICS_SCRIPT, type: 'module', async: true })
    expect(JSON.parse(fixture.scripts[0].getAttribute('data-cf-beacon')!)).toEqual({ token: CLOUDFLARE_ANALYTICS_TOKEN })
  })

  it('does not load in development even when accessed through a public hostname', () => {
    const fixture = createDocument()
    installCloudflareAnalytics({ production: false, hostname: 'example.com', document: fixture.document })
    expect(fixture.doc.createElement).not.toHaveBeenCalled()
  })

  it('excludes localhost, loopback and private IPv4 hosts from production previews', () => {
    const fixture = createDocument()
    for (const hostname of ['localhost', 'app.localhost', '127.0.0.1', '127.0.1.1', '[::1]', '::1', '0.0.0.0', '10.0.0.2', '192.168.1.2', '172.16.1.1', '172.31.255.1']) {
      installCloudflareAnalytics({ production: true, hostname, document: fixture.document })
    }
    expect(fixture.doc.createElement).not.toHaveBeenCalled()
  })

  it('does not misclassify public hosts or numeric subdomains as private addresses', () => {
    for (const hostname of ['example.com', '10.example.com', '172.32.0.1']) {
      const fixture = createDocument()
      installCloudflareAnalytics({ production: true, hostname, document: fixture.document })
      expect(fixture.scripts).toHaveLength(1)
    }
  })

  it('waits for parsed HTML and respects a Cloudflare auto-injected beacon', () => {
    const fixture = createDocument('loading')
    installCloudflareAnalytics({ production: true, hostname: 'example.com', document: fixture.document })
    expect(fixture.scripts).toHaveLength(0)
    const automatic = fixture.createScript()
    automatic.src = `${CLOUDFLARE_ANALYTICS_SCRIPT}/version`
    automatic.setAttribute('data-cf-beacon', '{"token":"automatic"}')
    fixture.scripts.push(automatic)
    fixture.events.dispatchEvent(new Event('DOMContentLoaded'))
    expect(fixture.scripts).toEqual([automatic])
    expect(fixture.doc.body.appendChild).not.toHaveBeenCalled()
  })

  it('ignores pre-existing manual scripts including token query strings', () => {
    const fixture = createDocument()
    const existing = fixture.createScript()
    existing.src = `${CLOUDFLARE_ANALYTICS_SCRIPT}?token=existing`
    fixture.scripts.push(existing)
    installCloudflareAnalytics({ production: true, hostname: 'example.com', document: fixture.document })
    expect(fixture.doc.body.appendChild).not.toHaveBeenCalled()
  })

  it('installs only once when initialized multiple times before DOMContentLoaded', () => {
    const fixture = createDocument('loading')
    const options = { production: true, hostname: 'example.com', document: fixture.document }
    installCloudflareAnalytics(options)
    installCloudflareAnalytics(options)
    fixture.events.dispatchEvent(new Event('DOMContentLoaded'))
    fixture.events.dispatchEvent(new Event('DOMContentLoaded'))
    expect(fixture.scripts).toHaveLength(1)
  })

  it('skips an invalid or empty token and tolerates script insertion failure', () => {
    const fixture = createDocument()
    for (const token of ['', 'not-a-site-token']) installCloudflareAnalytics({ production: true, hostname: 'example.com', document: fixture.document, token })
    expect(fixture.scripts).toHaveLength(0)
    fixture.doc.body.appendChild.mockImplementation(() => { throw new Error('blocked') })
    expect(() => installCloudflareAnalytics({ production: true, hostname: 'example.com', document: fixture.document })).not.toThrow()
  })
})
