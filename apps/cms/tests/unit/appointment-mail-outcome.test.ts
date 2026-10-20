import { describe, expect, it, vi } from "vitest"
import { asPayload } from "../_helpers/mockPayload"
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@/lib/email/sendEmail", async (original) => ({ ...await original<typeof import("@/lib/email/sendEmail")>(), sendEmail: send }))
import { MailSendError } from "@/lib/email/sendEmail"
import { processAppointmentNotifications } from "@/lib/jobs/appointmentNotifications"

describe("appointment mail acceptance outcome", () => {
  it("preserves manual review and refuses a second worker send after an uncertain receipt", async () => {
    const now = new Date("2026-10-20T12:00:00Z")
    const delivery: Record<string, unknown> & { id: number } = { id: 5, appointment: 1, tenant: 2, kind: "confirmation", recipientKind: "tenant", recipientEmail: "owner@example.test", eventVersion: 1, status: "queued", attemptCount: 0, nextAttemptAt: now.toISOString() }
    const appointment = { id: 1, eventVersion: 1, visitorName: "Fixture", visitorEmail: "visitor@example.test", startAt: "2026-10-21T10:00:00Z", endAt: "2026-10-21T10:30:00Z", timezone: "Europe/Amsterdam" }
    const payload = asPayload({
      find: vi.fn(async ({ collection }: { collection: string }) => ({ docs: collection === "appointment-notification-deliveries" ? [delivery] : collection === "appointments" ? [appointment] : collection === "tenants" ? [{ id: 2, name: "Fixture" }] : [{ id: 3, siteUrl: "https://fixture.example.test" }] })),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(delivery, data)),
    })
    send.mockRejectedValue(new MailSendError({ provider: "cloudflare-rest", providerErrorCode: "E_PROVIDER_WRITE_INDETERMINATE", providerErrorMessage: "Acceptance unknown; reconcile before retry", retryState: "manual_review" }))
    await expect(processAppointmentNotifications({ payload, now })).resolves.toMatchObject({ failed: 1 })
    expect(delivery).toMatchObject({ status: "failed", retryState: "manual_review", nextAttemptAt: "9999-12-31T00:00:00.000Z" })
    await processAppointmentNotifications({ payload, now })
    expect(send).toHaveBeenCalledOnce()
  })
})
