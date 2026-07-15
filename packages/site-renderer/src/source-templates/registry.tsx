import type * as React from "react"
import { SHADCNUI_SYSTEM_TEMPLATES } from "@siteinabox/contracts"
import type { SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import type { MediaResolver } from "../media"
import { ShadcnUiNotFoundView } from "../providers/shadcnui-blocks/system-views"

export type ProviderSystemTemplateRendererProps = { settings: SiteSettings; theme?: ThemeTokenSpec | null; tenantSlug?: string | null; domain?: string | null; mediaResolver?: MediaResolver; pathname?: string; nonce?: string }
export type ProviderSystemTemplateDefinition = {
  provider: "shadcnui-blocks"; role: "systemTemplate"; kind: "notFound"; namespace: string; id: string; rendererClassName: string
  renderer: (props: ProviderSystemTemplateRendererProps) => React.ReactNode
  slots: Record<string, { kind: string; status: string; exposed: boolean; sourceField: string; repeated: boolean }>
  source: { sourceName: string; sourceUrl: string; sourceComponent: string; sourceHash: string; capturedAt: string; license: string }
}
export const defineProviderSystemTemplate = (definition: ProviderSystemTemplateDefinition) => definition
export const providerSystemTemplateDefinitions: ProviderSystemTemplateDefinition[] = SHADCNUI_SYSTEM_TEMPLATES.map((variant) => ({
  provider: "shadcnui-blocks", role: "systemTemplate", kind: "notFound", namespace: "shadcnui-blocks.not-found", id: variant.id,
  rendererClassName: `system-template--shadcnui-blocks-${variant.upstreamName}`, renderer: (props) => ShadcnUiNotFoundView({ variant: variant.id, ...props }),
  slots: Object.fromEntries(Object.entries(variant.slots).map(([field, slot]) => [field, { ...slot, exposed: true, sourceField: field }])),
  source: { sourceName: "akash3444/shadcn-ui-blocks", sourceUrl: "https://github.com/akash3444/shadcn-ui-blocks", sourceComponent: variant.upstreamName, sourceHash: variant.sourceHash, capturedAt: "2026-07-15", license: "MIT" },
}))
export type ProviderSystemTemplateId = (typeof SHADCNUI_SYSTEM_TEMPLATES)[number]["id"]
const byId = new Map(providerSystemTemplateDefinitions.map((definition) => [definition.id, definition]))
export const DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID = "shadcnui-blocks.not-found-01" as const
const clean = (value: string | null | undefined) => value?.trim() || undefined
export const isProviderSystemTemplateIdentifier = (value: string | null | undefined) => clean(value)?.startsWith("shadcnui-blocks.") ?? false
export function getProviderSystemTemplateDefinition(kind: "notFound", variant: string | null | undefined) { const definition = clean(variant) ? byId.get(clean(variant)!) ?? null : null; return definition?.kind === kind ? definition : null }
export const getProviderSystemTemplateRenderer = (kind: "notFound", variant: string | null | undefined) => getProviderSystemTemplateDefinition(kind, variant)?.renderer ?? null
export function assertProviderSystemTemplateRenderer(kind: "notFound", variant: string | null | undefined) { const value = clean(variant); if (!value || !getProviderSystemTemplateDefinition(kind, value)) throw new Error(`Unresolved provider system template "${value ?? "missing"}" for ${kind}.`) }
