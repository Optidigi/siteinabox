import { describe, it, expect } from "vitest"
import { signPreviewToken, verifyPreviewToken } from "@/lib/preview/sign"

const SECRET = "test-secret-32-bytes-deadbeefcafe1234567890"

describe("signPreviewToken", () => {
  it("produces a 3-part token", () => {
    const { token } = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET)
    expect(token.split(".")).toHaveLength(3)
  })

  it("sets exp 30 minutes in the future", () => {
    const now = 1_700_000_000
    const { exp } = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET, now)
    expect(exp).toBe(now + 30 * 60)
  })

  it("throws when secret is missing", () => {
    expect(() => signPreviewToken({ tenantId: 1, pageId: 42 }, undefined)).toThrow()
    expect(() => signPreviewToken({ tenantId: 1, pageId: 42 }, "")).toThrow()
    expect(() => signPreviewToken({ tenantId: 1, pageId: 42 }, "   ")).toThrow()
  })

  it("encodes claims in the payload segment", () => {
    const { token } = signPreviewToken({ tenantId: 7, pageId: 99 }, SECRET, 1_700_000_000)
    const payloadSeg = token.split(".")[1] ?? ""
    const payload = JSON.parse(Buffer.from(payloadSeg, "base64url").toString("utf-8"))
    expect(payload.tenantId).toBe(7)
    expect(payload.pageId).toBe(99)
    expect(payload.exp).toBe(1_700_000_000 + 30 * 60)
  })

  it("supports string pageId for draft-<uuid> sentinel", () => {
    const { token } = signPreviewToken({ tenantId: 1, pageId: "draft-abc" }, SECRET)
    const payloadSeg = token.split(".")[1] ?? ""
    const payload = JSON.parse(Buffer.from(payloadSeg, "base64url").toString("utf-8"))
    expect(payload.pageId).toBe("draft-abc")
  })

  it("trims trailing whitespace from secret (parity with verify side)", () => {
    const a = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET, 1_700_000_000)
    const b = signPreviewToken({ tenantId: 1, pageId: 42 }, `${SECRET}\n`, 1_700_000_000)
    expect(a.token).toBe(b.token)
  })

  it("verifies a signed token and returns claims", () => {
    const { token } = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET, 1_700_000_000)
    expect(verifyPreviewToken(token, SECRET, 1_700_000_100)).toMatchObject({
      tenantId: 1,
      pageId: 42,
      exp: 1_700_001_800,
    })
  })

  it("rejects expired and tampered tokens", () => {
    const { token } = signPreviewToken({ tenantId: 1, pageId: 42 }, SECRET, 1_700_000_000)
    expect(() => verifyPreviewToken(token, SECRET, 1_700_001_801)).toThrow(/expired/i)
    expect(() => verifyPreviewToken(`${token.slice(0, -1)}x`, SECRET, 1_700_000_100)).toThrow(/signature/i)
  })
})
