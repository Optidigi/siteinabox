import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import type { Payload } from "payload"
import { getTestPayload, resetTestData } from "./_helpers"

import { createArgs, relationId, asDocRecord } from "../_helpers/payloadApi"
let payload: Payload

const inlineRoot = (text: string) => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const blockRoot = (text: string) => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const smokeTheme = {
  version: 3,
  appearance: { mode: "light" },
  colors: { schemeId: "red-confident" },
  fonts: { schemeId: "classic-editorial" },
  shape: { schemeId: "rounded" },
} as const

beforeAll(async () => {
  payload = await getTestPayload()
}, 30000)

beforeEach(async () => {
  await resetTestData(payload)
}, 30000)

describe("CMS integration smoke", () => {
  it("persists a renderer-ready tenant, V2 theme, settings, and source-backed page", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`
    const domain = `smoke-studio-${suffix}.test`
    const tenant = await payload.create(createArgs("tenants", {
      name: "Smoke Studio",
      slug: `smoke-studio-${suffix}`,
      domain,
      status: "active",
      theme: smokeTheme,
    }, { overrideAccess: true }))

    const page = await payload.create(createArgs("pages", {
      tenant: relationId(tenant),
        title: "Home",
        slug: "index",
        status: "published",
        blocks: [
          {
            blockType: "hero",
            designVariant: "shadcnui-blocks.hero-01",
            eyebrow: inlineRoot("Smoke ready"),
            headline: inlineRoot("Renderer-backed CMS smoke"),
            subheadline: blockRoot("A published page can carry source-backed content without layout fields."),
            cta: { label: "Start", href: "/intake" },
            secondary: { label: "Contact", href: "#contact" },
          },
          {
            blockType: "contactSection",
            designVariant: "shadcnui-blocks.contact-02",
            anchor: "contact",
            title: inlineRoot("Contact"),
            description: blockRoot("The form contract remains structured CMS data."),
            formName: "Smoke contact",
            submitLabel: "Send",
            fields: [
              { name: "first-name", label: "First name", type: "text", required: true },
              { name: "last-name", label: "Last name", type: "text", required: true },
              { name: "company", label: "Company", type: "text" },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone-number", label: "Phone number", type: "tel" },
              { name: "message", label: "Message", type: "textarea", required: true },
            ],
            provider: {
              provider: "siab",
              action: "/api/forms",
              method: "POST",
              requiresConsent: true,
              analyticsEnabled: true,
            },
          },
        ],
    }, { overrideAccess: true }))

    const settings = await payload.create(createArgs("site-settings", {
      tenant: relationId(tenant),
        siteName: "Smoke Studio",
        siteUrl: `https://${domain}`,
        description: "Smoke coverage for renderer-ready tenant settings.",
        language: "nl",
        chrome: {
          header: {
            variant: "shadcnui-blocks.navbar-01",
            behavior: "static",
            activeMode: "path",
            mobileMenu: "dropdown",
            cta: { label: "Contact", href: "#contact" },
          },
          footer: {
            variant: "shadcnui-blocks.footer-01",
            tagline: "Structured content, renderer-owned layout.",
          },
        },
        navHeader: [{ type: "page", page: page.id, label: "Home" }],
        navFooter: [{ type: "custom", url: "/privacy", label: "Privacy" }],
    }, { overrideAccess: true }))

    const storedTenant = await payload.findByID({
      collection: "tenants",
      id: tenant.id,
      overrideAccess: true,
      depth: 0,
    })
    const storedPages = await payload.find({
      collection: "pages",
      where: { tenant: { equals: tenant.id } },
      overrideAccess: true,
      depth: 0,
    })
    const storedSettings = await payload.find({
      collection: "site-settings",
      where: { tenant: { equals: tenant.id } },
      overrideAccess: true,
      depth: 0,
    })

    expect(storedTenant.theme).toEqual(smokeTheme)
    expect(storedTenant.theme).toEqual(smokeTheme)
    expect(DEFAULT_THEME_TOKEN_SPEC.colors.schemeId).toBe("monochrome")

    expect(storedPages.docs).toHaveLength(1)
    expect(storedPages.docs[0]).toMatchObject({
      id: page.id,
      slug: "index",
      status: "published",
    })
    expect(asDocRecord(storedPages.docs[0]!).blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ designVariant: "shadcnui-blocks.hero-01" }),
      expect.objectContaining({ designVariant: "shadcnui-blocks.contact-02" }),
    ]))

    expect(storedSettings.docs).toHaveLength(1)
    expect(storedSettings.docs[0]).toMatchObject({
      id: settings.id,
      siteName: "Smoke Studio",
      siteUrl: `https://${domain}`,
    })
    expect(asDocRecord(storedSettings.docs[0]!).navHeader).toHaveLength(1)
  })
})
