import { describe, it, expect } from "vitest"
import crypto from "node:crypto"
import { verifyPreviewToken } from "../src/lib/preview/verify"

const SECRET = "test-secret-32-bytes-deadbeefcafe1234567890"

function signFixture(claims: { tenantId: any; pageId: any; exp: number }, secret = SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")
  return `${header}.${payload}.${sig}`
}

describe("verifyPreviewToken", () => {
  it("verifies a valid token", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims)
    const result = verifyPreviewToken(token, SECRET)
    expect(result).toEqual(claims)
  })

  it("rejects a tampered payload", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims)
    const parts = token.split(".")
    const altered = Buffer.from(JSON.stringify({ ...claims, tenantId: 999 })).toString("base64url")
    const tampered = `${parts[0]}.${altered}.${parts[2]}`
    expect(verifyPreviewToken(tampered, SECRET)).toBeNull()
  })

  it("rejects an expired token", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) - 1 }
    const token = signFixture(claims)
    expect(verifyPreviewToken(token, SECRET)).toBeNull()
  })

  it("rejects a malformed token", () => {
    expect(verifyPreviewToken("not-a-jwt", SECRET)).toBeNull()
    expect(verifyPreviewToken("", SECRET)).toBeNull()
    expect(verifyPreviewToken(null, SECRET)).toBeNull()
    expect(verifyPreviewToken(undefined, SECRET)).toBeNull()
  })

  it("rejects when secret is empty or undefined", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims)
    expect(verifyPreviewToken(token, "")).toBeNull()
    expect(verifyPreviewToken(token, undefined)).toBeNull()
  })

  it("trims trailing whitespace from secret", () => {
    const claims = { tenantId: 1, pageId: 42, exp: Math.floor(Date.now() / 1000) + 60 }
    const token = signFixture(claims, SECRET)
    // Verify side has trailing newline (e.g., from `echo "..." > .env`).
    expect(verifyPreviewToken(token, `${SECRET}\n`)).toEqual(claims)
  })

  it("accepts string pageId (draft-<uuid> sentinel)", () => {
    const claims = {
      tenantId: 1,
      pageId: "draft-abc-123",
      exp: Math.floor(Date.now() / 1000) + 60,
    }
    const token = signFixture(claims)
    expect(verifyPreviewToken(token, SECRET)).toEqual(claims)
  })
})
