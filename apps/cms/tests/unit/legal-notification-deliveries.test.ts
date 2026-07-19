import { describe, expect, it } from "vitest"
import { LegalNotificationDeliveries } from "@/collections/LegalNotificationDeliveries"
import { legalReacceptanceTemplate } from "@/lib/email/templates/legalReacceptance"
import { sendLegalRequirementNotificationsTask } from "@/lib/jobs/sendLegalRequirementNotificationsTask"

import { accessArgs } from "../_helpers/accessArgs"
import { expectNamedField } from "../_helpers/payloadFields"
describe("legal notification delivery contract", () => {
  it("keeps the outbox system-managed and idempotent", () => {
    expect(LegalNotificationDeliveries.slug).toBe("legal-notification-deliveries")
    expect(LegalNotificationDeliveries.access?.create?.(accessArgs({ req: {} }))).toBe(false)
    expect(LegalNotificationDeliveries.access?.update?.(accessArgs({ req: {} }))).toBe(false)
    expect(LegalNotificationDeliveries.access?.delete?.(accessArgs({ req: {} }))).toBe(false)
    const key = expectNamedField(LegalNotificationDeliveries.fields, "notificationKey")
    expect(key).toMatchObject({ required: true, unique: true, index: true })
  })

  it("registers the recurring worker on the default durable queue", () => {
    expect(sendLegalRequirementNotificationsTask.slug).toBe("send-legal-requirement-notifications")
    expect(sendLegalRequirementNotificationsTask.schedule).toEqual([{ cron: "0 */5 * * * *", queue: "default" }])
  })

  it("renders an escaped, tracking-free reacceptance email with exact links", () => {
    const message = legalReacceptanceTemplate({
      tenantName: "Demo <Bedrijf>",
      changeSummary: "Prijs & looptijd gewijzigd.",
      documentVersion: "2026-08-01.1",
      effectiveAt: "2026-08-01T00:00:00.000Z",
      enforceAt: "2026-08-08T00:00:00.000Z",
      settingsUrl: "https://admin.demo.nl/settings#agreements",
      documentUrl: "https://www.siteinabox.nl/juridisch/algemene-voorwaarden/2026-08-01.1",
      mandatory: true,
    })
    expect(message.subject).toContain("Demo <Bedrijf>")
    expect(message.html).toContain("Demo &lt;Bedrijf&gt;")
    expect(message.html).toContain("Prijs &amp; looptijd")
    expect(message.html).toContain("https://admin.demo.nl/settings#agreements")
    expect(message.text).toContain("2026-08-01.1")
    expect(message.html).not.toMatch(/tracking|pixel|utm_/i)
  })

  it("removes line breaks from the mail subject", () => {
    const message = legalReacceptanceTemplate({
      tenantName: "Demo\r\nBcc: attacker@example.test",
      changeSummary: "Wijziging",
      documentVersion: "1",
      effectiveAt: "2026-08-01T00:00:00.000Z",
      settingsUrl: "https://admin.demo.nl/settings#agreements",
      documentUrl: "https://www.siteinabox.nl/terms/1",
      mandatory: true,
    })
    expect(message.subject).not.toMatch(/[\r\n]/)
  })
})
