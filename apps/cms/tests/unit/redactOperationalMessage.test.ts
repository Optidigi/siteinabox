import { describe, expect, it } from "vitest"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"

describe("redactOperationalMessage", () => {
  it.each([
    "CLOUDFLARE_EMAIL_API_TOKEN",
    "CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET",
    "OPENPROVIDER_PASSWORD",
    "BETTER_AUTH_PREVIEW_SECRET",
    "APPOINTMENT_CALENDAR_ENCRYPTION_KEY",
    "APPOINTMENT_MANAGEMENT_ENCRYPTION_KEY",
    "SIAB_OPERATIONAL_HASH_KEY",
  ])("redacts %s values", (name) => {
    const secret = "sensitive-value-123"
    const redacted = redactOperationalMessage(`${name}=${secret}`)

    expect(redacted).toBe(`${name}=[redacted]`)
    expect(redacted).not.toContain(secret)
  })
})
