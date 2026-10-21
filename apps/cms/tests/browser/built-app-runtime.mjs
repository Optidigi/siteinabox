import { registerHooks, syncBuiltinESMExports } from "node:module"
import http from "node:http"
import https from "node:https"
import { openSync, writeSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { builtAppMailVerification } from "./built-app-mail.mjs"
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
  const address = new URL(typeof input === "string" || input instanceof URL ? input : input.url)
  const mailEndpoint = "https://api.cloudflare.com/client/v4/accounts/" + "0".repeat(32) + "/email/sending/send"
  if (address.href === mailEndpoint && env.CLOUDFLARE_ACCOUNT_ID === "0".repeat(32)) {
    const headers = new Headers(options?.headers)
    if (options?.method !== "POST" || headers.get("authorization") !== "Bearer " + env.CLOUDFLARE_EMAIL_API_TOKEN ||
        typeof options.body !== "string" || options.body.length > 256 * 1024) throw new Error("E_TEST_MAIL_DOUBLE_INVALID")
    let verificationURL
    try { verificationURL = builtAppMailVerification(JSON.parse(options.body)) }
    catch (error) { record({ kind: "denied", operation: "mail-double", hostname: address.hostname }); throw error }
    const id = randomUUID()
    if (verificationURL) writeFileSync(path.join(env.DATA_DIR, "mail-" + id + ".json"), JSON.stringify({ verificationURL }), { mode: 0o600, flag: "wx" })
    record({ kind: "controlled-mail", verificationCaptured: verificationURL !== null })
    return Promise.resolve(new Response(JSON.stringify({ success: true, result: { message_id: "siab-test-captured-" + id } }),
      { status: 200, headers: { "content-type": "application/json" } }))
  }
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
