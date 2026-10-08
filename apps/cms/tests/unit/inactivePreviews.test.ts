import { describe, expect, it } from "vitest"
import { inactivePreviewDecision, inactivePreviewPolicy, inactivePreviewPolicySchema } from "@/lib/preview/inactivePreviews"

const activityAt = "2026-01-01T00:00:00.000Z"
const day = 86_400_000
const input = { now: Date.parse(activityAt) + 30 * day, activityAt, policy: { ...inactivePreviewPolicy, enabled: true }, exempt: false }
describe("A02 inactivity notice and expiry", () => {
  it("keeps the unratified policy disabled and preserves protected evidence", () => {
    expect(inactivePreviewDecision({ ...input, policy: inactivePreviewPolicy })).toBe("skip")
    expect(inactivePreviewDecision({ ...input, exempt: true })).toBe("skip")
  })
  it("requires an actual notice and a full notice period, even when already inactive", () => {
    expect(inactivePreviewDecision(input)).toBe("notice")
    const notice = { noticeState: "sent", noticeActivityAt: activityAt, noticeSentAt: "2026-01-31T00:00:00.000Z", expiresAt: "2026-02-07T00:00:00.000Z" }
    expect(inactivePreviewDecision({ ...input, ...notice })).toBe("skip")
    expect(inactivePreviewDecision({ ...input, ...notice, now: Date.parse("2026-02-07T00:00:00.000Z") })).toBe("expire")
  })
  it.each(["sending", "unknown"])("never expires or blindly replays %s delivery", (noticeState) => {
    expect(inactivePreviewDecision({ ...input, noticeState, noticeActivityAt: activityAt, now: input.now + 100 * day })).toBe("skip")
  })
  it("fresh authenticated activity invalidates an old notice", () => {
    expect(inactivePreviewDecision({ ...input, activityAt: "2026-01-30T00:00:00.000Z", noticeState: "sent", noticeActivityAt: activityAt, noticeSentAt: activityAt, expiresAt: "2026-01-31T00:00:00.000Z" })).toBe("skip")
  })
  it("fails closed on invalid timestamps, previous expiry and invalid policy", () => {
    expect(inactivePreviewDecision({ ...input, activityAt: "invalid" })).toBe("skip")
    expect(inactivePreviewDecision({ ...input, expiredAt: activityAt })).toBe("skip")
    expect(inactivePreviewPolicySchema.safeParse({ enabled: true, inactiveDays: 5, noticeDays: 7 }).success).toBe(false)
  })
})
