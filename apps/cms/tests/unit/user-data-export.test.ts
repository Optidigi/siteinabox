import { describe, expect, it, vi, beforeEach } from "vitest"
import { buildUserDataExport, emailUserDataExport } from "@/lib/privacy/userDataExport"
import { sendEmail } from "@/lib/email/sendEmail"

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: vi.fn(),
}))

const user = {
  id: 10,
  email: "owner@example.com",
  name: "Owner",
  role: "owner",
  language: "nl",
  editorMode: "sidebar",
  tenants: [{ tenant: { id: 7 } }],
}

function payloadStub() {
  return {
    findByID: vi.fn(async ({ collection }) => {
      if (collection === "users") {
        return {
          ...user,
          hash: "secret",
          salt: "secret",
          sessions: [{ id: "sid" }],
          apiKey: "secret",
          apiKeyIndex: "secret",
        }
      }
      if (collection === "tenants") {
        return { id: 7, name: "Amicare", slug: "amicare", domain: "ami-care.nl", status: "active" }
      }
      throw new Error(`unexpected collection ${collection}`)
    }),
    find: vi.fn(async ({ collection }) => {
      if (collection === "site-settings") return { docs: [{ id: 20, siteName: "Amicare" }] }
      if (collection === "pages") return { docs: [{ id: 30, title: "Home", slug: "home", status: "published" }] }
      if (collection === "media") return { docs: [{ id: 40, filename: "logo.png", alt: "Logo" }] }
      if (collection === "forms") return { docs: [{ id: 50, title: "Contact", retentionDays: 90 }] }
      throw new Error(`unexpected collection ${collection}`)
    }),
  }
}

describe("user data export", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset()
  })

  it("builds a sanitized account export with scoped site summaries", async () => {
    const payload = payloadStub()
    const exportData = await buildUserDataExport(payload, user)

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
      forms: [{ id: 50, title: "Contact", retentionDays: 90 }],
    })
  })

  it("emails the export to the requesting user", async () => {
    const payload = payloadStub()
    await emailUserDataExport(payload, user)

    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@example.com",
      subject: expect.stringContaining("data export"),
      html: expect.stringContaining("owner@example.com"),
    }))
  })
})
