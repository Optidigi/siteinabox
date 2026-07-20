import { cast } from "../_helpers/cast"
import { describe, it, expect } from "vitest"
import { validateNextRedirect } from "@/lib/auth/validateNextRedirect"

// Audit finding #9 (P2, T5) — Login post-auth open redirect via unvalidated `?next=`.
//
// Today, `src/components/forms/LoginForm.tsx:38-39` reads
//   const next = params.get("next") || "/"
//   router.replace(next)
// with no validation. Phisher mails a victim a login URL with a hostile
// `next` value; after legitimate sign-in the browser navigates to the
// attacker's origin (or to an attacker-rendered internal route) and lays
// a phishing UI on the trusted post-auth flow.
//
// Fix shape (per audit's literal Suggested fix and the dispatch §Sub-fix A):
//   Validate `next` against a guard before passing it to `router.replace`.
//   The guard admits a value iff:
//     - it is a string AND non-empty
//     - startsWith("/") (relative URL)
//     - does NOT startsWith("//") (rejects protocol-relative // ...)
//     - does NOT contain backslash (\\) — defense-in-depth against
//       browsers that treat \\ as / in URL parsing
//   Any other value falls back to "/".
//
// Mechanism: extract a pure function `validateNextRedirect(next: unknown): string`
// in `src/lib/auth/validateNextRedirect.ts`, called from LoginForm. Pure-function
// shape lets unit tests cover all 5 dispatch TDD cases plus extra defense-in-depth
// hypotheses (URL-encoded //, control characters, type confusion) without rendering
// the form.

describe("audit-p2 #9 — validateNextRedirect", () => {
  // -------------------------------------------------------------------------
  // 5 dispatch TDD cases (literal map from FIX-DISPATCH §Sub-fix A)
  // -------------------------------------------------------------------------

  it("Case 1 — empty next falls back to '/'", () => {
    expect(validateNextRedirect("")).toBe("/")
  })

  it("Case 2 — next='/sites/abc/pages' is permitted (relative, single leading slash)", () => {
    expect(validateNextRedirect("/sites/abc/pages")).toBe("/sites/abc/pages")
  })

  it("Case 3 — next='https://evil.example/phish' is rejected; falls back to '/'", () => {
    expect(validateNextRedirect("https://evil.example/phish")).toBe("/")
  })

  it("Case 4 — next='//evil.example/phish' (protocol-relative) is rejected; falls back to '/'", () => {
    // Without the !startsWith("//") guard, browsers interpret //host/path as
    // cross-origin (same scheme as current page). This is the highest-risk
    // shape the validator must reject.
    expect(validateNextRedirect("//evil.example/phish")).toBe("/")
  })

  it("Case 5 — next='javascript:alert(1)' is rejected; falls back to '/'", () => {
    // Defense-in-depth: javascript: doesn't startsWith("/") so the primary
    // guard already rejects, but this test pins the behavior explicitly so a
    // future refactor can't accidentally relax to e.g. URL-parsing-based check.
    expect(validateNextRedirect("javascript:alert(1)")).toBe("/")
  })

  // -------------------------------------------------------------------------
  // Defense-in-depth — type confusion
  // The Next.js useSearchParams `.get(key)` returns string | null. But hand-
  // crafted callers (or future refactors) might pass undefined / arrays /
  // objects. Each must collapse to "/" without throwing.
  // -------------------------------------------------------------------------

  it("Case 6 — null falls back to '/'", () => {
    expect(validateNextRedirect(null)).toBe("/")
  })

  it("Case 7 — undefined falls back to '/'", () => {
    expect(validateNextRedirect(undefined)).toBe("/")
  })

  it("Case 8 — non-string types (number, boolean, object, array) fall back to '/'", () => {
    expect(validateNextRedirect(42 as unknown as string)).toBe("/")
    expect(validateNextRedirect(true as unknown as string)).toBe("/")
    expect(validateNextRedirect({})).toBe("/")
    expect(validateNextRedirect(cast<unknown>([]))).toBe("/")
    expect(validateNextRedirect(cast<unknown>(["/legit"]))).toBe("/")
  })

  // -------------------------------------------------------------------------
  // Defense-in-depth — URL-encoding bypass
  // %2F is the percent-encoded '/'. A naive validator that decodes BEFORE
  // checking startsWith would be bypassable; one that checks the raw string
  // is not. The browser may or may not decode before navigating; the
  // conservative posture is "if the raw string doesn't startsWith('/'),
  // reject" — i.e. %2F%2Fevil.example must reject.
  // -------------------------------------------------------------------------

  it("Case 9 — '%2F%2Fevil.example/phish' (encoded //) rejects (raw string doesn't startsWith '/')", () => {
    expect(validateNextRedirect("%2F%2Fevil.example/phish")).toBe("/")
  })

  // -------------------------------------------------------------------------
  // Defense-in-depth — backslash variant
  // Some browsers (notably older IE/Edge variants and some URL parsers)
  // normalise `\` to `/` during URL parsing, so `/\evil.example` could be
  // interpreted as `//evil.example` — protocol-relative. The audit's text
  // names this defense-in-depth; reject any backslash in the path.
  // -------------------------------------------------------------------------

  it("Case 10 — '/\\\\evil.example' (leading slash + backslashes) rejects", () => {
    expect(validateNextRedirect("/\\evil.example")).toBe("/")
    expect(validateNextRedirect("/\\\\evil.example/phish")).toBe("/")
  })

  // -------------------------------------------------------------------------
  // Defense-in-depth — whitespace / control characters
  // A leading whitespace + // could pass a naive `trimmed.startsWith("//")`
  // check. We don't trim — we check the raw string. Verify both that a
  // leading space is rejected (not a `/`) and that an embedded control
  // character (e.g. \x00, \r, \n) is rejected.
  // -------------------------------------------------------------------------

  it("Case 11 — leading whitespace before // rejects", () => {
    expect(validateNextRedirect(" //evil.example/phish")).toBe("/")
    expect(validateNextRedirect("\t//evil.example/phish")).toBe("/")
  })

  it("Case 12 — embedded control characters (CR/LF/NUL) reject", () => {
    expect(validateNextRedirect("/legit\r\n//evil.example")).toBe("/")
    expect(validateNextRedirect("/legit\x00")).toBe("/")
    expect(validateNextRedirect("/legit\n")).toBe("/")
  })

  // -------------------------------------------------------------------------
  // Re-arm guards — the fix MUST NOT regress the legitimate post-auth flow
  // for the deep-link cases the admin actually uses.
  // -------------------------------------------------------------------------

  it("Re-arm 1 — '/' (root) is permitted (admin home)", () => {
    expect(validateNextRedirect("/")).toBe("/")
  })

  it("Re-arm 2 — '/sites' (top-level admin route) is permitted", () => {
    expect(validateNextRedirect("/sites")).toBe("/sites")
  })

  it("Re-arm 3 — query string and fragment preserved on a relative path", () => {
    // Query strings and fragments are part of the user's intended deep link
    // (e.g. tab state). They must pass through untouched.
    expect(validateNextRedirect("/sites/abc/pages?status=draft")).toBe("/sites/abc/pages?status=draft")
    expect(validateNextRedirect("/dashboard#tab=activity")).toBe("/dashboard#tab=activity")
  })
})
