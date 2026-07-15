import * as React from "react"
import { validateSiteChromeCapabilities, type SiteSettings } from "@siteinabox/contracts"
import type { MediaResolver } from "../../media"
import View01 from "./variants/footer-01/view"
import View02 from "./variants/footer-02/view"
import View03 from "./variants/footer-03/view"
import View04 from "./variants/footer-04/view"
import View05 from "./variants/footer-05/view"
import View06 from "./variants/footer-06/view"
import View07 from "./variants/footer-07/view"
import { adaptVariant as adapt01 } from "./variants/footer-01/adapter"
import { adaptVariant as adapt02 } from "./variants/footer-02/adapter"
import { adaptVariant as adapt03 } from "./variants/footer-03/adapter"
import { adaptVariant as adapt04 } from "./variants/footer-04/adapter"
import { adaptVariant as adapt05 } from "./variants/footer-05/adapter"
import { adaptVariant as adapt06 } from "./variants/footer-06/adapter"
import { adaptVariant as adapt07 } from "./variants/footer-07/adapter"

const definitions = {
  "shadcnui-blocks.footer-01": { adapt: adapt01, View: View01 },
  "shadcnui-blocks.footer-02": { adapt: adapt02, View: View02 },
  "shadcnui-blocks.footer-03": { adapt: adapt03, View: View03 },
  "shadcnui-blocks.footer-04": { adapt: adapt04, View: View04 },
  "shadcnui-blocks.footer-05": { adapt: adapt05, View: View05 },
  "shadcnui-blocks.footer-06": { adapt: adapt06, View: View06 },
  "shadcnui-blocks.footer-07": { adapt: adapt07, View: View07 },
} as const

export function ShadcnUiFooterView({ variant, settings, mediaResolver }: { variant: string; settings: SiteSettings; mediaResolver?: MediaResolver }) {
  const definition = definitions[variant as keyof typeof definitions]
  if (!definition) throw new Error(`Unresolved provider chrome variant "${variant}" for footer.`)
  const effectiveSettings = { ...settings, chrome: { ...settings.chrome, footer: { ...settings.chrome?.footer, variant } } } as SiteSettings
  const issues = validateSiteChromeCapabilities(effectiveSettings).filter((issue) => issue.path === "navFooter" || issue.path.startsWith("chrome.footer"))
  if (issues.length) throw new Error(`Invalid ${variant} settings: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`)
  const model = definition.adapt(effectiveSettings, mediaResolver)
  if (!model) return null
  const { View } = definition
  return <footer data-provider-token-mode="reference" data-provider-variant={variant}><View model={model} /></footer>
}
