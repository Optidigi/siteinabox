import * as React from "react"
import { renderToString } from "react-dom/server"
import { defineMiddleware } from "astro:middleware"
import {
  COLOR_SCHEME_IDS,
  FONT_SCHEME_IDS,
  SHAPE_SCHEME_IDS,
  type ThemeTokenSpec,
} from "@siteinabox/contracts"

const jsonForHtml = (value: unknown) => JSON.stringify(value).replaceAll("<", "\\u003c")
const approvedValue = <T extends readonly string[]>(values: T, value: string, fallback: T[number]): T[number] =>
  values.includes(value as T[number]) ? value as T[number] : fallback

export const onRequest = defineMiddleware(async (context, next) => {
  if (!import.meta.env.DEV || context.url.pathname !== "/provider-parity") return next()

  const [{ v1FixturePage }, { ShadcnUiExplicitBlockView }, { ShadcnUiChromeView }, { ShadcnUiNotFoundView }, { ShadcnUiPinnedLiteralReference }, { default: inventory }, { themeToCssVars }] = await Promise.all([
    import("../../../packages/site-renderer/src/fixtures/v1"),
    import("../../../packages/site-renderer/src/providers/shadcnui-blocks/block-views.generated"),
    import("../../../packages/site-renderer/src/providers/shadcnui-blocks/views"),
    import("../../../packages/site-renderer/src/providers/shadcnui-blocks/system-views"),
    import("../../../packages/site-renderer/src/providers/shadcnui-blocks/literal-references.generated"),
    import("../../../packages/site-renderer/src/providers/shadcnui-blocks/inventory.json"),
    import("../../../packages/site-renderer/src/theme/css-vars"),
  ])
  const variantId = context.url.searchParams.get("variant") ?? ""
  const reference = context.url.searchParams.get("reference")
  const variant = inventory.variants.find((candidate) => candidate.id === variantId)
  const block = variant ? v1FixturePage.blocks.find((candidate) => candidate.blockType === variant.blockType) : undefined
  if (!variant || (!reference && variant.role === "block" && !block)) return new Response("Unknown provider block variant", { status: 404 })

  const replaceFixtureMedia = (value: unknown): unknown => {
    if (typeof value === "string") return value.startsWith("/media/") ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E" : value
    if (Array.isArray(value)) return value.map(replaceFixtureMedia)
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceFixtureMedia(child)]))
    return value
  }
  const browserBlock = replaceFixtureMedia(block)
  const settings = {
    siteName: "Fixture Studio", siteUrl: "https://fixture.invalid", language: "en", description: "Structured provider fixture",
    contactEmail: "hello@fixture.invalid", contact: { phone: "+31 20 123 4567", address: "Canal 1, Amsterdam", social: [{ platform: "Mastodon", url: "https://social.invalid/fixture" }] },
    nap: { legalName: "Fixture Studio BV", kvkNumber: "12345678", city: "Amsterdam", country: "NL" },
    hours: [{ day: "monday", open: "09:00", close: "17:00" }], serviceArea: [{ name: "Amsterdam" }],
    navHeader: variant.id === "shadcnui-blocks.navbar-05" ? [] : variant.id === "shadcnui-blocks.navbar-03" ? [{ label: "Home", href: "/" }, { label: "Services", children: [{ label: "Design", href: "/design", description: "Digital product design", icon: "smile" }, { label: "Partner", href: "https://partner.invalid", external: true }] }] : [{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: "Contact", href: "/contact" }],
    navFooter: [{ label: "Contact", href: "/contact" }, { label: "Privacy", href: "/privacy" }],
    chrome: {
      header: { variant: variant.area === "header" ? variant.id : "shadcnui-blocks.navbar-01", behavior: "sticky", activeMode: "path", mobileMenu: variant.id === "shadcnui-blocks.navbar-05" ? null : "drawer", cta: { label: "Start", href: "/start" }, ...(variant.id === "shadcnui-blocks.navbar-05" ? { secondaryAction: { label: "Sign in", href: "/login" }, search: { enabled: true, action: "/search", placeholder: "Search" } } : {}) },
      footer: { variant: variant.area === "footer" ? variant.id : "shadcnui-blocks.footer-01", tagline: "Built with structured data", copyright: "© Fixture Studio", legalLinks: [{ label: "Terms", href: "/terms" }], columns: [{ items: [{ type: "navigation", label: "Explore" }, { type: "contact", label: "Contact" }] }], ...((variant as any).capabilities?.newsletter ? { newsletter: { title: "Updates", placeholder: "Email address", submitLabel: "Subscribe", action: "/subscribe", method: "POST" } } : {}) },
      banner: { variant: variant.area === "banner" ? variant.id : "shadcnui-blocks.banner-01", visible: true, title: "Notice", message: "A structured announcement", link: { label: "Learn more", href: "/notice" }, dismissible: true },
    },
    analyticsConsent: { enabled: variant.id === "shadcnui-blocks.banner-04" },
  }
  const props = reference ? { kind: "reference", variant: variant.id }
    : variant.role === "chrome" ? { kind: "chrome", area: variant.area, variant: variant.id, settings }
    : variant.role === "systemTemplate" ? { kind: "system", variant: variant.id, settings, pathname: "/missing" }
    : { kind: "block", block: browserBlock, options: { index: 0, formAction: "/api/forms" }, variant: variant.id }
  const body = renderToString(reference ? React.createElement(ShadcnUiPinnedLiteralReference, props as any)
    : variant.role === "chrome" ? React.createElement(ShadcnUiChromeView, props as any)
    : variant.role === "systemTemplate" ? React.createElement(ShadcnUiNotFoundView, props as any)
    : React.createElement(ShadcnUiExplicitBlockView, props as any))
  const mode = context.url.searchParams.get("mode") === "dark" ? "dark" : "light"
  const preference = context.url.searchParams.get("preference") === "system" ? "system" : mode
  const requestedColors = context.url.searchParams.get("colors") ?? "blue-professional"
  const requestedFonts = context.url.searchParams.get("fonts") ?? "clear-modern"
  const requestedShape = context.url.searchParams.get("shape") ?? "soft"
  const theme = {
    version: 3 as const,
    appearance: { mode: preference },
    colors: { schemeId: approvedValue(COLOR_SCHEME_IDS, requestedColors, "blue-professional") },
    fonts: { schemeId: approvedValue(FONT_SCHEME_IDS, requestedFonts, "clear-modern") },
    shape: { schemeId: approvedValue(SHAPE_SCHEME_IDS, requestedShape, "soft") },
  } satisfies ThemeTokenSpec
  const hydrationClient = reference ? "/src/smoke/provider-reference-client.tsx" : "/src/smoke/provider-parity-client.tsx"
  const hydration = `<script id="provider-parity-props" type="application/json">${jsonForHtml(props)}</script><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true</script><script type="module" src="${hydrationClient}"></script><script type="module" src="/src/client/site-behavior.ts"></script>`
  return new Response(`<!doctype html><html lang="en" data-siab-theme-mode="${preference}" data-siab-color-mode="${mode}" data-rt-mode="${mode}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"><link rel="stylesheet" href="/src/styles/site.css"><style>${themeToCssVars(theme, ":root")}</style><title>${variant.id}</title></head><body class="m-0 min-w-80 bg-background text-foreground"><div id="provider-parity-root" class="site-frame-root">${body}</div>${hydration}</body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
})
