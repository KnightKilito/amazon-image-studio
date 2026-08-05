import http from 'node:http'
import https from 'node:https'

function createResponseHeaders(upstreamHeaders) {
  const headers = {}
  for (const [key, value] of Object.entries(upstreamHeaders)) {
    if (value === undefined) continue
    if (['connection', 'transfer-encoding'].includes(key.toLowerCase())) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }
  headers['cache-control'] = 'no-store'
  const contentType = String(headers['content-type'] ?? '').toLowerCase()
  if (contentType.includes('text/event-stream')) headers['x-accel-buffering'] = 'no'
  return headers
}

export function streamApiProxyResponse({
  target,
  method,
  headers,
  body,
  downstreamRequest,
  downstreamResponse,
  timeoutMs = 300000,
}) {
  const client = target.protocol === 'http:' ? http : https

  return new Promise((resolve, reject) => {
    let settled = false
    let upstreamResponse = null
    let errorPreview = Buffer.alloc(0)

    const finish = (callback, value) => {
      if (settled) return
      settled = true
      downstreamResponse.removeListener('close', handleDownstreamClose)
      callback(value)
    }

    const handleDownstreamClose = () => {
      if (downstreamResponse.writableEnded) return
      upstreamResponse?.destroy()
      upstreamRequest.destroy()
      finish(resolve, { status: 499, preview: '' })
    }

    const upstreamRequest = client.request(target, { method, headers }, (response) => {
      upstreamResponse = response
      const status = response.statusCode ?? 502
      const responseHeaders = createResponseHeaders(response.headers)
      downstreamResponse.writeHead(status, responseHeaders)
      downstreamResponse.flushHeaders?.()

      if (status < 200 || status >= 300) {
        response.on('data', (chunk) => {
          if (errorPreview.byteLength >= 500) return
          const remaining = 500 - errorPreview.byteLength
          errorPreview = Buffer.concat([errorPreview, chunk.subarray(0, remaining)])
        })
      }

      response.on('error', (error) => {
        downstreamResponse.destroy(error)
        finish(reject, error)
      })
      response.on('end', () => {
        finish(resolve, {
          status,
          preview: errorPreview.toString('utf8').replace(/\s+/g, ' ').trim(),
        })
      })
      response.pipe(downstreamResponse)
    })

    downstreamResponse.on('close', handleDownstreamClose)
    upstreamRequest.on('error', (error) => {
      if (downstreamResponse.headersSent) downstreamResponse.destroy(error)
      finish(reject, error)
    })
    upstreamRequest.setTimeout(timeoutMs, () => {
      upstreamRequest.destroy(new Error('API proxy upstream timeout'))
    })
    if (body && body.length > 0) upstreamRequest.write(body)
    upstreamRequest.end()
  })
}
