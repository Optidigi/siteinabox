import type * as React from "react"
import { SHADCNUI_CHROME_VARIANTS } from "@siteinabox/contracts"
import type { SiteSettings } from "@siteinabox/contracts"
import type { SiteChromeCatalogArea } from "@siteinabox/contracts/block-catalog"
import type { MediaResolver } from "../media"
import { ShadcnUiChromeView } from "../providers/shadcnui-blocks/views"

export type ProviderChromeSlotKind = "text" | "cta" | "image" | "repeater" | "runtime" | "inactive"
export type ProviderChromeSlotStatus = "required" | "optional" | "inactive"
export type ProviderChromeSlotManifestEntry = { kind: ProviderChromeSlotKind; status: ProviderChromeSlotStatus; exposed: boolean; sourceField: string; repeated: boolean }
export type ProviderChromeRendererProps = { settings: SiteSettings; currentSlug?: string; mediaResolver?: MediaResolver }
export type ProviderChromeDefinition = {
  provider: "shadcnui-blocks"; role: "chrome"; area: SiteChromeCatalogArea; namespace: string; id: string; rendererClassName: string
  renderer: (props: ProviderChromeRendererProps) => React.ReactNode; slots: Record<string, ProviderChromeSlotManifestEntry>
  source: { sourceName: string; sourceUrl: string; sourceComponent: string; sourceHash: string; capturedAt: string; license: string }
}
export const defineProviderChrome = (definition: ProviderChromeDefinition) => definition
export const providerChromeDefinitions: ProviderChromeDefinition[] = SHADCNUI_CHROME_VARIANTS.map((variant) => ({
  provider: "shadcnui-blocks", role: "chrome", area: variant.area, namespace: `shadcnui-blocks.${variant.area}`, id: variant.id,
  rendererClassName: `site-${variant.area}--source-shadcnui-blocks-${variant.upstreamName}`,
  renderer: (props) => ShadcnUiChromeView({ area: variant.area, variant: variant.id, ...props }),
  slots: Object.fromEntries(Object.entries(variant.slots).map(([field, slot]) => [field, { ...slot, exposed: slot.status !== "inactive", sourceField: field }])),
  source: { sourceName: "akash3444/shadcn-ui-blocks", sourceUrl: "https://github.com/akash3444/shadcn-ui-blocks", sourceComponent: variant.upstreamName, sourceHash: variant.sourceHash, capturedAt: "2026-07-15", license: "MIT" },
}))
export type ProviderChromeId = (typeof SHADCNUI_CHROME_VARIANTS)[number]["id"]
const byId = new Map(providerChromeDefinitions.map((definition) => [definition.id, definition]))
const clean = (value: string | null | undefined) => value?.trim() || undefined
export const isProviderChromeVariantIdentifier = (value: string | null | undefined) => clean(value)?.startsWith("shadcnui-blocks.") ?? false
export function getProviderChromeDefinition(area: SiteChromeCatalogArea, variant: string | null | undefined) {
  const definition = clean(variant) ? byId.get(clean(variant)!) ?? null : null
  return definition?.area === area ? definition : null
}
export const getProviderChromeRenderer = (area: SiteChromeCatalogArea, variant: string | null | undefined) => getProviderChromeDefinition(area, variant)?.renderer ?? null
export function assertProviderChromeRenderer(area: SiteChromeCatalogArea, variant: string | null | undefined) {
  const value = clean(variant)
  if (!value) return
  if (!isProviderChromeVariantIdentifier(value) || !getProviderChromeDefinition(area, value)) throw new Error(`Unresolved provider chrome variant "${value}" for ${area}.`)
}
