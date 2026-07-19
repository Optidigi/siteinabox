// Owned typed adaptation of upstream shadcnui-blocks cta-01 (MIT, see ../../LICENSE).
"use client"

import * as React from "react"
import type { LinkRef, RtRoot } from "@siteinabox/contracts"
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"
import type { BlockEditSlots, RendererElementPath, RendererSectionAttributes } from "../../../../blocks/types"
import { RichTextRenderer } from "../../../../rich-text"

const BLOCK_TYPE = "cta" as const
const isExternalHref = (href: string) => /^(?:https?:)?\/\//i.test(href)

const previewInlineText = (text: string): RtRoot => ({
  t: "root",
  variant: "inline",
  children: [{ t: "text", v: text }],
})

const previewBlockText = (text: string): RtRoot => ({
  t: "root",
  variant: "block",
  children: [{ t: "paragraph", children: [{ t: "text", v: text }] }],
})

const PREVIEW_HEADLINE = previewInlineText("Ready to Build Faster?")
const PREVIEW_DESCRIPTION = previewBlockText(
  "Join thousands of developers using our premium component library to ship beautiful UIs in minutes, not hours.",
)
const PREVIEW_PRIMARY: LinkRef = { label: "Get Started", href: "#" }

const elementPath = (blockIndex: number, field: string): RendererElementPath => ({ blockIndex, field })

const renderInlineRichText = (
  editSlots: BlockEditSlots | undefined,
  field: string,
  value: RtRoot,
  blockIndex: number,
) => {
  const path = elementPath(blockIndex, field)
  const name = `${BLOCK_TYPE}.${field}`
  return editSlots?.renderRichText
    ? editSlots.renderRichText({
        name,
        value,
        variant: "inline",
        as: "span",
        className: "contents",
        elementPath: path,
        blockMode: "inline",
      })
    : <RichTextRenderer value={value} blockMode="inline" />
}

const renderPrimary = (editSlots: BlockEditSlots | undefined, primary: LinkRef, blockIndex: number) => {
  const href = primary.href?.trim()
  const label = primary.label?.trim()
  if (!href || !label) return null
  const path = elementPath(blockIndex, "primary")
  if (editSlots?.renderCta) {
    return editSlots.renderCta({
      name: `${BLOCK_TYPE}.primary`,
      value: { ...primary, href, label },
      elementPath: path,
    })
  }
  const external = primary.external ?? isExternalHref(href)
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      {label}
    </a>
  )
}

export type Cta01Props = {
  headline: RtRoot
  description?: RtRoot | null
  primary?: LinkRef | null
  blockIndex: number
  editSlots?: BlockEditSlots
  rootAttributes?: RendererSectionAttributes
}

export function Cta01({ headline, description, primary, blockIndex, editSlots, rootAttributes }: Cta01Props) {
  const primaryAction = renderPrimary(editSlots, primary ?? {}, blockIndex)

  return (
    <div className="px-0 py-20 sm:px-6" {...rootAttributes}>
      <div className="relative flex w-full flex-col items-center justify-center py-16">
        <h2 className="font-medium text-5xl tracking-tighter">
          {renderInlineRichText(editSlots, "headline", headline, blockIndex)}
        </h2>
        {description ? (
          <p className="mx-auto mt-6 max-w-xl text-center text-muted-foreground text-xl/normal">
            {renderInlineRichText(editSlots, "description", description, blockIndex)}
          </p>
        ) : null}
        {primaryAction ? (
          <Button className="mt-8" asChild>
            {primaryAction}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default function Cta01Literal() {
  return (
    <Cta01
      headline={PREVIEW_HEADLINE}
      description={PREVIEW_DESCRIPTION}
      primary={PREVIEW_PRIMARY}
      blockIndex={0}
    />
  )
}
