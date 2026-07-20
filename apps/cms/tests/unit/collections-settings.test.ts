import { describe, it, expect } from "vitest"
import type { Field } from "payload"
import { SiteSettings, enforceChromeCapabilities, enforceTenantExclusiveChromeVariants, filterChromeVariantOptions } from "@/collections/SiteSettings"
import { validateTenantExists } from "@/hooks/validateTenantExists"
import { SITE_CHROME_CATALOG } from "@siteinabox/contracts/block-catalog"
import { expectNamedField, findNamedSubField, fieldOptionValues, fieldOptions, fieldRequired, fieldValidator } from "../_helpers/payloadFields"
import { argsFor } from "../_helpers/argsFor"

const findField = (name: string) => expectNamedField(SiteSettings.fields, name)
const findSubField = (fields: Field[] | undefined, name: string) => {
  const field = findNamedSubField(fields, name)
  if (!field) throw new Error(`Sub-field "${name}" not found`)
  return field
}
const globalVariants = (area: "header" | "footer" | "banner") => SITE_CHROME_CATALOG.filter((entry) => entry.area === area && entry.scope.kind === "global").map((entry) => entry.variant)
const officialVariants = (area: "header" | "footer") => SITE_CHROME_CATALOG.filter((entry) => entry.area === area).map((entry) => entry.variant)

describe("SiteSettings collection config", () => {
  it("uses 'site-settings' slug", () => {
    expect(SiteSettings.slug).toBe("site-settings")
  })

  it("keeps original siteName / siteUrl required text fields", () => {
    expect(findField("siteName")).toMatchObject({ type: "text", required: true })
    expect(findField("siteUrl")).toMatchObject({ type: "text", required: true })
  })

  it("adds a textarea description field (optional)", () => {
    const f = findField("description")
    expect(f).toBeDefined()
    expect(f.type).toBe("textarea")
    expect(fieldRequired(f)).not.toBe(true)
  })

  it("exposes contactEmail as the editable public site contact address", () => {
    const f = findField("contactEmail")
    expect(f).toMatchObject({ type: "email" })
    expect("admin" in f && f.admin && typeof f.admin === "object" && "description" in f.admin).toBe(true)
  })

  it("adds language text with default 'nl'", () => {
    const f = findField("language")
    expect(f).toBeDefined()
    expect(f.type).toBe("text")
    expect("defaultValue" in f && f.defaultValue).toBe("nl")
  })

  it("adds aliases array with required host", () => {
    const f = findField("aliases")
    expect(f.type).toBe("array")
    const host = findSubField("fields" in f ? f.fields : undefined, "host")
    expect(host).toMatchObject({ type: "text", required: true })
  })

  it("adds nap group with the expected sub-fields", () => {
    const f = findField("nap")
    expect(f.type).toBe("group")
    const fields = "fields" in f ? f.fields ?? [] : []
    const subNames = fields.map((field) => ("name" in field ? field.name : "")).sort()
    expect(subNames).toEqual([
      "city",
      "country",
      "establishmentNumber",
      "kvkNumber",
      "legalName",
      "postalCode",
      "region",
      "streetAddress",
    ])
    const country = findSubField(fields, "country")
    expect("defaultValue" in country && country.defaultValue).toBe("NL")
  })

  it("adds hours array with day/open/close/closed", () => {
    const f = findField("hours")
    expect(f.type).toBe("array")
    const fields = "fields" in f ? f.fields ?? [] : []
    const day = findSubField(fields, "day")
    expect(day.type).toBe("select")
    expect(fieldRequired(day)).toBe(true)
    expect("options" in day ? fieldOptionValues(day.options) : []).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ])
    expect(findSubField(fields, "open").type).toBe("text")
    expect(findSubField(fields, "close").type).toBe("text")
    const closed = findSubField(fields, "closed")
    expect(closed.type).toBe("checkbox")
    expect("defaultValue" in closed && closed.defaultValue).toBe(false)
  })

  it("hours.open/close validate skips when row is closed and rejects bad strings", () => {
    const f = findField("hours")
    const fields = "fields" in f ? f.fields ?? [] : []
    const openField = findSubField(fields, "open")
    const validate = fieldValidator(openField)
    expect(validate).toBeDefined()
    expect(validate!(undefined, { siblingData: { closed: true } })).toBe(true)
    expect(validate!("", { siblingData: { closed: false } })).not.toBe(true)
    expect(validate!(undefined, { siblingData: { closed: false } })).not.toBe(true)
    expect(validate!("9:00", { siblingData: { closed: false } })).not.toBe(true)
    expect(validate!("24:00", { siblingData: { closed: false } })).not.toBe(true)
    expect(validate!("12:60", { siblingData: { closed: false } })).not.toBe(true)
    expect(validate!("09:00", { siblingData: { closed: false } })).toBe(true)
    expect(validate!("23:59", { siblingData: { closed: false } })).toBe(true)
    expect(validate!("00:00", { siblingData: { closed: false } })).toBe(true)
  })

  it("adds serviceArea array with required name", () => {
    const f = findField("serviceArea")
    expect(f.type).toBe("array")
    const name = findSubField("fields" in f ? f.fields : undefined, "name")
    expect(name).toMatchObject({ type: "text", required: true })
  })

  it("adds favicon, footer content, business identifiers, and maintenance fields", () => {
    const branding = findField("branding")
    const favicon = findSubField("fields" in branding ? branding.fields : undefined, "favicon")
    expect(favicon).toMatchObject({ type: "upload", relationTo: "media" })

    const nap = findField("nap")
    expect(("fields" in nap ? nap.fields ?? [] : []).map((field) => ("name" in field ? field.name : ""))).toEqual([
      "legalName",
      "kvkNumber",
      "establishmentNumber",
      "streetAddress",
      "city",
      "region",
      "postalCode",
      "country",
    ])

    const chrome = findField("chrome")
    expect(chrome.type).toBe("group")
    const chromeFields = "fields" in chrome ? chrome.fields ?? [] : []
    const header = findSubField(chromeFields, "header")
    const footer = findSubField(chromeFields, "footer")
    const banner = findSubField(chromeFields, "banner")
    expect(chromeFields.map((field) => ("name" in field ? field.name : ""))).toEqual(["header", "footer", "banner"])
    const headerFields = "fields" in header ? header.fields ?? [] : []
    const footerFields = "fields" in footer ? footer.fields ?? [] : []
    const bannerFields = "fields" in banner ? banner.fields ?? [] : []
    expect(headerFields.map((field) => ("name" in field ? field.name : ""))).toEqual(["variant", "logo", "behavior", "activeMode", "mobileMenu", "cta", "secondaryAction", "search"])
    expect(findSubField(headerFields, "logo")).toMatchObject({ type: "upload", relationTo: "media" })
    expect(fieldOptionValues("options" in findSubField(headerFields, "variant") ? fieldOptions(findSubField(headerFields, "variant")) : undefined)).toEqual(officialVariants("header"))
    expect(footerFields.map((field) => ("name" in field ? field.name : ""))).toEqual(["variant", "logo", "tagline", "copyright", "legalLinks", "columns", "newsletter"])
    expect(findSubField(footerFields, "logo")).toMatchObject({ type: "upload", relationTo: "media" })
    expect(fieldOptionValues("options" in findSubField(footerFields, "variant") ? fieldOptions(findSubField(footerFields, "variant")) : undefined)).toEqual(officialVariants("footer"))
    expect(findSubField(footerFields, "columns")).toMatchObject({ type: "json" })
    expect(bannerFields.map((field) => ("name" in field ? field.name : ""))).toEqual(["variant", "visible", "title", "message", "link", "dismissible"])
    expect(fieldOptionValues("options" in findSubField(bannerFields, "variant") ? fieldOptions(findSubField(bannerFields, "variant")) : undefined)).toEqual(globalVariants("banner"))
    expect(findSubField(bannerFields, "link")).toMatchObject({ type: "group" })

    const maintenance = findField("maintenance")
    expect(maintenance.type).toBe("group")
    expect(findSubField("fields" in maintenance ? maintenance.fields : undefined, "enabled")).toMatchObject({
      type: "checkbox",
      defaultValue: false,
    })
    expect(findSubField("fields" in maintenance ? maintenance.fields : undefined, "message").type).toBe("textarea")
  })

  it("registers server-side tenant-exclusive chrome variant validation", () => {
    expect(SiteSettings.hooks?.beforeValidate).toContain(validateTenantExists)
    expect(SiteSettings.hooks?.beforeValidate).toContain(enforceTenantExclusiveChromeVariants)
    expect(SiteSettings.hooks?.beforeValidate).toContain(enforceChromeCapabilities)
  })

  it("rejects settings that the selected literal chrome cannot render", async () => {
    const validate = async (data: Record<string, unknown>) => enforceChromeCapabilities(argsFor(enforceChromeCapabilities, {
      collection: SiteSettings,
      data,
      originalDoc: undefined,
      req: { i18n: { language: "en" } } as Parameters<typeof enforceChromeCapabilities>[0]["req"],
    }))

    await expect(validate({ chrome: { header: { variant: "shadcnui-blocks.navbar-01" } }, navHeader: [{ type: "group", children: [{ label: "A", href: "/a" }] }] })).rejects.toMatchObject({ data: { errors: expect.arrayContaining([expect.objectContaining({ path: "navHeader" })]) } })
    await expect(validate({ chrome: { header: { variant: "shadcnui-blocks.navbar-01", search: { enabled: true, action: "/search" } } } })).rejects.toMatchObject({ data: { errors: expect.arrayContaining([expect.objectContaining({ path: "chrome.header.search" })]) } })
    await expect(validate({ chrome: { footer: { variant: "shadcnui-blocks.footer-01", newsletter: { action: "/subscribe" } } } })).rejects.toMatchObject({ data: { errors: expect.arrayContaining([expect.objectContaining({ path: "chrome.footer.newsletter" })]) } })
    await expect(validate({ chrome: { header: { variant: "shadcnui-blocks.navbar-03" } }, navHeader: [{ type: "group", children: [{ label: "A", href: "/a" }] }] })).resolves.toBeTruthy()
  })

  it("filters tenant-exclusive chrome variants out of generic tenant admin options", () => {
    const chrome = findField("chrome")
    const chromeFields = "fields" in chrome ? chrome.fields ?? [] : []
    const header = findSubField(chromeFields, "header")
    const footer = findSubField(chromeFields, "footer")
    const headerFields = "fields" in header ? header.fields ?? [] : []
    const footerFields = "fields" in footer ? footer.fields ?? [] : []
    const headerVariant = findSubField(headerFields, "variant")
    const footerVariant = findSubField(footerFields, "variant")

    expect("filterOptions" in headerVariant && headerVariant.filterOptions).toBeTypeOf("function")
    expect("filterOptions" in footerVariant && footerVariant.filterOptions).toBeTypeOf("function")
    expect(fieldOptionValues(filterChromeVariantOptions("header", fieldOptions(headerVariant) ?? [], { tenant: { slug: "future-generated" } })))
      .toEqual(globalVariants("header"))
    expect(fieldOptionValues(filterChromeVariantOptions("footer", fieldOptions(footerVariant) ?? [], { tenant: { slug: "future-generated" } })))
      .toEqual(globalVariants("footer"))
  })

  it("does not let admin option filtering reject internal writes without tenant context", () => {
    const chrome = findField("chrome")
    const chromeFields = "fields" in chrome ? chrome.fields ?? [] : []
    const header = findSubField(chromeFields, "header")
    const footer = findSubField(chromeFields, "footer")
    const headerFields = "fields" in header ? header.fields ?? [] : []
    const footerFields = "fields" in footer ? footer.fields ?? [] : []
    const headerVariant = findSubField(headerFields, "variant")
    const footerVariant = findSubField(footerFields, "variant")

    expect(fieldOptionValues(filterChromeVariantOptions("header", fieldOptions(headerVariant) ?? [], {})))
      .toEqual(officialVariants("header"))
    expect(fieldOptionValues(filterChromeVariantOptions("footer", fieldOptions(footerVariant) ?? [], {})))
      .toEqual(officialVariants("footer"))
  })
  it("gives Ami Care the same canonical chrome options as every tenant", () => {
    const chrome = findField("chrome")
    const chromeFields = "fields" in chrome ? chrome.fields ?? [] : []
    const header = findSubField(chromeFields, "header")
    const footer = findSubField(chromeFields, "footer")
    const headerFields = "fields" in header ? header.fields ?? [] : []
    const footerFields = "fields" in footer ? footer.fields ?? [] : []
    const headerOptions = fieldOptions(findSubField(headerFields, "variant"))
    const footerOptions = fieldOptions(findSubField(footerFields, "variant"))

    expect(fieldOptionValues(filterChromeVariantOptions("header", headerOptions ?? [], { tenant: { slug: "ami-care" } })))
      .toEqual(globalVariants("header"))
    expect(fieldOptionValues(filterChromeVariantOptions("footer", footerOptions ?? [], { tenant: { slug: "ami-care" } })))
      .toEqual(globalVariants("footer"))
    expect(fieldOptionValues(headerOptions)).not.toContain("amicareZen")
    expect(fieldOptionValues(footerOptions)).not.toContain("amicareZen")
  })
})
