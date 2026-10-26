import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { inspectMicrosoftMailReadiness } from "../../src/lib/microsoftMailProvisioning/readiness.ts"

describe("Microsoft mail configuration readiness", () => {
  it("lists missing server settings without exposing values", () => {
    const result = inspectMicrosoftMailReadiness({} as NodeJS.ProcessEnv)
    assert.equal(result.readyForLiveProvisioning, false)
    assert.ok(result.missingSettings.includes("PAX8_CLIENT_SECRET"))
    assert.ok(result.missingSettings.includes("MICROSOFT_PARTNER_APP_CLIENT_SECRET"))
    assert.ok(result.missingSettings.includes("EXCHANGE_WORKER_SHARED_SECRET"))
    assert.ok(!JSON.stringify(result).includes("secret"))
  })

  it("validates worker configuration and reports configuration presence separately from a connected partner", () => {
    const base = {
      NODE_ENV: "test",
      PAX8_CLIENT_ID: "client", PAX8_CLIENT_SECRET: "hidden", PAX8_ORDER_EMAIL: "ops@example.com", PAX8_MPN_ID: "partner", MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 8).toString("base64"), MICROSOFT_MAIL_CURRENCY: "EUR", MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR: "5604",
      MICROSOFT_PARTNER_TENANT_ID: "tenant", MICROSOFT_PARTNER_APP_CLIENT_ID: "app",
      MICROSOFT_PARTNER_APP_CLIENT_SECRET: "hidden", MICROSOFT_PARTNER_APP_REDIRECT_URI: "https://admin.example.org/operations/microsoft-mail/consent/callback", MICROSOFT_GDAP_ROLE_DEFINITION_IDS: "role",
      MICROSOFT_PARTNER_SECURITY_GROUP_ID: "group", CLOUDFLARE_API_TOKEN: "hidden",
      CLOUDFLARE_ACCOUNT_ID: "account", EXCHANGE_WORKER_URL: "http://worker/jobs",
      EXCHANGE_WORKER_SHARED_SECRET: "x".repeat(40), MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      CLOUDFLARE_EMAIL_API_TOKEN: "hidden", EMAIL_FROM: "noreply@example.com", SITE_URL: "https://admin.example.org",
    }
    assert.equal(inspectMicrosoftMailReadiness(base as NodeJS.ProcessEnv).readyForLiveProvisioning, false)
    const result = inspectMicrosoftMailReadiness({ ...base, EXCHANGE_WORKER_URL: "https://worker/jobs" } as NodeJS.ProcessEnv)
    assert.equal(result.readyForLiveProvisioning, true)
    assert.ok(result.items.find(item => item.key === "microsoftCustomerAppModel")?.note?.includes("sign-in"))
  })
})
