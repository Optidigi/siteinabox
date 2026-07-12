import { describe, expect, it } from "vitest"
import { createEmailPreferenceLinks, signEmailPreferenceToken, verifyEmailPreferenceToken } from "@/lib/email/preferenceTokens"

const secret = "test-only-email-preference-secret"

describe("email preference tokens", () => {
  it("round trips purpose-bound claims without embedding the raw email", () => {
    const token = signEmailPreferenceToken({
      subjectKey: "email:abcdef",
      allowedAction: "unsubscribe_marketing",
      tenantId: 42,
      secret,
      nowSeconds: 100,
      ttlSeconds: 60,
      nonce: "fixed-nonce",
    })
    expect(token).not.toContain("person@example.com")
    expect(verifyEmailPreferenceToken(token, { secret, nowSeconds: 120, requiredAction: "unsubscribe_marketing" }))
      .toMatchObject({ subjectKey: "email:abcdef", tenantId: 42, nonce: "fixed-nonce" })
  })

  it("rejects tampering, expiry, and an action mismatch", () => {
    const token = signEmailPreferenceToken({ subjectKey: "email:abcdef", allowedAction: "manage_preferences", secret, nowSeconds: 100, ttlSeconds: 60 })
    expect(() => verifyEmailPreferenceToken(`${token}x`, { secret, nowSeconds: 120 })).toThrow("signature")
    expect(() => verifyEmailPreferenceToken(token, { secret, nowSeconds: 160 })).toThrow("expired")
    expect(() => verifyEmailPreferenceToken(token, { secret, nowSeconds: 120, requiredAction: "unsubscribe_marketing" })).toThrow("not allowed")
  })

  it("fails closed when the dedicated secret is absent or a placeholder", () => {
    expect(() => signEmailPreferenceToken({ subjectKey: "email:abcdef", allowedAction: "manage_preferences", secret: "" })).toThrow("SIAB_EMAIL_PREFERENCE_SECRET")
    expect(() => verifyEmailPreferenceToken("a.b", { secret: "<secret>" })).toThrow("SIAB_EMAIL_PREFERENCE_SECRET")
  })

  it("creates separate opaque one-click and management links", () => {
    const links = createEmailPreferenceLinks({ origin: "https://cms.siteinabox.nl", subjectKey: "email:abcdef", secret, nowSeconds: 100 })
    expect(links.unsubscribeUrl).toContain("/email/preferences?token=")
    expect(links.oneClickUrl).toContain("/api/email/unsubscribe?token=")
    expect(links.preferencesUrl).toContain("/email/preferences?token=")
    expect(links.unsubscribeUrl).not.toContain("example.com")
    const unsubscribeToken = new URL(links.oneClickUrl).searchParams.get("token")!
    expect(verifyEmailPreferenceToken(unsubscribeToken, { secret, nowSeconds: 120 }).allowedAction).toBe("unsubscribe_marketing")
  })
})
