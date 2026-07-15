import * as React from "react"
import type { SiteSettings } from "@siteinabox/contracts"
import View01 from "./variants/banner-01/view"
import View02 from "./variants/banner-02/view"
import View03 from "./variants/banner-03/view"
import View04 from "./variants/banner-04/view"
import { adaptVariant as adapt01 } from "./variants/banner-01/adapter"
import { adaptVariant as adapt02 } from "./variants/banner-02/adapter"
import { adaptVariant as adapt03 } from "./variants/banner-03/adapter"
import { adaptVariant as adapt04 } from "./variants/banner-04/adapter"

const definitions = {
  "shadcnui-blocks.banner-01": { adapt: adapt01, View: View01 },
  "shadcnui-blocks.banner-02": { adapt: adapt02, View: View02 },
  "shadcnui-blocks.banner-03": { adapt: adapt03, View: View03 },
  "shadcnui-blocks.banner-04": { adapt: adapt04, View: View04 },
} as const

export function ShadcnUiBannerView({ variant, settings }: { variant: string; settings: SiteSettings }) {
  const definition = definitions[variant as keyof typeof definitions]
  if (!definition) throw new Error(`Unresolved provider chrome variant "${variant}" for banner.`)
  const model = definition.adapt(settings)
  if (!model) return null
  const { View } = definition
  return <aside data-provider-variant={variant} data-provider-token-mode="reference" data-siab-cookie-consent={variant === "shadcnui-blocks.banner-04" && model.consent ? "true" : undefined}><View model={model} /></aside>
}
