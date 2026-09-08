import { describe, it, expect } from "vitest"
import { stripAdminPrefix, isSuperAdminDomain, isPlatformAdminHost, isMarketingSiteHost } from "@/lib/hostToTenant"

describe("stripAdminPrefix", () => {
  it("removes admin. prefix", () => {
    expect(stripAdminPrefix("admin.clientasite.nl")).toBe("clientasite.nl")
  })
  it("removes admin. and port", () => {
    expect(stripAdminPrefix("admin.clientasite.nl:3000")).toBe("clientasite.nl")
  })
  it("returns input unchanged when no admin. prefix", () => {
    expect(stripAdminPrefix("clientasite.nl")).toBe("clientasite.nl")
  })
  it("handles localhost", () => {
    expect(stripAdminPrefix("admin.localhost:3000")).toBe("localhost")
  })
})

describe("isSuperAdminDomain", () => {
  it("matches NEXT_PUBLIC_SUPER_ADMIN_DOMAIN", () => {
    // Pass isDev=false so the dev-convenience branch doesn't influence prod assertions
    expect(isSuperAdminDomain("siteinabox.nl", "siteinabox.nl", false)).toBe(true)
    expect(isSuperAdminDomain("clientasite.nl", "siteinabox.nl", false)).toBe(false)
  })
  it("dev fallback: unknown 'localhost' is super-admin if env not set", () => {
    expect(isSuperAdminDomain("localhost", undefined, false)).toBe(true)
  })
  it("dev convenience: localhost is super-admin in dev even when configured is set", () => {
    expect(isSuperAdminDomain("localhost", "siteinabox.nl", true)).toBe(true)
  })
  it("dev convenience: Cloudflare quick tunnels are super-admin in development", () => {
    expect(isSuperAdminDomain("random-words.trycloudflare.com", "siteinabox.nl", true)).toBe(true)
    expect(isSuperAdminDomain("random-words.trycloudflare.com", "siteinabox.nl", false)).toBe(false)
  })
  it("prod: localhost is NOT super-admin when configured is set", () => {
    expect(isSuperAdminDomain("localhost", "siteinabox.nl", false)).toBe(false)
  })
})

describe("isPlatformAdminHost", () => {
  it("accepts the platform admin host and rejects customer admin hosts", () => {
    expect(isPlatformAdminHost("admin.siteinabox.nl", "siteinabox.nl", false)).toBe(true)
    expect(isPlatformAdminHost("admin.ami-care.nl", "siteinabox.nl", false)).toBe(false)
  })
})

describe("isMarketingSiteHost", () => {
  it("accepts the public marketing apex and www, not admin or customer hosts", () => {
    expect(isMarketingSiteHost("siteinabox.nl", "siteinabox.nl")).toBe(true)
    expect(isMarketingSiteHost("www.siteinabox.nl", "siteinabox.nl")).toBe(true)
    expect(isMarketingSiteHost("admin.siteinabox.nl", "siteinabox.nl")).toBe(false)
    expect(isMarketingSiteHost("ami-care.nl", "siteinabox.nl")).toBe(false)
  })
})
