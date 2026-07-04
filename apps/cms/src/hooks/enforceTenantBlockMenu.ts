import type { CollectionBeforeValidateHook } from "payload"
import { ALL_BLOCKS } from "@/blocks/registry"

/**
 * Reject saves containing block types that fall outside the tenant's
 * declared siteManifest.blocks[] menu. When the tenant has no explicit
 * blocks[] menu, fall back to every canonical block schema accepted by the
 * Payload collection so existing pages remain editable.
 *
 * Lives in Pages.hooks.beforeValidate alongside validateRichTextOnSave
 * because both validate content shape before Payload runs its own
 * schema validation. data.blocks is not a role-scoped field-stripped
 * value, so beforeValidate sees the full array regardless of caller role.
 *
 * IMPORTANT: loadTenantManifest is loaded via dynamic import inside the
 * hook body, NOT a top-level static import. loadManifest statically
 * imports `@/payload.config`, so a top-level import here closes a cycle:
 *   payload.config → Pages → enforceTenantBlockMenu → loadManifest → payload.config
 * Under esbuild's `__esm` bundling (dist-runtime/migrate-on-boot.bundled.mjs),
 * the inner `await init_payload_config()` returns the outer's still-pending
 * init Promise, deadlocking container boot with Node's "unsettled top-level
 * await" warning. Mirrors the deferred-import pattern in validateRichTextOnSave.ts.
 */
const extractTenantId = (raw: unknown): string | number | null => {
  if (raw == null) return null
  if (typeof raw === "string" || typeof raw === "number") return raw
  if (typeof raw === "object" && "id" in raw) {
    const id = (raw as { id?: unknown }).id
    if (typeof id === "string" || typeof id === "number") return id
  }
  return null
}

export const enforceTenantBlockMenu: CollectionBeforeValidateHook = async ({ data, originalDoc }) => {
  const tenantId = extractTenantId(
    (data as any)?.tenant ?? (originalDoc as any)?.tenant,
  )
  if (tenantId == null) return data
  // Dynamic import to break the payload.config ↔ Pages ↔ enforceTenantBlockMenu
  // ↔ loadManifest circular module-init cycle under esbuild bundling.
  const { loadTenantManifest } = await import("@/lib/richText/loadManifest")
  const manifest = await loadTenantManifest(tenantId)
  const allowed = new Set(
    manifest.blocks && manifest.blocks.length > 0
      ? manifest.blocks.map((b) => b.slug)
      : ALL_BLOCKS.map((b) => b.slug),
  )
  const blocks = ((data as any)?.blocks ?? []) as { blockType: string }[]
  const violations = blocks
    .map((b, i) => ({ i, slug: b.blockType }))
    .filter((b) => !allowed.has(b.slug))
  if (violations.length > 0) {
    throw new Error(
      `Page contains block types not in this tenant's manifest: ${violations.map((v) => `${v.slug} (index ${v.i})`).join(", ")}`,
    )
  }
  return data
}
