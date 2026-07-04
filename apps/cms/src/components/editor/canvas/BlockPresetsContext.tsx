"use client"
import * as React from "react"
import { BLOCKS, resolveAllowedBlocks } from "@/blocks/registry"
import { sanitizePresetData } from "@/lib/blockPresets/sanitize"
import { parsePayloadError } from "@/lib/api"
import type { BlockPreset } from "@/payload-types"
import type { BlockTypeDef, BlockPresetDef } from "@/components/editor/canvas/chrome/block-type-picker"
import type { RtManifest } from "@/lib/richText/manifest"

/**
 * Provides the data + side-effect callbacks that the local block-type picker,
 * canvas gap button, and mobile section list need to fetch + mutate block
 * presets.
 *
 * Owns all Payload-specific integration: BLOCKS registry adapter,
 * /api/block-presets fetch + delete, parsePayloadError, sanitizePresetData
 * helper. UI components never touch backend directly; they consume the context
 * via the `useBlockPresets()` hook.
 *
 * Place a single `<BlockPresetsProvider tenantId={...} manifest={...}>` wrapping the
 * canvas tree in PageForm. The provider scopes preset fetches to the
 * given tenantId — necessary for super-admin users who would otherwise
 * see presets across all tenants.
 */

export type BlockPresetsContextValue = {
  blockTypes: BlockTypeDef[]
  presets: BlockPresetDef[]
  presetsError: string | null
  onReloadPresets: () => Promise<void>
  onDeletePreset: (preset: BlockPresetDef) => Promise<void>
  sanitizePresetData: (slug: string, data: Record<string, unknown>) => Record<string, unknown>
}

const BlockPresetsContext = React.createContext<BlockPresetsContextValue | null>(null)

export function BlockPresetsProvider({
  tenantId,
  manifest,
  children,
}: {
  tenantId: number | string
  manifest: RtManifest
  children: React.ReactNode
}) {
  const [presets, setPresets] = React.useState<BlockPresetDef[]>([])
  const [presetsError, setPresetsError] = React.useState<string | null>(null)

  const onReloadPresets = React.useCallback(async () => {
    setPresetsError(null)
    try {
      const url = `/api/block-presets?limit=200&depth=0&sort=-updatedAt&where[tenant][equals]=${encodeURIComponent(String(tenantId))}`
      const res = await fetch(url)
      if (!res.ok) {
        const detail = await parsePayloadError(res)
        throw new Error(detail.message)
      }
      const json = await res.json()
      const docs = (json.docs as BlockPreset[]) ?? []
      // Map BlockPreset (Payload type) → BlockPresetDef (registry-portable shape).
      setPresets(docs.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        blockType: p.blockType,
        data: (p.data as Record<string, unknown>) ?? {},
      })))
    } catch (e) {
      setPresetsError(e instanceof Error ? e.message : String(e))
    }
  }, [tenantId])

  const onDeletePreset = React.useCallback(async (preset: BlockPresetDef) => {
    const res = await fetch(`/api/block-presets/${preset.id}`, { method: "DELETE" })
    if (!res.ok) {
      const detail = await parsePayloadError(res)
      throw new Error(detail.message)
    }
  }, [])

  // Build BlockTypeDef[] from BLOCKS filtered + ordered per the tenant's
  // manifest.blocks[]. When manifest.blocks is absent, falls back to the
  // active source-backed registry (resolveAllowedBlocks handles the default). Per-tenant
  // label overrides come from manifest.blocks[].label.
  const blockTypes = React.useMemo<BlockTypeDef[]>(() => {
    const allowed = resolveAllowedBlocks(BLOCKS, manifest.blocks)
    const menuBySlug = new Map((manifest.blocks ?? []).map((m) => [m.slug, m]))
    return allowed.map(b => {
      const menuItem = menuBySlug.get(b.slug)
      const raw = b.labels?.singular
      const fallback: string | undefined =
        typeof raw === "string" ? raw
        : raw != null && typeof raw === "object" ? (raw["en"] ?? Object.values(raw)[0])
        : undefined
      const singular = menuItem?.label ?? fallback
      return {
        slug: b.slug,
        icon: b.icon,
        labels: singular != null ? { singular } : undefined,
        description: b.description,
        fields: b.fields,
      }
    })
  }, [manifest])

  const value: BlockPresetsContextValue = {
    blockTypes,
    presets,
    presetsError,
    onReloadPresets,
    onDeletePreset,
    sanitizePresetData,
  }

  return <BlockPresetsContext.Provider value={value}>{children}</BlockPresetsContext.Provider>
}

export function useBlockPresets(): BlockPresetsContextValue {
  const ctx = React.useContext(BlockPresetsContext)
  if (!ctx) {
    throw new Error("useBlockPresets must be used inside <BlockPresetsProvider>")
  }
  return ctx
}
