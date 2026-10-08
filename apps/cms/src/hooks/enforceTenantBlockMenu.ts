import type { Page } from "@/payload-types"
import type { RelationshipIdRef } from "@/lib/relationshipId"
import type { CollectionBeforeValidateHook } from "payload"
import { ALL_BLOCKS } from "@/blocks/registry"

/**
 * Reject saves containing block types that fall outside the tenant's
 * declared siteManifest.blocks[] menu. When the tenant has no explicit
 * blocks[] menu, fall back to every canonical block schema accepted by the
 * Payload collection so existing pages remain editable.
 *
 * Lives in Pages.hooks.beforeValidate because data.blocks is not a role-scoped
 * field-stripped value, so beforeValidate sees the full array regardless of
 * caller role.
 *
 * IMPORTANT: loadTenantManifest is loaded via dynamic import inside the
 * hook body, NOT a top-level static import. loadManifest statically
 * imports `@/payload.config`, so a top-level import here closes a cycle:
 *   payload.config → Pages → enforceTenantBlockMenu → loadManifest → payload.config
 * Under esbuild's `__esm` bundling (dist-runtime/migrate-on-boot.bundled.mjs),
 * the inner `await init_payload_config()` returns the outer's still-pending
 * init Promise, deadlocking container boot with Node's "unsettled top-level
 * await" warning.
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

type BlockMenuInput = { tenant?: RelationshipIdRef; blocks?: unknown }
export const enforceTenantBlockMenu = async <T extends BlockMenuInput | null | undefined>({ data, originalDoc, req }: Omit<Parameters<CollectionBeforeValidateHook<Page>>[0], "data"> & { data?: T }): Promise<T | undefined> => {
  const tenantId = extractTenantId(
    (data)?.tenant ?? (originalDoc)?.tenant,
  )
  if (tenantId == null) return data
  // Dynamic import to break the payload.config ↔ Pages ↔ enforceTenantBlockMenu
  // ↔ loadManifest circular module-init cycle under esbuild bundling.
  const { loadTenantManifest } = await import("@/lib/richText/loadManifest")
  const manifest = await loadTenantManifest(tenantId, req)
  const allowed = new Set(
    manifest.blocks && manifest.blocks.length > 0
      ? manifest.blocks.map((b) => b.slug)
      : ALL_BLOCKS.map((b) => b.slug),
  )
  const rawBlocks = data?.blocks ?? []
  if (!Array.isArray(rawBlocks)) throw new Error("Page blocks must be an array.")
  const blocks = rawBlocks.map((block: unknown) => {
    if (!block || typeof block !== "object" || !("blockType" in block) || typeof block.blockType !== "string") throw new Error("Page block has no valid blockType.")
    return { blockType: block.blockType }
  })
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
