import { DEFAULT_THEME_TOKEN_SPEC } from "@siteinabox/contracts"
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import type { Payload } from "payload"
import { getTestPayload, resetTestData } from "./_helpers"

import { createArgs, relationId, asDocRecord } from "../_helpers/payloadApi"
let payload: Payload

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
  it("persists a renderer-ready tenant, V2 theme, settings, and owned-block page", async () => {
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
            variant: "hero-01",
            heading: "Renderer-backed CMS smoke",
            body: "A published page can carry semantic content without layout fields.",
            primaryAction: { label: "Start", href: "/intake" },
            secondaryAction: { label: "Contact", href: "#contact" },
          },
          {
            blockType: "contact",
            anchor: "contact",
            heading: "Contact",
            body: "The form contract remains structured CMS data.",
            contactMethods: [{ kind: "email", label: "Email", value: "hello@smoke.test", href: "mailto:hello@smoke.test" }],
            form: { formName: "Smoke contact", submitLabel: "Send", fields: [
              { name: "first-name", label: "First name", type: "text", required: true },
              { name: "last-name", label: "Last name", type: "text", required: true },
              { name: "company", label: "Company", type: "text" },
              { name: "email", label: "Email", type: "email", required: true },
              { name: "phone-number", label: "Phone number", type: "tel" },
              { name: "message", label: "Message", type: "textarea", required: true },
            ] },
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
          navbar: {
            variant: "navbar-01",
            placement: "hero-overlay",
            activeMode: "path",
            mobileMenu: "dropdown",
            cta: { label: "Contact", href: "#contact" },
          },
          footer: {
            tagline: "Structured content, renderer-owned layout.",
          },
        },
        navigation: {
          primary: [{ type: "page", page: page.id, label: "Home" }],
          footer: [{ type: "custom", url: "/privacy", label: "Privacy" }],
        },
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
      expect.objectContaining({ blockType: "hero" }),
      expect.objectContaining({ blockType: "contact" }),
    ]))

    expect(storedSettings.docs).toHaveLength(1)
    expect(storedSettings.docs[0]).toMatchObject({
      id: settings.id,
      siteName: "Smoke Studio",
      siteUrl: `https://${domain}`,
    })
    expect(asDocRecord(storedSettings.docs[0]!)).toMatchObject({ navigation: { primary: expect.arrayContaining([expect.objectContaining({ label: "Home" })]) } })
  })
})
