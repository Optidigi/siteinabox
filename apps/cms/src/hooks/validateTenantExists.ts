import type { Tenant } from "@/payload-types"
import type { CollectionBeforeValidateHook } from "payload"
import { ValidationError } from "payload"
import { relationshipId } from "@/lib/relationshipId"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"

// Slug of the collection this hook is attached to is set on the req's
// hook context by Payload's pipeline; we read it for the ValidationError
// envelope so consumers logging the full body see e.g. "pages" instead
// of "(unknown)". Fallback covers internal/programmatic invocations
// that don't pass through the standard pipeline.

/**
 * FN-2026-0058 — cross-tenant FK PATCH on Pages, Media, SiteSettings
 * pre-fix returned HTTP 500 with a generic "Something went wrong."
 * envelope (the underlying tenant FK lookup throws). Translates the
 * missing-tenant case into a clean 400 ValidationError with
 * `path:"tenant"` so API callers and developers debugging tenant
 * mutations get a meaningful signal.
 *
 * Skip when `data.tenant` is unchanged (no lookup → no spurious DB
 * round-trip on every PATCH that touches an unrelated field). Skip
 * also when tenant is undefined — Payload's `required` invariant on
 * the multi-tenant plugin's tenant field handles the missing case
 * separately.
 */
export const validateTenantExists: CollectionBeforeValidateHook<{ id: number | string; tenant?: Tenant | number | null }> = async ({
  collection,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data
  if (data.tenant === undefined) return data
  const targetId = relationshipId(data.tenant)
  if (targetId == null) return data

  if (operation === "update") {
    const currentId = relationshipId(originalDoc?.tenant)
    if (targetId === currentId) return data
  }

  // Existence check via Local API. overrideAccess: true so we get the
  // honest answer regardless of caller's tenant scope (we WANT to
  // distinguish "tenant doesn't exist" from "you can't see it" —
  // the multi-tenant plugin's separate per-tenant access check
  // handles the visibility part).
  if (req.transactionID !== undefined) assertLiveBuilderTransaction(req.payload, req)
  try {
    await req.payload.findByID({
      collection: "tenants",
      id: targetId,
      overrideAccess: true,
      depth: 0,
      req,
    })
  } catch {
    throw new ValidationError({
      collection: collection?.slug ?? "unknown",
      errors: [{ path: "tenant", message: `Tenant ${targetId} not found` }],
    })
  }

  return data
}
