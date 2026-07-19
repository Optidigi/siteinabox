import { describe, it, expect } from "vitest"
import { settingsToJson } from "@/lib/projection/settingsToJson"
import type { SettingsContract } from "@/lib/settingsContract"

import { asPayload, matchesWhere, type MockCreateArgs, type MockDoc, type MockFindArgs, type MockUpdateArgs, type MockWhere } from "../_helpers/mockPayload"
const fullSettingsContract: SettingsContract = {
  general: {
    description: true,
    language: true,
    contactEmail: true,
  },
  identity: {
    branding: {
      logo: true,
      favicon: true,
    },
    footer: {
      tagline: false,
      copyright: false,
    },
  },
  details: {
    contact: {
      phone: true,
      address: true,
      social: true,
    },
    business: {
      legalName: true,
      kvkNumber: true,
      establishmentNumber: true,
      streetAddress: true,
      city: true,
      region: true,
      postalCode: true,
      country: true,
    },
    serviceArea: true,
    hours: true,
  },
  operations: {
    maintenance: true,
  },
}

describe("settingsToJson", () => {
  it("projects the versioned analytics consent contract for renderer enforcement", () => {
    const analyticsConsent = {
      enabled: true,
      provider: "posthog",
      consentStorageKey: "siab-analytics-consent",
      consentVersion: "legal:platform-privacy:nl:2026-08-01.1",
    }

    expect(settingsToJson({}, [], { analyticsConsent }, { analytics: true }).analyticsConsent).toEqual(analyticsConsent)
    expect(settingsToJson({}, [], { analyticsConsent }, { analytics: false }).analyticsConsent).toBeUndefined()
  })

  it("flattens settings with branding/contact + resolves navHeader/navFooter", () => {
    const doc: MockDoc = {
      id: "s1", tenant: "t1", siteName: "Client A", siteUrl: "https://clienta.nl",
      contactEmail: "hi@clienta.nl",
      branding: {
        logo: { url: "/uploads/logo.png", filename: "logo.png" },
        favicon: { url: "/uploads/favicon.png", filename: "favicon.png" },
        primaryColor: "#2563eb",
      },
      chrome: {
        header: {
          variant: "shadcnui-blocks.navbar-01",
          logo: { url: "/uploads/header-logo.png", filename: "header-logo.png" },
          behavior: "sticky",
          activeMode: "path",
          mobileMenu: "drawer",
          cta: { label: "Start", href: "/intake" },
        },
        footer: {
          variant: "shadcnui-blocks.footer-01",
          logo: { url: "/uploads/footer-logo.png", filename: "footer-logo.png" },
          tagline: "Local support",
          copyright: "© Client A",
          legalLinks: [{ label: "Privacy", href: "/privacy" }],
          columns: [
            { id: "col-1", items: [{ id: "brand", type: "brand", text: "Local support" }] },
            { id: "col-2", items: [{ id: "links", type: "links", label: "Links", links: [{ label: "Privacy", href: "/privacy" }] }] },
          ],
        },
        banner: {
          variant: "shadcnui-blocks.banner-01",
          visible: true,
          title: "Update",
          message: "Now booking",
          link: { label: "Contact", href: "/#contact" },
          dismissible: true,
        },
      },
      maintenance: { enabled: true, message: "Short maintenance window." },
      contact: { phone: "+31 20 555 1234", address: "Street 1", social: [{ platform: "instagram", url: "https://ig" }] },
      navHeader: [
        { type: "page", page: 1, label: null },
        { type: "section", anchor: "werkwijze", label: "Werkwijze" },
        { type: "custom", url: "https://x.com", label: "Ext", external: true },
      ],
      navFooter: [{ type: "custom", url: "/privacy", label: "Privacy", external: false }],
    }
    const json = settingsToJson(
      doc,
      [{ id: 1, slug: "home", title: "Home" }],
      {},
      { settingsContract: fullSettingsContract },
    )
    expect(json).toMatchObject({
      siteName: "Client A",
      siteUrl: "https://clienta.nl",
      contactEmail: "hi@clienta.nl",
      branding: { primaryColor: "#2563eb" },
      chrome: {
        header: {
          variant: "shadcnui-blocks.navbar-01",
          logo: { url: "/uploads/header-logo.png", filename: "header-logo.png" },
          behavior: "sticky",
          activeMode: "path",
          mobileMenu: "drawer",
          cta: { label: "Start", href: "/intake" },
        },
        footer: {
          variant: "shadcnui-blocks.footer-01",
          logo: { url: "/uploads/footer-logo.png", filename: "footer-logo.png" },
          tagline: "Local support",
          copyright: "© Client A",
          legalLinks: [{ label: "Privacy", href: "/privacy" }],
          columns: [
            { id: "col-1", items: [{ id: "brand", type: "brand", label: null, text: "Local support", links: [] }] },
            { id: "col-2", items: [{ id: "links", type: "links", label: "Links", text: null, links: [{ label: "Privacy", href: "/privacy" }] }] },
          ],
        },
        banner: {
          variant: "shadcnui-blocks.banner-01",
          visible: true,
          title: "Update",
          message: "Now booking",
          link: { label: "Contact", href: "/#contact" },
          dismissible: true,
        },
      },
      maintenance: { enabled: true, message: "Short maintenance window." },
      contact: { phone: "+31 20 555 1234", address: "Street 1" },
      navHeader: [
        { label: "Home", href: "/", external: false },
        { label: "Werkwijze", href: "#werkwijze", external: false },
        { label: "Ext", href: "https://x.com", external: true },
      ],
      navFooter: [{ label: "Privacy", href: "/privacy", external: false }],
    })
    expect(json.branding!.logo).toMatchObject({ url: "/uploads/logo.png", filename: "logo.png" })
    expect(json.branding!.favicon).toMatchObject({ url: "/uploads/favicon.png", filename: "favicon.png" })
    expect(json.contact!.social).toEqual([{ platform: "instagram", url: "https://ig" }])
  })

  it("uses the slim default settings projection contract", () => {
    const doc: MockDoc = {
      id: "x",
      tenant: "t",
      siteName: "Bare",
      siteUrl: "https://x",
      description: "Projected by default",
      language: "nl",
      contactEmail: "hidden@example.test",
      contact: { phone: "hidden", address: "hidden", social: [{ platform: "x", url: "https://x.test" }] },
      nap: { legalName: "Hidden B.V.", kvkNumber: "123" },
      hours: [{ day: "monday", open: "09:00", close: "17:00", closed: false }],
      serviceArea: [{ name: "Hidden" }],
      maintenance: { enabled: true, message: "Visible by default" },
    }
    const json = settingsToJson(doc)
    expect(json.siteName).toBe("Bare")
    expect(json.description).toBe("Projected by default")
    expect(json.maintenance).toEqual({ enabled: true, message: "Visible by default" })
    expect(json.navHeader).toEqual([])
    expect(json.navFooter).toEqual([])
    expect(json.contactEmail).toBeUndefined()
    expect(json.contact).toBeUndefined()
    expect(json.nap).toBeUndefined()
    expect(json.language).toBeUndefined()
    expect(json.aliases).toEqual([])
    expect(json.hours).toEqual([])
    expect(json.serviceArea).toEqual([])
  })

  it("projects optional settings fields only when the manifest contract enables them", () => {
    const doc: MockDoc = {
      id: "s2", tenant: "t1",
      siteName: "Client B", siteUrl: "https://clientb.nl",
      description: "A pleasant little business in Utrecht.",
      language: "nl",
      aliases: [
        // Payload arrays carry an `id` per row; the projector must NOT leak it.
        { id: "row-1", host: "www.clientb.nl" },
        { id: "row-2", host: "clientb.com" }
      ],
      nap: {
        legalName: "Client B B.V.",
        kvkNumber: "12345678",
        establishmentNumber: "000012345678",
        streetAddress: "Hoofdstraat 12",
        city: "Utrecht",
        region: "Utrecht",
        postalCode: "3511 AA",
        country: "NL"
      },
      hours: [
        { id: "h-1", day: "monday", open: "09:00", close: "17:00", closed: false },
        { id: "h-2", day: "saturday", open: null, close: null, closed: true }
      ],
      serviceArea: [
        { id: "sa-1", name: "Utrecht" },
        { id: "sa-2", name: "Amersfoort" }
      ]
    }
    const json = settingsToJson(doc, [], {}, { settingsContract: fullSettingsContract })
    expect(json.description).toBe("A pleasant little business in Utrecht.")
    expect(json.language).toBe("nl")
    expect(json.aliases).toEqual([
      { host: "www.clientb.nl" },
      { host: "clientb.com" }
    ])
    expect(json.nap).toEqual({
      legalName: "Client B B.V.",
      kvkNumber: "12345678",
      establishmentNumber: "000012345678",
      streetAddress: "Hoofdstraat 12",
      city: "Utrecht",
      region: "Utrecht",
      postalCode: "3511 AA",
      country: "NL"
    })
    expect(json.hours).toEqual([
      { day: "monday", open: "09:00", close: "17:00", closed: false },
      { day: "saturday", open: null, close: null, closed: true }
    ])
    expect(json.serviceArea).toEqual([
      { name: "Utrecht" },
      { name: "Amersfoort" }
    ])
    // Sanity: no leaked Payload-internal ids on any array row.
    for (const row of json.aliases) expect(row).not.toHaveProperty("id")
    for (const row of json.hours) expect(row).not.toHaveProperty("id")
    for (const row of json.serviceArea) expect(row).not.toHaveProperty("id")
  })

  it("omits hidden or empty announcement banner shells from published settings", () => {
    const base = {
      siteName: "Banner Site",
      siteUrl: "https://banner.test",
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01" },
        footer: { variant: "shadcnui-blocks.footer-01" },
      },
    }

    expect(settingsToJson({
      ...base,
      chrome: {
        ...base.chrome,
        banner: { variant: "shadcnui-blocks.banner-01", visible: false, title: "Draft", message: "Not live" },
      },
    }).chrome?.banner).toBeUndefined()

    expect(settingsToJson({
      ...base,
      chrome: {
        ...base.chrome,
        banner: { variant: "shadcnui-blocks.banner-01", visible: true, title: "", message: "", link: { label: "Bad", href: "javascript:alert(1)" } },
      },
    }).chrome?.banner).toBeUndefined()

    expect(settingsToJson({
      ...base,
      chrome: {
        ...base.chrome,
        banner: { variant: "shadcnui-blocks.banner-01", visible: true, message: "Published notice" },
      },
    }).chrome?.banner).toMatchObject({ variant: "shadcnui-blocks.banner-01", visible: true, message: "Published notice" })
  })

  it("projects public renderer analytics metadata from publish context", () => {
    const json = settingsToJson(
      { siteName: "Analytics Site", siteUrl: "https://analytics.test" },
      [],
      {
        tenantId: 42,
        tenantSlug: "analytics-site",
        siteDomain: "analytics.test",
        themeId: "theme-1",
        siteBuildId: "build-1",
        manifestVersion: 7,
        analytics: { enabled: true, dashboardVisible: true, conversionGoals: { contactClicks: ["phone", "email"] } },
      },
    )

    expect(json.analytics).toMatchObject({
      provider: "posthog",
      consentMode: "required",
      conversionGoals: { acceptedForms: true, contactClicks: ["phone", "email"] },
      schemaVersion: 1,
      tenantId: "42",
      tenantSlug: "analytics-site",
      siteId: "42",
      siteDomain: "analytics.test",
      themeId: "theme-1",
      siteBuildId: "build-1",
      manifestVersion: 7,
    })
  })
})
