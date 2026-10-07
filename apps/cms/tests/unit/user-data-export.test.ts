import { describe, expect, it, vi, beforeEach } from "vitest"
import { buildUserDataExport, emailUserDataExport } from "@/lib/privacy/userDataExport"
import { sendEmail } from "@/lib/email/sendEmail"
import { createTestPayload } from "../_helpers/testPayload"
import { userFixture, tenantFixture, pageFixture, mediaFixture, paginatedFixture } from "../_helpers/generatedDocs"
import { createSiteSettingsData } from "@/lib/queries/siteSettingsDefaults"

vi.mock("@/lib/email/sendEmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/sendEmail")>()
  return {
    ...actual,
    sendEmail: vi.fn(),
  }
})

const user = userFixture({
  id: 10,
  email: "owner@example.com",
  name: "Owner",
  role: "owner",
  language: "nl",
  tenants: [{ tenant: tenantFixture({ id: 7 }) }],
})

function payloadStub() {
  const payload = createTestPayload()
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection }) => {
      if (collection === "users") {
        return {
          ...user,
          hash: "secret",
          salt: "secret",
          sessions: [{ id: "sid", createdAt: "2026-08-01T00:00:00.000Z", expiresAt: "2026-09-01T00:00:00.000Z" }],
          apiKey: "secret",
          apiKeyIndex: "secret",
        }
      }
      if (collection === "tenants") {
        return tenantFixture({ id: 7, name: "Amicare", slug: "amicare", domain: "ami-care.nl", status: "active" })
      }
      throw new Error(`unexpected collection ${collection}`)
    })
  vi.spyOn(payload, "find").mockImplementation(async ({ collection }) => {
      if (collection === "site-settings") return paginatedFixture([{ ...createSiteSettingsData(7, "Amicare", "https://ami-care.nl"), id: 20, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }])
      if (collection === "pages") return paginatedFixture([pageFixture({ id: 30, title: "Home", slug: "home", status: "published" })])
      if (collection === "media") return paginatedFixture([mediaFixture({ id: 40, filename: "logo.png", alt: "Logo" })])
      if (collection === "forms") return paginatedFixture([{ id: 50, formName: "Contact", data: {}, status: "new", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }])
      if (collection === "appointments") return paginatedFixture([{
        id: 60, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z",
        status: "confirmed",
        startAt: "2026-09-07T09:00:00.000Z",
        endAt: "2026-09-07T09:30:00.000Z",
        timezone: "Europe/Amsterdam",
        durationMinutes: 30,
        visitorName: "Ada Lovelace",
        visitorEmail: "ada@example.test",
        visitorPhone: "+31 6 12345678",
        visitorNote: "Please call first.",
        pageUrl: "https://example.test/afspraak",
        source: "website",
        eventVersion: 1,
        managementTokenDigest: "must-not-export",
        encryptedManagementToken: "must-not-export",
      }])
      throw new Error(`unexpected collection ${collection}`)
    })
  return payload
}

describe("user data export", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset()
  })

  it("builds a sanitized account export with scoped site summaries", async () => {
    const exportData = await buildUserDataExport(payloadStub(), user)

    expect(exportData.user).toMatchObject({
      id: 10,
      email: "owner@example.com",
      role: "owner",
      tenants: [{ tenant: 7 }],
    })
    expect(exportData.user).not.toHaveProperty("hash")
    expect(exportData.user).not.toHaveProperty("sessions")
    expect(exportData.sites[0]).toMatchObject({
      tenant: { id: 7, slug: "amicare" },
      siteSettings: { id: 20, siteName: "Amicare" },
      pages: [{ id: 30, title: "Home", slug: "home", status: "published" }],
      media: [{ id: 40, filename: "logo.png", alt: "Logo" }],
      forms: [{ id: 50, formName: "Contact" }],
      appointments: [{ id: 60, visitorEmail: "ada@example.test", eventVersion: 1 }],
    })
    expect(exportData.sites[0]?.appointments[0]).not.toHaveProperty("managementTokenDigest")
    expect(exportData.sites[0]?.appointments[0]).not.toHaveProperty("encryptedManagementToken")
  })

  it("emails the export to the requesting user", async () => {
    const payload = payloadStub()
    await emailUserDataExport(payload, user)

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.com",
      subject: expect.stringContaining("gegevensexport"),
      html: expect.stringContaining("owner@example.com"),
    }))
  })
})
