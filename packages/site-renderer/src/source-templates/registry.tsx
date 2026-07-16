import { SHADCNUI_SYSTEM_TEMPLATES } from "@siteinabox/contracts"
import type { SiteSettings } from "@siteinabox/contracts"
import type { ThemeTokenSpec } from "@siteinabox/contracts/generation"
import type { MediaResolver } from "../media"
import { ShadcnUiNotFoundView } from "../providers/shadcnui-blocks/system-views"

export type ProviderSystemTemplateRendererProps = { settings: SiteSettings; theme?: ThemeTokenSpec | null; tenantSlug?: string | null; domain?: string | null; mediaResolver?: MediaResolver; pathname?: string; nonce?: string }
export type ProviderSystemTemplateId = (typeof SHADCNUI_SYSTEM_TEMPLATES)[number]["id"]
const ids = new Set<string>(SHADCNUI_SYSTEM_TEMPLATES.map((template) => template.id))
export const DEFAULT_PROVIDER_NOT_FOUND_TEMPLATE_ID = "shadcnui-blocks.not-found-01" as const
const clean = (value: string | null | undefined) => value?.trim() || undefined
export const isProviderSystemTemplateIdentifier = (value: string | null | undefined) => clean(value)?.startsWith("shadcnui-blocks.") ?? false
export function getProviderSystemTemplateRenderer(kind: "notFound", variant: string | null | undefined) {
  const id = clean(variant)
  if (kind !== "notFound" || !id || !ids.has(id)) return null
  return (props: ProviderSystemTemplateRendererProps) => ShadcnUiNotFoundView({ variant: id, ...props })
}
export function assertProviderSystemTemplateRenderer(kind: "notFound", variant: string | null | undefined) {
  const value = clean(variant)
  if (!getProviderSystemTemplateRenderer(kind, value)) throw new Error(`Unresolved provider system template "${value ?? "missing"}" for ${kind}.`)
}
