// SEE: feature "developer-tools" at core/docs/knowledge/developer-tools.md
//
// Custom MCP transport handler — replaces @nuxtjs/mcp-toolkit's node.js provider.
//
// The default provider creates a StreamableHTTPServerTransport per request, which
// internally calls getRequestListener() from @hono/node-server. Each invocation
// adds close/error listeners to the ServerResponse, triggering Node.js's
// MaxListenersExceededWarning and causing a real memory leak over time.
// See: https://github.com/modelcontextprotocol/python-sdk/issues/756 (same pattern)
//
// Fix: Use WebStandardStreamableHTTPServerTransport directly and stream via h3's
// sendWebResponse (pipeTo-based, no event listeners on ServerResponse).

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { readBody, toWebRequest, sendWebResponse } from 'h3'
import type { H3Event } from 'h3'

type McpTransportHandler = (server: any, event: H3Event) => Promise<void>

const handler: McpTransportHandler = async (server, event) => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode — no session tracking
  })

  await server.connect(transport)

  // Only read body for methods that have one (POST).
  // The original provider unconditionally calls readBody, which throws 405 on GET.
  const body = event.method === 'POST' ? await readBody(event) : undefined

  // Convert h3 event to web standard Request.
  // Body stream may already be consumed by readBody — that's fine because
  // we pass parsedBody to the transport, which skips req.json().
  const webRequest = toWebRequest(event)

  try {
    const response = await transport.handleRequest(webRequest, { parsedBody: body })
    // Stream the web Response through h3 (uses pipeTo — no event listener leak)
    await sendWebResponse(event, response)
  }
  finally {
    // Deterministic cleanup after streaming completes or on error.
    // The original provider relies on response 'close' event, which can miss cleanup.
    await transport.close()
    await server.close()
  }
}

export default handler
