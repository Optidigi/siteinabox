import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest"
import { NextRequest } from "next/server"
import { proxy as middleware, __resetRateLimitersForTests } from "@/proxy"
import { Forms } from "@/collections/Forms"
import { Users } from "@/collections/Users"
import { isSuperAdminField } from "@/access/isSuperAdmin"
import {
  __resetForgotPasswordLimiterForTests,
  rateLimitForgotPasswordByTargetEmail,
} from "@/hooks/rateLimitForgotPassword"

// Audit finding #5 (P1, T4) — Public form-submit/contact + forgot-password
// unrate-limited; Forms.data has no size cap. This batch lands BOTH sub-
// fixes (audit's suggested-fix items 1 + 2; item 3 hCaptcha is deferred
// per the audit's own deferral note).
//
// Sub-fix 1 — middleware rate-limit:
//   • Limit: 10 requests / 60 seconds, keyed per (path, IP).
//   • Anonymous detection (per dispatch Constraint 1, approach (b)): a
//     caller is "anonymous" iff BOTH `Authorization` header is absent
//     AND the `payload-token` cookie is absent. Authed super-admin
//     callers (API-key client requests) bypass.
//   • Path scope: `/api/forms`, `/api/contact`, `/api/intake`, and
//     `/api/users/forgot-password`. POST method only. The audit's
//     `/api/users` bootstrap path is INTENTIONALLY out of scope (T2 is
//     closed by P1 #6's BOOTSTRAP_TOKEN gate; rate-limiting that path
//     would interfere with the seed runbook).
//   • Identifier extraction: leftmost IP from `X-Forwarded-For` (the
//     VPS sits behind Traefik which sets this header per
//     RFC 7239); fallback `"unknown"` when absent. Documented choice;
//     spoofing is out-of-scope per THREAT-MODEL §5 (DoS at network
//     layer / above-app DoS).
//   • Response shape: HTTP 429 with `Retry-After` header (seconds) and
//     a small JSON body for clarity. Matches Payload-conventional 4xx
//     JSON error shape.
//   • Composes with audit-p1 #4 security headers (CSP / HSTS / XFO /
//     nosniff): the rate-limit branch passes through to the existing
//     `NextResponse.next()` + header-stamping path on permit; on
//     reject the 429 response also gets the security headers stamped
//     so a clickjacking iframe of the 429 page is also blocked.
//
// Sub-fix 2 — Forms.data 32 KB cap:
//   • beforeValidate field hook on `data` rejects when
//     `JSON.stringify(value).length > 32_768`. Inclusive boundary —
//     exactly 32 KB is permitted. Documented choice per the audit's
//     ~32 KB suggestion (the closest power-of-two-ish value with
//     comfortable headroom for typical contact-form payloads).
//
// Test-case map (16 cases — 11 from dispatch §Step 3.2 plus 5 re-arm guards):
//
//   1.  rate-limit /api/forms anon: 10 ok → 11th 429+Retry-After
//   2.  rate-limit /api/users/forgot-password anon: 10 ok → 11th 429
//   3.  per-IP isolation: two IPs each get independent 10/min budgets
//   4.  super-admin authed bypass (apiKey via Authorization header): 100x permitted
//   5.  path normalization: `/api/forms` and `/api/forms/` share one budget
//   6.  window reset: after duration elapses, request 11 succeeds
//   7.  out-of-scope routes (POST /api/users, /api/tenants) NOT rate-limited
//   8.  security-headers preserved on the rate-limit-allowed 200
//   9.  Forms.data ≤ 32 KB → beforeValidate permits
//  10.  Forms.data > 32 KB → beforeValidate rejects (validation error)
//  11.  Forms.data exactly at 32 KB → permitted (inclusive boundary)
//
//  R1.  AMD-1 owner-invite: role/tenants field-access for owner→editor in own tenant unchanged
//  R2.  AMD-2 apiKey field-level access: apiKey/enableAPIKey/apiKeyIndex still isSuperAdminField
//  R3.  AMD-3 honest-rejection hook: `Users.hooks.beforeOperation` still has the hook
//  R4.  super-admin authed forgot-password not rate-limited (= TDD #4; explicit cross-ref label)
//  R5.  P1 #6 bootstrap: anonymous POST /api/users with valid BOOTSTRAP_TOKEN succeeds AND is not
//       rate-limited (out-of-scope of finding #5)

// -----------------------------------------------------------------------------
// Request factory + helpers
// -----------------------------------------------------------------------------

type ReqOpts = {
  path: string
  method?: string
  ip?: string
  authorization?: string
  cookie?: string
  body?: BodyInit
  contentType?: string
  host?: string
}

const reqAt = (opts: ReqOpts) => {
  const headers: Record<string, string> = {
    host: opts.host ?? "admin.siteinabox.nl",
  }
  if (opts.ip) headers["x-forwarded-for"] = opts.ip
  if (opts.authorization) headers["authorization"] = opts.authorization
  if (opts.cookie) headers["cookie"] = opts.cookie
  if (opts.contentType) headers["content-type"] = opts.contentType
  return new NextRequest(`https://${opts.host ?? "admin.siteinabox.nl"}${opts.path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body,
  })
}

const formPostAt = (opts: Omit<ReqOpts, "body" | "contentType" | "method"> & {
  tenant?: string
  formName?: string
}) => {
  const body = new URLSearchParams()
  if (opts.tenant !== undefined) body.set("tenant", opts.tenant)
  body.set("formName", opts.formName ?? "contact")
  return reqAt({
    ...opts,
    method: "POST",
    body,
    contentType: "application/x-www-form-urlencoded",
  })
}

const expectAllowed = (res: Response, label: string) => {
  expect(res.status, `${label}: expected non-429, got ${res.status}`).not.toBe(429)
}

const expectBlocked = (res: Response, label: string) => {
  expect(res.status, `${label}: expected 429, got ${res.status}`).toBe(429)
  const ra = res.headers.get("retry-after")
  expect(ra, `${label}: missing Retry-After header on 429`).toBeTruthy()
  // Retry-After expressed as integer seconds (RFC 7231 §7.1.3 form 1).
  expect(Number.parseInt(ra ?? "", 10), `${label}: Retry-After not an integer`).toBeGreaterThanOrEqual(0)
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPER_ADMIN_DOMAIN", "siteinabox.nl")
  __resetRateLimitersForTests()
  __resetForgotPasswordLimiterForTests()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// -----------------------------------------------------------------------------
// Sub-fix 1 — middleware rate-limit
// -----------------------------------------------------------------------------

describe("audit-p1 #5 sub-fix 1 — anonymous POST rate-limit (T4)", () => {
  it("Case 1: /api/forms anon — 10 permitted, 11th returns 429 + Retry-After", async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.10" }))
      expectAllowed(res, `req #${i}`)
    }
    const res = await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.10" }))
    expectBlocked(res, "req #11")
  })

  it("Case 2: /api/users/forgot-password anon — 10 permitted, 11th returns 429 + Retry-After", async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await middleware(reqAt({ path: "/api/users/forgot-password", ip: "203.0.113.20" }))
      expect(res.status, `req #${i}: expected the configured admin host to pass through`).toBe(200)
    }
    const res = await middleware(reqAt({ path: "/api/users/forgot-password", ip: "203.0.113.20" }))
    expectBlocked(res, "req #11")
  })

  it("Case 2b: /api/contact anon — 10 permitted, 11th returns 429 + Retry-After", async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await middleware(reqAt({ path: "/api/contact", ip: "203.0.113.22" }))
      expectAllowed(res, `req #${i}`)
    }
    const res = await middleware(reqAt({ path: "/api/contact", ip: "203.0.113.22" }))
    expectBlocked(res, "req #11")
  })

  it("Case 3: per-IP isolation — two anonymous IPs each get an independent 10/min budget on /api/forms", async () => {
    // Burn IP A's budget completely.
    for (let i = 0; i < 10; i++) {
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.30" }))
    }
    expectBlocked(
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.30" })),
      "A #11 (burned)"
    )

    // IP B unaffected — still has full 10-point budget.
    for (let i = 1; i <= 10; i++) {
      const res = await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.31" }))
      expectAllowed(res, `B #${i}`)
    }
    expectBlocked(
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.31" })),
      "B #11"
    )
  })

  it("Case 4 / R4: super-admin authed (Authorization: users API-Key …) is exempt — 100 POSTs to /api/users/forgot-password all permitted", async () => {
    // Authorization header alone is sufficient to flip out of the
    // anonymous-only branch (per dispatch Constraint 1 approach (b)).
    // This is the machine-client invariant: owner-invite tenant provisioning
    // can call /api/users/forgot-password from a single IP in a burst.
    for (let i = 1; i <= 100; i++) {
      const res = await middleware(
        reqAt({
          path: "/api/users/forgot-password",
          ip: "203.0.113.40",
          authorization: "users API-Key sa-token-pretend",
        })
      )
      expectAllowed(res, `authed sa #${i}`)
    }
  })

  it("Case 4b: payload-token session cookie also bypasses the limiter (the in-app reset-password UI shape)", async () => {
    // Defense-in-depth: a logged-in user clicking "reset password" while
    // already authed shouldn't be rate-limited as if anonymous. Since the
    // anonymous-only check is `no Authorization header AND no payload-token
    // cookie`, presence of either bypasses.
    for (let i = 1; i <= 50; i++) {
      const res = await middleware(
        reqAt({
          path: "/api/users/forgot-password",
          ip: "203.0.113.41",
          cookie: "payload-token=opaque-jwt; other=ignored",
        })
      )
      expectAllowed(res, `cookie-authed #${i}`)
    }
  })

  it("Case 5: path normalization — /api/forms and /api/forms/ (trailing slash) share one rate-limit budget", async () => {
    // Anti-bypass: an attacker who tries `/api/forms/` to dodge the limiter
    // must hit the same key as `/api/forms`. 5 calls on each path = 10 total
    // → 11th call on EITHER path should 429.
    for (let i = 0; i < 5; i++) {
      expectAllowed(
        await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.50" })),
        `slash-no #${i}`
      )
    }
    for (let i = 0; i < 5; i++) {
      expectAllowed(
        await middleware(reqAt({ path: "/api/forms/", ip: "203.0.113.50" })),
        `slash-yes #${i}`
      )
    }
    expectBlocked(
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.50" })),
      "slash-no #11"
    )
    // And from the other variant — same key, still blocked.
    expectBlocked(
      await middleware(reqAt({ path: "/api/forms/", ip: "203.0.113.50" })),
      "slash-yes #11 (same budget)"
    )
  })

  it("Case 6: window reset — after the limit window elapses, the budget refreshes and a fresh request is permitted", async () => {
    // Exhaust the budget at t=0.
    for (let i = 0; i < 10; i++) {
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.60" }))
    }
    expectBlocked(
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.60" })),
      "pre-window-reset #11"
    )

    // Advance system time past the 60-second window. rate-limiter-flexible's
    // RateLimiterMemory consults Date.now() on every consume call (per the
    // library's MemoryStorage implementation), so setSystemTime moves the
    // expiry forward without depending on setTimeout callbacks firing.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(Date.now() + 61_000)
      const res = await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.60" }))
      expectAllowed(res, "post-window-reset #12")
    } finally {
      vi.useRealTimers()
    }
  })

  it("Case 7: out-of-scope routes — anonymous POST /api/users (bootstrap) and /api/tenants are NOT rate-limited (50× burst all permitted)", async () => {
    // Even hammered at >10/min, /api/users and /api/tenants must not 429:
    //   - /api/users is the AMD-1 owner-invite + P1 #6 bootstrap surface,
    //     each gated by their own access functions; rate-limiting it would
    //     regress the bootstrap runbook (one IP, possibly retried curl).
    //   - /api/tenants is super-admin-only; not in finding #5 scope.
    for (let i = 1; i <= 50; i++) {
      expectAllowed(
        await middleware(reqAt({ path: "/api/users", ip: "203.0.113.70" })),
        `users #${i}`
      )
      expectAllowed(
        await middleware(reqAt({ path: "/api/tenants", ip: "203.0.113.70" })),
        `tenants #${i}`
      )
    }
  })

  it("Case 7b: GET requests to the rate-limited paths are NOT counted (only POST is the audit's flood vector)", async () => {
    // The Forms `create: () => true` admit is on POST. GETs to /api/forms
    // (e.g. authed editor reading submissions list) should not consume the
    // anti-flood budget. Same for forgot-password reset-form GETs.
    for (let i = 1; i <= 30; i++) {
      expectAllowed(
        await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.71", method: "GET" })),
        `forms GET #${i}`
      )
      expectAllowed(
        await middleware(reqAt({ path: "/api/users/forgot-password", ip: "203.0.113.71", method: "GET" })),
        `forgot GET #${i}`
      )
    }
  })

  it("Case 8: security-headers preserved on rate-limit-allowed 200 responses (re-arm guard for P1 #4)", async () => {
    // The audit-p1 #4 contract: every middleware-matched response stamps
    // CSP / HSTS / XFO DENY / nosniff. Rate-limit must compose with — not
    // replace — that path.
    const res = await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.80" }))
    expectAllowed(res, "permit")
    expect(res.headers.get("content-security-policy"), "CSP missing").toMatch(
      /frame-ancestors\s+'none'/
    )
    expect(res.headers.get("strict-transport-security"), "HSTS missing").toBeTruthy()
    expect(res.headers.get("x-frame-options"), "XFO missing").toBe("DENY")
    expect(res.headers.get("x-content-type-options"), "nosniff missing").toBe("nosniff")
  })

  it("Case 8b: security-headers preserved on rate-limit-blocked 429 responses (defence-in-depth)", async () => {
    // A 429 page also gets stamped — clickjacking the 429 wouldn't itself
    // be useful, but consistency with the audit's "every middleware-matched
    // response" rule prevents accidental drift later.
    for (let i = 0; i < 10; i++) {
      await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.81" }))
    }
    const res = await middleware(reqAt({ path: "/api/forms", ip: "203.0.113.81" }))
    expectBlocked(res, "trigger 429")
    expect(res.headers.get("content-security-policy"), "CSP missing on 429").toMatch(
      /frame-ancestors\s+'none'/
    )
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("x-frame-options")).toBe("DENY")
  })

  it("non-rate-limited paths still get security-headers stamped (regression guard on the matcher composition)", async () => {
    // E.g. /sites/foo/users — the audit-p1 #4 strict path. Adding the rate-
    // limit branch must not skip the headers-stamping for paths that aren't
    // in the rate-limit scope.
    const res = await middleware(reqAt({ path: "/sites/foo/users", method: "GET" }))
    expectAllowed(res, "non-limited path")
    expect(res.headers.get("content-security-policy")).toMatch(/frame-ancestors\s+'none'/)
    expect(res.headers.get("x-frame-options")).toBe("DENY")
  })

  it("OBS-4: malformed users API-Key is rejected before Payload auth strategies run", async () => {
    const res = await middleware(reqAt({
      path: "/api/pages",
      authorization: "users API-Key short",
    }))
    expect(res.status).toBe(401)
    expect(res.headers.get("content-security-policy")).toMatch(/frame-ancestors\s+'none'/)
  })

  it("OBS-4: syntactically plausible users API-Key still reaches Payload auth", async () => {
    const res = await middleware(reqAt({
      path: "/api/pages",
      authorization: `users API-Key ${"a".repeat(32)}`,
    }))
    expect(res.status).not.toBe(401)
  })

  it("generated-site forms: rotating IPs still share a tenant/form target budget", async () => {
    for (let i = 1; i <= 50; i++) {
      const res = await middleware(formPostAt({
        path: "/api/forms",
        ip: `198.51.100.${i}`,
        tenant: "tenant-a",
        formName: "contact",
      }))
      expectAllowed(res, `target req #${i}`)
    }

    const res = await middleware(formPostAt({
      path: "/api/forms",
      ip: "198.51.100.251",
      tenant: "tenant-a",
      formName: "contact",
    }))
    expectBlocked(res, "target req #51")
  })

  it("generated-site forms: tenant/form target budgets are isolated", async () => {
    for (let i = 1; i <= 50; i++) {
      await middleware(formPostAt({
        path: "/api/forms",
        ip: `198.51.101.${i}`,
        tenant: "tenant-a",
        formName: "contact",
      }))
    }

    expectBlocked(
      await middleware(formPostAt({
        path: "/api/forms",
        ip: "198.51.101.251",
        tenant: "tenant-a",
        formName: "contact",
      })),
      "same tenant/form"
    )
    expectAllowed(
      await middleware(formPostAt({
        path: "/api/forms",
        ip: "198.51.101.252",
        tenant: "tenant-b",
        formName: "contact",
      })),
      "different tenant"
    )
    expectAllowed(
      await middleware(formPostAt({
        path: "/api/forms",
        ip: "198.51.101.253",
        tenant: "tenant-a",
        formName: "newsletter",
      })),
      "different form"
    )
  })

  it("generated-site forms: host-derived tenant target works when the form body omits tenant", async () => {
    for (let i = 1; i <= 50; i++) {
      await middleware(formPostAt({
        path: "/api/forms",
        ip: `198.51.102.${i}`,
        host: "client-one.example",
        formName: "contact",
      }))
    }

    expectBlocked(
      await middleware(formPostAt({
        path: "/api/forms",
        ip: "198.51.102.251",
        host: "client-one.example",
        formName: "contact",
      })),
      "same host/form"
    )
    expectAllowed(
      await middleware(formPostAt({
        path: "/api/forms",
        ip: "198.51.102.252",
        host: "client-two.example",
        formName: "contact",
      })),
      "different host"
    )
  })

  it("generated-site forms: target budget is env-configurable", async () => {
    const originalPoints = process.env.SIAB_FORM_TARGET_RATE_LIMIT_POINTS
    const originalWindow = process.env.SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS
    process.env.SIAB_FORM_TARGET_RATE_LIMIT_POINTS = "2"
    process.env.SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS = "120"
    __resetRateLimitersForTests()

    try {
      expectAllowed(
        await middleware(formPostAt({
          path: "/api/forms",
          ip: "198.51.103.1",
          tenant: "tenant-env",
          formName: "contact",
        })),
        "env target #1"
      )
      expectAllowed(
        await middleware(formPostAt({
          path: "/api/forms",
          ip: "198.51.103.2",
          tenant: "tenant-env",
          formName: "contact",
        })),
        "env target #2"
      )
      expectBlocked(
        await middleware(formPostAt({
          path: "/api/forms",
          ip: "198.51.103.3",
          tenant: "tenant-env",
          formName: "contact",
        })),
        "env target #3"
      )
    } finally {
      if (originalPoints === undefined) delete process.env.SIAB_FORM_TARGET_RATE_LIMIT_POINTS
      else process.env.SIAB_FORM_TARGET_RATE_LIMIT_POINTS = originalPoints
      if (originalWindow === undefined) delete process.env.SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS
      else process.env.SIAB_FORM_TARGET_RATE_LIMIT_WINDOW_SECONDS = originalWindow
      __resetRateLimitersForTests()
    }
  })

  it("generated-site forms: authenticated callers bypass both public form limiters", async () => {
    for (let i = 1; i <= 60; i++) {
      const res = await middleware(formPostAt({
        path: "/api/forms",
        ip: "203.0.113.42",
        tenant: "tenant-a",
        formName: "contact",
        cookie: "payload-token=opaque-jwt",
      }))
      expectAllowed(res, `authed form #${i}`)
    }
  })
})

// -----------------------------------------------------------------------------
// Sub-fix 2 — Forms.data 32 KB cap (beforeValidate field hook)
// -----------------------------------------------------------------------------

const dataField = (Forms.fields as any[]).find((f) => f.name === "data")
const dataValidate = dataField?.validate as
  | ((value: unknown, ctx: any) => true | string | Promise<true | string>)
  | undefined

const validateData = async (value: unknown) => {
  expect(dataValidate, "Forms.data field must declare a `validate` function (audit-p1 #5 sub-fix 2)").toBeTypeOf("function")
  return await dataValidate!(value, { req: { user: null } as any, siblingData: {}, operation: "create" })
}

describe("audit-p1 #5 sub-fix 2 — Forms.data 32 KB size cap (T4 payload-DoS sibling)", () => {
  it("Case 9: data ≤ 32 KB permitted (typical contact-form payload)", async () => {
    const small = { name: "Alice", email: "a@x", message: "hi", extra: "x".repeat(1000) }
    expect(await validateData(small)).toBe(true)
  })

  it("Case 10: data > 32 KB rejected (returns a non-true validation error string)", async () => {
    // 33 KB string in a field — JSON.stringify({field: '<33KB>'}).length > 32 KB.
    const big = { blob: "x".repeat(33 * 1024) }
    const result = await validateData(big)
    expect(result, "expected a string error, got").not.toBe(true)
    expect(typeof result, "Payload validate functions reject by returning a string").toBe("string")
  })

  it("Case 11: data exactly at 32 KB boundary permitted (inclusive boundary; documented choice)", async () => {
    // Build a payload whose JSON.stringify produces exactly 32_768 chars.
    // The wrapper is `{"v":"…"}` = 8 chars overhead; pad to 32_768 - 8 = 32_760.
    const padLen = 32_768 - JSON.stringify({ v: "" }).length
    const exact = { v: "x".repeat(padLen) }
    expect(JSON.stringify(exact).length, "test-setup sanity check").toBe(32_768)
    expect(await validateData(exact)).toBe(true)
  })

  it("null / undefined data is treated as empty object (does not throw)", async () => {
    // Defensive: Payload may invoke validate with value=undefined on partial
    // updates of the parent doc. The hook must not blow up on that — empty
    // serializes to `{}` (2 chars), which is well under 32 KB.
    expect(await validateData(undefined as any)).toBe(true)
    expect(await validateData(null as any)).toBe(true)
    expect(await validateData({})).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// Re-arm guards
// -----------------------------------------------------------------------------

describe("audit-p1 #5 — re-arm guards (AMD-1 / AMD-2 / AMD-3 / P0 #1-#3 / P1 #6 / P1 #4 must remain closed)", () => {
  const orig = process.env.BOOTSTRAP_TOKEN
  afterEach(() => {
    if (orig === undefined) delete process.env.BOOTSTRAP_TOKEN
    else process.env.BOOTSTRAP_TOKEN = orig
  })

  const fields = Users.fields as any[]
  const roleField = fields.find((f) => f.name === "role")
  const tenantsField = fields.find((f) => f.name === "tenants")
  const apiKeyField = fields.find((f) => f.name === "apiKey")
  const enableAPIKeyField = fields.find((f) => f.name === "enableAPIKey")
  const apiKeyIndexField = fields.find((f) => f.name === "apiKeyIndex")

  it("R1 (AMD-1): owner can still invite editor/viewer into own tenant — role.access.create + tenants.access.create unchanged", () => {
    const ownerArgs = {
      req: { user: { id: "o1", role: "owner", tenants: [{ tenant: 42 }] }, headers: { get: () => null } },
      data: { email: "n@x", role: "editor", tenants: [{ tenant: 42 }] },
      siblingData: {},
    }
    expect(roleField.access.create(ownerArgs)).toBe(true)
    expect(tenantsField.access.create(ownerArgs)).toBe(true)

    const viewerArgs = {
      req: { user: { id: "o1", role: "owner", tenants: [{ tenant: 42 }] }, headers: { get: () => null } },
      data: { email: "n@x", role: "viewer", tenants: [{ tenant: 42 }] },
      siblingData: {},
    }
    expect(roleField.access.create(viewerArgs)).toBe(true)
    expect(tenantsField.access.create(viewerArgs)).toBe(true)
  })

  it("R2 (AMD-2): apiKey / enableAPIKey / apiKeyIndex still locked to isSuperAdminField on BOTH create and update", () => {
    for (const [label, f] of [
      ["apiKey", apiKeyField],
      ["enableAPIKey", enableAPIKeyField],
      ["apiKeyIndex", apiKeyIndexField],
    ] as const) {
      // The reference comparison is the strongest assertion: the field
      // really uses isSuperAdminField, not some replacement function with
      // the same arity that quietly relaxes the gate.
      expect(f.access.create, `${label}.access.create must be isSuperAdminField`).toBe(isSuperAdminField)
      expect(f.access.update, `${label}.access.update must be isSuperAdminField`).toBe(isSuperAdminField)
    }
  })

  it("R3 (AMD-3): Users.hooks.beforeOperation still has the apiKey honest-rejection hook (regression guard)", () => {
    const hooks = (Users.hooks?.beforeOperation ?? []) as Array<unknown>
    expect(hooks.length, "AMD-3 hook missing").toBeGreaterThanOrEqual(1)
    expect(typeof hooks[0]).toBe("function")
  })

  it("R5 (P1 #6): anonymous POST /api/users with valid BOOTSTRAP_TOKEN is NOT rate-limited (out-of-scope of finding #5)", async () => {
    // The bootstrap path is hit by curl in the deploy runbook. Even if the
    // operator retries on a transient error, the rate-limiter must not block
    // them. /api/users is also already covered by Case 7 above (50× POST to
    // anonymous /api/users does not 429); this case repeats the assertion
    // with the BOOTSTRAP_TOKEN header to make the seed-runbook shape explicit.
    for (let i = 1; i <= 30; i++) {
      const res = await middleware(
        new NextRequest("https://admin.example.com/api/users", {
          method: "POST",
          headers: {
            host: "admin.example.com",
            "x-bootstrap-token": "secret-1234",
            "x-forwarded-for": "203.0.113.90",
          },
        })
      )
      expectAllowed(res, `bootstrap #${i}`)
    }
  })

  it("R-P14 (audit-p1 #4): non-rate-limited matched paths still stamp full security-header set (CSP, HSTS, XFO, nosniff, Referrer-Policy)", async () => {
    const res = await middleware(reqAt({ path: "/sites/foo/users", method: "GET" }))
    expect(res.headers.get("content-security-policy")).toMatch(/frame-ancestors\s+'none'/)
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=\d{8,}/)
    expect(res.headers.get("x-frame-options")).toBe("DENY")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(res.headers.get("referrer-policy")).toBeTruthy()
  })
})

// -----------------------------------------------------------------------------
// Sub-fix 1 layer-2 — collection-level bogus-auth rejection
// -----------------------------------------------------------------------------
//
// Adversarial review of fix batch 6 Pass 1 (audits/07-fix-batch-6-adversarial-
// review.md) confirmed that the middleware's `isAnonymousCaller` is presence-
// only — an attacker presenting `Authorization: x` or `Cookie: payload-token=
// garbage` bypasses the limiter. Closure shape (without breaking the AMD-1
// machine-client invariant): at the Payload collection level,
// where Payload's auth strategies have populated `req.user` (or set null on
// failure), reject any caller whose request PRESENTS auth signals BUT whose
// auth FAILED. Real anonymous (no signals) and real authed (req.user set)
// flow through unchanged.
//
// L-Form-1..6: Forms.access.create gate
// L-Users-1..5: Users.hooks.beforeOperation forgotPassword bogus-auth gate

const formsCreateAccess = Forms.access?.create as (args: any) => boolean

const reqShape = (opts: {
  user?: any
  authorization?: string
  cookie?: string
}) => {
  const headers = new Map<string, string>()
  if (opts.authorization !== undefined) headers.set("authorization", opts.authorization)
  if (opts.cookie !== undefined) headers.set("cookie", opts.cookie)
  return {
    user: opts.user ?? null,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    t: (k: string) => k,
  }
}

describe("audit-p1 #5 sub-fix 1 layer-2 — Forms.access.create rejects bogus-auth attempts (closes middleware bypass)", () => {
  it("L-Form-1: anonymous (no req.user, no auth signals) → admit", () => {
    expect(formsCreateAccess({ req: reqShape({}) })).toBe(true)
  })

  it("L-Form-2: authed (req.user set, even with bogus headers) → admit (real auth wins)", () => {
    // A real authed user whose JWT validated to req.user is admitted regardless
    // of any other header noise — the gate is for closing the *bypass*, not
    // adding new restrictions on legitimate authed paths.
    expect(
      formsCreateAccess({
        req: reqShape({ user: { id: "u1", role: "editor" }, authorization: "users API-Key real" }),
      })
    ).toBe(true)
  })

  it("L-Form-3: bogus Authorization (req.user=null, Authorization='x') → REJECT (the reviewer's H1 attack closed)", () => {
    expect(formsCreateAccess({ req: reqShape({ authorization: "x" }) })).toBe(false)
  })

  it("L-Form-4: bogus apiKey-shape Authorization (req.user=null, Authorization='users API-Key bogus') → REJECT", () => {
    // Same H1 attack with a more plausible-looking shape: still rejected
    // because Payload's apiKey strategy didn't validate it (req.user=null),
    // so the gate's bypass-attempt detection fires.
    expect(
      formsCreateAccess({ req: reqShape({ authorization: "users API-Key attacker-fake" }) })
    ).toBe(false)
  })

  it("L-Form-5: bogus payload-token cookie (req.user=null, Cookie='payload-token=garbage') → REJECT (the reviewer's H2 attack closed)", () => {
    expect(formsCreateAccess({ req: reqShape({ cookie: "payload-token=garbage" }) })).toBe(false)
  })

  it("L-Form-6: empty Authorization header value → admit (not a bypass attempt; matches middleware polarity)", () => {
    // The middleware's anonymous-detector treats Authorization='' as
    // anonymous (rate-limited). The gate must agree: empty is not a signal.
    expect(formsCreateAccess({ req: reqShape({ authorization: "" }) })).toBe(true)
  })

  it("L-Form-7: cookie present without payload-token (e.g. 'session=x') → admit (not the gated cookie name)", () => {
    expect(formsCreateAccess({ req: reqShape({ cookie: "session=irrelevant" }) })).toBe(true)
  })

  it("L-Form-8: cookie with empty payload-token value ('payload-token=;...') → admit (non-empty value is the signal)", () => {
    expect(formsCreateAccess({ req: reqShape({ cookie: "payload-token=; other=x" }) })).toBe(true)
  })
})

const usersBeforeOpHooks = (Users.hooks?.beforeOperation ?? []) as Array<(args: any) => any>
// The AMD-3 apiKey hook is at index 0 (registered first); the audit-p1 #5
// layer-2 forgot-password hook is at index 1 (registered second). The
// AMD-3 test asserts the index-0 invariant; we assert the index-1 hook's
// behaviour here, with a behavioral fallback in case the order ever drifts.
const findForgotPasswordHook = () => {
  for (const h of usersBeforeOpHooks) {
    let threw = false
    try {
      h({
        args: {},
        collection: {} as any,
        context: {},
        operation: "forgotPassword",
        overrideAccess: false,
        req: reqShape({ authorization: "x" }) as any,
      })
    } catch {
      threw = true
    }
    if (threw) return h
  }
  return undefined
}
const forgotPasswordHook = findForgotPasswordHook()

const callForgotHook = async (req: any, operation: "forgotPassword" | "create" | "update" = "forgotPassword") =>
  (forgotPasswordHook as any)?.({
    args: {},
    collection: {} as any,
    context: {},
    operation,
    overrideAccess: false,
    req,
  })

const expectForbiddenStatus = async (promise: Promise<any> | undefined) => {
  let err: any = null
  try {
    await promise
  } catch (e) {
    err = e
  }
  expect(err, "expected hook to throw Forbidden").not.toBeNull()
  expect(err?.status, "expected HTTP 403 Forbidden").toBe(403)
}

describe("audit-p1 #5 sub-fix 1 layer-2 — Users.hooks.beforeOperation forgot-password bogus-auth gate", () => {
  it("L-Users-S1: layer-2 hook is registered (Users.hooks.beforeOperation contains the forgot-password rejector)", () => {
    expect(forgotPasswordHook, "layer-2 hook missing on Users.hooks.beforeOperation").toBeTypeOf("function")
  })

  it("L-Users-1: forgotPassword + truly anonymous (no req.user, no auth signals) → does NOT throw (legitimate flow)", async () => {
    let threw = false
    try {
      await callForgotHook(reqShape({}))
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("L-Users-2: forgotPassword + authed super-admin (apiKey-validated, req.user set) -> does NOT throw (machine-client invariant)", async () => {
    let threw = false
    try {
      await callForgotHook(reqShape({ user: { id: "sa1", role: "super-admin" }, authorization: "users API-Key real" }))
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  it("L-Users-3: forgotPassword + bogus Authorization (req.user=null, Authorization='x') → throws Forbidden (H1 closure)", async () => {
    await expectForbiddenStatus(callForgotHook(reqShape({ authorization: "x" })))
  })

  it("L-Users-3b: forgotPassword + bogus apiKey-shape (Authorization='users API-Key bogus') → throws Forbidden", async () => {
    await expectForbiddenStatus(callForgotHook(reqShape({ authorization: "users API-Key attacker-fake" })))
  })

  it("L-Users-4: forgotPassword + bogus payload-token cookie (req.user=null) → throws Forbidden (H2 closure)", async () => {
    await expectForbiddenStatus(callForgotHook(reqShape({ cookie: "payload-token=garbage" })))
  })

  it("L-Users-5: non-forgotPassword operation (e.g. 'create') + bogus auth → does NOT throw (hook is operation-scoped)", async () => {
    // The layer-2 hook scopes to `operation === "forgotPassword"`. On other
    // operations it must be a no-op so it doesn't accidentally override
    // legitimate paths (e.g. AMD-1 owner-invite via the `inviteUser` action).
    let threw = false
    try {
      await callForgotHook(reqShape({ authorization: "x" }), "create")
    } catch {
      threw = true
    }
    expect(threw).toBe(false)

    let threwUpdate = false
    try {
      await callForgotHook(reqShape({ authorization: "x" }), "update")
    } catch {
      threwUpdate = true
    }
    // Note: the AMD-3 hook (index 0) DOES throw on update if `apiKey` is in
    // data — but the layer-2 hook (this one) should be a no-op on update
    // regardless of data. We're calling JUST the layer-2 hook directly here.
    expect(threwUpdate).toBe(false)
  })
})

describe("OBS-5 — forgot-password target-email limiter after Payload auth", () => {
  const callTargetLimiter = (email: string, user: any = { id: "editor1", role: "editor" }) =>
    rateLimitForgotPasswordByTargetEmail({
      args: { data: { email } },
      operation: "forgotPassword",
      req: reqShape({ user }),
    } as any)

  it("allows the first three reset attempts for the same target email", async () => {
    await expect(callTargetLimiter("Victim@Example.com")).resolves.toBeTruthy()
    await expect(callTargetLimiter(" victim@example.com ")).resolves.toBeTruthy()
    await expect(callTargetLimiter("victim@example.com")).resolves.toBeTruthy()
  })

  it("blocks the fourth reset attempt for the same target email, including authenticated callers", async () => {
    await callTargetLimiter("victim@example.com")
    await callTargetLimiter("victim@example.com")
    await callTargetLimiter("victim@example.com")

    let err: any = null
    try {
      await callTargetLimiter("victim@example.com")
    } catch (e) {
      err = e
    }

    expect(err, "expected target-email limiter to throw").not.toBeNull()
    expect(err.status).toBe(429)
    expect(err.data?.retryAfterSeconds).toBeGreaterThan(0)
  })

  it("keeps different target emails isolated so API-key invite bursts can continue", async () => {
    await callTargetLimiter("a@example.com", { id: "sa1", role: "super-admin" })
    await callTargetLimiter("a@example.com", { id: "sa1", role: "super-admin" })
    await callTargetLimiter("a@example.com", { id: "sa1", role: "super-admin" })

    await expect(
      callTargetLimiter("b@example.com", { id: "sa1", role: "super-admin" }),
    ).resolves.toBeTruthy()
  })

  it("is operation-scoped and ignores calls without a concrete target email", async () => {
    await expect(
      rateLimitForgotPasswordByTargetEmail({
        args: { data: { email: "victim@example.com" } },
        operation: "create",
        req: reqShape({ user: { id: "editor1", role: "editor" } }),
      } as any),
    ).resolves.toBeTruthy()

    await expect(
      rateLimitForgotPasswordByTargetEmail({
        args: { data: {} },
        operation: "forgotPassword",
        req: reqShape({ user: { id: "editor1", role: "editor" } }),
      } as any),
    ).resolves.toBeTruthy()
  })
})

afterAll(() => {
  __resetRateLimitersForTests()
  __resetForgotPasswordLimiterForTests()
})
