import "server-only"
import { getPayload } from "payload"
import config from "@/payload.config"

// Audit finding #11 (P2, T8) — find-then-create race resolution.
//
// Two-half fix paired with migration `20260509_site_settings_tenant_unique`
// (UNIQUE INDEX on site_settings.tenant_id). With the unique constraint,
// the loser of a concurrent first-load race no longer silently inserts a
// duplicate row — its `payload.create` rejects.
//
// Critical detail: `@payloadcms/drizzle@3.84.1` does NOT propagate the raw
// pg 23505 to application code. `handleUpsertError`
// (`node_modules/.pnpm/@payloadcms+drizzle@3.84.1.../upsertRow/handleUpsertError.js:6-62`)
// intercepts code 23505 (Postgres) / SQLITE_CONSTRAINT_UNIQUE (SQLite) and
// throws a Payload `ValidationError` with `data.errors[0].message ===
// "Value must be unique"` (the literal English fallback when `req?.t` is
// undefined; `getOrCreateSiteSettings` never passes a `req`). The wrapped
// error has no `.code` property — checking only `err.code === "23505"` would
// silently let the loser's request fail with HTTP 400 instead of returning
// the winner's row. This was caught by adversarial review of the first
// iteration of this fix and verified against the drizzle source.
//
// Three channels for defense-in-depth (any one matches → race detected):
//   1. Payload ValidationError shape (the real production path)
//   2. Raw pg `.code === "23505"` (defense for direct-driver paths or future
//      adapter changes)
//   3. Raw pg message regex (defense for adapters that strip `.code`)
const isUniqueViolation = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false
  const e = err as {
    code?: unknown
    message?: unknown
    data?: { errors?: Array<{ message?: unknown; path?: unknown }> }
  }
  // Channel 1 — Payload ValidationError thrown by drizzle's handleUpsertError.
  // Match by `path` first (language-invariant — survives any future i18n
  // fallback configured on payload.config.ts), then by the literal English
  // message as a belt-and-braces fallback. The English string is what
  // handleUpsertError.js:53 emits when no `req.t` translator is available;
  // adding `i18n.fallbackLanguage: "nl"` (or similar) to payload.config.ts
  // would translate it and silently degrade the literal comparison — the
  // path-based check keeps detection intact across that change. (OBS-13)
  const firstErr = e.data?.errors?.[0]
  if (firstErr?.path === "tenant") return true
  if (firstErr?.message === "Value must be unique") return true
  // Channel 2 — raw pg error code.
  if (e.code === "23505") return true
  // Channel 3 — raw pg message text fallback.
  if (typeof e.message === "string" && /duplicate key value violates unique constraint/i.test(e.message)) {
    return true
  }
  return false
}

export async function getOrCreateSiteSettings(
  tenantId: number | string,
  options: { payload?: Awaited<ReturnType<typeof getPayload>>; req?: any } = {},
) {
  const payload = options.payload ?? await getPayload({ config })
  const request = options.req ? { req: options.req } : {}
  const found = await payload.find({
    collection: "site-settings",
    overrideAccess: true,
    where: { tenant: { equals: tenantId } },
    limit: 1,
    ...request,
  })
  if (found.docs.length) return found.docs[0]
  try {
    return await payload.create({
      collection: "site-settings",
      overrideAccess: true,
      data: { tenant: tenantId, siteName: "Untitled", siteUrl: "https://example.com" } as any,
      ...request,
    })
  } catch (err) {
    if (!isUniqueViolation(err)) throw err
    // Lost the race. The winner inserted a row for this tenant; re-fetch.
    const refetched = await payload.find({
      collection: "site-settings",
      overrideAccess: true,
      where: { tenant: { equals: tenantId } },
      limit: 1,
      ...request,
    })
    // If the re-fetch returns 0, the unique-violation came from somewhere
    // other than our race (e.g. a phantom constraint). Re-throw the original
    // error so the caller learns something genuinely unexpected happened —
    // never an infinite retry loop, never a silent undefined return.
    if (!refetched.docs.length) throw err
    return refetched.docs[0]
  }
}
