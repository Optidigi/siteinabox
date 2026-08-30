import { describe, expect, it } from "vitest"
import type { Field } from "payload"
import {
  SiteSettings,
  enforceSiteSettingsCapabilities,
  normalizeSiteSettingsAliases,
} from "@/collections/SiteSettings"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import {
  expectNamedField,
  findNamedSubField,
} from "../_helpers/payloadFields"

const findField = (name: string) => expectNamedField(SiteSettings.fields, name)
const findSubField = (fields: Field[] | undefined, name: string) => {
  const field = findNamedSubField(fields, name)
  if (!field) throw new Error(`Sub-field "${name}" not found`)
  return field
}

describe("SiteSettings collection config", () => {
  it("keeps the canonical settings fields and owned chrome defaults", () => {
    expect(SiteSettings.slug).toBe("site-settings")
    expect(findField("siteName")).toMatchObject({ type: "text", required: true })
    expect(findField("siteUrl")).toMatchObject({ type: "text", required: true })
    expect(findField("language")).toMatchObject({ type: "text", defaultValue: "nl" })

    const chrome = findField("chrome")
    const chromeFields = "fields" in chrome ? chrome.fields ?? [] : []
    const navbar = findSubField(chromeFields, "navbar")
    expect(navbar).toMatchObject({ type: "group" })
    const navbarFields = "fields" in navbar ? navbar.fields ?? [] : []
    expect(findSubField(navbarFields, "variant")).toMatchObject({ type: "select", required: true, defaultValue: "navbar-01" })
    expect(findSubField(navbarFields, "placement")).toMatchObject({ type: "select", required: true, defaultValue: "sticky" })
    expect(findSubField(navbarFields, "showThemeToggle")).toMatchObject({ type: "checkbox", defaultValue: false })
    expect(findNamedSubField(navbarFields, "secondaryAction")).toBeUndefined()
    const footer = findSubField(chromeFields, "footer")
    expect(footer).toMatchObject({ type: "group" })
    const footerFields = "fields" in footer ? footer.fields ?? [] : []
    expect(findSubField(footerFields, "variant")).toMatchObject({ type: "select", required: true, defaultValue: "footer-01" })
    expect(findSubField(chromeFields, "announcement")).toMatchObject({ type: "group" })
    const systemTemplates = findField("systemTemplates")
    const notFound = findSubField(
      "fields" in systemTemplates ? systemTemplates.fields : undefined,
      "notFound",
    )
    expect(findSubField("fields" in notFound ? notFound.fields : undefined, "heading")).toMatchObject({ type: "text" })
    expect(findSubField("fields" in notFound ? notFound.fields : undefined, "body")).toMatchObject({ type: "textarea" })
    expect(findSubField("fields" in notFound ? notFound.fields : undefined, "primaryAction")).toMatchObject({ type: "group" })

    const consent = findField("consent")
    const consentFields = "fields" in consent ? consent.fields ?? [] : []
    expect(findSubField(consentFields, "variant")).toMatchObject({
      type: "select",
      required: true,
      defaultValue: "consent-01",
    })
    expect(findSubField(consentFields, "visible")).toMatchObject({ type: "checkbox", defaultValue: true })
    expect(findSubField(consentFields, "allowSelectionLabel")).toMatchObject({ type: "text" })
    expect(findSubField(consentFields, "preferencesLabel")).toMatchObject({ type: "text" })
    expect(findSubField(consentFields, "statisticsLabel")).toMatchObject({ type: "text" })
    expect(findSubField(consentFields, "marketingLabel")).toMatchObject({ type: "text" })
  })

  it("keeps contact, service-area and maintenance editing available", () => {
    expect(findField("contactEmail")).toMatchObject({ type: "email" })
    expect(findField("serviceArea")).toMatchObject({ type: "array" })
    expect(findField("maintenance")).toMatchObject({ type: "group" })
  })

  it("registers tenant existence and settings validation", () => {
    expect(SiteSettings.hooks?.beforeValidate).toContain(validateTenantExists)
    expect(SiteSettings.hooks?.beforeValidate).toContain(enforceSiteSettingsCapabilities)
  })

  it("normalizes alias hosts and rejects duplicates", async () => {
    const normalized = await normalizeSiteSettingsAliases({
      collection: { slug: "site-settings" },
      data: { aliases: [{ host: " WWW.Example.NL.:443 " }] },
      req: { i18n: { language: "en" } },
    } as never)
    expect(normalized?.aliases).toEqual([{ host: "www.example.nl" }])

    expect(() => normalizeSiteSettingsAliases({
      collection: { slug: "site-settings" },
      data: { aliases: [{ host: "www.example.nl" }, { host: "WWW.EXAMPLE.NL." }] },
      req: { i18n: { language: "en" } },
    } as never)).toThrow()
  })

  it("requires a message when maintenance mode is enabled", async () => {
    expect(() => enforceSiteSettingsCapabilities({
      collection: SiteSettings,
      data: { maintenance: { enabled: true, message: "" } },
      originalDoc: undefined,
      req: { i18n: { language: "en" } },
    } as never)).toThrow()

    expect(enforceSiteSettingsCapabilities({
      collection: SiteSettings,
      data: { maintenance: { enabled: true, message: "Back soon" } },
      originalDoc: undefined,
      req: { i18n: { language: "en" } },
    } as never)).toBeTruthy()
  })

  it("keeps legal disclosure as a settings-owned structured document", () => {
    const disclosure = findField("privacyDisclosure")
    const disclosureFields = "fields" in disclosure ? disclosure.fields ?? [] : []
    expect(findSubField(disclosureFields, "body")).toMatchObject({ type: "json" })
    expect(findSubField(disclosureFields, "mode")).toMatchObject({ type: "select" })
    const controller = findSubField(disclosureFields, "controller")
    expect(findSubField("fields" in controller ? controller.fields : undefined, "legalName")).toMatchObject({ type: "text" })
  })

  it("requires factual controller data only when a legal document is enabled", () => {
    expect(() => enforceSiteSettingsCapabilities({
      collection: SiteSettings,
      data: {
        privacyDisclosure: {
          enabled: true,
          mode: "template",
          version: "test-1",
          effectiveAt: "2026-08-25T00:00:00.000Z",
          controller: { legalName: "", email: "not-an-email" },
        },
      },
      originalDoc: undefined,
      req: { i18n: { language: "en" } },
    } as never)).toThrow()

    expect(enforceSiteSettingsCapabilities({
      collection: SiteSettings,
      data: { privacyDisclosure: { enabled: false, mode: "template" } },
      originalDoc: undefined,
      req: { i18n: { language: "en" } },
    } as never)).toBeTruthy()
  })
})
