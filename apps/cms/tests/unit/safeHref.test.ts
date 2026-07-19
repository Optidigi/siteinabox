import { describe, expect, it } from "vitest"
import { CTA } from "@/blocks/CTA"
import { Hero } from "@/blocks/Hero"
import { SiteSettings } from "@/collections/SiteSettings"
import { isSafeHref, validateSafeHref } from "@/lib/security/safeHref"
import { pageToJson } from "@/lib/projection/pageToJson"
import { resolveNav } from "@/lib/projection/resolveNav"
import { settingsToJson } from "@/lib/projection/settingsToJson"

import type { Field } from "payload"
import { cast } from "../_helpers/cast"
import { fieldValidator } from "../_helpers/payloadFields"
import { asPageSource, jsonBlockAt } from "../_helpers/pageToJsonFixtures"
import type { MockDoc } from "../_helpers/mockPayload"

const groupField = (block: unknown, groupName: string, fieldName: string) => {
  const fields = cast<MockDoc[]>(cast<MockDoc>(block).fields)
  const group = fields.find((field) => field.name === groupName) as MockDoc & { fields: MockDoc[] }
  return group.fields.find((field) => field.name === fieldName) as MockDoc
}

const siteSettingsField = (name: string) =>
  cast<MockDoc[]>(SiteSettings.fields).find((field) => field.name === name) as MockDoc & { fields: MockDoc[] }

const navUrlField = () => {
  const navHeader = siteSettingsField("navHeader")
  return navHeader.fields.find((field) => field.name === "url") as MockDoc
}

const socialUrlField = () => {
  const contact = siteSettingsField("contact")
  const social = contact.fields.find((field) => field.name === "social") as MockDoc & { fields: MockDoc[] }
  return social.fields.find((field) => field.name === "url") as MockDoc
}

const validate = (field: MockDoc) => (value: unknown, options: unknown = {}) =>
  fieldValidator(cast<Field>(field))!(value, options)

describe("safe CMS href validation", () => {
  it("allows only explicit safe schemes, anchors, and single-slash relative paths", () => {
    for (const href of ["https://example.test/a", "http://example.test", "mailto:hi@example.test", "tel:+31205551234", "#contact", "/privacy", "/"]) {
      expect(isSafeHref(href), href).toBe(true)
      expect(validateSafeHref(href), href).toBe(true)
    }

    expect(isSafeHref("")).toBe(false)
    expect(validateSafeHref("")).toBe(true)

    for (const href of ["javascript:alert(1)", "data:text/html,<p>x</p>", "//evil.test/path", "ftp://example.test", "example.test/path", "bad\0url", "/\\evil"]) {
      expect(isSafeHref(href), href).toBe(false)
      expect(validateSafeHref(href), href).not.toBe(true)
    }
  })

  it("is wired into Hero and CTA href fields", () => {
    expect(validate(groupField(Hero, "cta", "href"))("javascript:alert(1)")).not.toBe(true)
    expect(validate(groupField(Hero, "cta", "href"))("/contact")).toBe(true)
    expect(validate(groupField(CTA, "primary", "href"))("data:text/html,<p>x</p>")).not.toBe(true)
    expect(validate(groupField(CTA, "secondary", "href"))("mailto:hi@example.test")).toBe(true)
  })

  it("is wired into custom navigation and social URL fields", () => {
    expect(validate(navUrlField())("", { siblingData: { type: "custom" } })).toBe("URL is required for a custom link")
    expect(validate(navUrlField())("//evil.test", { siblingData: { type: "custom" } })).not.toBe(true)
    expect(validate(navUrlField())("/privacy", { siblingData: { type: "custom" } })).toBe(true)
    expect(validate(navUrlField())("javascript:alert(1)", { siblingData: { type: "page" } })).toBe(true)

    expect(validate(socialUrlField())("javascript:alert(1)")).not.toBe(true)
    expect(validate(socialUrlField())("https://social.example.test/profile")).toBe(true)
  })

  it("defensively omits unsafe custom navigation hrefs from projection", () => {
    expect(resolveNav([{ type: "custom", label: "Bad", url: "javascript:alert(1)" }], [])).toEqual([])
    expect(resolveNav([{ type: "custom", label: "Good", url: " /privacy " }], [])).toEqual([
      { label: "Good", href: "/privacy", external: false },
    ])
  })

  it("defensively strips unsafe Hero and CTA hrefs from page projection", () => {
    const json = pageToJson(asPageSource({
      title: "Home",
      slug: "home",
      updatedAt: "2026-06-03T00:00:00.000Z",
      blocks: [
        { blockType: "hero", cta: { label: "Bad", href: "javascript:alert(1)" } },
        { blockType: "cta", primary: { label: "Bad", href: "data:text/html,<p>x</p>" }, secondary: { label: "Good", href: " /contact " } },
      ],
    }))

    expect(jsonBlockAt(json, 0).cta).toEqual({ label: "Bad" })
    expect(jsonBlockAt(json, 1).primary).toEqual({ label: "Bad" })
    expect(jsonBlockAt(json, 1).secondary).toEqual({ label: "Good", href: "/contact" })
  })

  it("defensively omits unsafe social URLs from settings projection", () => {
    const json = settingsToJson({
      siteName: "Site",
      siteUrl: "https://site.example",
      contact: {
        social: [
          { platform: "bad", url: "javascript:alert(1)" },
          { platform: "good", url: " https://social.example/profile " },
        ],
      },
    }, [], {}, {
      settingsContract: {
        general: { description: true, language: false, contactEmail: false },
        identity: { branding: { logo: true, favicon: true }, footer: { tagline: false, copyright: false } },
        details: {
          contact: { phone: false, address: false, social: true },
          business: {
            legalName: false,
            kvkNumber: false,
            establishmentNumber: false,
            streetAddress: false,
            city: false,
            region: false,
            postalCode: false,
            country: false,
          },
          serviceArea: false,
          hours: false,
        },
        operations: { maintenance: true },
      },
    })

    expect(json.contact?.social).toEqual([{ platform: "good", url: "https://social.example/profile" }])
  })
})
