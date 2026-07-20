import { afterAll } from "vitest"
import { promises as fs } from "node:fs"
import path from "node:path"

// Load .env into process.env before any test imports the Payload config.
// Vitest runs each test file in a fork so this runs once per worker.
async function loadEnv() {
  try {
    const text = await fs.readFile(path.resolve(process.cwd(), ".env"), "utf8")
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m) {
        const key = m[1]!
        const val = m[2]!
        if (process.env[key] === undefined) process.env[key] = val
      }
    }
  } catch {
    // No .env — assume CI sets vars directly
  }

  if (!process.env.PAYLOAD_SECRET) {
    process.env.PAYLOAD_SECRET = "test-secret"
  }
  if (!process.env.DATABASE_URI) {
    process.env.DATABASE_URI = "postgresql://127.0.0.1:5432/payload_test"
  }

  // Override DATABASE_URI to point at the test database. Same Postgres instance,
  // hash to the right index — but the test DB starts empty, so this only matters
  // if any test fixture uses a pre-seeded API key.
  if (process.env.DATABASE_URI && !process.env.DATABASE_URI_OVERRIDDEN) {
    const original = process.env.DATABASE_URI
    process.env.DATABASE_URI = original.replace(/\/[^/?]+(\?|$)/, "/payload_test$1")
    process.env.DATABASE_URI_OVERRIDDEN = "1"
  }
  // DATA_DIR -> a per-test-run scratch dir so projection tests don't collide
  // with dev. Each fork uses its own dir; cleaned at process exit.
  if (!process.env.DATA_DIR_OVERRIDDEN) {
    const dir = path.resolve(process.cwd(), `.data-test-${process.pid}`)
    await fs.mkdir(dir, { recursive: true })
    process.env.DATA_DIR = dir
    process.env.DATA_DIR_OVERRIDDEN = "1"
  }
  // Unit/integration tests must never reach real email providers by accident.
  // Individual tests inject providers or stub env when they need delivery/API behavior.
  if (process.env.SIAB_ALLOW_TEST_EMAIL !== "1") {
    delete process.env.CLOUDFLARE_EMAIL_SMTP_TOKEN
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.CLOUDFLARE_API_TOKEN
  }
}

await loadEnv()

afterAll(async () => {
  // teardown: rm the test data dir
  if (process.env.DATA_DIR_OVERRIDDEN && process.env.DATA_DIR?.includes(".data-test-")) {
    await fs.rm(process.env.DATA_DIR, { recursive: true, force: true }).catch(() => {})
  }
})
