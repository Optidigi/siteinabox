import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  writeAtomic: vi.fn(),
  readManifest: vi.fn(),
  writeManifest: vi.fn(),
  upsertEntry: vi.fn(),
  withManifestLock: vi.fn(),
}))

vi.mock("@/lib/atomicWrite", () => ({
  writeAtomic: mocks.writeAtomic,
}))

vi.mock("@/lib/projection/manifest", () => ({
  readManifest: mocks.readManifest,
  writeManifest: mocks.writeManifest,
  upsertEntry: mocks.upsertEntry,
  removeEntry: vi.fn(),
  withManifestLock: mocks.withManifestLock,
}))

import { projectSettingsToDisk } from "@/hooks/projectToDisk"
import { asPayload } from "../_helpers/mockPayload"
import { cast } from "../_helpers/cast"

describe("projectSettingsToDisk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readManifest.mockResolvedValue({ version: 0, updatedAt: "", entries: [] })
    mocks.upsertEntry.mockImplementation((manifest, entry) => ({
      ...manifest,
      version: manifest.version + 1,
      updatedAt: entry.updatedAt,
      entries: [entry],
    }))
    mocks.withManifestLock.mockImplementation(async (_dataDir, _tenantId, fn) => fn())
  })

  it("projects the fresh hook doc and populates media-backed logos without reloading stale settings", async () => {
    const findByID = vi.fn().mockImplementation(async ({ collection, id }) => {
        if (collection === "tenants") {
          expect(id).toBe("7")
          return {
            id: 7,
            slug: "amicare",
            domain: "ami-care.nl",
            siteManifest: {
              version: 1,
              themeId: "amicare-theme",
              settings: {
                general: {
                  contactEmail: true,
                },
                identity: {
                  branding: {
                    logo: true,
                    favicon: true,
                  },
                },
              },
              analytics: {
                enabled: true,
                dashboardVisible: true,
                consentMode: "required",
                conversionGoals: { acceptedForms: true, contactClicks: ["phone"] },
              },
            },
          }
        }
        expect(collection).toBe("media")
        const mediaById: Record<string, unknown> = {
          11: { id: 11, filename: "brand.png", url: "/media/brand.png", alt: "Brand" },
          12: { id: 12, filename: "header.png", url: "/media/header.png", alt: "Header" },
          13: { id: 13, filename: "footer.png", url: "/media/footer.png", alt: "Footer" },
        }
        return mediaById[String(id)]
      })
    const payload = Object.assign(asPayload({
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID,
      logger: { info: vi.fn() },
    }), {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      findByID,
      logger: { info: vi.fn() },
    })

    await projectSettingsToDisk(cast<Parameters<typeof projectSettingsToDisk>[0]>({
      doc: {
        id: "settings-1",
        tenant: 7,
        siteName: "Amicare",
        siteUrl: "https://ami-care.nl",
        contactEmail: "hello@ami-care.nl",
        updatedAt: "2026-05-27T18:00:00.000Z",
        branding: {
          logo: 11,
        },
        chrome: {
          header: {
            logo: 12,
          },
          footer: {
            logo: 13,
            tagline: "Fresh footer text",
            copyright: "Fresh copyright",
            columns: [
              { items: [{ type: "text", label: "Fresh label", text: "Fresh column text" }] },
            ],
          },
        },
      },
      req: { payload },
    }))

    expect(payload.findByID).toHaveBeenCalledTimes(4)
    expect(payload.findByID).toHaveBeenCalledWith({
      collection: "tenants",
      id: "7",
      depth: 0,
      overrideAccess: true,
    })

    const writeCall = mocks.writeAtomic.mock.calls[0]
    expect(writeCall).toBeDefined()
    const projected = JSON.parse(writeCall![1])
    expect(projected.branding.logo).toMatchObject({ filename: "brand.png", url: "/media/brand.png" })
    expect(projected.contactEmail).toBe("hello@ami-care.nl")
    expect(projected.chrome.header.logo).toMatchObject({ filename: "header.png", url: "/media/header.png" })
    expect(projected.chrome.footer.logo).toMatchObject({ filename: "footer.png", url: "/media/footer.png" })
    expect(projected.chrome.footer.tagline).toBe("Fresh footer text")
    expect(projected.chrome.footer.copyright).toBe("Fresh copyright")
    expect(projected.chrome.footer.columns).toEqual([
      { id: null, items: [{ id: null, type: "text", label: "Fresh label", text: "Fresh column text", links: [] }] },
    ])
    expect(projected.analytics).toMatchObject({
      enabled: false,
      tenantId: "7",
      tenantSlug: "amicare",
      siteDomain: "ami-care.nl",
      themeId: "amicare-theme",
      manifestVersion: 1,
    })
    expect(mocks.upsertEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "settings", key: "site", updatedAt: "2026-05-27T18:00:00.000Z" }),
    )
  })
})
