// src/middleware.ts
import { defineMiddleware } from "astro:middleware"

const ADMIN_ORIGIN = process.env.PUBLIC_ADMIN_ORIGIN ?? "https://admin.siteinabox.nl"
const POSTHOG_HOST = "https://eu.posthog.com"
const POSTHOG_PROXY_HOST = "https://r.siteinabox.nl"
const POSTHOG_ASSETS_HOST = "https://eu-assets.i.posthog.com"

export const onRequest = defineMiddleware(async (ctx, next) => {
  // Astro 6 excludes any file in src/pages/ whose name starts with `_`
  // (rule lives in astro/dist/core/routing/create-manifest.js — checked
  // `name[0] === "_"`, no config escape hatch). That means
  // `src/pages/__preview.astro` is unbuildable; the on-disk filename
  // must be `preview.astro`. Payload's PreviewPane hard-codes the URL
  // `${tenantOrigin}/__preview?t=…`, so we internally rewrite incoming
  // /__preview requests onto the /preview handler with the query string
  // preserved. The browser-visible URL stays /__preview.
  if (ctx.url.pathname === "/__preview") {
    const target = new URL("/preview", ctx.url)
    target.search = ctx.url.search
    return ctx.rewrite(target)
  }

  const res = await next()

  // Common security headers (matches the prior nginx.conf baseline).
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set(
    "Permissions-Policy",
    "interest-cohort=(), camera=(), microphone=(), geolocation=(), payment=()",
  )
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

  const isDynamicRoute =
    !ctx.url.pathname.startsWith("/_astro/") &&
    !ctx.url.pathname.startsWith("/media/") &&
    !ctx.url.pathname.match(/\.(css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i)
  if (isDynamicRoute) {
    res.headers.set("Cache-Control", "no-store, max-age=0")
  }

  const isPreview =
    ctx.url.pathname === "/preview" || ctx.url.pathname.startsWith("/preview/")

  if (isPreview) {
    // Allow framing by EITHER admin origin:
    //  - the super-admin (admin.siteinabox.nl)
    //  - the tenant admin computed from the current request host
    //    (e.g. ami-care.nl → admin.ami-care.nl)
    // siab-payload routes both to the same Next.js app via Traefik labels,
    // and `hostToTenant.stripAdminPrefix` auto-context-switches the admin UI
    // into the matching tenant when accessed via admin.<tenant-domain>.
    // Without including both here, frame-ancestors blocks the iframe from
    // the tenant-domain admin.
    //
    // Use forwarded-host headers — `ctx.url.hostname` reports the internal
    // bind host ("localhost") behind a reverse proxy, not the public
    // domain. Traefik forwards the original Host header; prefer
    // X-Forwarded-Host if set, fall back to Host, then ctx.url.hostname.
    // Strip port (Host may include ":80" / ":443").
    const rawHost =
      ctx.request.headers.get("x-forwarded-host") ??
      ctx.request.headers.get("host") ??
      ctx.url.hostname
    const publicHost = (rawHost || "").split(":")[0] || "localhost"
    const tenantAdminOrigin = `https://admin.${publicHost}`
    const adminOrigins = Array.from(new Set([ADMIN_ORIGIN, tenantAdminOrigin]))
    const frameAncestors = adminOrigins.join(" ")
    const connectSrcAdmin = adminOrigins.join(" ")

    // Access-Control-Allow-Origin is single-value per spec — echo the
    // request's Origin if it's in the allowlist, else fall back to the
    // super-admin. `Vary: Origin` is set so caches don't reuse the wrong
    // ACAO header for a different requester.
    const reqOrigin = ctx.request.headers.get("origin") ?? ""
    const acaoValue = adminOrigins.includes(reqOrigin) ? reqOrigin : ADMIN_ORIGIN

    res.headers.delete("X-Frame-Options")
    res.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'unsafe-inline' ${POSTHOG_PROXY_HOST} ${POSTHOG_ASSETS_HOST}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ${connectSrcAdmin} ${POSTHOG_PROXY_HOST} ${POSTHOG_HOST} ${POSTHOG_ASSETS_HOST}; frame-ancestors ${frameAncestors}`,
    )
    res.headers.set("Access-Control-Allow-Origin", acaoValue)
    res.headers.set("Vary", "Origin")
  } else {
    // Strict defaults for non-preview routes — ported from the prior
    // nginx.conf baseline. 'unsafe-inline' on script-src is required so
    // Astro's island runtime + hydrator inline scripts execute (and so
    // framer-motion components don't stay invisible at initial opacity).
    res.headers.set("X-Frame-Options", "SAMEORIGIN")
    res.headers.set(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'unsafe-inline' ${POSTHOG_PROXY_HOST} ${POSTHOG_ASSETS_HOST}; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' ${POSTHOG_PROXY_HOST} ${POSTHOG_HOST} ${POSTHOG_ASSETS_HOST}; base-uri 'self'; frame-ancestors 'none'; form-action 'none'`,
    )
  }

  return res
})
