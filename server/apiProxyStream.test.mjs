import http from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { streamApiProxyResponse } from './apiProxyStream.mjs'

const servers = []

function listen(server) {
  servers.push(server)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()))
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer))
})

describe('streamApiProxyResponse', () => {
  it('forwards the first SSE chunk before the upstream response completes', async () => {
    let releaseSecondChunk
    const secondChunkGate = new Promise((resolve) => {
      releaseSecondChunk = resolve
    })
    const upstream = http.createServer(async (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"delta":"first"}\n\n')
      await secondChunkGate
      res.end('data: {"delta":"second"}\n\n')
    })
    const upstreamUrl = await listen(upstream)

    const proxy = http.createServer(async (req, res) => {
      await streamApiProxyResponse({
        target: new URL(upstreamUrl),
        method: req.method,
        headers: { accept: 'text/event-stream' },
        downstreamRequest: req,
        downstreamResponse: res,
      })
    })
    const proxyUrl = await listen(proxy)

    let completed = false
    let resolveFirstChunk
    const firstChunk = new Promise((resolve) => {
      resolveFirstChunk = resolve
    })
    const completedBody = new Promise((resolve, reject) => {
      http.get(proxyUrl, (response) => {
        expect(response.headers['content-type']).toContain('text/event-stream')
        expect(response.headers['x-accel-buffering']).toBe('no')
        let body = ''
        response.on('data', (chunk) => {
          body += chunk.toString()
          if (body.includes('first')) resolveFirstChunk(body)
        })
        response.on('end', () => {
          completed = true
          resolve(body)
        })
        response.on('error', reject)
      }).on('error', reject)
    })

    await expect(firstChunk).resolves.toContain('first')
    expect(completed).toBe(false)
    releaseSecondChunk()
    await expect(completedBody).resolves.toContain('second')
  })
})
