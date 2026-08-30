import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { NavbarRenderer } from "./Navbar.tsx"

const page = {
  slug: "home",
  title: "Home",
  status: "published",
  updatedAt: "2026-08-26T00:00:00.000Z",
  blocks: [{ blockType: "hero", variant: "hero-01", heading: "Welkom", body: "Een heldere eerste stap.", primaryAction: { label: "Neem contact op", href: "#contact" } }],
}

const settings = {
  siteName: "Atelier Noord",
  siteUrl: "https://atelier-noord.example",
  language: "nl",
  chrome: {
    navbar: {
      variant: "navbar-01",
      placement: "sticky",
      activeMode: "anchor",
      mobileMenu: "drawer",
      showThemeToggle: true,
      cta: { label: "Neem contact op", href: "#contact" },
    },
  },
  navigation: {
    primary: [
      { label: "Diensten", href: "#services" },
      {
        label: "Meer",
        description: "Meer informatie",
        children: [{ label: "Werk", href: "#work", icon: "package" }],
      },
    ],
  },
}

for (const variant of ["navbar-01", "navbar-02", "navbar-03"]) {
  test(`${variant} renders the shared navigation contract`, () => {
    const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
      page,
      settings: { ...settings, chrome: { navbar: { ...settings.chrome.navbar, variant } } },
    }))
    assert.match(html, new RegExp(`data-navbar-variant="${variant}"`))
    assert.match(html, /data-navbar-placement="sticky"/)
    assert.match(html, /data-navbar-scroll-state="top"/)
    assert.match(html, /aria-label="Primary navigation"/)
    assert.match(html, /aria-label="Mobile navigation"/)
    assert.match(html, /site-navbar-layout/)
    assert.match(html, /site-navbar-desktop-links/)
    assert.match(html, /site-navbar-actions-slot/)
    assert.match(html, /<details class="site-navbar-group">/)
    assert.match(html, /<summary class="site-navbar-mobile-trigger" aria-label="Toggle navigation" aria-controls="site-navbar-mobile-panel" aria-expanded="false">/)
    assert.match(html, /<ul class="site-navbar-dropdown-list">/)
    assert.doesNotMatch(html, /Meer informatie/)
    assert.doesNotMatch(html, /site-navbar-mobile-trigger-label|>Menu</)
    assert.match(html, /data-theme-toggle="true"/)
    assert.match(html, /data-navbar-mobile-menu="drawer"/)
    assert.match(html, /site-navbar-frame-sticky/)
    assert.equal((html.match(/site-navbar-action site-navbar-action-primary/g) ?? []).length, 2)
    assert.doesNotMatch(html, /site-navbar-action-secondary/)
  })
}

test("navbar variants dispatch to dedicated React components", async () => {
  const source = await readFile(new URL("./Navbar.tsx", import.meta.url), "utf8")
  assert.match(source, /import \{ Navbar01 \} from "\.\/Navbar01"/)
  assert.match(source, /import \{ Navbar02 \} from "\.\/Navbar02"/)
  assert.match(source, /import \{ Navbar03 \} from "\.\/Navbar03"/)
  assert.match(source, /switch \(props\.navbar\.variant\)/)
  assert.match(source, /case "navbar-01":\s*return <Navbar01/)
  assert.match(source, /case "navbar-02":\s*return <Navbar02/)
  assert.match(source, /case "navbar-03":\s*return <Navbar03/)
  assert.doesNotMatch(source, /function NavbarVariant\(/)

  for (const [variant, suffix] of [["navbar-01", "01"], ["navbar-02", "02"], ["navbar-03", "03"]]) {
    const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
      page,
      settings: { ...settings, chrome: { navbar: { ...settings.chrome.navbar, variant } } },
    }))
    assert.match(html, new RegExp(`site-navbar-inner-${suffix}`))
  }
})

test("navbar uses the branding mark for compact/mobile layouts when available", () => {
  const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
    page,
    settings: {
      ...settings,
      branding: {
        logo: { url: "/amicare-logo.svg", alt: "Amicare-Zorg logo" },
        favicon: { url: "/amicare-favicon.svg", alt: "Amicare-Zorg favicon" },
      },
    },
  }))

  assert.match(html, /site-navbar-brand-has-compact-logo/)
  assert.match(html, /site-navbar-logo-full/)
  assert.match(html, /site-navbar-logo-mark/)
  assert.equal((html.match(/site-navbar-logo-mark/g) ?? []).length, 1)
})

test("navbar-01 inline states use accent text without a background", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const start = styles.indexOf(".site-navbar-inner-01 .site-navbar-link")
  const end = styles.indexOf(".site-navbar-dropdown {", start)
  assert.ok(start >= 0 && end > start)
  const variantStyles = styles.slice(start, end)
  assert.match(variantStyles, /color:\s*var\(--primary\)/)
  assert.match(variantStyles, /background:\s*transparent/)
  assert.match(variantStyles, /site-navbar-group\[open\] > \.site-navbar-group-trigger/)
  assert.match(variantStyles, /site-navbar-group:has\(.site-navbar-dropdown-link\[aria-current="page"\]\)/)
})

test("hero-overlay placement is attached to a hero page without sticky behavior", () => {
  const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
    page,
    settings: {
      ...settings,
      chrome: { navbar: { ...settings.chrome.navbar, placement: "hero-overlay" } },
    },
  }))
  assert.match(html, /data-navbar-placement="hero-overlay"/)
  assert.doesNotMatch(html, /data-navbar-scroll-state=/)
  assert.doesNotMatch(html, /site-navbar-sentinel/)
})

test("transparent opening navbars opt into media contrast only for image-backed opening designs", () => {
  const imagePage = {
    ...page,
    blocks: [{ ...page.blocks[0], image: { id: "hero-image", url: "/hero.jpg", alt: "Hero" } }],
  }
  const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
    page: imagePage,
    settings,
    theme: { appearance: { mode: "light", backgroundMode: "image" } },
  }))
  assert.match(html, /data-navbar-over-media="true"/)

  const neutralHtml = renderToStaticMarkup(React.createElement(NavbarRenderer, {
    page: imagePage,
    settings,
    theme: { appearance: { mode: "light", backgroundMode: "grid" } },
  }))
  assert.doesNotMatch(neutralHtml, /data-navbar-over-media=/)

  for (const variant of ["hero-03", "hero-04", "hero-05"]) {
    const splitImageHtml = renderToStaticMarkup(React.createElement(NavbarRenderer, {
      page: {
        ...page,
        blocks: [{ ...page.blocks[0], variant, image: { id: `${variant}-image`, url: "/hero.jpg", alt: "Hero" } }],
      },
      settings,
      theme: { appearance: { mode: "light", backgroundMode: "image" } },
    }))
    assert.doesNotMatch(splitImageHtml, /data-navbar-over-media=/)
  }
})

test("media contrast rules keep Navbar 02's desktop navigation surface independent", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /data-navbar-over-media="true".*site-navbar-brand/)
  assert.match(styles, /data-navbar-over-media="true".*site-navbar-desktop-links \.site-navbar-link:not\(\.site-navbar-dropdown-link\)/)
  assert.match(styles, /site-navbar-theme-toggle/)
  assert.match(styles, /border-color: color-mix\(in oklab, var\(--on-media\) 58%/)
  assert.doesNotMatch(styles, /data-navbar-over-media="true"[^\n]*\.site-navbar-links\s*\{[^}]*background/)
})

test("a navbar without a theme toggle keeps one mobile CTA full width", () => {
  const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
    page,
    settings: {
      ...settings,
      chrome: {
        navbar: {
          ...settings.chrome.navbar,
          showThemeToggle: false,
        },
      },
    },
  }))
  assert.match(html, /site-navbar-actions-mobile(?![^>]*site-navbar-actions-with-theme-toggle)/)
  assert.equal((html.match(/site-navbar-action site-navbar-action-primary/g) ?? []).length, 2)
  assert.doesNotMatch(html, /site-navbar-action-secondary/)
})

test("navbar-02 uses the responsive navigation affordances", () => {
  const html = renderToStaticMarkup(React.createElement(NavbarRenderer, {
    page,
    settings: {
      ...settings,
      chrome: { navbar: { ...settings.chrome.navbar, variant: "navbar-02" } },
    },
  }))
  assert.match(html, /data-navbar-page-slug="home"/)
  assert.doesNotMatch(html, /site-navbar-action-arrow/)
  assert.match(html, /site-navbar-close-icon/)
  assert.doesNotMatch(html, /site-navbar-sentinel|data-navbar-scrolled/)
})

test("navbar-02 stays on the SIAB color and shape bridge", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const start = styles.indexOf(".site-navbar-frame.site-navbar-variant-02")
  const end = styles.indexOf(".site-navbar-frame.site-navbar-variant-03")
  assert.ok(start >= 0 && end > start)
  const variantStyles = styles.slice(start, end)
  assert.match(variantStyles, /border-radius:\s*var\(--siab-radius-control\)/)
  assert.match(variantStyles, /background:\s*var\(--primary\)/)
  assert.match(variantStyles, /color:\s*var\(--primary-foreground\)/)
  assert.match(variantStyles, /background:\s*var\(--card\)/)
  assert.doesNotMatch(variantStyles, /border-radius:\s*999px/)
  assert.doesNotMatch(variantStyles, /#[0-9a-f]{3,8}/i)
})

test("sticky navbar 01 and 02 use quiet and elevated scroll states", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-frame\s*\{[\s\S]*--siab-navbar-shadow:[\s\S]*0 1px 2px rgb\(0 0 0 \/ 0\.08\),[\s\S]*0 4px 12px rgb\(0 0 0 \/ 0\.05\)/)
  assert.match(styles, /--siab-navbar-popover-shadow:[\s\S]*0 8px 20px rgb\(0 0 0 \/ 0\.06\)/)
  assert.match(styles, /--siab-navbar-drawer-shadow:[\s\S]*0 12px 24px rgb\(0 0 0 \/ 0\.06\)/)
  assert.match(styles, /site-navbar-frame-hero-overlay\[data-navbar-variant="navbar-02"\] \.site-navbar\s*\{[\s\S]*background:\s*transparent[\s\S]*border-bottom-color:\s*transparent[\s\S]*-webkit-backdrop-filter:\s*none[\s\S]*backdrop-filter:\s*none/)
  assert.match(styles, /\.site-navbar-frame-sticky\[data-navbar-variant="navbar-01"\]\[data-navbar-scroll-state="top"\][\s\S]*background:\s*transparent[\s\S]*border-bottom-color:\s*transparent[\s\S]*box-shadow:\s*none[\s\S]*-webkit-backdrop-filter:\s*none[\s\S]*backdrop-filter:\s*none/)
  assert.match(styles, /\.site-navbar-frame-sticky\[data-navbar-variant="navbar-02"\]\[data-navbar-scroll-state="scrolled"\][\s\S]*background:\s*var\(--background\)[\s\S]*border-bottom-color:\s*color-mix\(in oklab, var\(--border\) 68%, transparent\)[\s\S]*box-shadow:\s*var\(--siab-navbar-shadow\)/)
  assert.match(styles, /transition:[\s\S]*background-color 180ms ease[\s\S]*border-bottom-color 180ms ease[\s\S]*box-shadow 180ms ease/)
})

test("compact navbar logo rules switch between the full wordmark and mark", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-logo-mark,\s*\.site-navbar-logo-fallback\s*\{[\s\S]*width:\s*2\.5rem[\s\S]*height:\s*2\.5rem/)
  assert.match(styles, /\.site-navbar-brand-has-compact-logo \.site-navbar-logo-full\s*\{[\s\S]*display:\s*none/)
  assert.match(styles, /@container siab-navbar \(min-width: 58rem\)[\s\S]*\.site-navbar-brand-has-compact-logo \.site-navbar-logo-full\s*\{[\s\S]*display:\s*block/)
  assert.match(styles, /@container siab-navbar \(min-width: 58rem\)[\s\S]*\.site-navbar-brand-has-compact-logo \.site-navbar-logo-mark\s*\{[\s\S]*display:\s*none/)
})

test("desktop navbar reserves a true center column for links", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /container-name:\s*siab-navbar/)
  assert.match(styles, /@container siab-navbar \(min-width: 58rem\)[\s\S]*\.site-navbar-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) max-content minmax\(0, 1fr\)/)
  assert.match(styles, /\.site-navbar-desktop-links\s*\{[\s\S]*grid-column:\s*2[\s\S]*justify-self:\s*center/s)
  assert.match(styles, /\.site-navbar-actions-slot\s*\{[\s\S]*grid-column:\s*3[\s\S]*justify-self:\s*end/s)
  assert.match(styles, /\.site-navbar-group\[open\] > \.site-navbar-group-trigger\s*\{[\s\S]*background:\s*color-mix\(in oklab, var\(--accent\) 28%, transparent\)/)
  assert.match(styles, /\.site-navbar-dropdown::before\s*\{[\s\S]*top:\s*-0\.5rem[\s\S]*height:\s*0\.5rem/)
  assert.match(styles, /\.site-navbar-desktop-links \.site-navbar-group > \.site-navbar-dropdown\s*\{[\s\S]*transform:\s*translateX\(-50%\)/)
  assert.match(styles, /\.site-navbar-desktop-links \.site-navbar-group\[open\] > \.site-navbar-dropdown\s*\{[\s\S]*animation:\s*site-navbar-dropdown-enter 140ms ease-out both/)
  assert.match(styles, /@container siab-navbar \(min-width: 58rem\) and \(max-width: 70rem\)[\s\S]*\.site-navbar-desktop-links \.site-navbar-group-item:last-child \.site-navbar-dropdown\s*\{[\s\S]*right:\s*0[\s\S]*left:\s*auto/)
})

test("closed mobile navigation removes its panel from layout and focus geometry", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-mobile-menu:not\(\[open\]\) > \.site-navbar-mobile-panel\s*\{[\s\S]*display:\s*none/)
  assert.match(styles, /\.site-navbar-mobile-menu\[open\] > \.site-navbar-mobile-panel\s*\{[\s\S]*display:\s*grid/)
  assert.match(styles, /\.site-navbar-mobile-links \.site-navbar-dropdown\s*\{[\s\S]*position:\s*static/)
  assert.match(styles, /\.site-navbar-mobile-links details:not\(\[open\]\) > \.site-navbar-dropdown\s*\{[\s\S]*display:\s*none/)
  assert.match(styles, /\.site-navbar-mobile-links details\[open\] > \.site-navbar-dropdown\s*\{[\s\S]*display:\s*grid/)
  assert.match(styles, /\.site-navbar-mobile-panel\s*\{[\s\S]*background:\s*var\(--background\)/)
  assert.match(styles, /\.site-navbar-mobile-links \.site-navbar-dropdown\s*\{[\s\S]*border:\s*0[\s\S]*background:\s*transparent/)
  assert.doesNotMatch(styles, /site-navbar-dropdown-description/)
})

test("mobile navbar actions reserve the theme control and keep one CTA flexible", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-actions-mobile\.site-navbar-actions-with-theme-toggle\s*\{[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*nowrap/)
  assert.match(styles, /\.site-navbar-actions-mobile\.site-navbar-actions-with-theme-toggle \.site-navbar-theme-toggle\s*\{[\s\S]*flex:\s*0 0 2\.75rem/)
  assert.match(styles, /\.site-navbar-actions-mobile\.site-navbar-actions-with-theme-toggle \.site-navbar-action\s*\{[\s\S]*min-width:\s*0[\s\S]*flex:\s*1 1 auto/)
})

test("navbar-03 floating surface follows the shared desktop content track", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /@media \(min-width: 64rem\)[\s\S]*\.site-navbar-frame\.site-navbar-variant-03 \.site-navbar\s*\{[\s\S]*width:\s*min\([\s\S]*calc\(100% - 5rem\),[\s\S]*calc\(var\(--siab-content-max\) - 5rem\)/)

  const start = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 .site-navbar {")
  const end = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 {", start)
  const variantStyles = styles.slice(start, end)
  assert.match(variantStyles, /background:\s*color-mix\(in oklab, var\(--card\) var\(--siab-navbar-glass-surface-alpha\), transparent\)/)
  assert.match(variantStyles, /color-mix\(in oklab, var\(--card\) var\(--siab-navbar-glass-surface-alpha\), transparent\)/)
  assert.match(variantStyles, /backdrop-filter:\s*blur\(0\.5rem\) saturate\(1\.01\)/)
  assert.match(variantStyles, /box-shadow:\s*var\(--siab-navbar-shadow\)/)
  assert.doesNotMatch(variantStyles, /inset 0 1px 0/)
})

test("navbar-03 inline states use theme-colored text without surfaces", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const start = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 .site-navbar-link:not(.site-navbar-dropdown-link)")
  const end = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 {\n  --siab-navbar-floating-gap", start)
  assert.ok(start >= 0 && end > start)
  const stateStyles = styles.slice(start, end)

  assert.match(stateStyles, /\.site-navbar-link:not\(\.site-navbar-dropdown-link\):is\(:hover, \[aria-current="page"\]\)/)
  assert.match(stateStyles, /\.site-navbar-dropdown-link:is\(:hover, \[aria-current="page"\]\)/)
  assert.match(stateStyles, /color:\s*var\(--primary\)/)
  assert.match(stateStyles, /background:\s*transparent/)
  assert.doesNotMatch(stateStyles, /siab-navbar-03-(?:hover|selected)-surface/)
})

test("theme toggle border follows the icon foreground direction", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-theme-toggle\s*\{[\s\S]*border:\s*1px solid color-mix\(in oklab, var\(--foreground\) 45%, transparent\)/)
})

test("navbar-03 owns its floating gap on the sticky frame", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const frameStart = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 {")
  const frameEnd = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 .site-navbar-inner")
  const frameStyles = styles.slice(frameStart, frameEnd)
  assert.match(frameStyles, /--siab-navbar-floating-gap:\s*0\.75rem/)
  assert.match(frameStyles, /padding-top:\s*var\(--siab-navbar-floating-gap\)/)
  assert.match(frameStyles, /--siab-navbar-glass-surface-alpha:\s*40%/)
  assert.doesNotMatch(frameStyles, /siab-navbar-glass-tint-(?:start|end)/)

  const navbarStart = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 .site-navbar {")
  const navbarEnd = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 {", navbarStart)
  const navbarStyles = styles.slice(navbarStart, navbarEnd)
  assert.doesNotMatch(navbarStyles, /margin-top:\s*0\.75rem/)
})

test("navbar-03 mobile dropdown keeps one floating card silhouette", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  const start = styles.indexOf(".site-navbar-frame.site-navbar-variant-03 .site-navbar-mobile-panel")
  const end = styles.indexOf("@media (min-width: 64rem)", start)
  assert.ok(start >= 0 && end > start)
  const variantStyles = styles.slice(start, end)

  assert.match(variantStyles, /left:\s*-1px/)
  assert.match(variantStyles, /right:\s*-1px/)
  assert.match(variantStyles, /max-width:\s*none/)
  assert.match(variantStyles, /border-right:\s*1px/)
  assert.match(variantStyles, /border-bottom:\s*1px/)
  assert.match(variantStyles, /border-left:\s*1px/)
  assert.match(variantStyles, /border-radius:\s*var\(--siab-radius-2xl\)/)
  assert.match(variantStyles, /background:\s*var\(--background\)/)
  assert.match(variantStyles, /background:\s*var\(--background\)/)
  assert.match(variantStyles, /backdrop-filter:\s*blur\(0\.5rem\) saturate\(1\.01\)/)
  assert.match(variantStyles, /box-shadow:\s*var\(--siab-navbar-shadow\)/)
  assert.doesNotMatch(variantStyles, /inset 0 1px 0/)
})

test("navbar-03 drawer escapes the floating card without inheriting its shape", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03\s*\{[\s\S]*--siab-navbar-floating-gap:\s*0\.75rem[\s\S]*--siab-navbar-drawer-top:\s*calc\(var\(--siab-navbar-row-height\) \+ var\(--siab-navbar-floating-gap\) \+ 2px\)[\s\S]*padding-top:\s*var\(--siab-navbar-floating-gap\)/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03 \.site-navbar:has\(\.site-navbar-mobile-menu-drawer\[open\]\)\s*\{[\s\S]*backdrop-filter:\s*none/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03 \.site-navbar-mobile-menu-drawer > \.site-navbar-mobile-panel\s*\{[\s\S]*inset:\s*var\(--siab-navbar-drawer-top\) 0 auto[\s\S]*max-width:\s*none[\s\S]*border-right:\s*0[\s\S]*border-bottom:\s*0[\s\S]*border-left:\s*0[\s\S]*border-radius:\s*0/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-03 \.site-navbar-mobile-menu-drawer > \.site-navbar-mobile-panel\s*\{[\s\S]*background:\s*var\(--background\)/)
  assert.match(styles, /\.site-navbar-mobile-menu-drawer \.site-navbar-mobile-panel\s*\{[\s\S]*max-height:\s*calc\(100dvh - var\(--siab-navbar-drawer-top\)\)/)
})

test("desktop navbar dropdown links use the popover foreground token", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8")
  assert.match(styles, /\.site-navbar-desktop-links \.site-navbar-dropdown-link\s*\{[\s\S]*color:\s*var\(--popover-foreground\)/)
  assert.match(styles, /\.site-navbar-desktop-links \.site-navbar-dropdown-link:hover\s*\{[\s\S]*color:\s*var\(--popover-foreground\)/)
  assert.match(styles, /\.site-navbar-frame\.site-navbar-variant-02 \.site-navbar-desktop-links \.site-navbar-dropdown-link,[\s\S]*color:\s*var\(--popover-foreground\)/)
})
