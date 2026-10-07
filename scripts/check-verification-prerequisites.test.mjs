import assert from "node:assert/strict"
import { test } from "node:test"
import { assertDisposableCmsEnvironment } from "./check-verification-prerequisites.mjs"

const safe = { DATABASE_URI: "postgres://fixture:synthetic@127.0.0.1:15432/payload_test",
  PAYLOAD_SECRET: "synthetic-test-only", PAYLOAD_DISABLE_JOBS_AUTORUN: "1", SITE_GENERATION_PROVIDER: "mock" }

test("verification rejects remote/default databases before invoking write-capable tests", () => {
  assertDisposableCmsEnvironment(safe)
  for (const DATABASE_URI of [undefined, "postgres://host.example/payload_test", "postgres://localhost/payload", "https://localhost/payload_test"]) {
    assert.throws(() => assertDisposableCmsEnvironment({ ...safe, DATABASE_URI }))
  }
})

test("verification rejects real provider credentials and enabled jobs/models", () => {
  for (const override of [{ MOLLIE_API_KEY: "test-fixture" }, { CLOUDFLARE_EMAIL_SMTP_TOKEN: "fixture" },
    { PAYLOAD_DISABLE_JOBS_AUTORUN: "0" }, { SITE_GENERATION_PROVIDER: "mastra" }, { PAYLOAD_SECRET: "" }]) {
    assert.throws(() => assertDisposableCmsEnvironment({ ...safe, ...override }))
  }
})
