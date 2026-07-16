import * as React from "react"
import { ArrowRightIcon, BlocksIcon, Settings2Icon } from "lucide-react"
import type { Block, RtRoot } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BlockRenderOptions } from "../../blocks/types"
import { resolveMedia } from "../../media"
import { extractRichText } from "../../rich-text"
import { ProviderBlockContent, ProviderField } from "./runtime/content"
import { providerBlockAttributes } from "./runtime/block"

type FeatureBlock = Extract<Block, { blockType: "featureList" }>
const icons = [Settings2Icon, BlocksIcon]
const richLines = (value: RtRoot | null | undefined) => {
  const lines: string[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return
    const record = node as Record<string, unknown>
    if ((record.type === "paragraph" || record.type === "listitem") && Array.isArray(record.children)) {
      const line = extractRichText({ root: record } as unknown as RtRoot).trim()
      if (line) lines.push(line)
      return
    }
    if (Array.isArray(record.children)) record.children.forEach(visit)
    if (record.root) visit(record.root)
  }
  visit(value)
  if (!lines.length) {
    const line = extractRichText(value).trim()
    if (line) lines.push(line)
  }
  return lines.slice(0, 2)
}

export function ShadcnUiStaticFeaturesView({ block, options, variant }: { block: FeatureBlock; options: BlockRenderOptions; variant: string }) {
  if (variant !== "shadcnui-blocks.features-03") throw new Error(`Unresolved feature variant "${variant}".`)
  const model = { block, options }
  const cards = block.features.slice(0, 2)
  return <ProviderBlockContent model={model}>
    <div {...providerBlockAttributes(model, variant)} className="mx-auto w-full max-w-(--breakpoint-lg) px-6 py-20">
      <h2 className="font-medium text-3xl leading-10 tracking-[-0.04em] sm:text-4xl md:text-[40px] md:leading-13"><ProviderField field="title" fallback="Features" inline /></h2>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-3">
        {cards.flatMap((feature, index) => {
          const media = resolveMedia(feature.image ?? null, options.mediaResolver)
          const lines = richLines(feature.description)
          const card = <div key={`card-${index}`} className="col-span-1 rounded-xl bg-muted p-6 md:col-span-2 lg:col-span-1">
            <div className="mb-6 aspect-video w-full overflow-hidden rounded-xl bg-background md:hidden">{media ? <img className="h-full w-full object-cover" src={media.src} alt={extractRichText(feature.title)} /> : null}</div>
            <span className="font-medium text-xl tracking-[-0.01em]">{extractRichText(feature.title)}</span>
            {lines.length ? <ul className="mt-6 space-y-5">{lines.map((line, lineIndex) => {
              const Icon = icons[lineIndex % icons.length]!
              return <li key={lineIndex}><div className="flex items-start gap-3"><Icon className="shrink-0" /><p className="-mt-0.5">{line}</p></div></li>
            })}</ul> : null}
            {feature.cta?.label && feature.cta.href ? <Button className="mt-8 w-full" asChild><a href={feature.cta.href}>{feature.cta.label}<ArrowRightIcon /></a></Button> : null}
          </div>
          const desktopMedia = <div key={`media-${index}`} className="col-span-1 hidden overflow-hidden rounded-xl bg-muted md:col-span-3 md:block lg:col-span-2">{media ? <img className="h-full w-full object-cover" src={media.src} alt="" /> : null}</div>
          return index % 2 === 0 ? [card, desktopMedia] : [desktopMedia, card]
        })}
      </div>
    </div>
  </ProviderBlockContent>
}
