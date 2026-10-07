import type { CommunicationPreference, TenantNotificationSubscription } from "@/payload-types"
import { createTestPayload } from "../_helpers/testPayload"
import { paginatedFixture, tenantFixture, userFixture } from "../_helpers/generatedDocs"
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { listCommunicationPreferences, listTenantNotificationSubscriptions } from "@/lib/queries/legalOperations"



describe("legal communications operator view", () => {
  it("maps and masks preference state while applying the selected status filter", async () => {
    const payload = createTestPayload()
    const preference: CommunicationPreference = { subjectKey: "fixture", directory: false, statementVersion: "v1", locale: "nl", createdAt: "2026-07-12T10:00:00.000Z", id: 9, email: "owner@example.nl", tenant: tenantFixture({ name: "Example" }), marketing: true, productNotifications: false, suppressed: false, marketingConsentSource: "public-intake", marketingConsentAt: "2026-07-12T10:00:00.000Z", updatedAt: "2026-07-12T10:01:00.000Z" }
    const find = vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([preference]))
    const rows = await listCommunicationPreferences({ status: "opted_in", q: "owner" }, payload)
    expect(rows.docs[0]).toMatchObject({ tenant: "Example", marketing: true, productNotifications: false, emailMasked: expect.stringMatching(/@example\.nl$/), href: "/legal/communications/9" })
    expect(rows.docs[0]?.emailMasked).not.toContain("owner")
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { and: expect.arrayContaining([{ marketing: { equals: true } }]) } }))
  })

  it("keeps operational routing separate from consent and lists enabled categories", async () => {
    const payload = createTestPayload()
    const subscription: TenantNotificationSubscription = { subscriptionKey: "fixture", appointmentBookings: false, createdAt: "2026-07-12T10:00:00.000Z", id: 4, tenant: tenantFixture({ name: "Amicare" }), user: userFixture({ name: "Owner" }), email: "owner@ami-care.nl", formSubmissions: true, publishingAndSiteStatus: true, domainAndDns: true, billingAndPayments: true, teamAndAccess: true, operationalDigest: false, updatedAt: "2026-07-12T10:00:00.000Z" }
    vi.spyOn(payload, "find").mockResolvedValue(paginatedFixture([subscription]))
    const rows = await listTenantNotificationSubscriptions({}, payload)
    expect(rows.docs[0]).toMatchObject({ tenant: "Amicare", member: "Owner", categories: ["formSubmissions", "publishingAndSiteStatus", "domainAndDns", "billingAndPayments", "teamAndAccess"] })
  })

  it("requires super-admin on both list and detail routes and exposes no mutation form", () => {
    const root = path.resolve(process.cwd(), "src/app/(frontend)/(admin)/legal/communications")
    for (const file of [path.join(root, "page.tsx"), path.join(root, "[id]/page.tsx")]) {
      const source = fs.readFileSync(file, "utf8")
      expect(source).toContain('requireRole(["super-admin"])')
      expect(source).not.toContain("<form")
      expect(source).not.toContain("action=")
    }
  })
})
