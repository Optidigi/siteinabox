import * as React from "react"
import { getProviderBlockVariant, type Block, type Page, type SiteSettings } from "@siteinabox/contracts"
import type { BlockRenderOptions } from "./blocks"
import type { MediaResolver } from "./media"
import { loadShadcnUiExplicitBlockView } from "./providers/shadcnui-blocks/block-client-loaders.generated"
import { ShadcnUiNavbarView } from "./providers/shadcnui-blocks/navbar-views"
import type { SitePageRendererProps } from "./SitePageRenderer"
import { SitePageShell } from "./SitePageShell"

type ProviderView = React.ComponentType<{ block: never; options: BlockRenderOptions }>

export type PreparedClientSiteRenderer = { kind: "generic"; views: ReadonlyMap<string, ProviderView> }

export async function prepareClientSiteRenderer({
  page,
  settings,
  tenantSlug,
  domain,
}: Pick<SitePageRendererProps, "page" | "settings" | "tenantSlug" | "domain">): Promise<PreparedClientSiteRenderer> {
  const variants = new Map<string, ProviderView>()
  const definitions = new Map(page.blocks.map((block) => {
    const definition = getProviderBlockVariant(block)
    if (!definition) {
      throw new Error(`Block type "${block.blockType}" requires an approved explicit provider variant.`)
    }
    return [definition.id, definition] as const
  }))
  await Promise.all([...definitions.values()].map(async (definition) => {
    if (definition.id === "shadcnui-blocks.legal-content-01") {
      const module = await import("./providers/shadcnui-blocks/system-views")
      variants.set(definition.id, module.ShadcnUiLegalContentView as ProviderView)
      return
    }
    variants.set(definition.id, await loadShadcnUiExplicitBlockView(definition.id) as ProviderView)
  }))
  return { kind: "generic", views: variants }
}

function PreparedProviderBlock({
  block,
  index,
  settings,
  mediaResolver,
  formAction,
  prepared,
}: {
  block: Block
  index: number
  settings: SiteSettings
  mediaResolver?: MediaResolver
  formAction?: string
  prepared: Extract<PreparedClientSiteRenderer, { kind: "generic" }>
}) {
  const definition = getProviderBlockVariant(block)
  if (!definition) throw new Error(`Block type "${block.blockType}" requires an approved explicit provider variant.`)
  const View = prepared.views.get(definition.id)
  if (!View) throw new Error(`Unresolved provider block variant "${definition.id}" for block type "${block.blockType}".`)
  const options: BlockRenderOptions = { index, mediaResolver, formAction, siteSettings: settings }
  const headerVariant = settings.chrome?.header?.variant

  return (
    <>
      {definition.composition.embedsNavigation && headerVariant ? (
        <ShadcnUiNavbarView variant={headerVariant} settings={settings} mediaResolver={mediaResolver} />
      ) : null}
      <View block={block as never} options={options} />
    </>
  )
}

export function ClientSitePageRenderer({
  prepared,
  page,
  settings,
  theme,
  registry,
  mediaResolver,
  formAction,
  className,
  canvasClassName,
  canvasAttributes,
  nonce,
  tenantSlug,
  domain,
  includeBehaviorScripts = false,
  header,
  banner,
  footer,
}: SitePageRendererProps & { prepared: PreparedClientSiteRenderer }) {
  const blocks = page.blocks.map((block, index) => {
    const explicitRenderer = registry?.[block.blockType]
    if (explicitRenderer && !block.designVariant) {
      const Renderer = explicitRenderer
      return <Renderer key={`${block.blockType}-${index}`} block={block} options={{ index, mediaResolver, formAction, siteSettings: settings }} />
    }
    return <PreparedProviderBlock key={`${block.blockType}-${index}`} block={block} index={index} settings={settings} mediaResolver={mediaResolver} formAction={formAction} prepared={prepared} />
  })
  return (
    <SitePageShell {...{ page, settings, theme, mediaResolver, className, canvasClassName, canvasAttributes, header, banner, footer }}>
      {blocks}
    </SitePageShell>
  )
}
