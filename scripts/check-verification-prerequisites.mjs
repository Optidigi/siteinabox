import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

export function assertDisposableCmsEnvironment(env) {
  let uri
  try { uri = new URL(env.DATABASE_URI) } catch { throw new Error("A disposable DATABASE_URI is required") }
  if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
      !["localhost", "127.0.0.1", "[::1]", "postgres"].includes(uri.hostname) ||
      uri.pathname !== "/payload_test") {
    throw new Error("Verification requires a loopback/isolated postgres service and payload_test database")
  }
  if (!env.PAYLOAD_SECRET || env.PAYLOAD_DISABLE_JOBS_AUTORUN !== "1" || env.SITE_GENERATION_PROVIDER !== "mock") {
    throw new Error("Verification requires a synthetic PAYLOAD_SECRET, disabled jobs and mock Sitegen")
  }
  const credentials = ["MOLLIE_API_KEY", "OPENPROVIDER_USERNAME", "OPENPROVIDER_PASSWORD", "OPENAI_API_KEY",
    "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_EMAIL_API_TOKEN", "CLOUDFLARE_EMAIL_SMTP_TOKEN",
    "GOOGLE_CLIENT_SECRET", "MICROSOFT_CLIENT_SECRET"]
  if (credentials.some((name) => env[name])) throw new Error("Provider credentials must be absent from verification")
}

async function checkCms() {
  assertDisposableCmsEnvironment(process.env)
  try {
    const version = execFileSync("/usr/bin/named-checkzone", ["-v"], { encoding: "utf8", timeout: 5000 }).trim()
    console.log("Authoritative BIND validator available: " + version)
  } catch { throw new Error("Install real bind9-utils: /usr/bin/named-checkzone is required; no fallback validator") }
  const require = createRequire(new URL("../apps/cms/package.json", import.meta.url))
  const { Client } = require("pg")
  const client = new Client({ connectionString: process.env.DATABASE_URI, connectionTimeoutMillis: 5000,
    query_timeout: 5000, options: "-c default_transaction_read_only=on" })
  try {
    await client.connect()
    const result = await client.query("SELECT current_database() AS db, current_setting('server_version_num')::int AS version")
    if (result.rows[0]?.db !== "payload_test" || Math.floor(result.rows[0].version / 10000) !== 18) {
      throw new Error("PostgreSQL 18 payload_test is required")
    }
    console.log("Disposable PostgreSQL 18 is reachable; integration tests must run")
  } catch { throw new Error("Disposable PostgreSQL 18 prerequisite failed; no integration-test skip is accepted") }
  finally { await client.end() }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2)
  if (flags.length !== 1 || flags[0] !== "--cms") throw new Error("Usage: node scripts/check-verification-prerequisites.mjs --cms")
  await checkCms()
}
