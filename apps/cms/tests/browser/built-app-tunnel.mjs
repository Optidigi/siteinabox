import { createServer } from "node:http"
import { connect } from "node:net"
import { once } from "node:events"

/** Preserve real HTTPS origins/redirects while tunnelling only to an owned edge. */
export async function createBuiltAppTunnel(edgePort, authorities) {
  const allowed = new Set(authorities)
  const sockets = new Set()
  const track = socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket))
    socket.on("error", () => socket.destroy())
    socket.setTimeout(30000, () => socket.destroy())
  }
  const server = createServer((_incoming, outgoing) => { outgoing.writeHead(403); outgoing.end() })
  server.on("connect", (incoming, client, head) => {
    track(client)
    if (!allowed.has(incoming.url)) {
      client.end("HTTP/1.1 403 Forbidden\r\n\r\n", () => client.destroy()); return
    }
    const upstream = connect(edgePort, "127.0.0.1"); track(upstream)
    upstream.on("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
      if (head.length) upstream.write(head)
      client.pipe(upstream); upstream.pipe(client)
    })
    client.on("error", () => upstream.destroy()); upstream.on("error", () => client.destroy())
    client.on("close", () => upstream.destroy()); upstream.on("close", () => client.destroy())
  })
  server.listen(0, "127.0.0.1"); await once(server, "listening")
  return {
    serverURL: "http://127.0.0.1:" + server.address().port,
    async close() {
      for (const socket of sockets) socket.destroy()
      server.closeAllConnections()
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
