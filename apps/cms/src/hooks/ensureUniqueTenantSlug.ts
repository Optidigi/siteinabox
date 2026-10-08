import type { Page } from "@/payload-types"
import type { CollectionBeforeValidateHook } from "payload"
import { ValidationError } from "payload"
import { assertLiveBuilderTransaction } from "@/lib/builder/quotaTransaction"

// Audit finding #8 (P1, T8) — pre-empt the (tenant_id, slug) unique-index
// violation surfaced by `20260509_pages_tenant_slug_unique` with a clean
// ValidationError. Without this hook, a duplicate-slug write reaches the DB
// and Postgres returns a raw "duplicate key value violates unique constraint
// pages_tenant_slug_idx" error — Payload v3.84.1 has no built-in translator
// for unique-violation errors (verified by absence of error-code mapping in
// node_modules/@payloadcms/db-postgres/dist/), so the user would otherwise
// see the raw constraint name in the admin UI.
//
// Tenant id-shape note: Payload returns the tenant relationship as either a
// scalar id (FK shape) or a populated object depending on auth depth. The
// helper handles both shapes — same defensive pattern used by `canManageUsers`
// (`String(a) === String(b)` to compare populated-vs-FK).
const extractTenantId = (t: unknown): string | number | undefined => {
  if (t == null) return undefined
  if (typeof t === "object" && "id" in (t as object)) {
    return (t as { id: number | string }).id
  }
  return t as string | number
}

export const ensureUniqueTenantSlug = async <T extends Partial<Page> | null | undefined>({
  data,
  operation,
  originalDoc,
  req,
}: Omit<Parameters<CollectionBeforeValidateHook<Page>>[0], "data"> & { data?: T }): Promise<T | undefined> => {
  if (!data) return data

  const slug = data.slug ?? originalDoc?.slug
  const tenantRaw = data.tenant !== undefined ? data.tenant : originalDoc?.tenant
  const tenantId = extractTenantId(tenantRaw)

  // Defensive skips — let Payload's `required` and the multi-tenant plugin's
  // tenant validator surface the missing-field error. The unique check only
  // runs once both fields are populated.
  if (slug == null || tenantId == null) return data

  // On update, short-circuit when neither slug nor tenant is changing. Avoids
  // a spurious DB round-trip on every PATCH that touches unrelated fields
  // (e.g. `title`, `blocks`).
  if (operation === "update") {
    const slugChanged =
      data.slug !== undefined && String(data.slug) !== String(originalDoc?.slug)
    const tenantChanged =
      data.tenant !== undefined &&
      String(extractTenantId(data.tenant)) !== String(extractTenantId(originalDoc?.tenant))
    if (!slugChanged && !tenantChanged) return data
  }

  // Self-exclusion: on update, the existing row IS the page being saved; that
  // must not count as a collision. On create, originalDoc is undefined.
  const selfExclusion =
    originalDoc?.id != null ? [{ id: { not_equals: originalDoc.id } }] : []

  if (req.transactionID !== undefined) assertLiveBuilderTransaction(req.payload, req)
  const existing = await req.payload.find({
    collection: "pages",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
    req,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { slug: { equals: slug } },
        ...selfExclusion,
      ],
    },
  })

  if (existing.totalDocs > 0) {
    throw new ValidationError({
      collection: "pages",
      errors: [
        {
          path: "slug",
          message: `A page with slug "${slug}" already exists in this tenant. Choose a different slug.`,
        },
      ],
    })
  }

  return data
}
