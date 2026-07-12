import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { listCommunicationPreferences, listTenantNotificationSubscriptions } from "@/lib/queries/legalOperations"

const result = (docs: any[]) => ({ docs, totalDocs: docs.length, totalPages: 1, page: 1, limit: 20, pagingCounter: 1, hasPrevPage: false, hasNextPage: false, prevPage: null, nextPage: null })

describe("legal communications operator view", () => {
  it("maps and masks preference state while applying the selected status filter", async () => {
    const find = vi.fn(async () => result([{ id: 9, email: "owner@example.nl", tenant: { name: "Example" }, marketing: true, productNotifications: false, suppressed: false, marketingConsentSource: "public-intake", marketingConsentAt: "2026-07-12T10:00:00.000Z", updatedAt: "2026-07-12T10:01:00.000Z" }]))
    const rows = await listCommunicationPreferences({ status: "opted_in", q: "owner" }, { find } as never)
    expect(rows.docs[0]).toMatchObject({ tenant: "Example", marketing: true, productNotifications: false, emailMasked: expect.stringMatching(/@example\.nl$/), href: "/legal/communications/9" })
    expect(rows.docs[0]?.emailMasked).not.toContain("owner")
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { and: expect.arrayContaining([{ marketing: { equals: true } }]) } }))
  })

  it("keeps operational routing separate from consent and lists enabled categories", async () => {
    const find = vi.fn(async () => result([{ id: 4, tenant: { name: "Amicare" }, user: { name: "Owner" }, email: "owner@ami-care.nl", formSubmissions: true, publishingAndSiteStatus: true, domainAndDns: true, billingAndPayments: true, teamAndAccess: true, operationalDigest: false, updatedAt: "2026-07-12T10:00:00.000Z" }]))
    const rows = await listTenantNotificationSubscriptions({}, { find } as never)
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
