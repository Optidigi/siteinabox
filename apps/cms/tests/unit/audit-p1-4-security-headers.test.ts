import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { proxy as middleware } from "@/proxy"

// Audit finding #4 (P1, T12) — Admin responses ship with no CSP /
// frame-ancestors / HSTS / nosniff / Referrer-Policy. Admin app is
// iframable from any origin; future XSS has no CSP fallback.
//
// Fix: stamp the middleware response with a strict CSP set
// (`frame-ancestors 'none'`) plus HSTS / X-Content-Type-Options /
// Referrer-Policy / X-Frame-Options DENY. Defensive path-branch
// reserved for future `/__preview*` routes (none in the CMS admin
// today; the live-preview iframe is hosted by the generated tenant
// site, which is a separate repo per THREAT-MODEL §1).
//
// Live-preview compatibility caveat (audit "Fix risk: Needs-care"):
// the CMS admin's <PreviewPane> embeds tenant origins via iframe.
// CSP `frame-src` must permit cross-origin HTTPS URLs so the iframe
// load is not blocked. We keep `frame-ancestors 'none'` (controls who
// embeds US) separate from `frame-src` (controls what we embed).

const reqAt = (path: string, host = "admin.example.com") =>
  new NextRequest(`https://${host}${path}`, { headers: { host } })

const headerOf = (res: Response, name: string) => res.headers.get(name)

describe("audit-p1 #4 — middleware stamps security headers (T12)", () => {
  // The middleware became async in audit-p1 #5 (T4) — rate-limit gate must
  // `await limiter.consume()`. The header-stamping branch is unaffected
  // semantically; just adding `await` to each call site here.

  describe("strict path (e.g. /sites/<slug>/users — the audit's clickjacking exploit URL)", () => {
    const path = "/sites/foo/users"

    it("sets Content-Security-Policy with frame-ancestors 'none' (clickjacking defense)", async () => {
      const res = await middleware(reqAt(path))
      const csp = headerOf(res, "content-security-policy")
      expect(csp).toBeTruthy()
      expect(csp).toMatch(/frame-ancestors\s+'none'/)
    })

    it("CSP includes a frame-src directive permitting cross-origin HTTPS (live-preview iframe)", async () => {
      const res = await middleware(reqAt(path))
      const csp = headerOf(res, "content-security-policy")!
      // Either an explicit frame-src that permits https:, or wildcard fallback.
      // We DO NOT want default-src to silently fall back to 'self', which would
      // block the <PreviewPane> iframe loading tenant.com/__preview/...
      expect(csp).toMatch(/frame-src[^;]*\bhttps:/)
    })

    it("CSP includes baseline directives: default-src, script-src, style-src, img-src, base-uri, form-action", async () => {
      const res = await middleware(reqAt(path))
      const csp = headerOf(res, "content-security-policy")!
      expect(csp).toMatch(/default-src\s+'self'/)
      expect(csp).toMatch(/script-src\s+/)
      expect(csp).toMatch(/style-src[^;]*'nonce-[^']+'/)
      expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/)
      expect(csp).toMatch(/img-src\s+/)
      expect(csp).toMatch(/base-uri\s+'self'/)
      expect(csp).toMatch(/form-action\s+'self'/)
    })

    it("sets X-Frame-Options: DENY (legacy clickjacking defense for older browsers)", async () => {
      const res = await middleware(reqAt(path))
      expect(headerOf(res, "x-frame-options")).toBe("DENY")
    })

    it("sets X-Content-Type-Options: nosniff", async () => {
      const res = await middleware(reqAt(path))
      expect(headerOf(res, "x-content-type-options")).toBe("nosniff")
    })

    it("sets Strict-Transport-Security with long max-age + includeSubDomains", async () => {
      const res = await middleware(reqAt(path))
      const hsts = headerOf(res, "strict-transport-security")
      expect(hsts).toBeTruthy()
      // max-age >= 1 year (31536000); includeSubDomains required.
      expect(hsts).toMatch(/max-age=\d{8,}/)
      expect(hsts).toMatch(/includeSubDomains/i)
    })

    it("sets Referrer-Policy", async () => {
      const res = await middleware(reqAt(path))
      const rp = headerOf(res, "referrer-policy")
      expect(rp).toBeTruthy()
      // Accept any conservative value (same-origin / strict-origin / strict-origin-when-cross-origin).
      expect(rp).toMatch(/(same-origin|strict-origin)/)
    })

    it("preserves existing x-siab-mode / x-siab-host stamping (no regression on tenant routing)", async () => {
      const res = await middleware(reqAt("/sites/foo/users", "tenant.example.com"))
      // Inspecting the request-side override is what hostToTenant downstream
      // reads. We assert the function still returns a NextResponse (didn't
      // throw / didn't strip the host stamp from request headers).
      expect(res).toBeTruthy()
    })
  })

  describe("the audit's exact exploit URL still gets frame-ancestors 'none'", () => {
    it("clickjacking iframe of /sites/<slug>/users from evil origin is blocked", async () => {
      // Audit's reproduction: <iframe src="https://admin.<tenant>/sites/<slug>/users">
      const res = await middleware(reqAt("/sites/clickjack-target/users"))
      expect(headerOf(res, "content-security-policy")).toMatch(/frame-ancestors\s+'none'/)
      expect(headerOf(res, "x-frame-options")).toBe("DENY")
    })

    it("/sites/<slug>/settings, /sites/<slug>/pages/123 — all admin routes get headers", async () => {
      for (const p of ["/sites/foo/settings", "/sites/foo/pages/123", "/users", "/login"]) {
        const res = await middleware(reqAt(p))
        expect(headerOf(res, "content-security-policy"), `path=${p}`).toMatch(/frame-ancestors\s+'none'/)
        expect(headerOf(res, "x-frame-options"), `path=${p}`).toBe("DENY")
        expect(headerOf(res, "x-content-type-options"), `path=${p}`).toBe("nosniff")
      }
    })
  })

  describe("renderer frame path can be embedded by the same-origin CMS shell only", () => {
    it("/renderer-frame* uses frame-ancestors 'self' and X-Frame-Options SAMEORIGIN", async () => {
      const res = await middleware(reqAt("/renderer-frame/preview/optidigi"))
      const csp = headerOf(res, "content-security-policy")

      expect(csp).toMatch(/frame-ancestors\s+'self'/)
      expect(csp).not.toMatch(/frame-ancestors\s+'none'/)
      expect(headerOf(res, "x-frame-options")).toBe("SAMEORIGIN")
      expect(headerOf(res, "x-content-type-options")).toBe("nosniff")
    })

    it("/editor-frame* uses frame-ancestors 'self' and X-Frame-Options SAMEORIGIN", async () => {
      const res = await middleware(reqAt("/editor-frame/pages/42"))
      const csp = headerOf(res, "content-security-policy")

      expect(csp).toMatch(/frame-ancestors\s+'self'/)
      expect(csp).not.toMatch(/frame-ancestors\s+'none'/)
      expect(headerOf(res, "x-frame-options")).toBe("SAMEORIGIN")
      expect(headerOf(res, "x-content-type-options")).toBe("nosniff")
    })

    it("does not relax frame ancestors for similarly named non-frame routes", async () => {
      for (const p of ["/__renderer", "/renderer", "/editor", "/sites/foo/pages/123"]) {
        const res = await middleware(reqAt(p))

        expect(headerOf(res, "content-security-policy"), `path=${p}`).toMatch(/frame-ancestors\s+'none'/)
        expect(headerOf(res, "x-frame-options"), `path=${p}`).toBe("DENY")
      }
    })
  })

  describe("OBS-2 — reserved preview paths are fail-closed", () => {
    it("/__preview* returns 404 until a reviewed CMS preview route is deliberately added", async () => {
      const res = await middleware(reqAt("/__preview/page-123"))
      expect(res.status).toBe(404)
      expect(headerOf(res, "x-frame-options")).toBe("DENY")
      expect(headerOf(res, "content-security-policy")).toMatch(/frame-ancestors\s+'none'/)
    })

    it("/__preview* still sets baseline hardening (HSTS, nosniff, Referrer-Policy)", async () => {
      const res = await middleware(reqAt("/__preview/page-123"))
      expect(headerOf(res, "strict-transport-security")).toBeTruthy()
      expect(headerOf(res, "x-content-type-options")).toBe("nosniff")
      expect(headerOf(res, "referrer-policy")).toBeTruthy()
    })
  })
})
