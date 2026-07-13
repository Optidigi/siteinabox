import { describe, expect, it } from "vitest"
import {
  createPreviewSiteReadyAuthorization,
  isPrivilegedPreviewSiteReadyMetadata,
} from "@/lib/preview/trustedSiteReadyIntent"

const env = { BETTER_AUTH_PREVIEW_SECRET: "preview-test-secret" } as unknown as NodeJS.ProcessEnv
const now = new Date("2026-07-13T10:00:00.000Z")
const subject = { email: "customer@example.com", clientSlug: "preview-studio" }

describe("trusted preview site-ready mail intent", () => {
  it("accepts site-ready metadata signed by the server for the exact recipient and preview", () => {
    const authorization = createPreviewSiteReadyAuthorization(subject, { now, env })
    expect(isPrivilegedPreviewSiteReadyMetadata({
      ...subject,
      metadata: { previewSiteReady: true, previewSiteReadyAuthorization: authorization },
      now,
      env,
    })).toBe(true)
  })

  it("treats a public caller's unsigned site-ready flag as an ordinary preview magic link", () => {
    expect(isPrivilegedPreviewSiteReadyMetadata({
      ...subject,
      metadata: { previewSiteReady: true },
      now,
      env,
    })).toBe(false)
  })

  it("rejects forged, rebound, and expired privileged metadata", () => {
    const authorization = createPreviewSiteReadyAuthorization(subject, { now, env })
    const metadata = { previewSiteReady: true, previewSiteReadyAuthorization: authorization }

    expect(isPrivilegedPreviewSiteReadyMetadata({
      ...subject,
      metadata: {
        ...metadata,
        previewSiteReadyAuthorization: { ...authorization, signature: "0".repeat(64) },
      },
      now,
      env,
    })).toBe(false)
    expect(isPrivilegedPreviewSiteReadyMetadata({
      email: "attacker@example.com",
      clientSlug: subject.clientSlug,
      metadata,
      now,
      env,
    })).toBe(false)
    expect(isPrivilegedPreviewSiteReadyMetadata({
      email: subject.email,
      clientSlug: "another-preview",
      metadata,
      now,
      env,
    })).toBe(false)
    expect(isPrivilegedPreviewSiteReadyMetadata({
      ...subject,
      metadata,
      now: new Date(now.getTime() + 5 * 60_000 + 1),
      env,
    })).toBe(false)
  })

  it("does not elevate a valid authorization unless the explicit site-ready flag is present", () => {
    const authorization = createPreviewSiteReadyAuthorization(subject, { now, env })
    expect(isPrivilegedPreviewSiteReadyMetadata({
      ...subject,
      metadata: { previewSiteReadyAuthorization: authorization },
      now,
      env,
    })).toBe(false)
  })
})
