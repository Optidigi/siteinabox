import { describe, expect, it } from "vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { passwordlessBefore, isForbiddenCustomerAuthPath } from "@/lib/auth/passwordlessPolicy"

function fixture() {
  return betterAuth({ baseURL: "http://localhost:3000", secret: "unit-test-passwordless-only-secret-32", database: memoryAdapter({ user: [], session: [], account: [] }), emailAndPassword: { enabled: true }, socialProviders: { google: { clientId: "fixture", clientSecret: "fixture" } }, hooks: { before: passwordlessBefore }, telemetry: { enabled: false } })
}
describe("real Better Auth endpoint dispatch", () => {
  it("denies direct API social and password login even when enabled in fixture config", async () => {
    const auth = fixture()
    await expect(auth.api.signInSocial({ body: { provider: "google" } })).rejects.toMatchObject({ status: "FORBIDDEN" })
    await expect(auth.api.signInEmail({ body: { email: "fixture@example.com", password: "valid-fixture-password" } })).rejects.toMatchObject({ status: "FORBIDDEN" })
    await expect(auth.api.linkSocialAccount({ headers: new Headers(), body: { provider: "google" } })).rejects.toMatchObject({ status: "FORBIDDEN" })
  })
  it.each(["sign-in/social", "sign-in/email", "link-social"])("denies HTTP %s without provider network IO", async (path) => {
    const response = await fixture().handler(new Request(`http://localhost:3000/api/auth/${path}`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ provider: "google", email: "fixture@example.com", password: "valid-fixture-password" }) }))
    expect(response.status).toBe(403)
  })
  it("keeps magic-link/session lifecycle and independent calendar OAuth paths", () => {
    for (const path of ["/sign-in/magic-link", "/magic-link/verify", "/get-session", "/sign-out", "/revoke-session", "/revoke-sessions", "/api/appointments/calendar/google/callback", "/api/appointments/calendar/microsoft/start"]) expect(isForbiddenCustomerAuthPath(path)).toBe(false)
    for (const path of ["/callback/google", "/callback/microsoft", "/sign-up/email", "/reset-password", "/change-password", "/set-password", "/request-password-reset"]) expect(isForbiddenCustomerAuthPath(path)).toBe(true)
  })
})
