import { describe, it, expect } from "vitest"
import { resolveNav, type NavPage } from "@/lib/projection/resolveNav"

// OBS-20 — resolveNav turns stored nav entries (page | section | custom)
// into the flat { label, href, external } list site.json carries.

const pages: NavPage[] = [
  { id: 1, slug: "home", title: "Home" },
  { id: 2, slug: "about", title: "About Us" },
  { id: 3, slug: "index", title: "Index Page" },
]

describe("resolveNav", () => {
  describe("page entries", () => {
    it("resolves a page entry to /<slug> with the page title as label", () => {
      expect(resolveNav([{ type: "page", page: 2 }], pages)).toEqual([
        { label: "About Us", href: "/about", external: false },
      ])
    })

    it("'home' and 'index' slugs resolve to '/'", () => {
      expect(resolveNav([{ type: "page", page: 1 }], pages)[0]!.href).toBe("/")
      expect(resolveNav([{ type: "page", page: 3 }], pages)[0]!.href).toBe("/")
    })

    it("a non-empty label overrides the page title", () => {
      expect(resolveNav([{ type: "page", page: 2, label: "Our Story" }], pages)[0]!.label).toBe("Our Story")
    })

    it("a blank/whitespace label falls back to the page title", () => {
      expect(resolveNav([{ type: "page", page: 2, label: "   " }], pages)[0]!.label).toBe("About Us")
    })

    it("omits a page entry whose target is draft or deleted (not in publishedPages)", () => {
      expect(resolveNav([{ type: "page", page: 999 }], pages)).toEqual([])
    })

    it("accepts a populated-object page ref ({ id })", () => {
      expect(resolveNav([{ type: "page", page: { id: 2 } }], pages)[0]!.href).toBe("/about")
    })

    it("string vs number page id compares correctly", () => {
      expect(resolveNav([{ type: "page", page: "2" }], pages)[0]!.href).toBe("/about")
    })
  })

  describe("section entries", () => {
    it("a section with no page is a same-page anchor (#anchor) — the onepager case", () => {
      expect(resolveNav([{ type: "section", anchor: "werkwijze", label: "Werkwijze" }], pages)).toEqual([
        { label: "Werkwijze", href: "#werkwijze", external: false },
      ])
    })

    it("a section targeting a page resolves to /<slug>#anchor", () => {
      expect(
        resolveNav([{ type: "section", anchor: "team", label: "Our Team", page: 2 }], pages)[0]!.href,
      ).toBe("/about#team")
    })

    it("a section targeting the home page resolves to /#anchor", () => {
      expect(
        resolveNav([{ type: "section", anchor: "intro", label: "Intro", page: 1 }], pages)[0]!.href,
      ).toBe("/#intro")
    })

    it("omits a section whose target page is draft/deleted", () => {
      expect(resolveNav([{ type: "section", anchor: "x", label: "X", page: 999 }], pages)).toEqual([])
    })

    it("omits a section with no anchor", () => {
      expect(resolveNav([{ type: "section", anchor: "", label: "X" }], pages)).toEqual([])
      expect(resolveNav([{ type: "section", label: "X" }], pages)).toEqual([])
    })

    it("omits a section with no label", () => {
      expect(resolveNav([{ type: "section", anchor: "x" }], pages)).toEqual([])
    })
  })

  describe("custom entries", () => {
    it("passes through url + label + external", () => {
      expect(
        resolveNav([{ type: "custom", url: "https://ext.com", label: "External", external: true }], pages),
      ).toEqual([{ label: "External", href: "https://ext.com", external: true }])
    })

    it("a site-relative custom url works and external defaults to false", () => {
      expect(resolveNav([{ type: "custom", url: "/privacy", label: "Privacy" }], pages)).toEqual([
        { label: "Privacy", href: "/privacy", external: false },
      ])
    })

    it("omits a custom entry with no url or no label", () => {
      expect(resolveNav([{ type: "custom", label: "X" }], pages)).toEqual([])
      expect(resolveNav([{ type: "custom", url: "/x" }], pages)).toEqual([])
    })
  })

  describe("flyout groups", () => {
    it("preserves ordered rich children and external intent while rejecting unsafe children", () => {
      expect(resolveNav([{ type: "group", label: "Services", description: "What we do", children: [
        { label: "Care", href: "/care", description: "At home", icon: "smile" },
        { label: "Partner", href: "https://partner.invalid", external: true },
        { label: "Unsafe", href: "javascript:alert(1)" },
      ] }], pages)).toEqual([{ label: "Services", external: false, description: "What we do", children: [
        { label: "Care", href: "/care", external: false, description: "At home", icon: "smile" },
        { label: "Partner", href: "https://partner.invalid", external: true },
      ] }])
    })

    it("omits empty groups rather than publishing an unusable trigger", () => {
      expect(resolveNav([{ type: "group", label: "Empty", children: [] }], pages)).toEqual([])
    })
  })

  describe("list behaviour", () => {
    it("preserves entry order and drops only the unresolvable ones", () => {
      const result = resolveNav(
        [
          { type: "page", page: 2 },
          { type: "page", page: 999 }, // dropped — not published
          { type: "section", anchor: "contact", label: "Contact" },
          { type: "custom", url: "https://x", label: "X" },
        ],
        pages,
      )
      expect(result).toEqual([
        { label: "About Us", href: "/about", external: false },
        { label: "Contact", href: "#contact", external: false },
        { label: "X", href: "https://x", external: false },
      ])
    })

    it("returns [] for null/undefined/empty entries", () => {
      expect(resolveNav(null, pages)).toEqual([])
      expect(resolveNav(undefined, pages)).toEqual([])
      expect(resolveNav([], pages)).toEqual([])
    })

    it("returns [] when no pages are published and all entries are page/section", () => {
      expect(
        resolveNav([{ type: "page", page: 1 }, { type: "section", anchor: "a", label: "A", page: 2 }], []),
      ).toEqual([])
    })
  })
})
