import { describe, it, expect } from "vitest"
import { SiteSettings, enforceTenantExclusiveChromeVariants, filterChromeVariantOptions } from "@/collections/SiteSettings"
import { validateTenantExists } from "@/hooks/validateTenantExists"

const findField = (name: string): any => SiteSettings.fields.find((f: any) => f.name === name)

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
    expect(f.required).not.toBe(true)
  })

  it("adds language text with default 'en'", () => {
    const f = findField("language")
    expect(f).toBeDefined()
    expect(f.type).toBe("text")
    expect(f.defaultValue).toBe("en")
  })

  it("adds aliases array with required host", () => {
    const f = findField("aliases")
    expect(f.type).toBe("array")
    const host = f.fields.find((x: any) => x.name === "host")
    expect(host).toMatchObject({ type: "text", required: true })
  })

  it("adds nap group with the expected sub-fields", () => {
    const f = findField("nap")
    expect(f.type).toBe("group")
    const subNames = f.fields.map((x: any) => x.name).sort()
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
    const country = f.fields.find((x: any) => x.name === "country")
    expect(country.defaultValue).toBe("NL")
  })

  it("adds hours array with day/open/close/closed", () => {
    const f = findField("hours")
    expect(f.type).toBe("array")
    const day = f.fields.find((x: any) => x.name === "day")
    expect(day.type).toBe("select")
    expect(day.required).toBe(true)
    expect(day.options.map((o: any) => o.value)).toEqual([
      "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
    ])
    expect(f.fields.find((x: any) => x.name === "open")?.type).toBe("text")
    expect(f.fields.find((x: any) => x.name === "close")?.type).toBe("text")
    const closed = f.fields.find((x: any) => x.name === "closed")
    expect(closed.type).toBe("checkbox")
    expect(closed.defaultValue).toBe(false)
  })

  it("hours.open/close validate skips when row is closed and rejects bad strings", () => {
    const f = findField("hours")
    const openField = f.fields.find((x: any) => x.name === "open")
    // Closed row: any value (or none) is fine.
    expect(openField.validate(undefined, { siblingData: { closed: true } })).toBe(true)
    // Open row: empty / missing is rejected.
    expect(openField.validate("", { siblingData: { closed: false } })).not.toBe(true)
    expect(openField.validate(undefined, { siblingData: { closed: false } })).not.toBe(true)
    // Open row: malformed strings rejected.
    expect(openField.validate("9:00", { siblingData: { closed: false } })).not.toBe(true)
    expect(openField.validate("24:00", { siblingData: { closed: false } })).not.toBe(true)
    expect(openField.validate("12:60", { siblingData: { closed: false } })).not.toBe(true)
    // Open row: well-formed HH:MM accepted.
    expect(openField.validate("09:00", { siblingData: { closed: false } })).toBe(true)
    expect(openField.validate("23:59", { siblingData: { closed: false } })).toBe(true)
    expect(openField.validate("00:00", { siblingData: { closed: false } })).toBe(true)
  })

  it("adds serviceArea array with required name", () => {
    const f = findField("serviceArea")
    expect(f.type).toBe("array")
    const name = f.fields.find((x: any) => x.name === "name")
    expect(name).toMatchObject({ type: "text", required: true })
  })

  it("adds favicon, footer content, business identifiers, and maintenance fields", () => {
    const branding = findField("branding")
    const favicon = branding.fields.find((x: any) => x.name === "favicon")
    expect(favicon).toMatchObject({ type: "upload", relationTo: "media" })

    const nap = findField("nap")
    expect(nap.fields.map((x: any) => x.name)).toEqual([
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
    const header = chrome.fields.find((x: any) => x.name === "header")
    const footer = chrome.fields.find((x: any) => x.name === "footer")
    const banner = chrome.fields.find((x: any) => x.name === "banner")
    expect(chrome.fields.map((x: any) => x.name)).toEqual(["header", "footer", "banner"])
    expect(header.fields.map((x: any) => x.name)).toEqual(["variant", "logo", "behavior", "activeMode", "mobileMenu", "cta"])
    expect(header.fields.find((x: any) => x.name === "logo")).toMatchObject({ type: "upload", relationTo: "media" })
    expect(header.fields.find((x: any) => x.name === "variant")?.options.map((x: any) => x.value)).toEqual(["default", "hyperUiSimple", "amicareZen", "amblastIndustrial"])
    expect(footer.fields.map((x: any) => x.name)).toEqual(["variant", "logo", "tagline", "copyright", "legalLinks", "columns"])
    expect(footer.fields.find((x: any) => x.name === "logo")).toMatchObject({ type: "upload", relationTo: "media" })
    expect(footer.fields.find((x: any) => x.name === "variant")?.options.map((x: any) => x.value)).toEqual(["default", "hyperUiSimple", "amicareZen", "amblastIndustrial"])
    expect(footer.fields.find((x: any) => x.name === "columns")).toMatchObject({ type: "json" })
    expect(banner.fields.map((x: any) => x.name)).toEqual(["variant", "visible", "title", "message", "link", "dismissible"])
    expect(banner.fields.find((x: any) => x.name === "variant")?.options.map((x: any) => x.value)).toEqual(["default", "hyperUiSimple"])
    expect(banner.fields.find((x: any) => x.name === "link")).toMatchObject({ type: "group" })

    const maintenance = findField("maintenance")
    expect(maintenance.type).toBe("group")
    expect(maintenance.fields.find((x: any) => x.name === "enabled")).toMatchObject({
      type: "checkbox",
      defaultValue: false,
    })
    expect(maintenance.fields.find((x: any) => x.name === "message")?.type).toBe("textarea")
  })

  it("registers server-side tenant-exclusive chrome variant validation", () => {
    expect(SiteSettings.hooks?.beforeValidate).toContain(validateTenantExists)
    expect(SiteSettings.hooks?.beforeValidate).toContain(enforceTenantExclusiveChromeVariants)
  })

  it("filters tenant-exclusive chrome variants out of generic tenant admin options", () => {
    const chrome = findField("chrome")
    const header = chrome.fields.find((x: any) => x.name === "header")
    const footer = chrome.fields.find((x: any) => x.name === "footer")
    const headerVariant = header.fields.find((x: any) => x.name === "variant")
    const footerVariant = footer.fields.find((x: any) => x.name === "variant")

    expect(headerVariant.filterOptions).toBeTypeOf("function")
    expect(footerVariant.filterOptions).toBeTypeOf("function")
    expect(filterChromeVariantOptions("header", headerVariant.options, { tenant: { slug: "future-generated" } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple"])
    expect(filterChromeVariantOptions("footer", footerVariant.options, { tenant: { slug: "future-generated" } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple"])
  })

  it("does not let admin option filtering reject internal writes without tenant context", () => {
    const chrome = findField("chrome")
    const header = chrome.fields.find((x: any) => x.name === "header")
    const footer = chrome.fields.find((x: any) => x.name === "footer")
    const headerVariant = header.fields.find((x: any) => x.name === "variant")
    const footerVariant = footer.fields.find((x: any) => x.name === "variant")

    expect(filterChromeVariantOptions("header", headerVariant.options, {}).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amicareZen", "amblastIndustrial"])
    expect(filterChromeVariantOptions("footer", footerVariant.options, {}).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amicareZen", "amblastIndustrial"])
  })

  it("keeps official legacy tenant chrome variants available in admin options", () => {
    const chrome = findField("chrome")
    const header = chrome.fields.find((x: any) => x.name === "header")
    const footer = chrome.fields.find((x: any) => x.name === "footer")
    const headerOptions = header.fields.find((x: any) => x.name === "variant").options
    const footerOptions = footer.fields.find((x: any) => x.name === "variant").options

    expect(filterChromeVariantOptions("header", headerOptions, { tenant: { slug: "ami-care" } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amicareZen"])
    expect(filterChromeVariantOptions("footer", footerOptions, { tenant: { slug: "amicare" } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amicareZen"])
    expect(filterChromeVariantOptions("header", headerOptions, { tenant: { slug: "amblast" } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amblastIndustrial"])
    expect(filterChromeVariantOptions("footer", footerOptions, { tenant: { slug: "amblast" } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amblastIndustrial"])
    expect(filterChromeVariantOptions("header", headerOptions, { tenant: 1 }, { user: { tenants: [{ tenant: { slug: "ami-care" } }] } }).map((x) => x.value))
      .toEqual(["default", "hyperUiSimple", "amicareZen"])
  })

  it("rejects Amicare and Amblast chrome variants for future generated tenants", async () => {
    const req = {
      payload: {
        findByID: async () => ({ id: 1, slug: "future-generated" }),
      },
    }

    await expect(enforceTenantExclusiveChromeVariants({
      collection: { slug: "site-settings" },
      data: {
        tenant: 1,
        chrome: {
          header: { variant: "amicareZen" },
          footer: { variant: "amblastIndustrial" },
        },
      },
      req,
    } as any)).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([
          expect.objectContaining({ path: "chrome.header.variant" }),
          expect.objectContaining({ path: "chrome.footer.variant" }),
        ]),
      },
    })
  })

  it("allows official legacy tenants to retain their tenant-exclusive chrome variants", async () => {
    const req = {
      payload: {
        findByID: async ({ id }: any) => ({ id, slug: String(id) === "1" ? "ami-care" : "amblast" }),
      },
    }

    await expect(enforceTenantExclusiveChromeVariants({
      collection: { slug: "site-settings" },
      data: {
        tenant: 1,
        chrome: {
          header: { variant: "amicareZen" },
          footer: { variant: "amicareZen" },
        },
      },
      req,
    } as any)).resolves.toMatchObject({ chrome: { header: { variant: "amicareZen" } } })

    await expect(enforceTenantExclusiveChromeVariants({
      collection: { slug: "site-settings" },
      data: {
        tenant: 2,
        chrome: {
          header: { variant: "amblastIndustrial" },
          footer: { variant: "amblastIndustrial" },
        },
      },
      req,
    } as any)).resolves.toMatchObject({ chrome: { header: { variant: "amblastIndustrial" } } })
  })
})
