import { registerHooks, syncBuiltinESMExports } from "node:module"
import http from "node:http"
import https from "node:https"
import { openSync, writeSync } from "node:fs"
import path from "node:path"
import { loadCmsTestEnvironment, assertWorkerStorage, assertDatabaseOwnership } from "../_helpers/cmsTestEnvironment.mjs"

// This preload is test-owned. It validates the final child environment before
// imports can initialize Payload, then denies remote provider transports.
const { env, resource } = await loadCmsTestEnvironment()
await assertWorkerStorage(env, resource)
await assertDatabaseOwnership(env, resource)
const audit = openSync(path.join(env.DATA_DIR, "network-" + process.pid + ".ndjson"), "wx", 0o600)
const record = (event) => writeSync(audit, JSON.stringify(event) + "\n")
record({ kind: "initialized", mode: "deny-external-provider-operations" })
const local = (host) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
function check(value, operation) {
  const url = value instanceof URL ? value : new URL(value)
  if (!local(url.hostname)) {
    record({ kind: "denied", operation, protocol: url.protocol, hostname: url.hostname })
    throw new Error("E_TEST_PROVIDER_NETWORK_DENIED: " + operation + " " + url.hostname)
  }
}
const originalFetch = globalThis.fetch
// Use explicit deny doubles, not successful fake responses for application routes.
globalThis.fetch = function (input, options) {
  check(typeof input === "string" || input instanceof URL ? input : input.url, "fetch")
  return originalFetch.call(this, input, options)
}
for (const [protocol, transport] of [["http:", http], ["https:", https]]) {
  for (const name of ["request", "get"]) {
    const original = transport[name]
    transport[name] = function (...args) {
      const first = args[0]
      if (typeof first === "string" || first instanceof URL) check(first, name)
      else {
        const host = first.hostname ?? first.host ?? "localhost"
        if (!local(host)) check(new URL(protocol + "//" + host), name)
      }
      return original.apply(this, args)
    }
  }
}
syncBuiltinESMExports()
// Ordinary Node fixture APIs need React's ordinary exports. This inert marker
// matches the existing production migration bundle's server-only alias.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: new URL("../../scripts/server-only-shim.ts", import.meta.url).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
