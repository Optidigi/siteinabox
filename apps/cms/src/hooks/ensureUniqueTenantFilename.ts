import type { Media } from "@/payload-types"
import type { CollectionBeforeValidateHook } from "payload"
import { ValidationError } from "payload"
import { assertSafeMediaFilename } from "@/lib/mediaFilename"

// Audit finding #15 (P3, T8) — pre-empt the (tenant_id, filename) unique-index
// violation surfaced by `20260509_media_tenant_filename_unique` with a clean
// ValidationError. Without this hook a duplicate-filename upload reaches the DB
// and Postgres returns a raw "duplicate key value violates unique constraint
// media_tenant_filename_idx" error — Payload v3.84.1's drizzle adapter wraps
// it into a ValidationError but with the constraint name in the message,
// which surfaces in the admin UI as user-hostile copy. Same pattern as
// `ensureUniqueTenantSlug` on Pages (audit P1 #8).
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

export const ensureUniqueTenantFilename = async <T extends Partial<Media> | null | undefined>({
  data,
  operation,
  originalDoc,
  req,
}: Omit<Parameters<CollectionBeforeValidateHook<Media>>[0], "data"> & { data?: T }): Promise<T | undefined> => {
  if (!data) return data

  const filename = data.filename ?? originalDoc?.filename
  const tenantRaw = data.tenant !== undefined ? data.tenant : originalDoc?.tenant
  const tenantId = extractTenantId(tenantRaw)

  // Defensive skips — let Payload's upload validator and the multi-tenant
  // plugin's tenant validator surface the missing-field errors. The unique
  // check only runs once both fields are populated.
  if (filename == null || tenantId == null) return data

  const safeFilename = assertSafeMediaFilename(filename)

  // On update, short-circuit when neither filename nor tenant is changing.
  // Avoids a spurious DB round-trip on every PATCH that touches unrelated
  // fields (e.g. `alt`, `caption`).
  if (operation === "update") {
    const filenameChanged =
      data.filename !== undefined &&
      String(data.filename) !== String(originalDoc?.filename)
    const tenantChanged =
      data.tenant !== undefined &&
      String(extractTenantId(data.tenant)) !== String(extractTenantId(originalDoc?.tenant))
    if (!filenameChanged && !tenantChanged) return data
  }

  // Self-exclusion: on update, the existing row IS the media being saved;
  // that must not count as a collision. On create, originalDoc is undefined.
  const selfExclusion =
    originalDoc?.id != null ? [{ id: { not_equals: originalDoc.id } }] : []

  const existing = await req.payload.find({
    collection: "media",
    overrideAccess: true,
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { filename: { equals: safeFilename } },
        ...selfExclusion,
      ],
    },
  })

  if (existing.totalDocs > 0) {
    throw new ValidationError({
      collection: "media",
      errors: [
        {
          path: "filename",
          message: `A file named "${safeFilename}" already exists in this tenant. Choose a different filename or rename the existing file.`,
        },
      ],
    })
  }

  return data
}
