import type * as React from "react"
import type { SiteSettings } from "@siteinabox/contracts"
import type { SiteChromeCatalogArea } from "@siteinabox/contracts/block-catalog"
import type { MediaResolver } from "../media"
import { tailwindPlusMarketingBannerWithButtonProviderChrome } from "./tailwindplus/marketing/banner/with-button"
import { tailwindPlusMarketingHeaderWithStackedFlyoutMenuProviderChrome } from "./tailwindplus/marketing/header/with-stacked-flyout-menu"

export type ProviderChromeSlotKind = "text" | "cta" | "image" | "repeater" | "checkbox"
export type ProviderChromeSlotStatus = "required" | "optional" | "inactive"

export type ProviderChromeSlotManifestEntry = {
  kind: ProviderChromeSlotKind
  status: ProviderChromeSlotStatus
  exposed: boolean
  sourceField: string
  minItems?: number
  maxItems?: number
}

export type ProviderChromeSourceMetadata = {
  sourceName: string
  sourceUrl: string
  sourceComponent: string
  sourceHash: string
  capturedAt: string
  license: string
}

export type ProviderChromeRendererProps = {
  settings: SiteSettings
  currentSlug?: string
  mediaResolver?: MediaResolver
}

export type ProviderChromeDefinition = {
  provider: "tailwindplus"
  role: "chrome"
  area: SiteChromeCatalogArea
  namespace: string
  id: string
  rendererClassName?: string
  renderer?: (props: ProviderChromeRendererProps) => React.ReactNode
  slots: Record<string, ProviderChromeSlotManifestEntry>
  source: ProviderChromeSourceMetadata
}

export function defineProviderChrome(definition: ProviderChromeDefinition) {
  return definition
}

export const providerChromeDefinitions = [
  tailwindPlusMarketingHeaderWithStackedFlyoutMenuProviderChrome,
  tailwindPlusMarketingBannerWithButtonProviderChrome,
] as const satisfies readonly ProviderChromeDefinition[]

export type ProviderChromeId = typeof providerChromeDefinitions[number]["id"]

const providerChromeDefinitionsByVariant: Partial<Record<string, ProviderChromeDefinition>> = {}

for (const definition of providerChromeDefinitions) {
  providerChromeDefinitionsByVariant[definition.id] = definition
}

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
}

export function isProviderChromeVariantIdentifier(value: string | null | undefined) {
  const variant = cleanVariant(value)
  if (!variant) return false
  return (
    variant.startsWith("tailwindplus.") ||
    variant.startsWith("preline.") ||
    variant.startsWith("tailblocks.")
  )
}

export function getProviderChromeDefinition(area: SiteChromeCatalogArea, variant: string | null | undefined) {
  const clean = cleanVariant(variant)
  if (!clean) return null
  const definition = providerChromeDefinitionsByVariant[clean] ?? null
  return definition?.area === area ? definition : null
}

export function getProviderChromeRenderer(area: SiteChromeCatalogArea, variant: string | null | undefined) {
  return getProviderChromeDefinition(area, variant)?.renderer ?? null
}

export function assertProviderChromeRenderer(area: SiteChromeCatalogArea, variant: string | null | undefined) {
  const clean = cleanVariant(variant)
  if (!clean || !isProviderChromeVariantIdentifier(clean)) return
  const definition = getProviderChromeDefinition(area, clean)
  if (!definition) {
    throw new Error(`Unresolved provider chrome variant "${clean}" for ${area}.`)
  }
  if (!definition.renderer) {
    throw new Error(`Provider chrome variant "${clean}" for ${area} has no renderer.`)
  }
}
