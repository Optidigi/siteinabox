import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const importMiddleware = async () => {
  return (await import("@/proxy")).proxy
}

describe("middleware CSP nonce", () => {
  beforeEach(() => { vi.unstubAllEnvs() })

  it("emits a fresh nonce per request and no unsafe-* on script-src in prod/test mode", async () => {
    // Default NODE_ENV in vitest is "test" — strict CSP applies.
    const mw = await importMiddleware()
    const req1 = new NextRequest("https://admin.localhost/")
    const req2 = new NextRequest("https://admin.localhost/")
    const r1 = await mw(req1)
    const r2 = await mw(req2)
    const csp1 = r1!.headers.get("content-security-policy") ?? ""
    const csp2 = r2!.headers.get("content-security-policy") ?? ""
    expect(csp1).toMatch(/script-src [^;]*'nonce-[^']+'/)
    expect(csp1).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(csp1).not.toMatch(/script-src[^;]*'unsafe-eval'/)
    expect(csp1).toMatch(/style-src [^;]*'nonce-[^']+'/)
    expect(csp1).not.toMatch(/style-src[^;]*'unsafe-inline'/)
    expect(csp1).not.toEqual(csp2)
  })

  it("uses the same nonce value in script-src, style-src, and the forwarded nonce header", async () => {
    const mw = await importMiddleware()
    const res = await mw(new NextRequest("https://admin.localhost/"))
    const csp = res!.headers.get("content-security-policy") ?? ""
    const headerNonce = res!.headers.get("x-csp-nonce")
    const scriptNonce = csp.match(/script-src[^;]*'nonce-([^']+)'/)?.[1]
    const styleNonce = csp.match(/style-src[^;]*'nonce-([^']+)'/)?.[1]

    expect(headerNonce).toBeTruthy()
    expect(scriptNonce).toBe(headerNonce)
    expect(styleNonce).toBe(headerNonce)
  })

  it("allows 'unsafe-eval' on script-src ONLY in development (for Fast Refresh)", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const mw = await importMiddleware()
    const r = await mw(new NextRequest("https://admin.localhost/"))
    const csp = r!.headers.get("content-security-policy") ?? ""
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'[^;]*'unsafe-eval'/)
    // 'unsafe-inline' MUST NOT be added even in dev — nonces cover inline scripts.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    // Next devtools injects diagnostic style elements without our request nonce.
    expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/)
  })

  it("does NOT include 'unsafe-eval' when NODE_ENV is production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const mw = await importMiddleware()
    const r = await mw(new NextRequest("https://admin.localhost/"))
    const csp = r!.headers.get("content-security-policy") ?? ""
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/)
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/)
  })

  it("permits configured PostHog origins for native CMS browser analytics", async () => {
    vi.stubEnv("POSTHOG_PUBLIC_HOST", "https://r.siteinabox.nl/")
    vi.stubEnv("POSTHOG_HOST", "https://eu.posthog.com/")
    const mw = await importMiddleware()
    const r = await mw(new NextRequest("https://admin.localhost/"))
    const csp = r!.headers.get("content-security-policy") ?? ""

    expect(csp).toMatch(/script-src[^;]*https:\/\/r\.siteinabox\.nl/)
    expect(csp).toMatch(/connect-src[^;]*https:\/\/r\.siteinabox\.nl/)
    expect(csp).toMatch(/connect-src[^;]*https:\/\/eu\.posthog\.com/)
  })
})
