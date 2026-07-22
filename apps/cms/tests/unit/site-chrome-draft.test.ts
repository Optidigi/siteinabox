import { describe, expect, it } from "vitest"
import {
  chromeComparable,
  chromeDraftFromSettings,
  chromePatchFromDraft,
  mergeChromeSettings,
  rendererSettingsFromChromeDraft,
  type SiteChromeDraft,
} from "@/lib/siteChromeDraft"
import type { FooterCompositionContract } from "@/lib/footerComposition"
import type { SiteSetting } from "@/payload-types"
import { cast } from "../_helpers/cast"

const footerContract: FooterCompositionContract = {
  columnCounts: [2, 3],
  defaultColumnCount: 2,
  items: [
    { type: "brand", label: "Brand" },
    { type: "links", label: "Links" },
    { type: "text", label: "Text" },
  ],
}

describe("site chrome draft helpers", () => {
  it("builds a draft from existing settings chrome", () => {
    const draft = chromeDraftFromSettings(
      cast<SiteSetting>({
        chrome: {
          header: {
            variant: "shadcnui-blocks.navbar-03",
            logo: { id: 10, url: "/logo.png" },
            cta: { label: "Contact", href: "/contact" },
          },
          footer: {
            variant: "shadcnui-blocks.footer-07",
            logo: 11,
            tagline: "Footer copy",
            copyright: "2026",
            legalLinks: [{ label: "Privacy", href: "/privacy" }],
            columns: [{ items: [{ type: "text", label: "About", text: "Hello" }] }],
          },
          banner: { variant: "shadcnui-blocks.banner-03", visible: true, message: "Update" },
        },
      }),
      footerContract,
    )

    expect(draft.header.variant).toBe("shadcnui-blocks.navbar-03")
    expect(draft.header.logo).toEqual({ id: 10, url: "/logo.png" })
    expect(draft.header.cta).toEqual({ label: "Contact", href: "/contact" })
    expect(draft.footer.variant).toBe("shadcnui-blocks.footer-07")
    expect(draft.footer.logo).toBe(11)
    expect(draft.footer.tagline).toBe("Footer copy")
    expect(draft.footer.legalLinks).toEqual([{ label: "Privacy", href: "/privacy" }])
    expect(draft.footer.columns[0]?.items[0]?.type).toBe("text")
    expect(draft.banner).toEqual({ variant: "shadcnui-blocks.banner-03", visible: true, message: "Update" })
  })

  it("normalizes media relationships for comparison and PATCH payloads", () => {
    const draft: SiteChromeDraft = {
      header: { variant: "shadcnui-blocks.navbar-01", logo: { id: 10, url: "/logo.png" }, cta: { label: "Start", href: "/start" } },
      footer: {
        variant: "shadcnui-blocks.footer-01",
        logo: { id: "11" },
        tagline: "",
        copyright: null,
        legalLinks: [{ label: "Privacy", href: "/privacy" }],
        columns: [{ items: [{ type: "brand", label: "Brand" }] }],
      },
      banner: { variant: "shadcnui-blocks.banner-03", visible: true, message: "Update" },
    }

    expect(chromeComparable(draft, footerContract).header.logo).toBe(10)
    expect(chromeComparable(draft, footerContract).footer.logo).toBe("11")
    expect(chromePatchFromDraft(draft, footerContract)).toMatchObject({
      header: { variant: "shadcnui-blocks.navbar-01", logo: 10, cta: { label: "Start", href: "/start" } },
      footer: { variant: "shadcnui-blocks.footer-01", logo: "11", tagline: "", copyright: null, legalLinks: [{ label: "Privacy", href: "/privacy" }] },
      banner: { variant: "shadcnui-blocks.banner-03", visible: true, message: "Update" },
    })
  })

  it("merges draft chrome without dropping unrelated settings", () => {
    const settings = {
      id: 7,
      siteName: "Site",
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-04", behavior: "sticky" },
        footer: { copyright: "old", legalLinks: [{ label: "Old", href: "/old" }] },
      },
    }
    const draft: SiteChromeDraft = {
      header: { variant: "shadcnui-blocks.navbar-01", logo: 3, behavior: "static", cta: { label: "Go", href: "/go" } },
      footer: {
        variant: "shadcnui-blocks.footer-01",
        logo: null,
        tagline: "New",
        copyright: "2026",
        legalLinks: [{ label: "Privacy", href: "/privacy" }],
        columns: [],
      },
      banner: { variant: "shadcnui-blocks.banner-01", visible: false },
    }

    expect(mergeChromeSettings(cast<SiteSetting>(settings), draft)).toMatchObject({
      id: 7,
      siteName: "Site",
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01", behavior: "static", logo: 3, cta: { label: "Go", href: "/go" } },
        footer: {
          variant: "shadcnui-blocks.footer-01",
          copyright: "2026",
          logo: null,
          tagline: "New",
          legalLinks: [{ label: "Privacy", href: "/privacy" }],
          columns: [],
        },
        banner: { variant: "shadcnui-blocks.banner-01", visible: false },
      },
    })
  })

  it("projects draft chrome into renderer-compatible site settings", () => {
    const settings = {
      siteName: "Site",
      siteUrl: "https://example.test",
      language: "nl",
      branding: { logo: { url: "/brand.png", filename: "brand.png", alt: "Brand" } },
      navHeader: [{ type: "page", page: 5, label: "Home" }],
      chrome: {
        header: { variant: "shadcnui-blocks.navbar-01", logo: 3, cta: { label: "Bad", href: "javascript:alert(1)" } },
        footer: { variant: "shadcnui-blocks.footer-01", logo: null, columns: [] },
      },
    }
    const draft: SiteChromeDraft = {
      header: {
        variant: "shadcnui-blocks.navbar-03",
        logo: { url: "/draft-logo.png", filename: "draft-logo.png", alt: "Draft logo" },
        behavior: "sticky",
        activeMode: "path",
        mobileMenu: "drawer",
        cta: { label: "Contact", href: "/contact" },
      },
      footer: {
        variant: "shadcnui-blocks.footer-07",
        logo: 9,
        tagline: "Draft footer",
        copyright: "2026",
        legalLinks: [{ label: "Privacy", href: "/privacy" }],
        columns: [{ items: [{ type: "text", label: "About", text: "Hello" }] }],
      },
      banner: { variant: "shadcnui-blocks.banner-01", visible: true, message: "Draft banner" },
    }

    const projected = rendererSettingsFromChromeDraft(cast<SiteSetting>(settings), draft, {
      publishedPages: [{ id: 5, slug: "index", title: "Home page" }],
    })

    expect(projected).toMatchObject({
      siteName: "Site",
      siteUrl: "https://example.test",
      chrome: {
        header: {
          variant: "shadcnui-blocks.navbar-03",
          logo: { url: "/draft-logo.png", filename: "draft-logo.png", alt: "Draft logo" },
          behavior: "sticky",
          activeMode: "path",
          mobileMenu: "drawer",
          cta: { label: "Contact", href: "/contact" },
        },
        footer: {
          variant: "shadcnui-blocks.footer-07",
          logo: { id: 9 },
          tagline: "Draft footer",
          copyright: "2026",
          legalLinks: [{ label: "Privacy", href: "/privacy" }],
          columns: [{ id: null, items: [{ id: null, type: "text", label: "About", text: "Hello", links: [] }] }],
        },
        banner: { variant: "shadcnui-blocks.banner-01", visible: true, message: "Draft banner" },
      },
      navHeader: [{ label: "Home", href: "/", external: false }],
    })
    expect(projected?.chrome?.header?.cta).toEqual({ label: "Contact", href: "/contact", external: false })
    expect(projected).not.toHaveProperty("analytics")
  })
})
