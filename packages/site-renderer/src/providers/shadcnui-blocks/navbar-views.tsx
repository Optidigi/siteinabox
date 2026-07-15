import * as React from "react"
import { validateSiteChromeCapabilities, type SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "../../media"
import View01 from "./variants/navbar-01/view"
import View02 from "./variants/navbar-02/view"
import View03 from "./variants/navbar-03/view"
import View04 from "./variants/navbar-04/view"
import View05 from "./variants/navbar-05/view"
import { adaptVariant as adapt01 } from "./variants/navbar-01/adapter"
import { adaptVariant as adapt02 } from "./variants/navbar-02/adapter"
import { adaptVariant as adapt03 } from "./variants/navbar-03/adapter"
import { adaptVariant as adapt04 } from "./variants/navbar-04/adapter"
import { adaptVariant as adapt05 } from "./variants/navbar-05/adapter"
const definitions = {
  "shadcnui-blocks.navbar-01": { adapt: adapt01, View: View01 },
  "shadcnui-blocks.navbar-02": { adapt: adapt02, View: View02 },
  "shadcnui-blocks.navbar-03": { adapt: adapt03, View: View03 },
  "shadcnui-blocks.navbar-04": { adapt: adapt04, View: View04 },
  "shadcnui-blocks.navbar-05": { adapt: adapt05, View: View05 },
} as const
export function ShadcnUiNavbarView({ variant, settings, currentSlug, mediaResolver }: { variant: string; settings: SiteSettings; currentSlug?: string; mediaResolver?: MediaResolver }) {
  const definition = definitions[variant as keyof typeof definitions]
  if (!definition) throw new Error(`Unresolved provider chrome variant "${variant}" for header.`)
  const effectiveSettings = { ...settings, chrome: { ...settings.chrome, header: { ...settings.chrome?.header, variant } } } as SiteSettings
  const issues = validateSiteChromeCapabilities(effectiveSettings).filter((issue) => issue.path === "navHeader" || issue.path.startsWith("navHeader.") || issue.path.startsWith("chrome.header"))
  if (issues.length) throw new Error(`Invalid ${variant} settings: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`)
  const model = definition.adapt(effectiveSettings, currentSlug, mediaResolver)
  if (!model) return null
  const { View } = definition
  return <header data-provider-token-mode="reference" data-provider-variant={variant}><View model={model} /></header>
}
