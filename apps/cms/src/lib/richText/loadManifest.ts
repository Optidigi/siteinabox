// NOTE: This module USED to `import "server-only"` as a defense-in-depth
// marker. Removed because esbuild-bundled scripts (rt-v2 repopulate +
// migrate-on-boot in dist-runtime/) don't have Next.js's webpack shim
// that replaces server-only with a no-op at client-bundle time —
// server-only's throw fires at module-init in the bundled .mjs even
// via dynamic import (esbuild still initializes the bundled module
// body). The function uses `getPayload(config)` which is itself
// server-only and would fail loudly in any client bundle, so the
// marker's safety net is intact one layer deeper.
import { getPayload } from "payload"
import config from "@/payload.config"
import { DEFAULT_FONT_FAMILIES, manifestSchema, type RtManifest } from "./manifest"

// Default manifest for tenants without one declared. Conservative —
// paragraph only, bold/italic marks. Use this as the safety floor while
// templates ship their first manifest.
export const DEFAULT_MANIFEST: RtManifest = {
  version: 1,
  inlineMarks: { bold: true, italic: true },
  blockTypes: { paragraph: true, heading: { levels: [2, 3] } },
  colorTokens: [],
  fontFamilies: [...DEFAULT_FONT_FAMILIES],
  typeStyles: [],
}

export const loadTenantManifest = async (tenantId: string | number): Promise<RtManifest> => {
  const payload = await getPayload({ config })
  const t = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    overrideAccess: true,
  })
  const raw = (t).siteManifest
  if (!raw) return DEFAULT_MANIFEST
  const parsed = manifestSchema.safeParse(raw)
  if (!parsed.success) {
    console.error("[loadTenantManifest] tenant has invalid manifest, falling back to default", parsed.error.issues)
    return DEFAULT_MANIFEST
  }
  return {
    ...parsed.data,
    fontFamilies: parsed.data.fontFamilies ?? [...DEFAULT_FONT_FAMILIES],
  }
}
