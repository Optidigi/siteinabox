import * as React from "react"
import { TooltipProvider } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { ProviderBlockModel } from "./content"
import { ProviderBlockContent } from "./content"
import { providerBlockAttributes } from "./block"

type LiteralComponent = (props: Record<string, never>) => React.ReactNode
const tooltipVariants = new Set(["shadcnui-blocks.pricing-03", "shadcnui-blocks.pricing-04"])

const tooltips = (variant: string, children: React.ReactNode) =>
  tooltipVariants.has(variant) ? <TooltipProvider>{children}</TooltipProvider> : children

/**
 * Adds renderer metadata to a pinned literal root. Content inside that root is
 * already bound explicitly by the importer through ProviderField and
 * ProviderItems; this function deliberately does not inspect or rewrite the
 * rendered React tree.
 */
export function LiteralProviderVariantView({ Literal, model, variant }: { Literal: LiteralComponent; model: ProviderBlockModel; variant: string }) {
  const root = Literal({})
  if (!React.isValidElement(root)) throw new Error(`Literal provider variant "${variant}" did not return a React element.`)
  const bound = React.cloneElement(root as React.ReactElement<Record<string, unknown>>, providerBlockAttributes(model, variant))
  return tooltips(variant, <ProviderBlockContent model={model}>{bound}</ProviderBlockContent>)
}

export function LiteralProviderPreviewView({ Literal, variant }: { Literal: LiteralComponent; variant: string }) {
  const root = Literal({})
  if (!React.isValidElement(root)) throw new Error(`Literal provider reference "${variant}" did not return a React element.`)
  return tooltips(variant, React.cloneElement(root as React.ReactElement<Record<string, unknown>>, {
    "data-provider-literal-preview": variant,
    "data-provider-token-mode": "theme",
  }))
}
