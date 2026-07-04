import type * as React from "react"
import type { SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import type { MediaResolver } from "../media"
import { tailwindPlusMarketingFeedback404SimpleProviderTemplate } from "./tailwindplus/marketing/feedback/404-simple"

export type ProviderSystemTemplateSlotKind = "text" | "cta"
export type ProviderSystemTemplateSlotStatus = "required" | "optional" | "inactive"

export type ProviderSystemTemplateSlotManifestEntry = {
  kind: ProviderSystemTemplateSlotKind
  status: ProviderSystemTemplateSlotStatus
  exposed: boolean
  sourceField: string
}

export type ProviderSystemTemplateSourceMetadata = {
  sourceName: string
  sourceUrl: string
  sourceComponent: string
  sourceHash: string
  capturedAt: string
  license: string
}

export type ProviderSystemTemplateRendererProps = {
  settings: SiteSettings
  theme?: ThemeTokenSpec | null
  tenantSlug?: string | null
  domain?: string | null
  mediaResolver?: MediaResolver
  pathname?: string
  nonce?: string
}

export type ProviderSystemTemplateDefinition = {
  provider: "tailwindplus"
  role: "systemTemplate"
  kind: "notFound"
  namespace: string
  id: string
  rendererClassName?: string
  renderer?: (props: ProviderSystemTemplateRendererProps) => React.ReactNode
  slots: Record<string, ProviderSystemTemplateSlotManifestEntry>
  source: ProviderSystemTemplateSourceMetadata
}

export function defineProviderSystemTemplate(definition: ProviderSystemTemplateDefinition) {
  return definition
}

export const providerSystemTemplateDefinitions = [
  tailwindPlusMarketingFeedback404SimpleProviderTemplate,
] as const satisfies readonly ProviderSystemTemplateDefinition[]

export type ProviderSystemTemplateId = typeof providerSystemTemplateDefinitions[number]["id"]

const providerSystemTemplateDefinitionsByVariant: Partial<Record<string, ProviderSystemTemplateDefinition>> = {}

for (const definition of providerSystemTemplateDefinitions) {
  providerSystemTemplateDefinitionsByVariant[definition.id] = definition
}

export const DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID = "tailwindplus.marketing.feedback.404-simple" as const

function cleanVariant(value: string | null | undefined) {
  const variant = value?.trim()
  return variant ? variant : undefined
}

export function isProviderSystemTemplateIdentifier(value: string | null | undefined) {
  const variant = cleanVariant(value)
  if (!variant) return false
  return (
    variant.startsWith("tailwindplus.") ||
    variant.startsWith("preline.") ||
    variant.startsWith("tailblocks.")
  )
}

export function getProviderSystemTemplateDefinition(kind: "notFound", variant: string | null | undefined) {
  const clean = cleanVariant(variant)
  if (!clean) return null
  const definition = providerSystemTemplateDefinitionsByVariant[clean] ?? null
  return definition?.kind === kind ? definition : null
}

export function getProviderSystemTemplateRenderer(kind: "notFound", variant: string | null | undefined) {
  return getProviderSystemTemplateDefinition(kind, variant)?.renderer ?? null
}

export function assertProviderSystemTemplateRenderer(kind: "notFound", variant: string | null | undefined) {
  const clean = cleanVariant(variant)
  if (!clean || !isProviderSystemTemplateIdentifier(clean)) return
  const definition = getProviderSystemTemplateDefinition(kind, clean)
  if (!definition) {
    throw new Error(`Unresolved provider system template "${clean}" for ${kind}.`)
  }
  if (!definition.renderer) {
    throw new Error(`Provider system template "${clean}" for ${kind} has no renderer.`)
  }
}
