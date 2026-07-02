import { NextRequest, NextResponse } from "next/server"
import { RateLimiterMemory } from "rate-limiter-flexible"
import { stripAdminPrefix, isSuperAdminDomain } from "@/lib/hostToTenant"

// Pass-through for everything that isn't an authenticated app route.
// Specifically skip:
//   /_next/*  — Next.js asset pipeline
//   /admin/*  — Payload's native admin (still mounted in Phase 0; disabled in Phase 5)
//   favicon.ico, robots.txt, etc.
//
// Most of /api/* is excluded (Payload's REST/GraphQL endpoints have their
// own auth), with two opt-in exceptions for audit-p1 #5 (T4) rate-limit:
// /api/forms, /api/intake, /api/contact, and /api/users/forgot-password are anonymous public surfaces
// whose abuse-by-flood vector the matcher MUST route through middleware.
//
// The (frontend) route group's pages (/, /login, /sites/*, etc.) all match
// the matcher below and receive the stamped headers.

// Audit-p1 #4 (T12) / OBS-1 / OBS-18: security-header set applied on every
// middleware-matched response. CSP composition:
//   - default-src 'self'           — same-origin baseline
//   - script-src 'nonce-<N>'       — per-request cryptographic nonce replaces
//                                    the former 'unsafe-inline'/'unsafe-eval'.
//                                    Next.js 15 picks up the nonce from the
//                                    `x-csp-nonce` response header (and the
//                                    matching `x-csp-nonce` request header we
//                                    stamp in the forwarded headers) and applies
//                                    it to hydration scripts automatically.
//   - style-src 'nonce-<N>'        — per-request cryptographic nonce authorizes
//                                    tenant/theme/runtime CSS <style> tags in
//                                    production/test. Development keeps a
//                                    narrow 'unsafe-inline' style relaxation
//                                    because Next devtools injects unnonceable
//                                    diagnostic styles.
//   - img-src https: data:         — admin renders tenant uploads + base64 thumbs
//   - font-src 'self' data:        — admin self-hosts fonts
//   - connect-src 'self' + PostHog — same-origin fetch plus analytics ingest
//                                    through the configured first-party proxy.
//   - frame-src 'self' https:      — REQUIRED for live-preview <iframe> embedding
//                                    tenant origins (`<PreviewPane>`). Without
//                                    this, default-src falls back and blocks the
//                                    cross-origin iframe load.
//   - frame-ancestors 'none'       — primary fix; blocks clickjacking on admin
//                                    Renderer-frame routes deliberately use
//                                    same-origin ancestors so CMS preview can
//                                    embed the isolated generated-site document.
//   - base-uri 'self'              — block <base> override
//   - form-action 'self'           — block form-redirect to attacker origin

// Web Crypto API works in both Node.js and Edge runtimes (Next.js middleware
// runs in Edge by default). `node:crypto`'s randomBytes is unavailable there.
const buildNonce = (): string => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // base64 — btoa on a binary string is the bridge-friendly path
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number)
  return btoa(bin)
}

// Dev-only relaxation: Next.js's Fast Refresh (react-refresh) runtime uses
// `eval()` to inject hot-replaced modules. Production builds DO NOT include
// react-refresh, so prod CSP stays strict (`'self' 'nonce-X'`). We narrow
// the exception to NODE_ENV === "development" only — `test` and any other
// runtime still get the strict policy so the audit posture and CI tests
// reflect what ships to prod.
const isDev = process.env.NODE_ENV === "development"
const scriptSrcDev = isDev ? " 'unsafe-eval'" : ""
const styleSrc = (nonce: string) =>
  isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`

const normalizeOrigin = (value: string | undefined, fallback: string): string => {
  const raw = (value || fallback).replace(/\/+$/, "")
  try {
    return new URL(raw).origin
  } catch {
    return new URL(fallback).origin
  }
}

const posthogPublicOrigin = normalizeOrigin(process.env.POSTHOG_PUBLIC_HOST, "https://r.siteinabox.nl")
const posthogUiOrigin = normalizeOrigin(process.env.POSTHOG_HOST, "https://app.posthog.com")
const posthogConnectOrigins = Array.from(new Set([posthogPublicOrigin, posthogUiOrigin])).join(" ")

const buildAdminCsp = (nonce: string, options: { allowSameOriginFrameAncestor?: boolean } = {}) => [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' ${posthogPublicOrigin}${scriptSrcDev}`,
  styleSrc(nonce),
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${posthogConnectOrigins}`,
  "frame-src 'self' https:",
  options.allowSameOriginFrameAncestor ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const HSTS = "max-age=63072000; includeSubDomains; preload"

const isPreviewPath = (p: string): boolean =>
  p === "/__preview" || p.startsWith("/__preview/")

const isRendererFramePath = (p: string): boolean =>
  p === "/renderer-frame" || p.startsWith("/renderer-frame/")

const isEditorFramePath = (p: string): boolean =>
  p === "/editor-frame" || p.startsWith("/editor-frame/")

// Stamp the audit-p1 #4 security-header set onto a response. Centralised so
// the rate-limit branch's 429 path and the regular pass-through path both
// emit the same set; nonce is generated once per request and threaded through.
const applySecurityHeaders = (res: NextResponse, pathname: string, nonce: string): NextResponse => {
  const allowSameOriginFrameAncestor = isRendererFramePath(pathname) || isEditorFramePath(pathname)
  res.headers.set("Content-Security-Policy", buildAdminCsp(nonce, { allowSameOriginFrameAncestor }))
  res.headers.set("Strict-Transport-Security", HSTS)
  res.headers.set("X-Content-Type-Options", "nosniff")
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  res.headers.set("x-csp-nonce", nonce)
  res.headers.set("X-Frame-Options", allowSameOriginFrameAncestor ? "SAMEORIGIN" : "DENY")
  return res
}

// -----------------------------------------------------------------------------
// Audit-p1 #5 (T4) — rate-limit on public POST surfaces
// -----------------------------------------------------------------------------
//
// Library: `rate-limiter-flexible` (RateLimiterMemory). In-memory, no Redis
// dep — appropriate for the single-instance VPS deployment. If/when this
// fans out to multiple Node processes or hosts, swap to RateLimiterCluster
// or a Redis-backed limiter. (Documented in audits/07-fix-batch-6-report.md.)
//
// Scope: /api/forms, /api/intake, /api/contact, and /api/users/forgot-password
// ONLY. POST method only. /api/users (bootstrap surface) is INTENTIONALLY
// out-of-scope; rate-limiting it would interfere with the P1 #6 BOOTSTRAP_TOKEN
// seed runbook + AMD-1 owner-invite flow.
//
// Anonymous detection (per dispatch Constraint 1, approach (b)): a caller
// is "anonymous" iff BOTH the `Authorization` header is absent AND no
// `payload-token` cookie is present. Authed callers (super-admin via
// API-key client, or any logged-in user via session cookie) bypass the
// limiter; authenticated tenant provisioning can still issue bursts of
// /api/users/forgot-password. The residual gap (authed editor floods forgot-
// password with arbitrary emails) is recorded as out-of-batch observation
// in the batch report; closing it is a future-audit item.
//
// Identifier: leftmost IP from `X-Forwarded-For` (the VPS sits behind nginx-
// proxy-manager, which sets this header per the audit's deployment notes;
// RFC 7239 best practice is leftmost = original client). Fallback `"unknown"`
// shares one bucket across all spoofed/missing-XFF callers — the worst case
// is that all such callers compete for one 10/min budget, which is the
// correct conservative behaviour. Spoofing IP via the XFF header to bypass
// the limit lands a different attacker IP in the bucket per request, which
// IS a real bypass — but THREAT-MODEL §5 places network-layer DoS out-of-
// scope; the in-app limiter raises the cost-of-attack from one machine to
// distributed-bot territory. Documented in batch report.
//
// Limits: default 10 / 60 seconds per (path, ip). Aligns with the audit's
// literal suggestion ("10/min/IP/route"). Budget is per-route — a flooder
// hitting /api/forms doesn't cost the /api/users/forgot-password budget for
// the same IP. Path normalization strips trailing slashes so `/api/forms` and
// `/api/forms/` share one budget (Test Case 5).
//
// Generated-site forms also get a second anonymous-only budget keyed by
// tenant/form target. This catches distributed low-volume spam that rotates IPs
// but pounds one customer's form. Defaults are intentionally conservative for
// a single-instance production CMS and can be relaxed/tightened without code:
//   SIAB_PUBLIC_POST_RATE_LIMIT_POINTS=10
//   SIAB_PUBLIC_POST_RATE_LIMIT_WINDOW_SECONDS=60
//   SIAB_FORM_TARGET_RATE_LIMIT_POINTS=50
//   SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS=3600

const parsePositiveIntEnv = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const publicPostRateLimitConfig = () => ({
  points: parsePositiveIntEnv("SIAB_PUBLIC_POST_RATE_LIMIT_POINTS", 10),
  duration: parsePositiveIntEnv("SIAB_PUBLIC_POST_RATE_LIMIT_WINDOW_SECONDS", 60),
})

const formTargetRateLimitConfig = () => ({
  points: parsePositiveIntEnv("SIAB_FORM_TARGET_RATE_LIMIT_POINTS", 50),
  duration: parsePositiveIntEnv("SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS", 3600),
})

// Single shared limiter instance per process. The composite key
// `${normalizedPath}:${ip}` provides per-(path,ip) isolation. We don't
// pre-allocate per-route limiters because the set of rate-limited routes
// is small and may grow (e.g. /api/health, future contact-v2 endpoints);
// keying on path keeps the wiring uniform.
let rateLimiter: RateLimiterMemory | null = null
let formTargetRateLimiter: RateLimiterMemory | null = null

const getRateLimiter = (): RateLimiterMemory => {
  if (rateLimiter == null) {
    rateLimiter = new RateLimiterMemory(publicPostRateLimitConfig())
  }
  return rateLimiter
}

const getFormTargetRateLimiter = (): RateLimiterMemory => {
  if (formTargetRateLimiter == null) {
    formTargetRateLimiter = new RateLimiterMemory(formTargetRateLimitConfig())
  }
  return formTargetRateLimiter
}

// Test-only export: drop limiter state between tests so per-IP budgets
// don't leak across test cases. NOT called from production code; the
// underscore-prefixed name is the convention for `import-but-do-not-call`.
export const __resetRateLimitersForTests = (): void => {
  rateLimiter = null
  formTargetRateLimiter = null
}

const RATE_LIMITED_PATHS = new Set<string>([
  "/api/forms",
  "/api/contact",
  "/api/intake",
  "/api/users/forgot-password",
])

const normalizePath = (p: string): string => {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1)
  return p
}

const isRateLimitedRequest = (req: NextRequest): boolean => {
  if (req.method !== "POST") return false
  return RATE_LIMITED_PATHS.has(normalizePath(req.nextUrl.pathname))
}

const isFormsRequest = (req: NextRequest): boolean =>
  req.method === "POST" && normalizePath(req.nextUrl.pathname) === "/api/forms"

// Anonymous = no Authorization header AND no payload-token cookie. Either
// signal flips the caller to "authed-or-trusted" and the limiter skips.
const isAnonymousCaller = (req: NextRequest): boolean => {
  if (req.headers.get("authorization")) return false
  // NextRequest exposes parsed cookies via the cookies() helper in the
  // edge runtime; fall back to a manual cookie-header parse for unit-test
  // shapes that don't materialise the cookie store.
  const tokenCookie = req.cookies.get("payload-token")
  if (tokenCookie?.value) return false
  return true
}

// Leftmost IP from X-Forwarded-For. The VPS deployment terminates TLS at
// Traefik, which appends client IPs in chain order
// (RFC 7239 §5.2); `203.0.113.10, 10.0.0.5` → take `203.0.113.10`. Empty
// or missing header → `"unknown"` (one shared bucket across such callers).
const extractClientIp = (req: NextRequest): string => {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  // NextRequest exposes `ip` in the edge runtime when a trusted proxy is
  // configured; fall back to it where present, else "unknown".
  const ip = (req as unknown as { ip?: string }).ip
  if (ip) return ip
  return "unknown"
}

const buildRateLimitedResponse = (msBeforeNext: number, pathname: string, nonce: string): NextResponse => {
  const retryAfterSeconds = Math.max(1, Math.ceil(msBeforeNext / 1000))
  const res = NextResponse.json(
    { error: `Too many requests, retry in ${retryAfterSeconds} seconds` },
    { status: 429 }
  )
  res.headers.set("Retry-After", String(retryAfterSeconds))
  // Also stamp the audit-p1 #4 security headers — the 429 page is a
  // middleware-matched response, so the same hardening contract applies.
  return applySecurityHeaders(res, pathname, nonce)
}

const cleanRateLimitKeyPart = (value: unknown): string | null => {
  if (typeof value !== "string" && typeof value !== "number") return null
  const trimmed = String(value).trim().toLowerCase()
  if (!trimmed) return null
  return trimmed.replace(/[^a-z0-9._:-]+/g, "-").slice(0, 96)
}

const relationshipKeyPart = (value: unknown): string | null => {
  if (typeof value === "string" || typeof value === "number") return cleanRateLimitKeyPart(value)
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return cleanRateLimitKeyPart(record.id ?? record.value ?? record.slug)
}

type FormTarget = {
  tenant: string
  form: string
}

const formTargetFromRecord = (record: Record<string, unknown>, hostTenant: string): FormTarget | null => {
  const form = cleanRateLimitKeyPart(record.formName)
  if (!form) return null
  const tenant = relationshipKeyPart(record.tenant) ?? cleanRateLimitKeyPart(hostTenant)
  if (!tenant) return null
  return { tenant, form }
}

const parseFormTarget = async (req: NextRequest, hostTenant: string): Promise<FormTarget | null> => {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? ""

  try {
    if (contentType.includes("application/json")) {
      const body = await req.clone().json()
      if (!body || typeof body !== "object" || Array.isArray(body)) return null
      return formTargetFromRecord(body as Record<string, unknown>, hostTenant)
    }

    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.clone().formData()
      const record: Record<string, unknown> = {}
      for (const key of ["tenant", "formName"]) {
        const value = formData.get(key)
        if (typeof value === "string") record[key] = value
      }
      return formTargetFromRecord(record, hostTenant)
    }
  } catch {
    return null
  }

  return null
}

const API_KEY_AUTH_PREFIX = "users API-Key "
const MIN_API_KEY_LENGTH = 16
const MAX_API_KEY_LENGTH = 256

const hasMalformedUsersApiKey = (req: NextRequest): boolean => {
  const auth = req.headers.get("authorization")
  if (!auth?.startsWith(API_KEY_AUTH_PREFIX)) return false
  const apiKey = auth.slice(API_KEY_AUTH_PREFIX.length)
  return apiKey.length < MIN_API_KEY_LENGTH || apiKey.length > MAX_API_KEY_LENGTH
}

const buildMalformedApiKeyResponse = (pathname: string, nonce: string): NextResponse => {
  const res = NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  return applySecurityHeaders(res, pathname, nonce)
}

const isPasswordLoginRequest = (req: NextRequest): boolean =>
  req.method === "POST" && normalizePath(req.nextUrl.pathname) === "/api/users/login"

const buildPasswordLoginUnavailableResponse = (pathname: string, nonce: string): NextResponse => {
  const res = NextResponse.json({ error: "Password login is only available on the SIAB admin host" }, { status: 403 })
  return applySecurityHeaders(res, pathname, nonce)
}

const rateLimitFallbackMs = (durationSeconds: number): number => durationSeconds * 1000

const retryMsFromLimiterRejection = (rejRes: unknown, fallbackMs: number): number => {
  const ms =
    typeof rejRes === "object" && rejRes && "msBeforeNext" in rejRes
      ? Number((rejRes as { msBeforeNext: unknown }).msBeforeNext)
      : fallbackMs
  return Number.isFinite(ms) ? ms : fallbackMs
}

// -----------------------------------------------------------------------------
// Proxy entry point
// -----------------------------------------------------------------------------

export async function proxy(req: NextRequest): Promise<NextResponse> {
  // Generate one nonce per request. Stamped onto forwarded request headers so
  // root layouts can read it via headers().get("x-csp-nonce"), and onto the
  // response headers so the browser enforces it in the CSP. Next.js 15 also
  // picks up the request-side x-csp-nonce header and applies it to hydration
  // scripts automatically.
  const nonce = buildNonce()

  if (isPreviewPath(req.nextUrl.pathname)) {
    const res = new NextResponse(null, { status: 404 })
    return applySecurityHeaders(res, req.nextUrl.pathname, nonce)
  }

  if (hasMalformedUsersApiKey(req)) {
    return buildMalformedApiKeyResponse(req.nextUrl.pathname, nonce)
  }

  const host = req.headers.get("host") || ""
  const domain = stripAdminPrefix(host)
  const superAdminDomain = process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN

  if (isPasswordLoginRequest(req) && !isSuperAdminDomain(domain, superAdminDomain)) {
    return buildPasswordLoginUnavailableResponse(req.nextUrl.pathname, nonce)
  }

  // Rate-limit short-circuit: gate ONLY when the request is in scope
  // (POST + named path + anonymous caller). Authenticated callers and
  // out-of-scope paths fall through to the unchanged headers-stamping
  // path below.
  if (isRateLimitedRequest(req) && isAnonymousCaller(req)) {
    const limiter = getRateLimiter()
    const ip = extractClientIp(req)
    const key = `${normalizePath(req.nextUrl.pathname)}:${ip}`
    try {
      await limiter.consume(key, 1)
    } catch (rejRes) {
      return buildRateLimitedResponse(
        retryMsFromLimiterRejection(rejRes, rateLimitFallbackMs(publicPostRateLimitConfig().duration)),
        req.nextUrl.pathname,
        nonce
      )
    }

    if (isFormsRequest(req)) {
      const target = await parseFormTarget(req, domain)
      if (target) {
        const targetLimiter = getFormTargetRateLimiter()
        const targetKey = `forms:${target.tenant}:${target.form}`
        try {
          await targetLimiter.consume(targetKey, 1)
        } catch (rejRes) {
          return buildRateLimitedResponse(
            retryMsFromLimiterRejection(rejRes, rateLimitFallbackMs(formTargetRateLimitConfig().duration)),
            req.nextUrl.pathname,
            nonce
          )
        }
      }
    }
  }

  const reqHeaders = new Headers(req.headers)
  reqHeaders.set("x-csp-nonce", nonce)
  if (isSuperAdminDomain(domain, superAdminDomain)) {
    reqHeaders.set("x-siab-mode", "super-admin")
    reqHeaders.set("x-siab-host", "")
  } else {
    reqHeaders.set("x-siab-mode", "tenant")
    reqHeaders.set("x-siab-host", domain)
  }

  const res = NextResponse.next({ request: { headers: reqHeaders } })
  return applySecurityHeaders(res, req.nextUrl.pathname, nonce)
}

export const config = {
  matcher: [
    // Match everything EXCEPT:
    //   - Payload API + admin (handled by their own routes)
    //   - Next.js internals
    //   - common static asset paths
    //
    // The trailing `/` after `api` and `admin` is intentional — without it,
    // `api-key` and any future `admin-*` route would be incorrectly excluded
    // (the negative lookahead would match the `api` prefix in `api-key`).
    "/((?!api/|admin/|_next/static|_next/image|favicon.ico|robots.txt|llms.txt).*)",
    // OBS-4: API-key credentials are normally handled by Payload's auth
    // strategies, but obviously malformed `users API-Key` credentials are
    // rejected here before they can trigger HMAC + DB lookup work.
    "/api/:path*",
    // audit-p1 #5 (T4): opt the anti-flood public surfaces back IN to
    // middleware so the rate-limit gate runs on them. Trailing-slash variants
    // are explicit so the matcher itself doesn't depend on Next.js' implicit
    // trailing-slash handling (which differs between dev / prod / nginx).
    "/api/forms",
    "/api/forms/",
    "/api/contact",
    "/api/contact/",
    "/api/intake",
    "/api/intake/",
    "/api/users/forgot-password",
    "/api/users/forgot-password/",
  ]
}
